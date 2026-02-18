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

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request)
    const { dbType, connectionString, config } = await request.json()

    if (!dbType || !['sqlite', 'postgres', 'mysql', 'mongodb', 'mssql'].includes(dbType)) {
      return NextResponse.json({ error: 'Invalid database type' }, { status: 400 })
    }

    try {
      const databases: { name: string }[] = []

      if (dbType === 'sqlite') {
        // For SQLite return the file path as the single "database" entry (if valid)
        if (!connectionString || typeof connectionString !== 'string') {
          return NextResponse.json({ databases: [] })
        }
        // small safety checks
        if (connectionString.includes('..') || /[\r\n]/.test(connectionString)) {
          return NextResponse.json({ databases: [] })
        }
        const resolvedPath = path.resolve(connectionString)
        const allowedPaths = [path.resolve('./'), path.resolve('/tmp/')]
        if (!allowedPaths.some(allowedPath => resolvedPath.startsWith(allowedPath))) {
          return NextResponse.json({ databases: [] })
        }
        if (fs.existsSync(connectionString)) {
          databases.push({ name: connectionString })
        }
      } else if (dbType === 'postgres') {
        const client = new Client({ connectionString })
        await client.connect()
        const res = await client.query("SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname")
        res.rows.forEach((r: any) => databases.push({ name: r.datname }))
        await client.end()
      } else if (dbType === 'mysql') {
        const conn = await (config ? mysql.createConnection(config) : mysql.createConnection(connectionString))
        const [rows] = await conn.query('SHOW DATABASES')
        ;(rows as any[]).forEach(r => {
          const name = Object.values(r)[0]
          databases.push({ name: String(name) })
        })
        await conn.end()
      } else if (dbType === 'mongodb') {
        const client = new MongoClient(connectionString)
        await client.connect()
        const admin = client.db().admin()
        const list: any = await admin.listDatabases()
        ;(list.databases || []).forEach((d: any) => databases.push({ name: d.name }))
        await client.close()
      } else if (dbType === 'mssql') {
        const pool = await mssql.connect(connectionString || config)
        const result = await pool.request().query('SELECT name FROM sys.databases ORDER BY name')
        ;(result.recordset || []).forEach((r: any) => databases.push({ name: r.name }))
        await pool.close()
      }

      // Exclude common system DBs before returning
      const blacklist = new Set(['information_schema','mysql','performance_schema','sys'])
      const filtered = databases.filter(d => !blacklist.has(String(d.name).toLowerCase()))
      return NextResponse.json({ databases: filtered })
    } catch (err: any) {
      logger.error('Failed to list databases', { error: err?.message })
      return NextResponse.json({ error: 'Failed to list databases' }, { status: 500 })
    }
  } catch (err: any) {
    logger.error('Databases request failed', { error: err?.message })
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
}
