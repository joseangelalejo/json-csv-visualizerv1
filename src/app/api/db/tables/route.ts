import { NextRequest, NextResponse } from 'next/server'
import sqlite3 from 'sqlite3'
import { Client } from 'pg'
import mysql from 'mysql2/promise'
import { MongoClient, Db } from 'mongodb'
import mssql from 'mssql'
import fs from 'fs'
import path from 'path'
import { requireAuth } from '@/lib/auth'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    // Require authentication for database operations
    const user = requireAuth(request)

    const { dbType, connectionString, config } = await request.json()

    if (!dbType || !['sqlite', 'postgres', 'mysql', 'mongodb', 'mssql'].includes(dbType)) {
      return NextResponse.json({ error: 'Invalid database type' }, { status: 400 })
    }

    try {
      let tables: string[] = []
      let dbConn: any = null

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
        tables = await new Promise<string[]>((resolve, reject) => {
          dbConn.all("SELECT name FROM sqlite_master WHERE type='table'", (err: any, rows: any[]) => {
            if (err) reject(err)
            else resolve(rows.map(row => row.name))
          })
        })
        dbConn.close()
      } else if (dbType === 'postgres') {
        dbConn = new Client({ connectionString })
        await dbConn.connect()
        const result = await dbConn.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
        tables = result.rows.map((row: any) => row.table_name)
        await dbConn.end()
      } else if (dbType === 'mysql') {
        // Validate config
        if (!config || typeof config !== 'object') {
          return NextResponse.json({ error: 'Invalid MySQL config. Provide host, user, database' }, { status: 400 })
        }
        if (!config.host || !config.user || !config.database) {
          return NextResponse.json({ error: 'MySQL config missing required fields: host, user, database' }, { status: 400 })
        }
        dbConn = await mysql.createConnection(config)
        const [rows] = await dbConn.execute("SHOW TABLES")
        tables = (rows as any[]).map((row: any) => Object.values(row)[0] as string)
        await dbConn.end()
      } else if (dbType === 'mongodb') {
        dbConn = new MongoClient(connectionString)
        await dbConn.connect()
        const db = dbConn.db()
        const collections = await db.collections()
        tables = collections.map((col: any) => col.collectionName)
        await dbConn.close()
      } else if (dbType === 'mssql') {
        // MSSQL: list base tables
        const pool = await mssql.connect(connectionString || config)
        const result = await pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'")
        tables = (result.recordset || []).map((r: any) => r.TABLE_NAME)
        await pool.close()
      }

      return NextResponse.json({ tables })
    } catch (error: any) {
      console.error('Tables error:', error)
      return NextResponse.json({ error: `Failed to get tables: ${error.message}` }, { status: 500 })
    }
  } catch (error: any) {
    logger.error('Database tables request failed', { error: error.message })
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
}