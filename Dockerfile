# Dockerfile para Data Visualizer
#
# Contenedor optimizado para producción de la aplicación Next.js
# Incluye configuraciones de seguridad, usuario no-root y health checks.
#
# Características:
# - Imagen base Alpine Linux (ligera)
# - Usuario no-root para seguridad
# - Multi-stage build optimizado
# - Health checks integrados
# - Manejo adecuado de señales con dumb-init
#
# @author José Ángel Alejo
# @version 1.0.0

# === ETAPA DE CONSTRUCCIÓN ===
# Usar Node.js 20 en Alpine Linux (imagen ligera y segura)
FROM node:20-alpine

# === ACTUALIZACIONES DE SEGURIDAD ===
# Actualizar paquetes del sistema e instalar utilidades (dumb-init + su-exec)
# su-exec permitirá que el entrypoint arranque como root, fije permisos y
# luego ejecute la aplicación como el usuario no-root `nextjs`.
RUN apk update && apk upgrade && apk add --no-cache dumb-init su-exec

# === CREACIÓN DE USUARIO NO-ROOT ===
# Crear grupo y usuario dedicados para ejecutar la aplicación
# Evita ejecutar como root (principio de menor privilegio)
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# === CONFIGURACIÓN DEL DIRECTORIO DE TRABAJO ===
WORKDIR /app

# Allow passing JWT_SECRET at build time so Next.js modules that read it during
# static generation don't fail. If not provided, a build-time placeholder is used
# (must be overridden at runtime via docker-compose environment or secrets).
ARG JWT_SECRET
ENV JWT_SECRET=${JWT_SECRET:-build-time-placeholder-secret}

# === PERMISOS DE ARCHIVOS ===
# Cambiar ownership del directorio de la aplicación al usuario nextjs
RUN chown -R nextjs:nodejs /app

# === COPIA DE ARCHIVOS DE DEPENDENCIAS ===
# Copiar package.json y package-lock.json primero (para aprovechar cache de Docker)
COPY --chown=nextjs:nodejs package*.json ./

# === CAMBIO A USUARIO NO-ROOT ===
# Todas las operaciones siguientes se ejecutan como usuario no-privilegiado
USER nextjs

# === CREACIÓN DE DIRECTORIO DE LOGS ===
# Crear directorio para logs con permisos apropiados (el entrypoint corregirá ownership
# del volumen montado en tiempo de arranque si es necesario)
RUN mkdir -p /app/logs

# === COPIA DEL CÓDIGO FUENTE ===
# Copiar todos los archivos del proyecto
COPY --chown=nextjs:nodejs . .

# === CONFIGURACIÓN DE NPM ===
# Configurar npm para reducir verbosidad y alertas
RUN npm config set audit false && \
    npm config set fund false && \
    npm config set update-notifier false

# === INSTALACIÓN DE DEPENDENCIAS ===
# Instalar dependencias de producción y limpiar cache de npm (modo silencioso)
RUN npm ci --silent && npm cache clean --force

# === VERIFICACIÓN DE ARCHIVOS API ===
# Debug: Verificar que los archivos API existen antes del build
RUN ls -la src/app/api/ || echo "API directory not found"

# === CONFIGURACIÓN DE BUILD ===
# Deshabilitar Turbopack para build de producción estable
ENV TURBOPACK=0

# === CONSTRUCCIÓN DE LA APLICACIÓN ===
# Compilar la aplicación Next.js para producción (modo silencioso)
RUN npm run build --silent

# Copiar entrypoint que garantizará los permisos de /app/logs en tiempo de arranque
USER root
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Establecer entrypoint que corregirá ownership y ejecutará el proceso como `nextjs`
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# === HEALTH CHECK ===
# Verificación automática de salud cada 30 segundos
# Usa el endpoint /api/health para determinar si el contenedor está saludable
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# === EXPOSICIÓN DEL PUERTO ===
# Exponer puerto 3000 para la aplicación Next.js
EXPOSE 3000

# === COMANDO DE EJECUCIÓN ===
# El entrypoint ejecutará el proceso como `nextjs` si su-exec está instalado
CMD ["npm", "start"]