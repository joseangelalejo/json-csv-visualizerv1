'use client'

/**
 * RegisterForm — Formulario de registro de nuevos usuarios.
 * Extraído de page.tsx para mantener el componente principal limpio.
 */

import React, { useState } from 'react'
import { Eye, EyeOff, UserPlus } from 'lucide-react'
import ProtectedInput from './ProtectedInput'

interface RegisterFormProps {
  onSuccess: (token: string) => void
  onSwitchToLogin: () => void
}

export default function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const passwordsMatch = password === confirmPassword
  const isValid = username.length >= 3 && email.length > 0 && password.length >= 6 && passwordsMatch

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, confirmPassword }),
      })
      if (res.ok) {
        const data = await res.json()
        onSuccess(data.token)
      } else {
        const err = await res.json()
        setError(err.error || 'Error al crear la cuenta')
      }
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
        <ProtectedInput
          placeholder="Mínimo 3 caracteres"
          type="text"
          value={username}
          onChange={setUsername}
          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <ProtectedInput
          placeholder="tu@email.com"
          type="email"
          value={email}
          onChange={setEmail}
          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
        <div className="flex items-center gap-2">
          <ProtectedInput
            placeholder="Mínimo 6 caracteres"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={setPassword}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(s => !s)}
            className="p-2 border border-gray-300 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
        <div className="flex items-center gap-2">
          <ProtectedInput
            placeholder="Repite la contraseña"
            type={showConfirm ? 'text' : 'password'}
            value={confirmPassword}
            onChange={setConfirmPassword}
            className={`flex-1 px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
              confirmPassword && !passwordsMatch ? 'border-red-400' : 'border-gray-300'
            }`}
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirm(s => !s)}
            className="p-2 border border-gray-300 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
            aria-label={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {confirmPassword && !passwordsMatch && (
          <p className="mt-1 text-xs text-red-500">Las contraseñas no coinciden</p>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!isValid || loading}
        className="w-full flex items-center justify-center gap-2 text-white py-2 px-4 rounded-md transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed bg-gradient-to-r from-green-500 to-teal-600 hover:shadow-lg"
      >
        <UserPlus size={16} />
        {loading ? 'Creando cuenta...' : 'Crear cuenta'}
      </button>

      <p className="text-center text-sm text-gray-600">
        ¿Ya tienes cuenta?{' '}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-indigo-600 hover:underline font-medium"
        >
          Iniciar sesión
        </button>
      </p>
    </form>
  )
}
