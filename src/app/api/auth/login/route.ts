/**
 * Ruta API de Login - /api/auth/login
 *
 * Maneja la autenticación de usuarios mediante credenciales (username/password).
 * Esta ruta es crítica para la seguridad de la aplicación y registra
 * todos los intentos de login para auditoría.
 *
 * Funcionalidades:
 * - Validación de entrada de datos
 * - Autenticación de usuario con bcrypt
 * - Generación de tokens JWT
 * - Logging de seguridad completo
 * - Manejo de errores seguro
 *
 * Consideraciones de seguridad:
 * - No revela si el usuario existe o no (evita enumeración)
 * - Registra IPs y User-Agents para auditoría
 * - Maneja errores sin exponer información sensible
 * - Rate limiting recomendado en producción
 *
 * @author José Ángel Alejo
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser, generateToken } from '@/lib/auth'
import { logger } from '@/lib/logger'

/**
 * Handler POST para autenticación de usuarios
 *
 * Procesa solicitudes de login y devuelve tokens JWT válidos.
 * Incluye validación exhaustiva y logging de seguridad.
 *
 * @param request Objeto NextRequest con datos de login
 * @returns NextResponse con token JWT o error
 */
export async function POST(request: NextRequest) {
  try {
    // Extraer credenciales del cuerpo JSON de la solicitud
    const { username, password } = await request.json()

    // === VALIDACIÓN DE ENTRADA ===
    // Verificar que username y password estén presentes y sean strings
    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      // Log de seguridad: registrar intento con entrada inválida
      logger.security('Login attempt with invalid input', {
        username: username?.substring(0, 50), // Limitar longitud para evitar logs excesivos
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      })
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      )
    }

    // Validar formato mínimo de credenciales (seguridad básica)
    if (username.length < 3 || password.length < 6) {
      logger.security('Login attempt with invalid credentials format', {
        username,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      })
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 400 }
      )
    }

    // === AUTENTICACIÓN ===
    // Verificar credenciales contra la base de datos
    const user = await authenticateUser(username, password)
    if (!user) {
      // Log de seguridad: intento fallido (no revela si usuario existe)
      logger.security('Failed login attempt', {
        username,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      })
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // === GENERACIÓN DE TOKEN ===
    // Crear token JWT con información del usuario
    const token = generateToken(user)

    // Log de autenticación exitosa
    logger.auth(`Successful login for user: ${username}`, user.id, {
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    })

    // === RESPUESTA EXITOSA ===
    // Devolver token y datos básicos del usuario (sin información sensible)
    return NextResponse.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    })

  } catch (error) {
    // === MANEJO DE ERRORES ===
    // Capturar cualquier error inesperado durante el proceso
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Login error', {
      error: errorMessage,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    })
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
}