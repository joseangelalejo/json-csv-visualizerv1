'use client'

/**
 * FileUploader — Subida, parseo y visualización de archivos JSON/CSV.
 * Extraído de page.tsx para mantener el componente principal limpio.
 */

import React, { useState } from 'react'
import Papa from 'papaparse'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  useReactTable, getCoreRowModel, getPaginationRowModel,
  getFilteredRowModel, flexRender, ColumnDef,
} from '@tanstack/react-table'
import { Upload, Table2, BarChart2, ChevronLeft, ChevronRight } from 'lucide-react'
import ProtectedSelect from './ProtectedSelect'

interface DataRow {
  [key: string]: string | number
}

export default function FileUploader() {
  const [data, setData] = useState<DataRow[]>([])
  const [columns, setColumns] = useState<ColumnDef<DataRow>[]>([])
  const [chartData, setChartData] = useState<{ name: string; value: number }[]>([])
  const [chartColumn, setChartColumn] = useState<string>('')
  const [globalFilter, setGlobalFilter] = useState('')
  const [fileName, setFileName] = useState('')

  // ── Parseo de archivos ───────────────────────────────────────────────────
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const ext = file.name.split('.').pop()?.toLowerCase()
    setFileName(file.name)

    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          const parsed = results.data as DataRow[]
          processData(parsed)
        },
      })
    } else if (ext === 'json') {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string)
          const parsed = Array.isArray(json) ? json : [json]
          processData(parsed)
        } catch {
          alert('Error al parsear el archivo JSON. Comprueba que el formato es válido.')
        }
      }
      reader.readAsText(file)
    } else {
      alert('Solo se admiten archivos CSV o JSON')
    }
  }

  const processData = (parsed: DataRow[]) => {
    if (parsed.length === 0) return
    setData(parsed)

    // Columnas para TanStack Table
    const cols: ColumnDef<DataRow>[] = Object.keys(parsed[0]).map(key => ({
      accessorKey: key,
      header: key,
    }))
    setColumns(cols)

    // Columna inicial del gráfico = primera columna
    const firstKey = Object.keys(parsed[0])[0]
    setChartColumn(firstKey)
    generateChartData(parsed, firstKey)
  }

  const generateChartData = (rows: DataRow[], colKey: string) => {
    const counts: Record<string, number> = {}
    rows.forEach(row => {
      const v = String(row[colKey])
      counts[v] = (counts[v] || 0) + 1
    })
    setChartData(Object.entries(counts).map(([name, value]) => ({ name, value })))
  }

  const handleChartColumnChange = (col: string) => {
    setChartColumn(col)
    generateChartData(data, col)
  }

  // ── Tabla con paginación ─────────────────────────────────────────────────
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    initialState: { pagination: { pageSize: 25 } },
  })

  const columnOptions = data.length > 0
    ? Object.keys(data[0]).map(k => ({ value: k, label: k }))
    : []

  return (
    <div className="space-y-6">
      {/* Upload */}
      <div className="bg-white/50 p-6 rounded-2xl shadow-lg border border-white/30">
        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
          <Upload size={16} />
          Subir archivo JSON o CSV
        </label>
        <input
          type="file"
          accept=".json,.csv"
          onChange={handleFileUpload}
          className="block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white/80 transition-all duration-300 text-gray-700"
        />
        {fileName && (
          <p className="mt-2 text-sm text-gray-500">
            Archivo cargado: <span className="font-medium text-gray-700">{fileName}</span>
            {' '}({data.length} filas)
          </p>
        )}
      </div>

      {data.length > 0 && (
        <>
          {/* Tabla */}
          <div className="bg-white/50 p-6 rounded-2xl shadow-lg border border-white/30">
            <h2 className="text-2xl font-bold mb-4 text-gray-800 flex items-center gap-2">
              <Table2 size={22} />
              Tabla de datos
            </h2>

            {/* Barra de búsqueda + paginación superior */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <input
                type="text"
                placeholder="Buscar en todas las columnas..."
                value={globalFilter}
                onChange={e => setGlobalFilter(e.target.value)}
                className="flex-1 min-w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Mostrar:</span>
                <ProtectedSelect
                  value={String(table.getState().pagination.pageSize)}
                  onChange={v => table.setPageSize(Number(v))}
                  options={[
                    { value: '10', label: '10' },
                    { value: '25', label: '25' },
                    { value: '50', label: '50' },
                    { value: '100', label: '100' },
                  ]}
                  className="border border-gray-300 rounded-lg text-sm"
                />
                <span>filas</span>
              </div>
              <span className="text-sm text-gray-500">
                {table.getFilteredRowModel().rows.length} de {data.length} filas
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 bg-white rounded-xl overflow-hidden shadow-inner">
                <thead className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                  {table.getHeaderGroups().map(hg => (
                    <tr key={hg.id}>
                      {hg.headers.map(h => (
                        <th key={h.id} className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                          {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {table.getRowModel().rows.map(row => (
                    <tr key={row.id} className="hover:bg-purple-50 transition-colors duration-150">
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-gray-600">
                Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-200 transition-colors"
                >
                  <ChevronLeft size={14} /> Anterior
                </button>
                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-200 transition-colors"
                >
                  Siguiente <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Gráfico */}
          <div className="bg-white/50 p-6 rounded-2xl shadow-lg border border-white/30">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <BarChart2 size={22} />
                Gráfico de frecuencias
              </h2>
              {/* Selector de columna para el gráfico */}
              {columnOptions.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <label>Columna:</label>
                  <ProtectedSelect
                    value={chartColumn}
                    onChange={handleChartColumnChange}
                    options={columnOptions}
                    className="border border-gray-300 rounded-lg text-sm min-w-32"
                  />
                </div>
              )}
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                <XAxis dataKey="name" stroke="#7c3aed" tick={{ fontSize: 12 }} />
                <YAxis stroke="#7c3aed" />
                <Tooltip contentStyle={{ backgroundColor: '#f3f4f6', border: 'none', borderRadius: '8px' }} />
                <Legend />
                <Bar dataKey="value" fill="url(#colorGradient)" name={chartColumn} />
                <defs>
                  <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
