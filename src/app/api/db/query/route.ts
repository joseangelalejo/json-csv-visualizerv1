import { NextRequest, NextResponse } from 'next/server'
import sqlite3 from 'sqlite3'
import { Client } from 'pg'
import mysql from 'mysql2/promise'
import { MongoClient } from 'mongodb'
import mssql from 'mssql'
import fs from 'fs'
import path from 'path'
import { requireAuth } from '@/lib/auth'
import { logger } from '@/lib/logger'

// Simple in-memory cache for database-list queries (TTL short-lived)
const dbListCache: Record<string, { ts: number; data: any[] }> = {}
const DB_LIST_TTL = 30 * 1000 // 30 seconds

import { Parser } from 'node-sql-parser'
const sqlParser = new Parser()

// Simple SQL splitter (fallback) that ignores semicolons inside quotes and comments
function splitSqlStatements(sql: string): string[] {
  const stmts: string[] = []
  let current = ''
  let inSingle = false
  let inDouble = false
  let inBacktick = false
  let inLineComment = false
  let inBlockComment = false

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]
    const next = sql[i + 1]

    if (inLineComment) {
      if (ch === '\n') { inLineComment = false; current += ch; continue }
      current += ch; continue
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') { inBlockComment = false; current += '*/'; i++; continue }
      current += ch; continue
    }

    if (!inSingle && !inDouble && !inBacktick && ch === '-' && next === '-') { inLineComment = true; current += '--'; i++; continue }
    if (!inSingle && !inDouble && !inBacktick && ch === '/' && next === '*') { inBlockComment = true; current += '/*'; i++; continue }

    if (ch === "'" && !inDouble && !inBacktick) { inSingle = !inSingle; current += ch; continue }
    if (ch === '"' && !inSingle && !inBacktick) { inDouble = !inDouble; current += ch; continue }
    if (ch === '`' && !inSingle && !inDouble) { inBacktick = !inBacktick; current += ch; continue }

    if (ch === ';' && !inSingle && !inDouble && !inBacktick && !inLineComment && !inBlockComment) {
      const t = current.trim()
      if (t) stmts.push(t)
      current = ''
      continue
    }

    current += ch
  }
  const last = current.trim()
  if (last) stmts.push(last)
  return stmts
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication for database operations
    const user = requireAuth(request)

    const { query, dbType, connectionString, config } = await request.json()

    // Basic validation
    if (!query || typeof query !== 'string' || query.length > 10000) {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 })
    }

    if (!dbType || !['sqlite', 'postgres', 'mysql', 'mongodb', 'mssql'].includes(dbType)) {
      return NextResponse.json({ error: 'Invalid database type' }, { status: 400 })
    }

    try {
      let data: any = null
      let dbConn: any = null

      // Prefer a dedicated SQL parser to split/validate statements; fallback to splitter
      let statements: string[] = []
      try {
        const ast = sqlParser.astify(query, { database: dbType === 'postgres' ? 'Postgres' : 'MySQL' })
        if (Array.isArray(ast)) statements = ast.map((a: any) => sqlParser.sqlify(a))
        else statements = [sqlParser.sqlify(ast)]
      } catch (err) {
        // If parsing fails, fallback to our simpler splitter
        statements = splitSqlStatements(query)
      }

      // === Special-case: database-listing queries (cacheable) ===
      const listQueryTargets = [/SHOW\s+DATABASES/i, /pg_database/i, /__LIST_DATABASES__/i, /sys\.databases/i]
      const isListQuery = listQueryTargets.some(rx => rx.test(query))
      // Include user role in the cache key so admin/non-admin lists are cached separately
      const cacheKey = `${user.role}::${dbType}::${connectionString || JSON.stringify(config || {})}`

      if (isListQuery && dbListCache[cacheKey] && (Date.now() - dbListCache[cacheKey].ts) < DB_LIST_TTL) {
        return NextResponse.json({ data: dbListCache[cacheKey].data || [] })
      }

      if (dbType === 'sqlite') {
        // For SQLite, ensure it's a local file path and prevent path traversal
        if (!connectionString.startsWith('./') && !connectionString.startsWith('/tmp/')) {
          return NextResponse.json({ error: 'Invalid SQLite path. Use ./path/to/database.db' }, { status: 400 })
        }

        // Prevent path traversal attacks
        if (connectionString.includes('..') || connectionString.includes('../') || /[\r\n]/.test(connectionString)) {
          return NextResponse.json({ error: 'Invalid characters in SQLite path' }, { status: 400 })
        }

        // Resolve path to prevent directory traversal
        const resolvedPath = path.resolve(connectionString)
        const allowedPaths = [path.resolve('./'), path.resolve('/tmp/')]

        if (!allowedPaths.some(allowedPath => resolvedPath.startsWith(allowedPath))) {
          return NextResponse.json({ error: 'Access denied to this path' }, { status: 403 })
        }

        if (!fs.existsSync(connectionString)) {
          return NextResponse.json({ error: 'SQLite database file does not exist' }, { status: 400 })
        }

        dbConn = new sqlite3.Database(connectionString)

        // Execute statements sequentially and collect last result rows
        let lastRows: any[] = []
        for (const stmt of statements) {
          const isSelect = /^\s*(SELECT|PRAGMA|WITH|EXPLAIN)\b/i.test(stmt)
          if (isSelect) {
            // all() returns rows
            // wrap in Promise
            lastRows = await new Promise((resolve, reject) => {
              dbConn.all(stmt, (err: any, rows: any) => {
                if (err) reject(err)
                else resolve(rows)
              })
            })
          } else {
            // run() for non-select statements
            await new Promise((resolve, reject) => {
              dbConn.run(stmt, function (this: any, err: any) {
                if (err) reject(err)
                else resolve({ lastID: this.lastID, changes: this.changes })
              })
            })
          }
        }
        data = lastRows
        dbConn.close()

      } else if (dbType === 'postgres') {
        dbConn = new Client({ connectionString })
        await dbConn.connect()
        // Execute multiple statements sequentially and return rows from the last SELECT
        let lastRows: any[] = []
        for (const stmt of statements) {
          const res = await dbConn.query(stmt)
          if (res && res.rows) lastRows = res.rows
        }
        data = lastRows
        await dbConn.end()

      } else if (dbType === 'mysql') {
        // Validate config for MySQL: host/user required; database is optional for server-level queries
        if (!config || typeof config !== 'object') {
          return NextResponse.json({ error: 'Invalid MySQL config. Provide host and user' }, { status: 400 })
        }
        if (!config.host || !config.user) {
          return NextResponse.json({ error: 'MySQL config missing required fields: host, user' }, { status: 400 })
        }

        // Creating a connection without `database` is valid for queries like SHOW DATABASES
        dbConn = await mysql.createConnection(config)

        // Execute sequentially; use `query()` so session-changing commands (USE) work
        let lastRows: any[] = []
        for (const stmt of statements) {
          const trimmed = stmt.trim()
          if (/^\s*USE\b/i.test(trimmed)) {
            await dbConn.query(trimmed)
            // no result rows for USE
            continue
          }
          const [rows] = await dbConn.query(trimmed)
          if (Array.isArray(rows)) lastRows = rows
        }
        data = lastRows
        await dbConn.end()
      } else if (dbType === 'mongodb') {
        // Support a dedicated list-databases token
        dbConn = new MongoClient(connectionString)
        await dbConn.connect()
        const admin = dbConn.db().admin()
        if (/__LIST_DATABASES__/.test(query)) {
          const list = await admin.listDatabases()
          data = (list.databases || []).map((d: any) => ({ name: d.name }))
        } else {
          const db = dbConn.db()
          const collection = db.collection(query.split(' ')[1] || '') // Simple parsing for demo
          data = await collection.find({}).limit(100).toArray()
        }
        await dbConn.close()

      } else if (dbType === 'mssql') {
        // MSSQL basic handling (LIST + general queries)
        const pool = await mssql.connect(connectionString || config)
        let lastRows: any[] = []
        for (const stmt of statements) {
          const result = await pool.request().query(stmt)
          if (result && result.recordset) lastRows = result.recordset
        }
        data = lastRows
        await pool.close()
      }

      // If this was a DB-listing query, remove server-internal DBs for non-admin users
      if (isListQuery && user.role !== 'admin') {
        const forbidden = new Set(['information_schema', 'mysql', 'performance_schema'])
        data = (data || []).filter((row: any) => {
          const name = String(row?.name ?? row?.datname ?? row?.NAME ?? Object.values(row)[0] ?? '').toLowerCase()
          return !forbidden.has(name)
        })
      }

      // Store list responses in cache (role included in cacheKey)
      if (isListQuery) {
        dbListCache[cacheKey] = { ts: Date.now(), data: data || [] }
      }

      return NextResponse.json({ data: data || [] })
    } catch (error: any) {
      console.error('Query error:', error)
      return NextResponse.json({ error: `Failed to execute query: ${error.message}` }, { status: 500 })
    }
  } catch (error: any) {
    logger.error('Database query request failed', { error: error.message })
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
}