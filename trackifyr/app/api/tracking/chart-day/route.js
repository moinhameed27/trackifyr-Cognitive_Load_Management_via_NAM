import { getSessionTokenFromRequest } from '@/lib/auth-session'
import { getUserIdFromSessionToken } from '@/lib/trackingLiveDb'
import { listTodayBucketsForChart } from '@/lib/trackingSessionsDb'

export async function GET() {
  const token = await getSessionTokenFromRequest()
  if (!token) {
    return Response.json({ ok: false, points: [] }, { status: 401 })
  }
  const userId = await getUserIdFromSessionToken(token)
  if (!userId) {
    return Response.json({ ok: false, points: [] }, { status: 401 })
  }
  try {
    const points = await listTodayBucketsForChart(userId)
    return Response.json({ ok: true, points })
  } catch {
    return Response.json({ ok: false, points: [] }, { status: 500 })
  }
}
