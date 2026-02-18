import { NextRequest, NextResponse } from 'next/server'
import { registerUser, generateToken } from '@/lib/auth'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const { username, email, password, confirmPassword } = await request.json()

    if (!username || !email || !password || !confirmPassword) {
      return NextResponse.json({ error: 'username, email and both password fields are required' }, { status: 400 })
    }

    // Basic validation
    if (typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string' || typeof confirmPassword !== 'string') {
      return NextResponse.json({ error: 'Invalid input types' }, { status: 400 })
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 })
    }

    if (username.length < 3 || password.length < 6) {
      return NextResponse.json({ error: 'Invalid username or password length' }, { status: 400 })
    }

    // Create user (in-memory)
    const user = await registerUser(username.trim(), email.trim(), password)

    // Generate token for immediate login
    const token = generateToken(user)

    logger.info(`New user registered: ${username}`, { userId: user.id })

    return NextResponse.json({ token, user: { id: user.id, username: user.username, role: user.role, email: user.email } }, { status: 201 })
  } catch (error: any) {
    logger.error('Registration failed', { error: error.message })
    return NextResponse.json({ error: error.message || 'Registration failed' }, { status: 400 })
  }
}
