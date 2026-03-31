import { getTrackingLive } from '@/lib/trackingStore'

/** Payload when no bridge and no ingest has ever populated the store */
const NO_DATA = {
  hasData: false,
  activity_load: null,
  engagement: null,
  final_cognitive_load: null,
  blinks: null,
  gaze_away: null,
}

export async function GET() {
  const bridgePort = process.env.TRACKIFYR_BRIDGE_PORT || '47833'
  try {
    const r = await fetch(`http://127.0.0.1:${bridgePort}/bridge/live`, { cache: 'no-store' })
    if (r.ok) {
      const j = await r.json()
      if (j && j.fused && typeof j.fused === 'object' && j.fused !== null) {
        const keys = Object.keys(j.fused)
        if (keys.length > 0) {
          return Response.json({ ...j.fused, hasData: true })
        }
      }
    }
  } catch {
    /* fall through */
  }
  const mem = getTrackingLive()
  if (mem && typeof mem === 'object') {
    return Response.json({ ...mem, hasData: true })
  }
  return Response.json(NO_DATA)
}
