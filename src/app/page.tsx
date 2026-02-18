'use client'

/**
 * page.tsx — Página principal del JSON/CSV Data Visualizer.
 *
 * Gestiona autenticación y enruta entre los tres modos:
 *   - File Upload  → FileUploader
 *   - Database     → DatabaseVisualizer
 *   - SQL Editor   → SqlEditor
 *
 * @author José Ángel Alejo
 * @version 3.0.0
 */

import React, { useState, useEffect } from 'react'
import { LogOut, FolderOpen, Database, Code2 } from 'lucide-react'
import LoginForm from '../components/LoginForm'
import RegisterForm from '../components/RegisterForm'
import FileUploader from '../components/FileUploader'
import DatabaseVisualizer from '../components/DatabaseVisualizer'
import SqlEditor from '../components/SqlEditor'

type Mode = 'file' | 'db' | 'sql'
type AuthView = 'login' | 'register'

export default function Home() {
  const [token, setToken] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [authView, setAuthView] = useState<AuthView>('login')
  const [mode, setMode] = useState<Mode>('file')

  useEffect(() => {
    const saved = localStorage.getItem('token')
    if (saved) { setToken(saved); setIsLoggedIn(true) }
  }, [])

  const handleLoginSuccess = (newToken: string) => {
    setToken(newToken)
    setIsLoggedIn(true)
    localStorage.setItem('token', newToken)
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    setToken('')
    localStorage.removeItem('token')
  }

  const tabs: { id: Mode; label: string; icon: React.ReactNode }[] = [
    { id: 'file', label: 'File Upload (JSON/CSV)', icon: <FolderOpen size={17} /> },
    { id: 'db',   label: 'Database Visualization', icon: <Database size={17} /> },
    { id: 'sql',  label: 'SQL Editor',              icon: <Code2 size={17} /> },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-600 to-pink-500 py-6 flex flex-col justify-center sm:py-12">
      <div className="relative py-3 sm:max-w-7xl sm:mx-auto w-full px-4">
        <div className="relative px-4 py-10 bg-white/90 backdrop-blur-sm shadow-2xl sm:rounded-3xl sm:p-16 border border-white/20">

          {!isLoggedIn ? (
            /* ── Auth ── */
            <div className="max-w-md mx-auto">
              <img src="/02_logo_horizontal_1200x300.png" alt="Data Visualizer" className="mx-auto mb-8 max-w-full h-auto" />
              <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
                {authView === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
              </h2>
              {authView === 'login'
                ? <LoginForm onSuccess={handleLoginSuccess} onSwitchToRegister={() => setAuthView('register')} />
                : <RegisterForm onSuccess={handleLoginSuccess} onSwitchToLogin={() => setAuthView('login')} />
              }
            </div>

          ) : (
            /* ── App principal ── */
            <div>
              {/* Header */}
              <div className="flex justify-between items-center mb-8">
                <img src="/02_logo_horizontal_1200x300.png" alt="Data Visualizer" className="max-w-xs h-auto" />
                <button onClick={handleLogout}
                  className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-xl hover:bg-red-600 transition-colors text-sm font-medium">
                  <LogOut size={15} /> Cerrar sesión
                </button>
              </div>

              {/* Selector de modo */}
              <div className="flex justify-center mb-8 gap-3 flex-wrap">
                {tabs.map(tab => (
                  <button key={tab.id} onClick={() => setMode(tab.id)}
                    className={`flex items-center gap-2 px-6 py-3 rounded-full font-semibold shadow-lg transition-all duration-200 text-sm ${
                      mode === tab.id
                        ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-xl scale-105'
                        : 'bg-white/80 text-gray-700 hover:bg-white hover:shadow-md'
                    }`}
                  >
                    {tab.icon}{tab.label}
                  </button>
                ))}
              </div>

              {/* Contenido */}
              {mode === 'file' && <FileUploader />}
              {mode === 'db'   && <div className="bg-white/50 p-6 rounded-2xl shadow-lg border border-white/30"><DatabaseVisualizer token={token} /></div>}
              {mode === 'sql'  && <div className="bg-white/50 p-6 rounded-2xl shadow-lg border border-white/30"><SqlEditor token={token} /></div>}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
