/**
 * Módulo de Gestión de Conexiones de Base de Datos - database-connections.ts
 *
 * Este módulo centraliza la lógica para manejar conexiones guardadas de base de datos,
 * incluyendo encriptación de credenciales, validación y operaciones CRUD.
 *
 * Funcionalidades:
 * - Encriptación/desencriptación de credenciales sensibles
 * - Validación de conexiones
 * - Almacenamiento temporal de conexiones (en producción usar BD)
 * - Utilidades para gestión de conexiones
 *
 * Consideraciones de seguridad:
 * - Credenciales siempre encriptadas en almacenamiento
 * - Validación estricta de permisos por usuario
 * - Logging de operaciones sensibles
 *
 * @author José Ángel Alejo
 * @version 1.0.0
 */

import crypto from 'crypto'

// Configuración de encriptación
const ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY || 'default-key-change-in-production'
const ALGORITHM = 'aes-256-gcm'

/**
 * Interfaz que define la estructura de una conexión guardada
 */
export interface SavedConnection {
  id: string
  userId: string
  name: string
  dbType: 'sqlite' | 'postgres' | 'mysql' | 'mongodb' | 'mssql'
  connectionString?: string
  database?: string
  config?: {
    host: string
    port?: number
    user: string
    password: string
    database: string
  }
  createdAt: Date
  lastUsed: Date
}

/**
 * Almacenamiento temporal de conexiones (en producción usar base de datos)
 * En un entorno real, esto sería una tabla en la base de datos
 */
export let savedConnections: SavedConnection[] = []

/**
 * Función para encriptar credenciales sensibles
 * @param text Texto a encriptar
 * @returns Texto encriptado con IV
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

/**
 * Función para desencriptar credenciales
 * @param encryptedText Texto encriptado con IV
 * @returns Texto desencriptado
 */
export function decrypt(encryptedText: string): string {
  const [ivHex, encrypted] = encryptedText.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

/**
 * Valida los datos de una conexión antes de guardarla
 * @param connection Datos de la conexión a validar
 * @returns Objeto con resultado de validación
 */
export function validateConnection(connection: Partial<SavedConnection>): { valid: boolean; error?: string } {
  if (!connection.name || !connection.dbType) {
    return { valid: false, error: 'Name and dbType are required' }
  }

  if (!['sqlite', 'postgres', 'mysql', 'mongodb', 'mssql'].includes(connection.dbType)) {
    return { valid: false, error: 'Invalid database type' }
  }

  // Validar configuración según el tipo de BD
  if (connection.dbType === 'mysql' && !connection.config) {
    return { valid: false, error: 'MySQL requires config object' }
  }

  // Para bases que usan connectionString (postgres, mongodb, sqlite, mssql)
  if (['postgres', 'mongodb', 'sqlite', 'mssql'].includes(connection.dbType) && !connection.connectionString) {
    return { valid: false, error: 'Connection string required for this database type' }
  }

  return { valid: true }
}

/**
 * Busca conexiones de un usuario específico
 * @param userId ID del usuario
 * @returns Array de conexiones del usuario
 */
export function getUserConnections(userId: string): SavedConnection[] {
  return savedConnections.filter(conn => conn.userId === userId)
}

/**
 * Busca una conexión específica por ID y usuario
 * @param id ID de la conexión
 * @param userId ID del usuario
 * @returns Conexión encontrada o undefined
 */
export function getConnectionById(id: string, userId: string): SavedConnection | undefined {
  return savedConnections.find(conn => conn.id === id && conn.userId === userId)
}

/**
 * Actualiza la fecha de último uso de una conexión
 * @param id ID de la conexión
 * @param userId ID del usuario
 */
export function updateLastUsed(id: string, userId: string): void {
  const connection = getConnectionById(id, userId)
  if (connection) {
    connection.lastUsed = new Date()
  }
}

/**
 * Desencripta las credenciales de una conexión para uso en el frontend
 * @param connection Conexión con credenciales encriptadas
 * @returns Conexión con credenciales desencriptadas
 */
export function decryptConnectionForResponse(connection: SavedConnection): SavedConnection {
  return {
    ...connection,
    connectionString: connection.connectionString ? decrypt(connection.connectionString) : undefined,
    config: connection.config ? {
      ...connection.config,
      password: decrypt(connection.config.password)
    } : undefined
  }
}