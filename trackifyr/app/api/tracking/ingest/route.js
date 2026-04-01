import { getSessionTokenFromRequest } from '@/lib/auth-session'
import { getUserIdFromSessionToken, upsertTrackingLiveForUser } from '@/lib/trackingLiveDb'
import { setTrackingLive } from '@/lib/trackingStore'

export async function POST(request) {
  try {
    const body = await request.json()
    if (!body || typeof body !== 'object') {
      return Response.json({ ok: false, error: 'invalid_body' }, { status: 400 })
    }

    const token = await getSessionTokenFromRequest(request)
    if (token) {
      const userId = await getUserIdFromSessionToken(token)
      if (!userId) {
        return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
      }
      await upsertTrackingLiveForUser(userId, body)
      return Response.json({ ok: true })
    }

    // Legacy: unauthenticated ingest (local dev only) — in-memory, not user-scoped
    setTrackingLive(body)
    return Response.json({ ok: true })
  } catch {
    return Response.json({ ok: false }, { status: 400 })
  }
}
