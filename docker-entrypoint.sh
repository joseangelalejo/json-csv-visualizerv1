#!/bin/sh
set -e

# docker-entrypoint.sh
# - asegura que /app/logs sea escribible por el usuario de la aplicación (nextjs)
# - si no es posible cambiar permisos, continúa sin fallar
# - finalmente ejecuta el proceso como usuario `nextjs` usando su-exec

LOG_FILE=${LOG_FILE:-/app/logs/app.log}
LOG_DIR=$(dirname "$LOG_FILE")

# Crear el directorio si no existe y asegurar ownership
if [ ! -d "$LOG_DIR" ]; then
  mkdir -p "$LOG_DIR" 2>/dev/null || true
fi

# Intentar setear ownership a nextjs:nodejs (ignore errors)
if chown -R nextjs:nodejs "$LOG_DIR" 2>/dev/null; then
  echo "[entrypoint] fixed ownership of $LOG_DIR to nextjs"
else
  echo "[entrypoint] warning: could not chown $LOG_DIR (may be a mounted volume owned by root)." >&2
fi

# If directory is not writable, attempt chmod 1777 as a last resort (ignore failures)
if [ ! -w "$LOG_DIR" ]; then
  chmod 1777 "$LOG_DIR" 2>/dev/null || true
fi

# Exec the requested command as user `nextjs` if su-exec is available
if command -v su-exec >/dev/null 2>&1; then
  exec su-exec nextjs "$@"
else
  # Fallback: attempt to run as nextjs via gosu-like su -c (may not be present on all images)
  echo "[entrypoint] su-exec not found, running command directly (process will run as current user)" >&2
  exec "$@"
fi