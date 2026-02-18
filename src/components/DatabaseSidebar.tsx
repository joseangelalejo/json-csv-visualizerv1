/**
 * Componente DatabaseSidebar - Menú Lateral de Bases de Datos
 *
 * Panel lateral deslizable que permite gestionar y cambiar entre
 * múltiples conexiones de base de datos guardadas por el usuario.
 *
 * Funcionalidades:
 * - Lista de conexiones guardadas con indicadores de estado
 * - Cambio rápido entre conexiones
 * - Gestión de conexiones (guardar, editar, eliminar)
 * - Indicadores visuales de conexión activa
 * - Animaciones suaves de apertura/cierre
 *
 * Estados:
 * - Conectado: Verde con checkmark
 * - Desconectado: Gris con icono de desconexión
 * - Error: Rojo con icono de error
 *
 * @author José Ángel Alejo
 * @version 1.0.0
 */

'use client'

import React, { useState, useEffect } from 'react'
import { SavedConnection } from '@/lib/database-connections'

interface DatabaseSidebarProps {
  isOpen: boolean
  onClose: () => void
  currentConnection?: SavedConnection | null
  onConnectionSelect: (connection: SavedConnection) => void
  onSaveCurrentConnection: (name: string) => Promise<void> | void
  onConnectionsChange?: (connections: SavedConnection[]) => void
  token: string
}

/**
 * Componente principal del menú lateral de bases de datos
 */
export default function DatabaseSidebar({
  isOpen,
  onClose,
  currentConnection,
  onConnectionSelect,
  onSaveCurrentConnection,
  onConnectionsChange,
  token
}: DatabaseSidebarProps) {
  const [connections, setConnections] = useState<SavedConnection[]>([])
  const [loading, setLoading] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [connectionName, setConnectionName] = useState('')



  // Cargar conexiones guardadas al abrir el sidebar
  useEffect(() => {
    if (isOpen && token) {
      loadConnections()
    }
  }, [isOpen, token])

  /**
   * Carga las conexiones guardadas del usuario
   */
  const loadConnections = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/db/connections', {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        const conns = data.connections || []
        setConnections(conns)
        // Notify parent component (if provided) so it can keep a synchronized copy
        if (onConnectionsChange) onConnectionsChange(conns)
      }
    } catch (error) {
      console.error('Error loading connections:', error)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Guarda la conexión actual con un nombre personalizado
   */
  const handleSaveConnection = async () => {
    if (!connectionName.trim()) return

    try {
      // Llamar al parent para que guarde la conexión usando los datos actuales del formulario
      await onSaveCurrentConnection(connectionName)
      setShowSaveDialog(false)
      setConnectionName('')

      // Recargar la lista de conexiones guardadas para reflejar el nuevo elemento
      await loadConnections()
    } catch (error: any) {
      console.error('Error saving connection:', error)
      alert('Error al guardar la conexión: ' + (error?.message || String(error)))
    }
  }

  /**
   * Elimina una conexión guardada
   */
  const handleDeleteConnection = async (connectionId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta conexión?')) return

    try {
      const response = await fetch(`/api/db/connections/${connectionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.ok) {
        await loadConnections() // Recargar la lista
      }
    } catch (error) {
      console.error('Error deleting connection:', error)
    }
  }

  /**
   * Obtiene el icono correspondiente al tipo de base de datos
   */
  const getDatabaseIcon = (dbType: string) => {
    switch (dbType) {
      case 'sqlite': return '🗄️'
      case 'postgres': return '🐘'
      case 'mysql': return '🦭'
      case 'mongodb': return '🍃'
      case 'mssql': return '🟦'
      default: return '🗃️'
    }
  }

  /**
   * Formatea la fecha para mostrar
   */
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  if (!isOpen) return null

  return (
    <>
      {/* Overlay para cerrar el sidebar */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className={`
        fixed right-0 top-0 h-full w-80 bg-white shadow-2xl z-50
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">
            🗃️ Bases de Datos
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Botón para guardar conexión actual */}
          {currentConnection && (
            <div className="mb-4 space-y-3">
              <div>
                <button
                  onClick={() => setShowSaveDialog(true)}
                  className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                >
                  💾 Guardar Conexión Actual
                </button>
              </div>
            </div>
          )}

          {/* Lista de conexiones */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                Conexiones Guardadas
              </h3>
              <div>
                <button
                  onClick={() => setShowSaveDialog(true)}
                  className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                  title="Guardar conexión actual"
                >
                  💾 Save connection
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Cargando...</p>
              </div>
            ) : connections.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">No hay conexiones guardadas</p>
                <p className="text-xs mt-1">Conecta a una BD y guárdala aquí</p>
              </div>
            ) : (
              connections.map((connection) => (
                <div
                  key={connection.id}
                  className={`
                    p-3 rounded-lg border transition-all cursor-pointer
                    ${currentConnection?.id === connection.id
                      ? 'border-blue-500 bg-blue-50 shadow-md'
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }
                  `}
                  onClick={() => onConnectionSelect(connection)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{getDatabaseIcon(connection.dbType)}</span>
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {connection.name}
                        </h4>
                        {currentConnection?.id === connection.id && (
                          <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full">
                            Activa
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-gray-500 uppercase">
                        {connection.dbType}
                      </p>

                      <p className="text-xs text-gray-400 mt-1">
                        Último uso: {formatDate(connection.lastUsed)}
                      </p>
                    </div>

                    {/* Menú de acciones */}
                    <div className="ml-2 flex flex-col gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteConnection(connection.id)
                        }}
                        className="text-red-400 hover:text-red-600 transition-colors p-1"
                        title="Eliminar conexión"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Diálogo para guardar conexión */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-96 mx-4">
            <h3 className="text-lg font-semibold mb-4">Guardar Conexión</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre de la conexión
              </label>
              <input
                type="text"
                value={connectionName}
                onChange={(e) => setConnectionName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: Mi Base de Datos"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSaveDialog(false)
                  setConnectionName('')
                }}
                className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveConnection}
                disabled={!connectionName.trim()}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}