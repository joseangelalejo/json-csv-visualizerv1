import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:80', 'https://localhost:443']

export function corsMiddleware(request: NextRequest): NextResponse | null {
  const origin = request.headers.get('origin')

  // Check if origin is allowed
  if (origin && !allowedOrigins.includes(origin)) {
    logger.security('CORS violation attempt', {
      origin,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    })
    return new NextResponse('Forbidden', { status: 403 })
  }

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': origin || allowedOrigins[0],
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  return null
}

export function securityHeadersMiddleware(): Record<string, string> {
  return {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-XSS-Protection': '1; mode=block',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'",
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  }
}