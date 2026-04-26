import { getSessionTokenFromRequest } from '@/lib/auth-session'
import { sanitizeTrackingLivePayload } from '@/lib/trackingFeedback'
import { getTrackingLive } from '@/lib/trackingStore'
import {
  getTrackingLivePayloadForUser,
  getUserIdFromSessionToken,
} from '@/lib/trackingLiveDb'
import { getTodayAverageActivityPercent } from '@/lib/trackingSessionsDb'

/** No recent ingest from the desktop app — treat as no live session (~3× dashboard poll) */
const STALE_MS = 35000

/** Payload when no data */
const NO_DATA = {
  hasData: false,
  activity_load: null,
  engagement: null,
  final_cognitive_load: null,
  daily_avg_activity_pct: null,
  feedback_messages: [],
}

/**
 * @param {import('next/server').NextRequest} request
 */
export async function GET(request) {
  const token = await getSessionTokenFromRequest(request)
  if (token) {
    try {
      const userId = await getUserIdFromSessionToken(token)
      if (!userId) {
        return Response.json(NO_DATA)
      }
      let dailyAvg = null
      try {
        dailyAvg = await getTodayAverageActivityPercent(userId)
      } catch {
        dailyAvg = null
      }

      const row = await getTrackingLivePayloadForUser(userId)
      if (row?.payload && typeof row.payload === 'object') {
        const updated = row.updatedAt ? new Date(row.updatedAt).getTime() : 0
        if (!updated || Number.isNaN(updated) || Date.now() - updated > STALE_MS) {
          const safe = sanitizeTrackingLivePayload(row.payload)
          const persistedFeedback = Array.isArray(safe?.feedback_messages) ? safe.feedback_messages : []
          return Response.json({
            ...NO_DATA,
            daily_avg_activity_pct: dailyAvg,
            feedback_messages: persistedFeedback,
          })
        }
        return Response.json({
          ...sanitizeTrackingLivePayload(row.payload),
          hasData: true,
          daily_avg_activity_pct: dailyAvg,
        })
      }
      return Response.json({ ...NO_DATA, daily_avg_activity_pct: dailyAvg })
    } catch {
      return Response.json(NO_DATA)
    }
  }

  const bridgePort = process.env.TRACKIFYR_BRIDGE_PORT || '47833'
  try {
    const r = await fetch(`http://127.0.0.1:${bridgePort}/bridge/live`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(1200),
    })
    if (r.ok) {
      const j = await r.json()
      if (j && j.fused && typeof j.fused === 'object' && j.fused !== null) {
        const keys = Object.keys(j.fused)
        if (keys.length > 0) {
          return Response.json({
            ...sanitizeTrackingLivePayload(j.fused),
            hasData: true,
            daily_avg_activity_pct: null,
          })
        }
      }
    }
  } catch {
    /* fall through */
  }

  const mem = getTrackingLive()
  if (mem && typeof mem === 'object') {
    return Response.json({ ...sanitizeTrackingLivePayload(mem), hasData: true, daily_avg_activity_pct: null })
  }
  return Response.json(NO_DATA)
}
