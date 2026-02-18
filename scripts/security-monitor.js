#!/usr/bin/env node

const fs = require('fs').promises
const path = require('path')
const { logger } = require('../src/lib/logger')

class SecurityMonitor {
  constructor() {
    this.logFile = process.env.LOG_FILE || '/app/logs/app.log'
    this.alertThresholds = {
      failedLogins: 5, // Alert if more than 5 failed logins in 5 minutes
      suspiciousRequests: 10, // Alert if more than 10 suspicious requests in 5 minutes
      rateLimitHits: 20, // Alert if more than 20 rate limit hits in 5 minutes
    }
    this.monitoringWindow = 5 * 60 * 1000 // 5 minutes
  }

  async monitor() {
    try {
      const logContent = await fs.readFile(this.logFile, 'utf8')
      const lines = logContent.split('\n').filter(line => line.trim())

      const now = Date.now()
      const windowStart = now - this.monitoringWindow

      const events = {
        failedLogins: [],
        suspiciousRequests: [],
        rateLimitHits: [],
      }

      for (const line of lines) {
        try {
          const logEntry = JSON.parse(line)
          const timestamp = new Date(logEntry.timestamp).getTime()

          if (timestamp >= windowStart) {
            if (logEntry.level === 'security') {
              if (logEntry.message.includes('Failed login')) {
                events.failedLogins.push(logEntry)
              } else if (logEntry.message.includes('Suspicious request') ||
                        logEntry.message.includes('CORS violation') ||
                        logEntry.message.includes('SQL injection attempt')) {
                events.suspiciousRequests.push(logEntry)
              } else if (logEntry.message.includes('Rate limit exceeded')) {
                events.rateLimitHits.push(logEntry)
              }
            }
          }
        } catch (parseError) {
          // Skip malformed log entries
          continue
        }
      }

      // Check thresholds and generate alerts
      await this.checkThresholds(events)

    } catch (error) {
      console.error('Security monitoring error:', error.message)
    }
  }

  async checkThresholds(events) {
    const alerts = []

    if (events.failedLogins.length > this.alertThresholds.failedLogins) {
      alerts.push({
        type: 'FAILED_LOGINS',
        count: events.failedLogins.length,
        threshold: this.alertThresholds.failedLogins,
        message: `High number of failed login attempts detected: ${events.failedLogins.length}`,
        severity: 'high'
      })
    }

    if (events.suspiciousRequests.length > this.alertThresholds.suspiciousRequests) {
      alerts.push({
        type: 'SUSPICIOUS_REQUESTS',
        count: events.suspiciousRequests.length,
        threshold: this.alertThresholds.suspiciousRequests,
        message: `High number of suspicious requests detected: ${events.suspiciousRequests.length}`,
        severity: 'high'
      })
    }

    if (events.rateLimitHits.length > this.alertThresholds.rateLimitHits) {
      alerts.push({
        type: 'RATE_LIMIT_HITS',
        count: events.rateLimitHits.length,
        threshold: this.alertThresholds.rateLimitHits,
        message: `High number of rate limit hits detected: ${events.rateLimitHits.length}`,
        severity: 'medium'
      })
    }

    // Log alerts
    for (const alert of alerts) {
      logger.security(`Security Alert: ${alert.type}`, {
        count: alert.count,
        threshold: alert.threshold,
        severity: alert.severity
      })

      // In production, you would send these to a monitoring service
      console.log(`🚨 SECURITY ALERT: ${alert.message}`)
    }

    if (alerts.length === 0) {
      console.log('✅ Security monitoring: No alerts detected')
    }
  }

  async getSecurityReport() {
    try {
      const logContent = await fs.readFile(this.logFile, 'utf8')
      const lines = logContent.split('\n').filter(line => line.trim())

      const report = {
        period: 'Last 24 hours',
        totalEvents: 0,
        securityEvents: 0,
        breakdown: {
          failedLogins: 0,
          suspiciousRequests: 0,
          rateLimitHits: 0,
          successfulLogins: 0,
        }
      }

      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      for (const line of lines) {
        try {
          const logEntry = JSON.parse(line)
          const timestamp = new Date(logEntry.timestamp)

          if (timestamp >= yesterday) {
            report.totalEvents++

            if (logEntry.level === 'security') {
              report.securityEvents++

              if (logEntry.message.includes('Failed login')) {
                report.breakdown.failedLogins++
              } else if (logEntry.message.includes('Suspicious request') ||
                        logEntry.message.includes('CORS violation') ||
                        logEntry.message.includes('SQL injection attempt')) {
                report.breakdown.suspiciousRequests++
              } else if (logEntry.message.includes('Rate limit exceeded')) {
                report.breakdown.rateLimitHits++
              } else if (logEntry.message.includes('Successful login')) {
                report.breakdown.successfulLogins++
              }
            }
          }
        } catch (parseError) {
          continue
        }
      }

      return report

    } catch (error) {
      logger.error('Failed to generate security report', { error: error.message })
      throw error
    }
  }
}

// Run monitoring if called directly
if (require.main === module) {
  const monitor = new SecurityMonitor()

  if (process.argv[2] === 'report') {
    monitor.getSecurityReport()
      .then(report => {
        console.log('Security Report:')
        console.log(JSON.stringify(report, null, 2))
      })
      .catch(error => {
        console.error('Error generating report:', error.message)
        process.exit(1)
      })
  } else {
    monitor.monitor()
  }
}

module.exports = SecurityMonitor