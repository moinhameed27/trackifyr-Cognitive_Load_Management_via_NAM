import { getSessionTokenFromRequest } from '@/lib/auth-session'
import { getTrackingLive, setTrackingLive } from '@/lib/trackingStore'
import { applySustainedLoadFeedback } from '@/lib/trackingFeedback'
import {
  getTrackingLivePayloadForUser,
  getUserIdFromSessionToken,
  upsertTrackingLiveForUser,
} from '@/lib/trackingLiveDb'
import { mergeIngestIntoFiveMinuteBucket } from '@/lib/trackingSessionsDb'

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
      const prev = await getTrackingLivePayloadForUser(userId)
      const enriched = applySustainedLoadFeedback(body, prev?.payload || null)
      await upsertTrackingLiveForUser(userId, enriched)
      try {
        await mergeIngestIntoFiveMinuteBucket(userId, enriched)
      } catch {
        /* bucket aggregation is best-effort */
      }
      return Response.json({ ok: true })
    }

    // Legacy: unauthenticated ingest (local dev only) — in-memory, not user-scoped
    const prev = getTrackingLive()
    const enriched = applySustainedLoadFeedback(body, prev)
    setTrackingLive(enriched)
    return Response.json({ ok: true })
  } catch {
    return Response.json({ ok: false }, { status: 400 })
  }
}
