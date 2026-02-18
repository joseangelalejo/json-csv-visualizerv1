import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const MAX_REQUESTS = 100 // requests per window

export function rateLimitMiddleware(request: NextRequest): NextResponse | null {
  const ip = request.headers.get('x-forwarded-for') ||
             request.headers.get('x-real-ip') ||
             'unknown'

  const key = `rate_limit_${ip}`
  const now = Date.now()
  const windowStart = now - WINDOW_MS

  let entry = rateLimitStore.get(key)

  if (!entry || entry.resetTime < windowStart) {
    entry = { count: 1, resetTime: now + WINDOW_MS }
  } else {
    entry.count++
  }

  rateLimitStore.set(key, entry)

  // Clean up old entries periodically
  if (Math.random() < 0.01) { // 1% chance to clean up
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetTime < windowStart) {
        rateLimitStore.delete(k)
      }
    }
  }

  if (entry.count > MAX_REQUESTS) {
    logger.security('Rate limit exceeded', {
      ip,
      count: entry.count,
      userAgent: request.headers.get('user-agent') || 'unknown'
    })
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: {
        'Retry-After': Math.ceil((entry.resetTime - now) / 1000).toString(),
        'X-RateLimit-Limit': MAX_REQUESTS.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': entry.resetTime.toString(),
      },
    })
  }

  return null
}