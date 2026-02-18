/**
 * Módulo de Conexión a Bases de Datos - database.ts
 *
 * Este módulo gestiona las conexiones a múltiples tipos de bases de datos
 * soportadas por la aplicación JSON/CSV Data Visualizer.
 *
 * Bases de datos soportadas:
 * - SQLite: Base de datos local basada en archivos
 * - PostgreSQL: Base de datos relacional avanzada
 * - MySQL: Base de datos relacional popular
 * - MongoDB: Base de datos NoSQL orientada a documentos
 *
 * Características:
 * - Conexión automática basada en variables de entorno
 * - Manejo robusto de errores con logging
 * - Pool de conexiones para PostgreSQL y MySQL
 * - Soporte para operaciones CRUD básicas
 *
 * Consideraciones de seguridad:
 * - Credenciales obtenidas únicamente de variables de entorno
 * - Logging de errores sin exponer información sensible
 * - Validación de tipos de conexión
 *
 * @author José Ángel Alejo
 * @version 1.0.0
 */

import { logger } from './logger'

/**
 * Interfaz que define la estructura de una conexión a base de datos
 * Unifica el manejo de diferentes tipos de conexiones bajo una interfaz común
 */
export interface DatabaseConnection {
  type: 'sqlite' | 'postgres' | 'mysql' | 'mongodb' | 'mssql'
  connection: any
}

/**
 * Función principal para establecer conexión a base de datos
 * Determina automáticamente qué tipo de base de datos usar basado en variables de entorno
 * Prioridad: SQLite (si existe SQLITE_PATH) -> PostgreSQL -> MySQL -> MongoDB
 *
 * @returns Promise con objeto DatabaseConnection configurado
 * @throws Error si no se puede establecer conexión o no hay configuración válida
 */
export async function connectToDatabase(): Promise<DatabaseConnection> {
  // SQLite (default) - Base de datos local, no requiere servidor
  if (process.env.SQLITE_PATH) {
    try {
      const sqlite3 = require('sqlite3').verbose()
      const db = new sqlite3.Database(process.env.SQLITE_PATH)
      return { type: 'sqlite', connection: db }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown SQLite error'
      logger.error('SQLite connection failed', { error: errorMessage })
      throw error
    }
  }

  // PostgreSQL - Base de datos relacional avanzada con pool de conexiones
  if (process.env.POSTGRES_HOST) {
    try {
      const { Pool } = require('pg')
      const pool = new Pool({
        host: process.env.POSTGRES_HOST,
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DATABASE,
      })
      return { type: 'postgres', connection: pool }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown PostgreSQL error'
      logger.error('PostgreSQL connection failed', { error: errorMessage })
      throw error
    }
  }

  // MySQL - Base de datos relacional popular con pool de conexiones
  if (process.env.MYSQL_HOST) {
    try {
      const mysql = require('mysql2/promise')
      const connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        port: parseInt(process.env.MYSQL_PORT || '3306'),
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
      })
      return { type: 'mysql', connection }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown MySQL error'
      logger.error('MySQL connection failed', { error: errorMessage })
      throw error
    }
  }

  // MongoDB - Base de datos NoSQL orientada a documentos
  if (process.env.MONGODB_URI) {
    try {
      const { MongoClient } = require('mongodb')
      const client = new MongoClient(process.env.MONGODB_URI)
      await client.connect()
      const db = client.db()
      return { type: 'mongodb', connection: db }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown MongoDB error'
      logger.error('MongoDB connection failed', { error: errorMessage })
      throw error
    }
  }

  // MSSQL support (optional, via MSSQL env vars)
  if (process.env.MSSQL_HOST) {
    try {
      const sql = require('mssql')
      const pool = await sql.connect({
        user: process.env.MSSQL_USER,
        password: process.env.MSSQL_PASSWORD,
        server: process.env.MSSQL_HOST,
        port: parseInt(process.env.MSSQL_PORT || '1433'),
        database: process.env.MSSQL_DATABASE,
        options: { encrypt: false }
      })
      return { type: 'mssql', connection: pool }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown MSSQL error'
      logger.error('MSSQL connection failed', { error: errorMessage })
      // continue to fallback
    }
  }

  // Fallback: SQLite en memoria para desarrollo cuando no hay configuración
  const sqlite3 = require('sqlite3').verbose()
  const db = new sqlite3.Database(':memory:')
  return { type: 'sqlite', connection: db }
}

/**
 * Ejecuta una consulta SQL en la base de datos conectada
 * Maneja diferentes tipos de bases de datos con sus APIs específicas
 *
 * @param db Conexión a base de datos establecida
 * @param query Consulta SQL a ejecutar
 * @param params Parámetros para la consulta (previene SQL injection)
 * @returns Promise con los resultados de la consulta
 */
export async function executeQuery(db: DatabaseConnection, query: string, params: any[] = []): Promise<any> {
  try {
    switch (db.type) {
      case 'sqlite':
        // SQLite usa callbacks, convertimos a Promise
        return new Promise((resolve, reject) => {
          db.connection.all(query, params, (err: any, rows: any) => {
            if (err) reject(err)
            else resolve(rows)
          })
        })

      case 'postgres':
        // PostgreSQL con pg library
        const result = await db.connection.query(query, params)
        return result.rows

      case 'mysql':
        // MySQL con mysql2/promise
        const [rows] = await db.connection.execute(query, params)
        return rows

      case 'mongodb':
        // MongoDB - implementación simplificada (solo consultas básicas)
        // En una implementación completa, se necesitaría un parser de queries
        const collection = db.connection.collection('data')
        return await collection.find({}).toArray()

      case 'mssql':
        // MSSQL: execute and return recordset
        const mssqlResult = await db.connection.request().query(query)
        return mssqlResult.recordset

      default:
        throw new Error('Unsupported database type')
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown query error'
    logger.error('Query execution failed', { error: errorMessage, query })
    throw error
  }
}

/**
 * Cierra la conexión a la base de datos de forma segura
 * Libera recursos y conexiones del pool según el tipo de base de datos
 *
 * @param db Conexión a base de datos a cerrar
 */
export async function closeDatabase(db: DatabaseConnection): Promise<void> {
  try {
    switch (db.type) {
      case 'sqlite':
        // SQLite: cerrar conexión directa
        db.connection.close()
        break
      case 'postgres':
        // PostgreSQL: cerrar pool de conexiones
        await db.connection.end()
        break
      case 'mysql':
        // MySQL: cerrar conexión
        await db.connection.end()
        break
      case 'mongodb':
        // MongoDB: cerrar cliente
        await db.connection.client.close()
        break
      case 'mssql':
        // MSSQL: cerrar pool
        await db.connection.close()
        break
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown close error'
    logger.error('Database close failed', { error: errorMessage })
  }
}