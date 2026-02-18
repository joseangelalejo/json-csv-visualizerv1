/**
 * API de Conexión Individual - /api/db/connections/[id]
 *
 * Maneja operaciones CRUD para conexiones individuales de base de datos.
 * Permite actualizar, eliminar y recuperar conexiones específicas por ID.
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
  getConnectionById,
  updateLastUsed,
  decryptConnectionForResponse
} from '@/lib/database-connections'
import crypto from 'crypto'

/**
 * GET /api/db/connections/[id]
 * Recupera una conexión específica por ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuth(request)
    const { id } = await params

    // Buscar la conexión
    const connection = getConnectionById(id, user.id)

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    // Desencriptar credenciales para la respuesta
    const responseConnection = decryptConnectionForResponse(connection)

    logger.info(`Retrieved connection: ${connection.name}`, {
      userId: user.id
    })

    return NextResponse.json({ connection: responseConnection })

  } catch (error) {
    logger.error('Failed to retrieve connection', { error: (error as Error).message })
    return NextResponse.json({ error: 'Failed to retrieve connection' }, { status: 500 })
  }
}

/**
 * PUT /api/db/connections/[id]
 * Actualiza una conexión existente
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuth(request)
    const { id } = await params
    const { name, dbType, connectionString, config, database } = await request.json()

    // Buscar la conexión existente
    const connectionIndex = savedConnections.findIndex(
      conn => conn.id === id && conn.userId === user.id
    )

    if (connectionIndex === -1) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    // Validar los nuevos datos si se proporcionan
    if (name !== undefined || dbType !== undefined || connectionString !== undefined || config !== undefined) {
      const validation = validateConnection({ name, dbType, connectionString, config })
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 })
      }
    }

    // Actualizar la conexión
    const existingConnection = savedConnections[connectionIndex]
    const updatedConnection = {
      ...existingConnection,
      ...(name !== undefined && { name }),
      ...(dbType !== undefined && { dbType }),
      ...(connectionString !== undefined && {
        connectionString: connectionString || undefined
      }),
      ...(config !== undefined && {
        config: config || undefined
      }),
      ...(database !== undefined && { database: database || undefined }),
      lastUsed: new Date()
    }

    savedConnections[connectionIndex] = updatedConnection

    logger.info(`Updated connection: ${updatedConnection.name}`, {
      userId: user.id
    })

    return NextResponse.json({ connection: updatedConnection })

  } catch (error) {
    logger.error('Failed to update connection', { error: (error as Error).message })
    return NextResponse.json({ error: 'Failed to update connection' }, { status: 500 })
  }
}

/**
 * DELETE /api/db/connections/[id]
 * Elimina una conexión guardada
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuth(request)
    const { id } = await params

    // Buscar la conexión
    const connectionIndex = savedConnections.findIndex(
      conn => conn.id === id && conn.userId === user.id
    )

    if (connectionIndex === -1) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    const deletedConnection = savedConnections[connectionIndex]

    // Eliminar la conexión
    savedConnections.splice(connectionIndex, 1)

    logger.info(`Deleted connection: ${deletedConnection.name}`, {
      userId: user.id
    })

    return NextResponse.json({ message: 'Connection deleted successfully' })

  } catch (error) {
    logger.error('Failed to delete connection', { error: (error as Error).message })
    return NextResponse.json({ error: 'Failed to delete connection' }, { status: 500 })
  }
}