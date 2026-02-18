/**
 * Ruta API de Verificación de Token - /api/auth/verify
 *
 * Verifica la validez de tokens JWT para autenticación stateless.
 * Esta ruta es esencial para mantener sesiones de usuario seguras
 * sin almacenar estado en el servidor.
 *
 * Funcionalidades:
 * - Extracción de token del header Authorization
 * - Verificación de firma y expiración del JWT
 * - Validación de formato Bearer Token
 * - Retorno de información del usuario decodificada
 *
 * Consideraciones de seguridad:
 * - Solo acepta tokens en formato Bearer
 * - Verifica expiración automática del JWT
 * - No expone detalles internos del token
 * - Logging de errores para debugging seguro
 *
 * @author José Ángel Alejo
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

/**
 * Handler GET para verificación de tokens JWT
 *
 * Valida tokens de autenticación y devuelve información del usuario.
 * Usado por el frontend para verificar sesiones activas.
 *
 * @param request Objeto NextRequest con header Authorization
 * @returns NextResponse con estado de validez del token
 */
export async function GET(request: NextRequest) {
  try {
    // === EXTRACCIÓN DEL TOKEN ===
    // Obtener header Authorization (formato: "Bearer <token>")
    const authHeader = request.headers.get('Authorization')

    // Verificar que el header existe y tiene formato Bearer
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No authorization token provided' },
        { status: 401 }
      )
    }

    // Extraer el token real (remover "Bearer " del inicio)
    const token = authHeader.substring(7)

    // === VERIFICACIÓN DEL TOKEN ===
    // Verificar firma, expiración y validez del JWT
    const decoded = verifyToken(token)

    // Si el token es inválido o expiró
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    // === RESPUESTA EXITOSA ===
    // Devolver confirmación de validez y datos del usuario
    return NextResponse.json({
      valid: true,
      user: decoded.user
    })

  } catch (error) {
    // === MANEJO DE ERRORES ===
    // Capturar errores inesperados durante la verificación
    console.error('Token verification error:', error)
    return NextResponse.json(
      { error: 'Token verification failed' },
      { status: 500 }
    )
  }
}