import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { query } from '../../../../lib/db'

export const runtime = 'nodejs'

const SESSION_COOKIE_NAME = 'trackifyr_session'

function makeExpiryDate(days = 7) {
  const ms = days * 24 * 60 * 60 * 1000
  return new Date(Date.now() + ms)
}

export async function POST(req) {
  try {
    const body = await req.json()
    const { email, password } = body || {}

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 })
    }

    const normalizedEmail = String(email).toLowerCase().trim()

    await query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)

    // Make sure users table exists too (signin on fresh DB).
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'Student',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)

    const userRes = await query(
      `
      SELECT id, full_name, email, password_hash, role
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
      [normalizedEmail],
    )

    const user = userRes.rows[0]
    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 })
    }

    const ok = await bcrypt.compare(String(password), user.password_hash)
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 })
    }

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = makeExpiryDate(7)

    await query(
      `
      INSERT INTO sessions (user_id, token, expires_at)
      VALUES ($1, $2, $3)
    `,
      [user.id, token, expiresAt],
    )

    const res = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
      },
    })

    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    })

    return res
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Failed to sign in' }, { status: 500 })
  }
}

