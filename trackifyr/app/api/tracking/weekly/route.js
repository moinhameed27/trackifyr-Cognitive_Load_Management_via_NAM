import { getSessionTokenFromRequest } from '@/lib/auth-session'
import { getUserIdFromSessionToken } from '@/lib/trackingLiveDb'
import { listRollingDailyAggregatesForUser } from '@/lib/trackingSessionsDb'

export async function GET() {
  const token = await getSessionTokenFromRequest()
  if (!token) {
    return Response.json({ ok: false, weekly: [] }, { status: 401 })
  }
  const userId = await getUserIdFromSessionToken(token)
  if (!userId) {
    return Response.json({ ok: false, weekly: [] }, { status: 401 })
  }
  try {
    const weekly = await listRollingDailyAggregatesForUser(userId)
    return Response.json({ ok: true, weekly })
  } catch {
    return Response.json({ ok: false, weekly: [] }, { status: 500 })
  }
}
