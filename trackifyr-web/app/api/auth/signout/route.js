import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { query } from '../../../lib/db'

export const runtime = 'nodejs'

const SESSION_COOKIE_NAME = 'trackifyr_session'

export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  try {
    if (token) {
      await query(`DELETE FROM sessions WHERE token = $1`, [token])
    }
  } catch {
    // Even if session deletion fails, still clear cookie.
  }

  const res = NextResponse.json({ success: true })
  res.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
  })
  return res
}

