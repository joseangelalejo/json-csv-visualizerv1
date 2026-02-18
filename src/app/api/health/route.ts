/**
 * Ruta API de Health Check - /api/health
 *
 * Endpoint de monitoreo para verificar el estado de salud de la aplicación.
 * Proporciona información detallada sobre el estado de componentes críticos
 * como base de datos, sistema de archivos y rendimiento general.
 *
 * Funcionalidades:
 * - Verificación de conectividad de base de datos (opcional)
 * - Validación de acceso al sistema de archivos
 * - Métricas de uptime y rendimiento
 * - Información del entorno de ejecución
 * - Códigos de estado HTTP apropiados (200/503/500)
 *
 * Configuración:
 * - HEALTH_CHECK_DATABASE=true: Habilita verificación de BD
 * - LOG_FILE: Directorio para verificar acceso al filesystem
 *
 * Usos comunes:
 * - Monitoreo de infraestructura (Kubernetes, Docker Healthchecks)
 * - Load balancers para verificar instancias saludables
 * - Alertas automáticas cuando servicios fallan
 * - Debugging de problemas de conectividad
 *
 * @author José Ángel Alejo
 * @version 1.0.0
 */

import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { connectToDatabase } from '@/lib/database'

/**
 * Handler GET para verificación de salud del sistema
 *
 * Ejecuta múltiples verificaciones de salud y retorna estado detallado.
 * Diseñado para ser usado por sistemas de monitoreo automatizados.
 *
 * @returns NextResponse con estado de salud y métricas detalladas
 */
export async function GET() {
  // Registrar tiempo de inicio para medir rendimiento
  const startTime = Date.now()

  try {
    // === INICIALIZACIÓN DEL OBJETO DE SALUD ===
    // Estructura completa con todos los indicadores de salud
    const healthCheck = {
      status: 'healthy', // Estado general: 'healthy' | 'unhealthy' | 'error'
      timestamp: new Date().toISOString(), // Timestamp ISO para trazabilidad
      uptime: process.uptime(), // Tiempo de actividad del proceso en segundos
      version: process.version, // Versión de Node.js
      environment: process.env.NODE_ENV || 'development', // Entorno de ejecución
      responseTime: 0, // Tiempo de respuesta en ms (calculado al final)
      checks: {
        database: false as boolean | string, // Estado de la BD: true | false | 'skipped'
        filesystem: false, // Estado del filesystem: true | false
      }
    }

    // === VERIFICACIÓN DE BASE DE DATOS ===
    // Solo si está habilitada por variable de entorno
    if (process.env.HEALTH_CHECK_DATABASE === 'true') {
      try {
        // Conectar a la base de datos configurada
        const db = await connectToDatabase()

        // Ejecutar query simple según el tipo de base de datos
        if (db.type === 'sqlite') {
          // SQLite: SELECT 1 (verificación básica)
          await new Promise((resolve, reject) => {
            db.connection.all('SELECT 1', (err: any, rows: any) => {
              if (err) reject(err)
              else resolve(rows)
            })
          })
        } else if (db.type === 'postgres') {
          // PostgreSQL: SELECT 1
          await db.connection.query('SELECT 1')
        } else if (db.type === 'mysql') {
          // MySQL: SELECT 1
          await db.connection.execute('SELECT 1')
        } else if (db.type === 'mongodb') {
          // MongoDB: findOne en colección de prueba
          await db.connection.collection('healthcheck').findOne({})
        }

        // Marcar verificación de BD como exitosa
        healthCheck.checks.database = true

      } catch (dbError) {
        // Error en verificación de base de datos
        const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error'
        logger.error('Database health check failed', { error: errorMessage })

        // Marcar BD como fallida y cambiar estado general
        healthCheck.checks.database = false
        healthCheck.status = 'unhealthy'
      }
    } else {
      // Verificación de BD deshabilitada
      healthCheck.checks.database = 'skipped'
    }

    // === VERIFICACIÓN DEL SISTEMA DE ARCHIVOS ===
    try {
      const fs = require('fs').promises
      // Verificar acceso al directorio de logs (o /tmp por defecto)
      const logDir = process.env.LOG_FILE ? require('path').dirname(process.env.LOG_FILE) : '/tmp'
      await fs.access(logDir)

      // Marcar filesystem como saludable
      healthCheck.checks.filesystem = true

    } catch (fsError) {
      // Error en verificación del filesystem
      const errorMessage = fsError instanceof Error ? fsError.message : 'Unknown filesystem error'
      logger.error('Filesystem health check failed', { error: errorMessage })

      // Marcar filesystem como fallido y cambiar estado general
      healthCheck.checks.filesystem = false
      healthCheck.status = 'unhealthy'
    }

    // === CÁLCULO DE TIEMPO DE RESPUESTA ===
    const responseTime = Date.now() - startTime
    healthCheck.responseTime = responseTime

    // === DETERMINACIÓN DEL CÓDIGO HTTP ===
    // 200 para healthy, 503 para unhealthy (service unavailable)
    const statusCode = healthCheck.status === 'healthy' ? 200 : 503

    // === LOGGING DEL RESULTADO ===
    logger.info('Health check completed', {
      status: healthCheck.status,
      responseTime,
      checks: healthCheck.checks
    })

    // === RESPUESTA FINAL ===
    return NextResponse.json(healthCheck, { status: statusCode })

  } catch (error) {
    // === MANEJO DE ERRORES CRÍTICOS ===
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Health check error', { error: errorMessage })

    // Respuesta de error con estado mínimo
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    }, { status: 500 })
  }
}