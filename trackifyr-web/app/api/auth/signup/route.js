import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { query } from '../../../lib/db'

export const runtime = 'nodejs'

export async function POST(req) {
  try {
    const body = await req.json()
    const { fullName, email, password, role } = body || {}

    if (!fullName || !email || !password) {
      return NextResponse.json(
        { success: false, error: 'fullName, email, and password are required' },
        { status: 400 },
      )
    }

    const normalizedEmail = String(email).toLowerCase().trim()

    const passwordHash = await bcrypt.hash(String(password), 10)

    // Ensure table exists (simple dev-time safety).
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

    const result = await query(
      `
      INSERT INTO users (full_name, email, password_hash, role)
      VALUES ($1, $2, $3, COALESCE($4, 'Student'))
      RETURNING id, full_name, email, role
    `,
      [String(fullName).trim(), normalizedEmail, passwordHash, role],
    )

    const user = result.rows[0]
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
      },
    })
  } catch (err) {
    // Unique constraint violation => email already exists
    if (String(err?.message || '').includes('users_email_key')) {
      return NextResponse.json({ success: false, error: 'Email already exists' }, { status: 409 })
    }
    return NextResponse.json(
      { success: false, error: 'Failed to sign up' },
      { status: 500 },
    )
  }
}

