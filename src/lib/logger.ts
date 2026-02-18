/**
 * Sistema de Logging - logger.ts
 *
 * Logger compatible con Edge Runtime de Next.js para entornos serverless.
 * Proporciona logging estructurado con diferentes niveles de severidad
 * y metadatos contextuales para debugging y monitoreo.
 *
 * Niveles de logging:
 * - ERROR: Errores críticos que requieren atención inmediata
 * - WARN: Advertencias que no detienen la ejecución pero requieren revisión
 * - INFO: Información general sobre operaciones normales
 * - DEBUG: Información detallada para desarrollo y troubleshooting
 *
 * Características:
 * - Compatible con Edge Runtime (no usa fs ni APIs de Node.js específicas)
 * - Logging estructurado con metadatos JSON
 * - Configurable vía variables de entorno
 * - Formato consistente con timestamps ISO
 * - Información contextual (usuario, IP, user-agent, etc.)
 *
 * @author José Ángel Alejo
 * @version 1.0.0
 */

// Edge Runtime compatible logger
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

/**
 * Interfaz que define la estructura de una entrada de log
 * Incluye campos comunes para logging estructurado
 */
interface LogEntry {
  timestamp: string           // Timestamp ISO de la entrada
  level: LogLevel            // Nivel de severidad del log
  message: string            // Mensaje principal del log
  userId?: string           // ID del usuario (opcional)
  username?: string         // Nombre de usuario (opcional)
  error?: string            // Mensaje de error (opcional)
  status?: string           // Código de estado HTTP (opcional)
  responseTime?: number     // Tiempo de respuesta en ms (opcional)
  checks?: any              // Resultados de validaciones (opcional)
  query?: string            // Consulta SQL ejecutada (opcional)
  security?: boolean        // Indicador de evento de seguridad (opcional)
  count?: number            // Contador numérico (opcional)
  origin?: string           // Origen de la petición (opcional)
  ip?: string              // Dirección IP del cliente (opcional)
  userAgent?: string        // User-Agent del cliente (opcional)
  metadata?: Record<string, any> // Metadatos adicionales (opcional)
}

/**
 * Clase Logger principal - implementa logging estructurado
 * Diseñada para ser compatible con Edge Runtime de Next.js
 */
class Logger {
  private logLevel: LogLevel
  private initialized: boolean = false
  // null = not-checked, true/false = writable or not
  private fileWritable: boolean | null = null

  constructor() {
    this.logLevel = LogLevel.INFO
  }

  /**
   * Inicializa el logger con configuración de entorno
   * Solo se ejecuta una vez por instancia. Además comprueba si el
   * `LOG_FILE` es escribible y cachea el resultado para evitar
   * intentos repetidos que generen errores EACCES en contenedores.
   */
  private initialize() {
    if (this.initialized) return
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO

    // Detectar si podemos escribir al archivo de logs (solo en Node.js runtime)
    try {
      if (typeof process !== 'undefined' && process.env.NEXT_RUNTIME !== 'edge') {
        const fs = require('fs')
        const path = require('path')
        const logFile = process.env.LOG_FILE || '/app/logs/app.log'
        const dir = path.dirname(logFile)
        try {
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
          // Intentar acceso de escritura al directorio
          fs.accessSync(dir, fs.constants.W_OK)
          this.fileWritable = true
        } catch (err) {
          // No escribible -> usaremos solo stdout/stderr
          this.fileWritable = false
          // Evitar imprimir el stack completo en producción
          console.warn(`Logger: no se puede escribir en ${dir}; usando stdout`)
        }
      } else {
        this.fileWritable = false
      }
    } catch (err) {
      this.fileWritable = false
    }

    this.initialized = true
  }

  /**
   * Determina si un nivel de log debe ser procesado
   * Basado en la jerarquía: ERROR > WARN > INFO > DEBUG
   * @param level Nivel a evaluar
   * @returns true si debe loguearse, false si no
   */
  private shouldLog(level: LogLevel): boolean {
    this.initialize()
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG]
    return levels.indexOf(level) <= levels.indexOf(this.logLevel)
  }

  /**
   * Formatea una entrada de log para salida por consola
   * Incluye timestamp, nivel, mensaje y metadatos adicionales
   * @param entry Entrada de log a formatear
   * @returns String formateado para logging
   */
  private formatMessage(entry: LogEntry): string {
    const base = `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}`
    const extras = []

    if (entry.userId) extras.push(`user=${entry.userId}`)
    if (entry.ip) extras.push(`ip=${entry.ip}`)
    if (entry.userAgent) extras.push(`ua=${entry.userAgent}`)
    if (entry.metadata) extras.push(`metadata=${JSON.stringify(entry.metadata)}`)

    return extras.length > 0 ? `${base} ${extras.join(' ')}` : base
  }

  /**
   * Escribe el mensaje de log a un archivo si es posible
   * Compatible con Edge Runtime - no escribe archivos en ese entorno
   * @param message Mensaje formateado a escribir
   */
  private writeToFile(message: string): void {
    // Skip file writing entirely in Edge Runtime or if we previously determined it's not writable
    if (typeof process !== 'undefined' && process.env.NEXT_RUNTIME === 'edge') return
    if (this.fileWritable === false) return

    // Only attempt file operations in Node.js runtime
    try {
      // Use require to avoid static imports that Next.js detects
      const fs = require('fs')
      const path = require('path')
      const logFile = process.env.LOG_FILE || '/app/logs/app.log'
      const dir = path.dirname(logFile)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.appendFileSync(logFile, message + '\n')
    } catch (error) {
      // If first-time write fails, mark as not-writable to avoid noisy EACCES later
      try { if (error && (error as any).code === 'EACCES') this.fileWritable = false } catch { }
      console.log('Logger file write failed:', (error && (error as any).message) || error)
    }
  }

  /**
   * Método interno que procesa y registra una entrada de log
   * Aplica filtrado por nivel, formatea el mensaje y lo envía a consola y archivo
   * @param level Nivel de severidad del log
   * @param message Mensaje principal
   * @param metadata Metadatos adicionales opcionales
   */
  private log(level: LogLevel, message: string, metadata?: Partial<LogEntry>) {
    if (!this.shouldLog(level)) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...metadata
    }

    const formatted = this.formatMessage(entry)

    // Always log to console
    console.log(formatted)

    // Try to write to file if possible
    this.writeToFile(formatted)
  }

  /**
   * Registra un mensaje de error (nivel ERROR)
   * @param message Mensaje de error
   * @param metadata Metadatos adicionales
   */
  error(message: string, metadata?: Partial<LogEntry>) {
    this.log(LogLevel.ERROR, message, metadata)
  }

  /**
   * Registra un mensaje de advertencia (nivel WARN)
   * @param message Mensaje de advertencia
   * @param metadata Metadatos adicionales
   */
  warn(message: string, metadata?: Partial<LogEntry>) {
    this.log(LogLevel.WARN, message, metadata)
  }

  /**
   * Registra un mensaje informativo (nivel INFO)
   * @param message Mensaje informativo
   * @param metadata Metadatos adicionales
   */
  info(message: string, metadata?: Partial<LogEntry>) {
    this.log(LogLevel.INFO, message, metadata)
  }

  /**
   * Registra un mensaje de debug (nivel DEBUG)
   * @param message Mensaje de debug
   * @param metadata Metadatos adicionales
   */
  debug(message: string, metadata?: Partial<LogEntry>) {
    this.log(LogLevel.DEBUG, message, metadata)
  }

  /**
   * Registra eventos de seguridad con prefijo especial
   * Siempre se registra como WARN para asegurar visibilidad
   * @param message Mensaje de evento de seguridad
   * @param metadata Metadatos adicionales
   */
  security(message: string, metadata?: Partial<LogEntry>) {
    this.log(LogLevel.WARN, `SECURITY: ${message}`, {
      ...metadata,
      security: true
    })
  }

  /**
   * Registra eventos de autenticación con prefijo especial
   * Incluye automáticamente el ID de usuario si se proporciona
   * @param message Mensaje de evento de autenticación
   * @param userId ID del usuario involucrado (opcional)
   * @param metadata Metadatos adicionales
   */
  auth(message: string, userId?: string, metadata?: Partial<LogEntry>) {
    this.log(LogLevel.INFO, `AUTH: ${message}`, { userId, ...metadata })
  }
}

/**
 * Instancia singleton del logger para uso en toda la aplicación
 * Exportada para ser utilizada en otros módulos
 */
export const logger = new Logger()