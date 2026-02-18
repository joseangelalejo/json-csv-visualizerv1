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
      let schema: { name: string; columns: { name: string; type: string }[] }[] = []
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
        const tables = await new Promise<string[]>((resolve, reject) => {
          dbConn.all("SELECT name FROM sqlite_master WHERE type='table'", (err: any, rows: any[]) => {
            if (err) reject(err)
            else resolve(rows.map(row => row.name))
          })
        })

        for (const table of tables) {
          const columns = await new Promise<{ name: string; type: string }[]>((resolve, reject) => {
            dbConn.all(`PRAGMA table_info(${table})`, (err: any, rows: any[]) => {
              if (err) reject(err)
              else resolve(rows.map(row => ({ name: row.name, type: row.type })))
            })
          })
          schema.push({ name: table, columns })
        }
        dbConn.close()
      } else if (dbType === 'postgres') {
        dbConn = new Client({ connectionString })
        await dbConn.connect()
        const result = await dbConn.query(`
          SELECT table_name, column_name, data_type
          FROM information_schema.columns
          WHERE table_schema = 'public'
          ORDER BY table_name, ordinal_position
        `)
        const tableMap: { [key: string]: { name: string; type: string }[] } = {}
        result.rows.forEach((row: any) => {
          if (!tableMap[row.table_name]) tableMap[row.table_name] = []
          tableMap[row.table_name].push({ name: row.column_name, type: row.data_type })
        })
        schema = Object.entries(tableMap).map(([name, columns]) => ({ name, columns }))
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
        const [tableRows] = await dbConn.execute("SHOW TABLES")
        const tables = (tableRows as any[]).map((row: any) => Object.values(row)[0])

        for (const table of tables) {
          const [columnRows] = await dbConn.execute(`DESCRIBE ${table}`)
          const columns = (columnRows as any[]).map((row: any) => ({ name: row.Field, type: row.Type }))
          schema.push({ name: table as string, columns })
        }
        await dbConn.end()
      } else if (dbType === 'mongodb') {
        dbConn = new MongoClient(connectionString)
        await dbConn.connect()
        const db = dbConn.db()
        const collections = await db.collections()
        for (const collection of collections) {
          const sampleDoc = await collection.findOne({})
          const columns = sampleDoc ? Object.keys(sampleDoc).map(key => ({ name: key, type: typeof sampleDoc[key] })) : []
          schema.push({ name: collection.collectionName, columns })
        }
        await dbConn.close()
      } else if (dbType === 'mssql') {
        const pool = await mssql.connect(connectionString || config)
        const result = await pool.request().query(`
          SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
          FROM INFORMATION_SCHEMA.COLUMNS
          ORDER BY TABLE_NAME, ORDINAL_POSITION
        `)
        const tableMap: { [key: string]: { name: string; type: string }[] } = {}
        ;(result.recordset || []).forEach((row: any) => {
          if (!tableMap[row.TABLE_NAME]) tableMap[row.TABLE_NAME] = []
          tableMap[row.TABLE_NAME].push({ name: row.COLUMN_NAME, type: row.DATA_TYPE })
        })
        schema = Object.entries(tableMap).map(([name, columns]) => ({ name, columns }))
        await pool.close()
      }

      return NextResponse.json({ schema })
    } catch (error: any) {
      console.error('Schema error:', error)
      return NextResponse.json({ error: `Failed to get schema: ${error.message}` }, { status: 500 })
    }
  } catch (error: any) {
    logger.error('Database schema request failed', { error: error.message })
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
}