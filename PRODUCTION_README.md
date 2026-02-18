# JSON/CSV Data Visualizer - Guía de Despliegue en Producción

## Resumen

Esta aplicación es una herramienta de visualización de datos JSON/CSV lista para producción con características de seguridad de nivel empresarial incluyendo autenticación JWT, encriptación HTTPS, limitación de tasa, logging completo y capacidades de monitoreo. Soporta acceso remoto y monitoreo para despliegues distribuidos.

## Características de Seguridad

- **Autenticación**: Autenticación basada en JWT con hash de contraseñas bcrypt
- **Autorización**: Control de acceso basado en roles (roles admin/usuario)
- **HTTPS**: Encriptación SSL/TLS con headers de seguridad
- **Limitación de Tasa**: Limitación configurable de solicitudes para prevenir abuso
- **CORS**: Compartir recursos de origen cruzado configurable
- **Headers de Seguridad**: Headers de seguridad completos (CSP, HSTS, X-Frame-Options, etc.)
- **Validación de Entrada**: Protección contra inyección SQL y XSS
- **Logging**: Logging estructurado de eventos de seguridad
- **Monitoreo**: Chequeos de salud y monitoreo de seguridad
- **Seguridad de Dependencias**: Todas las dependencias npm actualizadas a versiones seguras más recientes con cero vulnerabilidades conocidas

## Prerrequisitos

- Docker y Docker Compose
- Certificados SSL (o usar certificados auto-firmados proporcionados para desarrollo)
- Base de datos (SQLite, PostgreSQL, MySQL o MongoDB)

## Inicio Rápido

1. **Clonar y configurar**:

   ```bash
   git clone <repository-url>
   cd json-csv-visualizer
   cp .env.example .env.local
   ```

2. **Configurar entorno**:

   Editar `.env.local` con tus configuraciones de producción:

   ```env
   NODE_ENV=production
   JWT_SECRET=your-super-secret-jwt-key
   ALLOWED_ORIGINS=https://yourdomain.com
   SSL_CERT_PATH=/app/ssl/cert.pem
   SSL_KEY_PATH=/app/ssl/key.pem
   ```

3. **Generar certificados SSL** (para desarrollo):

   ```bash
   mkdir ssl
   openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
   ```

4. **Iniciar entorno de producción**:

   ```bash
   docker-compose up -d
   ```

## Configuración de Entorno

### Variables Requeridas

| Variable          | Descripción              | Ejemplo                                             |
|-------------------|--------------------------|-----------------------------------------------------|
| `NODE_ENV`        | Modo de entorno          | `production`                                        |
| `JWT_SECRET`      | Secreto de firma JWT     | `your-super-secret-key`                             |
| `ALLOWED_ORIGINS` | Orígenes CORS permitidos | `https://yourdomain.com,https://www.yourdomain.com` |

### Configuración de Base de Datos

Elige un tipo de base de datos y configura en consecuencia:

**SQLite** (por defecto):

```env
SQLITE_PATH=/app/data/production.db
```

**PostgreSQL**:

```env
POSTGRES_HOST=your-postgres-host
POSTGRES_PORT=5432
POSTGRES_USER=your-username
POSTGRES_PASSWORD=your-password
POSTGRES_DATABASE=your-database
```

**MySQL**:

```env
MYSQL_HOST=your-mysql-host
MYSQL_PORT=3306
MYSQL_USER=your-username
MYSQL_PASSWORD=your-password
MYSQL_DATABASE=your-database
```

**MongoDB**:

```env
MONGODB_URI=mongodb://username:password@host:port/database
```

### Configuración de Seguridad

| Variable                | Descripción                           | Por Defecto         |
|-------------------------|---------------------------------------|---------------------|
| `API_RATE_LIMIT`        | Solicitudes por ventana de 15 minutos | `100`               |
| `SESSION_TIMEOUT`       | Expiración de token JWT (ms)          | `3600000`           |
| `LOG_LEVEL`             | Nivel de logging                      | `info`              |
| `LOG_FILE`              | Ruta del archivo de log               | `/app/logs/app.log` |
| `HEALTH_CHECK_DATABASE` | Habilitar chequeos de salud de BD     | `true`              |

## Acceso Remoto y Monitoreo

### Configuración de Port Forwarding

Para acceder a la aplicación remotamente desde fuera de tu red local:

1. **Configura tu router** para port forwarding:
   - **Puerto 80 (HTTP)**: Redirigir a la IP interna de tu servidor (ej. `192.168.1.100:80`)
   - **Puerto 443 (HTTPS)**: Redirigir a la IP interna de tu servidor (ej. `192.168.1.100:443`)
   - Protocolo: **TCP** para ambos puertos

2. **Obtén tu IP pública**: Visita `whatismyipaddress.com` o ejecuta `curl ifconfig.me`

3. **Accede a la aplicación**: Navega a `https://tu-ip-publica` (acepta el certificado SSL auto-firmado)

### Endpoints de Monitoreo

- **Chequeo de Salud**: `https://tu-ip-publica/api/health` - Devuelve JSON con estado del sistema
- **Logs de Aplicación**: Acceso vía SSH: `docker-compose logs app`
- **Logs de Seguridad**: `docker-compose run --rm app node scripts/security-monitor.js report`

### Herramientas de Monitoreo Remoto

- **Monitoreo de Uptime**: Usa servicios como UptimeRobot apuntando a `https://tu-ip-publica/api/health`
- **Envío de Logs**: Configura logging remoto a servicios como Loggly o Papertrail
- **Acceso VPN**: Considera WireGuard para acceso remoto seguro sin exponer puertos

## Despliegue Docker

### Configuración de Producción

```yaml
# docker-compose.yml
services:
  app:
    build: .
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
    volumes:
      - data:/app/data
      - logs:/app/logs
      - backups:/app/backups
      - ssl:/app/ssl
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ssl:/etc/nginx/ssl
    depends_on:
      - app
```

### Configuración SSL

1. **Obtener certificados**:
   - Para producción: Usa Let's Encrypt o compra certificados
   - Para desarrollo: Usa el script proporcionado

2. **Colocar certificados**:

   ```bash
   mkdir ssl
   cp your-cert.pem ssl/cert.pem
   cp your-key.pem ssl/key.pem
   chmod 600 ssl/key.pem
   ```

## Monitoreo y Mantenimiento

### Chequeos de Salud

La aplicación incluye chequeos de salud completos:

```bash
# Verificar salud de la aplicación
curl https://yourdomain.com/api/health

# Ejemplo de respuesta:
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "checks": {
    "database": true,
    "filesystem": true
  }
}
```

### Monitoreo de Seguridad

Ejecutar monitoreo de seguridad:

```bash
# Verificar alertas de seguridad
docker-compose run --rm app node scripts/security-monitor.js

# Generar reporte de seguridad
docker-compose run --rm app node scripts/security-monitor.js report
```

### Backups de Base de Datos

Los backups automatizados están configurados:

```bash
# Backup manual
docker-compose run --rm backup

# Configuración de backup
BACKUP_RETENTION_DAYS=30  # Mantener backups por 30 días
BACKUP_DIR=/app/backups   # Ubicación de almacenamiento de backups
```

### Gestión de Logs

Los logs están estructurados e incluyen eventos de seguridad:

```bash
# Ver logs de aplicación
docker-compose logs app

# Ver logs de nginx
docker-compose logs nginx

# Niveles de log: error, warn, info, debug
```

## Mejores Prácticas de Seguridad

### Lista de Verificación de Producción

- [ ] Cambiar secreto JWT por defecto
- [ ] Usar certificados SSL fuertes
- [ ] Configurar orígenes CORS apropiados
- [ ] Establecer límites de tasa apropiados
- [ ] Habilitar chequeos de salud de base de datos
- [ ] Configurar rotación de logs
- [ ] Configurar alertas de monitoreo
- [ ] Actualizaciones de seguridad regulares

### Gestión de Usuarios

Crear usuario admin en el primer inicio:

```bash
# La aplicación pedirá creación de usuario admin
# O usar el endpoint de API
curl -X POST https://yourdomain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"secure-password","role":"admin"}'
```

### Estrategia de Backup

- **Automatizado**: Backups diarios vía trabajo cron
- **Retención**: 30 días de backups
- **Almacenamiento**: Volúmenes Docker persistentes
- **Verificación**: Chequeos regulares de integridad de backups

## Solución de Problemas

### Problemas Comunes

1. **Errores de Certificado SSL**:

   ```bash
   # Verificar validez del certificado
   openssl x509 -in ssl/cert.pem -text -noout

   # Regenerar certificados auto-firmados
   openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes
   ```

2. **Problemas de Conexión a Base de Datos**:

   ```bash
   # Verificar conectividad de base de datos
   docker-compose exec app node -e "require('./src/lib/database').connectToDatabase().then(() => console.log('Conectado'))"
   ```

3. **Problemas de Limitación de Tasa**:
   - Revisar logs por eventos de límite de tasa
   - Ajustar variable de entorno `API_RATE_LIMIT`
   - Revisar patrones de solicitudes del cliente

### Optimización de Rendimiento

- **Memoria**: Monitorear uso de memoria del contenedor
- **CPU**: Ajustar límites de CPU de Docker si es necesario
- **Base de Datos**: Optimizar consultas y pool de conexiones
- **Cache**: Implementar Redis para almacenamiento de sesiones en escenarios de alto tráfico

## Documentación de API

### Endpoints de Autenticación

- `POST /api/auth/login` - Inicio de sesión de usuario
- `POST /api/auth/register` - Registro de usuario (solo admin)
- `POST /api/auth/verify` - Verificación de token
- `POST /api/auth/logout` - Cierre de sesión de usuario

### Endpoints de Datos

- `GET /api/data` - Recuperar datos (autenticado)
- `POST /api/data` - Subir datos (autenticado)
- `DELETE /api/data/:id` - Eliminar datos (solo admin)

### Endpoints de Salud

- `GET /api/health` - Chequeo de salud de aplicación

## Actualizaciones de Seguridad Recientes (2026-02-12)

- **Cero Vulnerabilidades**: Todas las dependencias npm actualizadas para eliminar todas las vulnerabilidades de seguridad conocidas
- **Overrides de Dependencias**: Implementados overrides en package.json para dependencias transitivas críticas:
  - `form-data`: Actualizado a versión segura
  - `qs`: Actualizado para prevenir ataques DoS
  - `semver`: Actualizado para prevenir RegExp DoS
  - `tar`: Actualizado para prevenir vulnerabilidades de sobrescritura de archivos
  - `tough-cookie`: Actualizado para prevenir contaminación de prototipos
- **SQLite3**: Actualizado a versión segura más reciente
- **Actualizaciones Automatizadas**: Dependencias mantenidas actualizadas con npm audit fix

## Soporte

Para problemas y preguntas:

1. Revisar logs de aplicación: `docker-compose logs app`
2. Revisar monitor de seguridad: `docker-compose run --rm app node scripts/security-monitor.js report`
3. Verificar configuración en `.env.local`
4. Verificar estado de contenedores Docker: `docker-compose ps`

## Licencia

Este proyecto está licenciado bajo la Licencia MIT.
