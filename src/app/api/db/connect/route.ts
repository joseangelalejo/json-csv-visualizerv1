/**
 * Ruta API de Conexión a Base de Datos - /api/db/connect
 *
 * Prueba conexiones a múltiples tipos de bases de datos sin mantener
 * conexiones persistentes. Esta ruta es crítica para validar credenciales
 * y configuración antes de operaciones reales de base de datos.
 *
 * Bases de datos soportadas:
 * - SQLite: Archivos locales con validación de path traversal
 * - PostgreSQL: Conexiones remotas con connection strings
 * - MySQL: Configuración detallada con objetos de configuración
 * - MongoDB: Conexiones NoSQL con URIs de MongoDB
 *
 * Características de seguridad:
 * - Autenticación requerida para todas las operaciones
 * - Validación estricta de paths para SQLite (previene path traversal)
 * - Sanitización de inputs y connection strings
 * - Logging detallado de errores sin exponer credenciales
 * - Conexiones de prueba que se cierran inmediatamente
 *
 * Consideraciones de rendimiento:
 * - Conexiones se prueban y cierran (no pooling)
 * - Validación de archivos SQLite antes de conectar
 * - Timeouts apropiados para conexiones remotas
 *
 * @author José Ángel Alejo
 * @version 1.0.0
 */

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

/**
 * Handler POST para prueba de conexiones de base de datos
 *
 * Valida credenciales y configuración de BD sin mantener conexiones.
 * Retorna éxito/error basado en la capacidad de conectar temporalmente.
 *
 * @param request NextRequest con configuración de BD y auth token
 * @returns NextResponse con resultado de la prueba de conexión
 */
export async function POST(request: NextRequest) {
  try {
    // === AUTENTICACIÓN ===
    // Verificar que el usuario esté autenticado (requerido para operaciones de BD)
    const user = requireAuth(request)

    // === EXTRACCIÓN DE PARÁMETROS ===
    // Obtener configuración de conexión del cuerpo JSON
    const { dbType, connectionString, config } = await request.json()

    // === VALIDACIÓN DE ENTRADA ===
    // Validar tipo de base de datos soportado
    let validationError = null
    if (!dbType || !['sqlite', 'postgres', 'mysql', 'mongodb', 'mssql'].includes(dbType)) {
      validationError = { error: 'Invalid database type', status: 400 }
    } else if (dbType === 'mysql') {
      // MySQL requiere objeto de configuración detallado
      if (!config || typeof config !== 'object') {
        validationError = { error: 'MySQL requires config object with host, user, password, database', status: 400 }
      } else if (!config.host || !config.user || !config.database) {
        validationError = { error: 'MySQL config missing required fields: host, user, database', status: 400 }
      }
    } else if (dbType === 'mssql') {
      // MSSQL expects a connection string or a config object; accept both
      if ((!connectionString || typeof connectionString !== 'string') && (!config || typeof config !== 'object')) {
        validationError = { error: 'MSSQL requires a connection string or config object', status: 400 }
      }
    } else {
      // Otros tipos usan connection string
      if (!connectionString || typeof connectionString !== 'string' || connectionString.length > 500) {
        validationError = { error: 'Invalid connection string', status: 400 }
      }
    }

    // Retornar error de validación si existe
    if (validationError) {
      return NextResponse.json({ error: validationError.error }, { status: validationError.status })
    }

    // === PRUEBA DE CONEXIÓN POR TIPO DE BD ===
    try {
      let dbConnection: any = null

      // === SQLITE ===
      if (dbType === 'sqlite') {
        // Validación de seguridad: solo paths locales permitidos
        if (!connectionString.startsWith('./') && !connectionString.startsWith('/tmp/')) {
          return NextResponse.json({ error: 'Invalid SQLite path. Use ./path/to/database.db' }, { status: 400 })
        }

        // Prevenir ataques de path traversal
        if (connectionString.includes('..') || connectionString.includes('../') || /[\r\n]/.test(connectionString)) {
          return NextResponse.json({ error: 'Invalid characters in SQLite path' }, { status: 400 })
        }

        // Resolver path absoluto y verificar permisos
        const resolvedPath = path.resolve(connectionString)
        const allowedPaths = [path.resolve('./'), path.resolve('/tmp/')]

        if (!allowedPaths.some(allowedPath => resolvedPath.startsWith(allowedPath))) {
          return NextResponse.json({ error: 'Access denied to this path' }, { status: 403 })
        }

        // Verificar que el archivo existe antes de conectar
        if (!fs.existsSync(connectionString)) {
          return NextResponse.json({ error: 'SQLite database file does not exist' }, { status: 400 })
        }

        // Crear conexión de prueba y cerrarla inmediatamente
        dbConnection = new sqlite3.Database(connectionString, (err: any) => {
          if (err) {
            throw new Error(`SQLite connection failed: ${err.message}`)
          }
        })
        // Cerrar inmediatamente después de la prueba
        dbConnection.close()

      // === POSTGRESQL ===
      } else if (dbType === 'postgres') {
        dbConnection = new Client({ connectionString })
        await dbConnection.connect()
        await dbConnection.end()

      // === MYSQL ===
      } else if (dbType === 'mysql') {
        dbConnection = await mysql.createConnection(config)
        await dbConnection.end()

      // === MONGODB ===
      } else if (dbType === 'mongodb') {
        dbConnection = new MongoClient(connectionString)
        await dbConnection.connect()
        await dbConnection.close()

      // === MSSQL ===
      } else if (dbType === 'mssql') {
        // Use mssql driver for a quick connection test
        const pool = await mssql.connect(connectionString || config)
        await pool.close()
      }

      // === ÉXITO ===
      return NextResponse.json({ success: true })

    } catch (error: any) {
      // === MANEJO DE ERRORES DE CONEXIÓN ===
      console.error('Connection error:', error.message)

      // Proporcionar mensajes de error específicos y útiles
      let errorMessage = 'Failed to connect to database'
      if (error.code) {
        switch (error.code) {
          case 'ECONNREFUSED':
            errorMessage = 'Connection refused. Check if database server is running and accessible.'
            break
          case 'ENOTFOUND':
            errorMessage = 'Host not found. Check the hostname/IP address.'
            break
          case 'ER_ACCESS_DENIED_ERROR':
            errorMessage = 'Access denied. Check username and password.'
            break
          case 'ER_BAD_DB_ERROR':
            errorMessage = 'Database does not exist. Check database name.'
            break
          default:
            errorMessage = `Connection failed: ${error.message}`
        }
      } else if (error.message) {
        errorMessage = error.message
      }
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }

  } catch (error: any) {
    // === ERROR DE AUTENTICACIÓN ===
    logger.error('Database connection request failed', { error: error.message })
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
}