/**
 * Módulo de Autenticación - auth.ts
 *
 * Sistema de autenticación JWT con persistencia de usuarios en SQLite.
 * Usa el paquete 'sqlite3' (ya incluido en el proyecto) mediante una capa
 * síncrona con promesas, evitando dependencias nativas problemáticas.
 *
 * @author José Ángel Alejo
 * @version 2.1.0
 */

import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import sqlite3 from 'sqlite3'
import path from 'path'
import fs from 'fs'

// ── Configuración JWT ────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  console.warn(
    '\n⚠️  ADVERTENCIA: JWT_SECRET no está definido en las variables de entorno.\n' +
    '   Configura JWT_SECRET en tu archivo .env.local\n'
  )
}
const SECRET = JWT_SECRET || (() => { throw new Error('JWT_SECRET must be set in environment variables') })()
const JWT_EXPIRES_IN = parseInt(process.env.JWT_EXPIRES_IN || '3600', 10)

// ── Base de datos SQLite ─────────────────────────────────────────────────────
const DB_PATH = process.env.USERS_DB_PATH || path.join(process.cwd(), 'data', 'users.db')

const dbDir = path.dirname(DB_PATH)
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

// Singleton
let _db: sqlite3.Database | null = null

function getDb(): sqlite3.Database {
  if (_db) return _db
  _db = new sqlite3.Database(DB_PATH)
  return _db
}

// ── Helpers de promesas sobre sqlite3 (que es callback-based) ────────────────
function dbRun(sql: string, params: unknown[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, (err) => err ? reject(err) : resolve())
  })
}

function dbGet<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => err ? reject(err) : resolve(row as T))
  })
}

// ── Inicializar esquema ─────────────────────────────────────────────────────
let _initialized = false
async function ensureInit(): Promise<void> {
  if (_initialized) return
  _initialized = true

  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      username   TEXT UNIQUE NOT NULL,
      email      TEXT UNIQUE NOT NULL,
      password   TEXT NOT NULL,
      role       TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const row = await dbGet<{ n: number }>('SELECT COUNT(*) as n FROM users')
  if ((row?.n ?? 0) === 0) {
    const adminHash = bcrypt.hashSync('admin123', 12)
    const user1Hash = bcrypt.hashSync('user123', 12)
    await dbRun(
      'INSERT OR IGNORE INTO users (id, username, email, password, role) VALUES (?, ?, ?, ?, ?)',
      ['1', 'admin', 'admin@generico.com', adminHash, 'admin']
    )
    await dbRun(
      'INSERT OR IGNORE INTO users (id, username, email, password, role) VALUES (?, ?, ?, ?, ?)',
      ['2', 'user1', 'user1@generico.com', user1Hash, 'user']
    )
    console.log('✅ Usuarios por defecto creados en SQLite')
  }
}

// ── Tipos ────────────────────────────────────────────────────────────────────
export interface User {
  id: string
  username: string
  role: 'admin' | 'user'
  email?: string
}

export interface AuthToken {
  user: User
  iat: number
  exp: number
}

type DbUser = User & { password: string }

// ── Contraseñas ───────────────────────────────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(password, hashed)
}

// ── JWT ─────────────────────────────────────────────────────────────────────
export function generateToken(user: User): string {
  return jwt.sign(
    { user: { id: user.id, username: user.username, role: user.role } },
    SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  )
}

export function verifyToken(token: string): AuthToken | null {
  try {
    return jwt.verify(token, SECRET) as AuthToken
  } catch {
    return null
  }
}

// ── CRUD usuarios ─────────────────────────────────────────────────────────────
export async function authenticateUser(username: string, password: string): Promise<User | null> {
  await ensureInit()
  const row = await dbGet<DbUser>('SELECT * FROM users WHERE username = ?', [username])
  if (!row) return null
  const valid = await verifyPassword(password, row.password)
  if (!valid) return null
  return { id: row.id, username: row.username, role: row.role, email: row.email }
}

export async function registerUser(username: string, email: string, password: string): Promise<User> {
  if (!username || !email || !password) throw new Error('Faltan campos obligatorios')
  await ensureInit()

  const existsByUsername = await dbGet('SELECT id FROM users WHERE username = ?', [username])
  if (existsByUsername) throw new Error('El nombre de usuario ya existe')

  const existsByEmail = await dbGet('SELECT id FROM users WHERE email = ?', [email])
  if (existsByEmail) throw new Error('El email ya está en uso')

  const hashed = await hashPassword(password)
  const id = crypto.randomUUID()
  await dbRun(
    "INSERT INTO users (id, username, email, password, role) VALUES (?, ?, ?, ?, 'user')",
    [id, username.trim(), email.trim(), hashed]
  )
  return { id, username: username.trim(), role: 'user', email: email.trim() }
}

// ── Auth middleware ───────────────────────────────────────────────────────────
export function requireAuth(request: Request): User {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) throw new Error('No se proporcionó token de autorización')
  const token = authHeader.substring(7)
  const decoded = verifyToken(token)
  if (!decoded) throw new Error('Token inválido o expirado')
  return decoded.user
}

export function requireAdmin(user: User): void {
  if (user.role !== 'admin') throw new Error('Se requieren permisos de administrador')
}

