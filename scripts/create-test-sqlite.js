// Script de ayuda para crear una base de datos SQLite de prueba
// Usado por las pruebas E2E para asegurar que exista un fichero .db con tablas
const fs = require('fs')
const sqlite3 = require('sqlite3').verbose()
const outDir = './test-fixtures'
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir)
const dbPath = `${outDir}/test.db`
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
const db = new sqlite3.Database(dbPath)
db.serialize(() => {
  db.run('CREATE TABLE people (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)')
  const stmt = db.prepare('INSERT INTO people (name, age) VALUES (?, ?)')
  stmt.run('Alice', 30)
  stmt.run('Bob', 25)
  stmt.run('Carlos', 40)
  stmt.finalize()
})
db.close(() => {
  console.log('Test SQLite DB created at', dbPath)
})
