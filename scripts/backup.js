#!/usr/bin/env node

const fs = require('fs').promises
const path = require('path')
const { exec } = require('child_process')
const { promisify } = require('util')
const execAsync = promisify(exec)

const logger = require('../src/lib/logger')

class DatabaseBackup {
  constructor() {
    this.backupDir = process.env.BACKUP_DIR || '/app/backups'
    this.retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS) || 30
  }

  async createBackup() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true })

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupFile = path.join(this.backupDir, `backup-${timestamp}.sql`)

      // Determine database type and create backup
      if (process.env.POSTGRES_HOST) {
        await this.backupPostgreSQL(backupFile)
      } else if (process.env.MYSQL_HOST) {
        await this.backupMySQL(backupFile)
      } else if (process.env.SQLITE_PATH) {
        await this.backupSQLite(backupFile)
      } else if (process.env.MONGODB_URI) {
        await this.backupMongoDB(backupFile.replace('.sql', '.json'))
      } else {
        throw new Error('No database configuration found')
      }

      logger.info('Database backup completed', { backupFile })

      // Clean up old backups
      await this.cleanupOldBackups()

    } catch (error) {
      logger.error('Database backup failed', { error: error.message })
      throw error
    }
  }

  async backupPostgreSQL(backupFile) {
    const { POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DATABASE } = process.env

    const command = `pg_dump -h ${POSTGRES_HOST} -p ${POSTGRES_PORT} -U ${POSTGRES_USER} -d ${POSTGRES_DATABASE} -f ${backupFile}`

    const env = { ...process.env, PGPASSWORD: POSTGRES_PASSWORD }
    await execAsync(command, { env })
  }

  async backupMySQL(backupFile) {
    const { MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE } = process.env

    const command = `mysqldump -h ${MYSQL_HOST} -P ${MYSQL_PORT} -u ${MYSQL_USER} -p${MYSQL_PASSWORD} ${MYSQL_DATABASE} > ${backupFile}`

    await execAsync(command)
  }

  async backupSQLite(backupFile) {
    const sourcePath = process.env.SQLITE_PATH
    await fs.copyFile(sourcePath, backupFile)
  }

  async backupMongoDB(backupFile) {
    const { MONGODB_URI } = process.env

    const command = `mongodump --uri="${MONGODB_URI}" --out=${this.backupDir}/temp && tar -czf ${backupFile} -C ${this.backupDir}/temp . && rm -rf ${this.backupDir}/temp`

    await execAsync(command)
  }

  async cleanupOldBackups() {
    try {
      const files = await fs.readdir(this.backupDir)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays)

      for (const file of files) {
        const filePath = path.join(this.backupDir, file)
        const stats = await fs.stat(filePath)

        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath)
          logger.info('Old backup cleaned up', { file })
        }
      }
    } catch (error) {
      logger.error('Backup cleanup failed', { error: error.message })
    }
  }
}

// Run backup if called directly
if (require.main === module) {
  const backup = new DatabaseBackup()
  backup.createBackup()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}

module.exports = DatabaseBackup