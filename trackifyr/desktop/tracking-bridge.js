'use strict'

const fs = require('fs')
const http = require('http')
const path = require('path')
const { spawn } = require('child_process')
const readline = require('readline')
const { fuseTracking } = require('./fusion.js')

/** @type {() => string} */
let getIngestToken = () => ''

function setIngestTokenGetter(fn) {
  if (typeof fn === 'function') getIngestToken = fn
}

const DEFAULT_BRIDGE_PORT = Number(process.env.TRACKIFYR_BRIDGE_PORT || 47833)
const ACTIVITY_INTERVAL_SEC = 10
const WEBCAM_JSON_INTERVAL = 10

let activityProc = null
let webcamProc = null
let lastActivity = null
let lastWebcam = null
let lastFused = null
let webcamEnabled = false
/** @type {'combined' | 'activity' | 'webcam'} */
let filterMode = 'combined'

let httpServer = null
/** @type {() => import('electron').BrowserWindow | null} */
let getMainWindow = () => null

function repoRoot() {
  const envRoot = (process.env.TRACKIFYR_TRACKING_ROOT || '').trim()
  if (envRoot) return envRoot
  if (process.resourcesPath) {
    const bundled = path.join(process.resourcesPath, 'python-tracking')
    try {
      if (fs.existsSync(path.join(bundled, 'activity_tracker.py'))) return bundled
    } catch {
      /* ignore */
    }
  }
  return path.join(__dirname, '..')
}

function pythonExecutable() {
  return (process.env.TRACKIFYR_PYTHON || 'python').trim() || 'python'
}

function broadcastUpdate() {
  const win = getMainWindow && getMainWindow()
  if (!win || win.isDestroyed()) return
  win.webContents.send('trackifyr:tracking', {
    activityData: lastActivity,
    webcamData: lastWebcam,
    fused: lastFused,
    filterMode,
    webcamEnabled,
  })
}

async function pushToNextIngest() {
  if (!lastFused) return
  const base = (process.env.TRACKIFYR_API_BASE || 'http://localhost:3000').replace(/\/$/, '')
  const headers = { 'Content-Type': 'application/json' }
  const t = (getIngestToken && getIngestToken()) || ''
  if (t) headers.Authorization = `Bearer ${t}`
  try {
    const res = await fetch(`${base}/api/tracking/ingest`, {
      method: 'POST',
      headers,
      body: JSON.stringify(lastFused),
    })
    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      console.warn(
        '[trackifyr] ingest failed',
        res.status,
        t ? '(with token)' : '(no token — dashboard will stay empty)',
        errBody.slice(0, 200),
      )
    }
  } catch (err) {
    console.warn('[trackifyr] ingest network error', base, err && err.message)
  }
}

function tryFuse() {
  const act = lastActivity
  if (!act || typeof act.activity_percentage !== 'number') {
    lastFused = null
    return
  }
  const actPct = act.activity_percentage
  const w = lastWebcam

  if (filterMode === 'activity') {
    lastFused = fuseTracking({
      activity_percentage: actPct,
      final_model_load: 'Medium',
      blinks: 0,
      gaze_away: 0,
      face_detected: true,
    })
    broadcastUpdate()
    void pushToNextIngest()
    return
  }

  if (filterMode === 'webcam') {
    if (!w || typeof w.final_model_load !== 'string') {
      lastFused = null
      broadcastUpdate()
      return
    }
    lastFused = fuseTracking({
      activity_percentage: 0,
      final_model_load: w.final_model_load,
      blinks: w.blinks,
      gaze_away: w.gaze_away,
      face_detected: w.face_detected,
    })
    broadcastUpdate()
    void pushToNextIngest()
    return
  }

  if (!webcamEnabled || !w || typeof w.final_model_load !== 'string') {
    lastFused = fuseTracking({
      activity_percentage: actPct,
      final_model_load: 'Medium',
      blinks: 0,
      gaze_away: 0,
      face_detected: true,
    })
  } else {
    lastFused = fuseTracking({
      activity_percentage: actPct,
      final_model_load: w.final_model_load,
      blinks: w.blinks,
      gaze_away: w.gaze_away,
      face_detected: w.face_detected,
    })
  }
  broadcastUpdate()
  void pushToNextIngest()
}

function wireStdoutJson(proc, onObj) {
  const rl = readline.createInterface({ input: proc.stdout })
  rl.on('line', (line) => {
    const j = safeJsonLine(line)
    if (j) onObj(j)
  })
  proc.stderr?.on('data', () => {})
}

function safeJsonLine(line) {
  const s = String(line || '').trim()
  if (!s) return null
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

function stopChildren() {
  if (activityProc) {
    try {
      activityProc.kill()
    } catch {
      /* ignore */
    }
    activityProc = null
  }
  if (webcamProc) {
    try {
      webcamProc.kill()
    } catch {
      /* ignore */
    }
    webcamProc = null
  }
  lastActivity = null
  lastWebcam = null
  lastFused = null
}

function startTracking(opts = {}) {
  stopChildren()
  webcamEnabled = Boolean(opts.webcam)
  const root = repoRoot()
  const py = pythonExecutable()

  activityProc = spawn(py, ['activity_tracker.py', '--interval', String(ACTIVITY_INTERVAL_SEC)], {
    cwd: root,
    env: process.env,
  })
  activityProc.on('error', (err) => {
    console.error('[trackifyr] activity_tracker spawn error', root, err && err.message)
  })
  activityProc.on('exit', (code, signal) => {
    if (code && code !== 0) {
      console.error('[trackifyr] activity_tracker exited', code, signal, 'cwd=', root)
    }
  })
  wireStdoutJson(activityProc, (j) => {
    lastActivity = j
    tryFuse()
  })

  if (webcamEnabled) {
    webcamProc = spawn(
      py,
      [
        'webcam_cognitive_load.py',
        '--stream-json',
        '--json-interval',
        String(WEBCAM_JSON_INTERVAL),
        '--device',
        'auto',
      ],
      { cwd: root, env: process.env },
    )
    wireStdoutJson(webcamProc, (j) => {
      lastWebcam = j
      tryFuse()
    })
  }

  broadcastUpdate()
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(obj))
}

function startHttpServer() {
  if (httpServer) return
  httpServer = http.createServer((req, res) => {
    const u = String(req.url || '').split('?')[0]
    if (req.method === 'GET' && u === '/bridge/live') {
      json(res, 200, {
        ok: true,
        activityData: lastActivity,
        webcamData: lastWebcam,
        fused: lastFused,
        filterMode,
        webcamEnabled,
      })
      return
    }
    if (req.method === 'POST' && u === '/bridge/start') {
      let body = ''
      req.on('data', (c) => {
        body += c
      })
      req.on('end', () => {
        let opts = {}
        try {
          opts = JSON.parse(body || '{}')
        } catch {
          opts = {}
        }
        startTracking({ webcam: Boolean(opts.webcam) })
        json(res, 200, { ok: true })
      })
      return
    }
    if (req.method === 'POST' && u === '/bridge/stop') {
      stopChildren()
      broadcastUpdate()
      json(res, 200, { ok: true })
      return
    }
    if (req.method === 'POST' && u === '/bridge/filter') {
      let body = ''
      req.on('data', (c) => {
        body += c
      })
      req.on('end', () => {
        try {
          const o = JSON.parse(body || '{}')
          const m = String(o.mode || 'combined')
          if (m === 'activity' || m === 'webcam' || m === 'combined') filterMode = m
        } catch {
          /* ignore */
        }
        tryFuse()
        json(res, 200, { ok: true, filterMode })
      })
      return
    }
    json(res, 404, { ok: false, error: 'not_found' })
  })
  httpServer.listen(DEFAULT_BRIDGE_PORT, '127.0.0.1', () => {
    /* ready */
  })
}

function registerIpc(ipcMain) {
  ipcMain.handle('trackifyr:tracking:start', (_e, payload) => {
    startTracking({ webcam: Boolean(payload && payload.webcam) })
    return { ok: true }
  })
  ipcMain.handle('trackifyr:tracking:stop', () => {
    stopChildren()
    broadcastUpdate()
    return { ok: true }
  })
  ipcMain.handle('trackifyr:tracking:setFilter', (_e, payload) => {
    const m = String((payload && payload.mode) || 'combined')
    if (m === 'activity' || m === 'webcam' || m === 'combined') filterMode = m
    tryFuse()
    return { ok: true, filterMode }
  })
  ipcMain.handle('trackifyr:tracking:getState', () => ({
    activityData: lastActivity,
    webcamData: lastWebcam,
    fused: lastFused,
    filterMode,
    webcamEnabled,
  }))
}

function setMainWindowGetter(fn) {
  getMainWindow = fn
}

module.exports = {
  startHttpServer,
  registerIpc,
  setMainWindowGetter,
  setIngestTokenGetter,
  startTracking,
  stopChildren,
}
