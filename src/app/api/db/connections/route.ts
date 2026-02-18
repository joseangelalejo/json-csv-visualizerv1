/**
 * API de Conexiones Guardadas - /api/db/connections
 *
 * Esta API permite a los usuarios guardar, recuperar, actualizar y eliminar
 * conexiones de base de datos para acceso rápido y gestión centralizada.
 *
 * Funcionalidades:
 * - Guardar conexiones de BD con credenciales encriptadas
 * - Recuperar lista de conexiones por usuario
 * - Actualizar conexiones existentes
 * - Eliminar conexiones guardadas
 * - Validación de permisos por usuario
 *
 * Consideraciones de seguridad:
 * - Credenciales encriptadas en la base de datos
 * - Solo el propietario puede acceder a sus conexiones
 * - Validación de entrada estricta
 * - Logging de operaciones sensibles
 *
 * @author José Ángel Alejo
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { logger } from '@/lib/logger'
import {
  savedConnections,
  validateConnection,
  getUserConnections,
  decryptConnectionForResponse
} from '@/lib/database-connections'
import crypto from 'crypto'

/**
 * GET /api/db/connections
 * Recupera todas las conexiones guardadas del usuario autenticado
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const user = requireAuth(request)

    // Obtener conexiones del usuario y desencriptar credenciales
    const userConnections = getUserConnections(user.id).map(decryptConnectionForResponse)

    logger.info(`Retrieved ${userConnections.length} saved connections for user: ${user.username}`, {
      userId: user.id
    })

    return NextResponse.json({ connections: userConnections })

  } catch (error) {
    logger.error('Failed to retrieve saved connections', { error: (error as Error).message })
    return NextResponse.json({ error: 'Failed to retrieve connections' }, { status: 500 })
  }
}

/**
 * POST /api/db/connections
 * Guarda una nueva conexión de base de datos
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const user = requireAuth(request)

    const { name, dbType, connectionString, config } = await request.json()

    // Crear objeto de conexión para validación
    const connectionData = { name, dbType, connectionString, config }

    // Validar la conexión
    const validation = validateConnection(connectionData)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Verificar que no exista una conexión con el mismo nombre
    const existingConnection = savedConnections.find(
      conn => conn.userId === user.id && conn.name === name
    )

    if (existingConnection) {
      return NextResponse.json({ error: 'Connection with this name already exists' }, { status: 409 })
    }

    // Crear nueva conexión
    const newConnection = {
      id: crypto.randomUUID(),
      userId: user.id,
      name,
      dbType,
      connectionString: connectionString || undefined,
      config: config || undefined,
      createdAt: new Date(),
      lastUsed: new Date()
    }

    // Guardar en el almacenamiento (esto encripta automáticamente en el módulo)
    savedConnections.push(newConnection)

    logger.info(`Saved new database connection: ${name}`, {
      userId: user.id
    })

    return NextResponse.json({ connection: newConnection }, { status: 201 })

  } catch (error) {
    logger.error('Failed to save database connection', { error: (error as Error).message })
    return NextResponse.json({ error: 'Failed to save connection' }, { status: 500 })
  }
}