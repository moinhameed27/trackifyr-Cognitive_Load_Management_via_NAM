export const runtime = 'nodejs'

/**
 * Optional: forward filter mode to the local Electron bridge (127.0.0.1).
 * The Next.js server often cannot reach the user's machine (remote deploy) — always return JSON 200.
 * The dashboard should prefer POSTing directly to the bridge from the browser (`trackingBridgeClient`).
 */

export async function GET() {
  return Response.json({
    ok: true,
    hint: 'POST JSON { "mode": "combined" | "activity" | "webcam" } to forward to the desktop bridge when it is running.',
  })
}

export async function POST(request) {
  let mode = 'combined'
  try {
    const body = await request.json()
    mode = String(body.mode || 'combined')
  } catch {
    /* ignore */
  }
  if (mode !== 'activity' && mode !== 'webcam' && mode !== 'combined') {
    mode = 'combined'
  }

  const bridgePort = process.env.TRACKIFYR_BRIDGE_PORT || '47833'
  try {
    const r = await fetch(`http://127.0.0.1:${bridgePort}/bridge/filter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
      signal: AbortSignal.timeout(2500),
    })
    const data = await r.json().catch(() => ({}))
    return Response.json({
      ok: r.ok,
      mode: data.filterMode || mode,
      bridge: true,
    })
  } catch {
    return Response.json(
      {
        ok: false,
        mode,
        bridge: false,
        reason: 'Bridge not reachable from this server (expected when the app runs on another host). Use the browser bridge client or run the desktop app locally.',
      },
      { status: 200 },
    )
  }
}
