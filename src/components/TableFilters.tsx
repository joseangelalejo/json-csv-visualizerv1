/**
 * Componente TableFilters - Filtros y Controles de Tabla
 *
 * Panel de controles avanzados para filtrar, ordenar y gestionar
 * datos en tablas interactivas usando TanStack Table.
 *
 * Funcionalidades:
 * - Búsqueda global en todas las columnas
 * - Filtros individuales por columna (texto, número, fecha)
 * - Ordenamiento múltiple con indicadores visuales
 * - Controles de paginación
 * - Selector de filas por página
 * - Estadísticas de resultados filtrados
 * - Botones de exportación (CSV/JSON)
 *
 * Estados de filtro:
 * - Texto: Contiene, comienza con, termina con, igual
 * - Número: Igual, mayor, menor, rango
 * - Fecha: Antes, después, entre fechas
 *
 * @author José Ángel Alejo
 * @version 1.0.0
 */

'use client'

import React, { useState } from 'react'
import { Column, Table } from '@tanstack/react-table'
import ProtectedSelect from './ProtectedSelect'

interface DataRow {
  [key: string]: string | number
}

interface TableFiltersProps {
  table: Table<DataRow>
  globalFilter: string
  setGlobalFilter: (value: string) => void
  data: DataRow[]
  onExportCSV?: () => void
  onExportJSON?: () => void
}

/**
 * Componente principal de filtros de tabla
 */
export default function TableFilters({
  table,
  globalFilter,
  setGlobalFilter,
  data,
  onExportCSV,
  onExportJSON
}: TableFiltersProps) {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [columnFilters, setColumnFilters] = useState<{ [key: string]: any }>({})

  /**
   * Aplica un filtro a una columna específica
   */
  const applyColumnFilter = (columnId: string, filterValue: any) => {
    const newFilters = { ...columnFilters, [columnId]: filterValue }
    setColumnFilters(newFilters)

    // Aplicar el filtro a la columna usando TanStack Table
    const column = table.getColumn(columnId)
    if (column) {
      column.setFilterValue(filterValue)
    }
  }

  /**
   * Limpia todos los filtros
   */
  const clearAllFilters = () => {
    setGlobalFilter('')
    setColumnFilters({})
    table.resetColumnFilters()
  }

  /**
   * Obtiene el tipo de dato de una columna basado en los datos
   */
  const getColumnType = (columnId: string): 'text' | 'number' | 'date' => {
    const sampleValue = data.find(row => row[columnId] !== undefined)?.[columnId]

    if (typeof sampleValue === 'number') return 'number'
    if (typeof sampleValue === 'string' && !isNaN(Date.parse(sampleValue))) return 'date'
    return 'text'
  }

  /**
   * Renderiza el input de filtro según el tipo de columna
   */
  const renderColumnFilter = (column: Column<DataRow>) => {
    const columnType = getColumnType(column.id)
    const currentFilter = columnFilters[column.id]

    switch (columnType) {
      case 'number':
        return (
          <div className="space-y-2">
            <ProtectedSelect
              value={currentFilter?.operator || 'equals'}
              onChange={(v) => applyColumnFilter(column.id, { ...currentFilter, operator: v })}
              options={[
                { value: 'equals', label: '=' },
                { value: 'greater', label: '>' },
                { value: 'less', label: '<' },
                { value: 'between', label: 'entre' },
              ]}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              style={{ color: 'var(--foreground)', WebkitTextFillColor: 'var(--foreground)' }}
            />
            <input
              type="number"
              placeholder="Valor"
              value={currentFilter?.value || ''}
              onChange={(e) => applyColumnFilter(column.id, { ...currentFilter, value: e.target.value })}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {currentFilter?.operator === 'between' && (
              <input
                type="number"
                placeholder="Valor máximo"
                value={currentFilter?.value2 || ''}
                onChange={(e) => applyColumnFilter(column.id, { ...currentFilter, value2: e.target.value })}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          </div>
        )

      case 'date':
        return (
          <div className="space-y-2">
            <ProtectedSelect
              value={currentFilter?.operator || 'equals'}
              onChange={(v) => applyColumnFilter(column.id, { ...currentFilter, operator: v })}
              options={[
                { value: 'equals', label: 'igual' },
                { value: 'before', label: 'antes' },
                { value: 'after', label: 'después' },
                { value: 'between', label: 'entre' },
              ]}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              style={{ color: 'var(--foreground)', WebkitTextFillColor: 'var(--foreground)' }}
            />
            <input
              type="date"
              value={currentFilter?.value || ''}
              onChange={(e) => applyColumnFilter(column.id, { ...currentFilter, value: e.target.value })}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {currentFilter?.operator === 'between' && (
              <input
                type="date"
                value={currentFilter?.value2 || ''}
                onChange={(e) => applyColumnFilter(column.id, { ...currentFilter, value2: e.target.value })}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          </div>
        )

      default: // text
        return (
          <div className="space-y-2">
            <ProtectedSelect
              value={currentFilter?.operator || 'contains'}
              onChange={(v) => applyColumnFilter(column.id, { ...currentFilter, operator: v })}
              options={[
                { value: 'contains', label: 'contiene' },
                { value: 'startsWith', label: 'comienza con' },
                { value: 'endsWith', label: 'termina con' },
                { value: 'equals', label: 'igual' },
              ]}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              style={{ color: 'var(--foreground)', WebkitTextFillColor: 'var(--foreground)' }}
            />
            <input
              type="text"
              placeholder="Buscar..."
              value={currentFilter?.value || ''}
              onChange={(e) => applyColumnFilter(column.id, { ...currentFilter, value: e.target.value })}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
      {/* Header con título y toggle de filtros avanzados */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          🔍 Controles de Tabla
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            {table.getFilteredRowModel().rows.length} de {data.length} filas
          </span>
        </h3>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="text-xs px-3 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
          >
            {showAdvancedFilters ? 'Ocultar' : 'Mostrar'} Filtros
          </button>

          <button
            onClick={clearAllFilters}
            className="text-xs px-3 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* Búsqueda global */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Búsqueda Global
        </label>
        <input
          type="text"
          placeholder="Buscar en todas las columnas..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Filtros avanzados */}
      {showAdvancedFilters && (
        <div className="mb-4">
          <h4 className="text-xs font-medium text-gray-600 mb-2">Filtros por Columna</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {table.getAllColumns()
              .filter(column => column.getCanFilter())
              .map(column => (
                <div key={column.id} className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600">
                    {column.id}
                  </label>
                  {renderColumnFilter(column)}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Controles de paginación y exportación */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div className="flex items-center gap-4">
          {/* Selector de filas por página */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">Mostrar:</span>
            <ProtectedSelect
              value={String(table.getState().pagination.pageSize)}
              onChange={(v) => table.setPageSize(Number(v))}
              options={[{ value: '10', label: '10' }, { value: '25', label: '25' }, { value: '50', label: '50' }, { value: '100', label: '100' }]}
              className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
              style={{ color: 'var(--foreground)', WebkitTextFillColor: 'var(--foreground)' }}
            />
            <span className="text-xs text-gray-600">filas</span>
          </div>

          {/* Info de paginación */}
          <span className="text-xs text-gray-600">
            Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Controles de paginación */}
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
          >
            ← Anterior
          </button>

          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
          >
            Siguiente →
          </button>

          {/* Botones de exportación */}
          {onExportCSV && (
            <button
              onClick={onExportCSV}
              className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
            >
              📊 CSV
            </button>
          )}

          {onExportJSON && (
            <button
              onClick={onExportJSON}
              className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
            >
              📄 JSON
            </button>
          )}
        </div>
      </div>
    </div>
  )
}