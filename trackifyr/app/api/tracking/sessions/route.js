import { getSessionTokenFromRequest } from '@/lib/auth-session'
import { getUserIdFromSessionToken } from '@/lib/trackingLiveDb'
import { listFiveMinuteSessionsForUser } from '@/lib/trackingSessionsDb'

export async function GET() {
  const token = await getSessionTokenFromRequest()
  if (!token) {
    return Response.json({ ok: false, sessions: [] }, { status: 401 })
  }
  const userId = await getUserIdFromSessionToken(token)
  if (!userId) {
    return Response.json({ ok: false, sessions: [] }, { status: 401 })
  }
  try {
    const sessions = await listFiveMinuteSessionsForUser(userId, 48)
    return Response.json({ ok: true, sessions })
  } catch {
    return Response.json({ ok: false, sessions: [] }, { status: 500 })
  }
}
