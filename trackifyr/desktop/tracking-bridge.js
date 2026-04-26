'use strict'

const fs = require('fs')
const http = require('http')
const path = require('path')
const { spawn, spawnSync } = require('child_process')
const readline = require('readline')
const { fuseTracking } = require('./fusion.js')

// #region agent log
const AGENT_LOG = 'http://127.0.0.1:7902/ingest/12dc9b3d-fb1e-4500-92ef-90b256789304'
const DEBUG_LOG_FILE = path.join(__dirname, '..', '.cursor', 'debug-6cdaaf.log')
function appendDebugNdjson(payload) {
  try {
    const dir = path.dirname(DEBUG_LOG_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(DEBUG_LOG_FILE, `${JSON.stringify(payload)}\n`, 'utf8')
  } catch {
    /* ignore */
  }
}
function dbgAgent(hypothesisId, location, message, data) {
  const payload = {
    sessionId: '6cdaaf',
    hypothesisId,
    location,
    message,
    data: data || {},
    timestamp: Date.now(),
  }
  appendDebugNdjson(payload)
  fetch(AGENT_LOG, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '6cdaaf' },
    body: JSON.stringify(payload),
  }).catch(() => {})
}
// #endregion

/** @type {() => string} */
let getIngestToken = () => ''

function setIngestTokenGetter(fn) {
  if (typeof fn === 'function') getIngestToken = fn
}

const DEFAULT_BRIDGE_PORT = Number(process.env.TRACKIFYR_BRIDGE_PORT || 47833)
const ACTIVITY_INTERVAL_SEC = Math.max(1, Number(process.env.TRACKIFYR_ACTIVITY_INTERVAL_SEC) || 5)
const WEBCAM_JSON_INTERVAL = Math.max(1, Number(process.env.TRACKIFYR_WEBCAM_JSON_INTERVAL_SEC) || 5)
const WEBCAM_RELAUNCH_MS = Math.max(500, Number(process.env.TRACKIFYR_WEBCAM_RELAUNCH_MS) || 2000)
const WEBCAM_RELAUNCH_MAX = Math.max(0, Number(process.env.TRACKIFYR_WEBCAM_RELAUNCH_MAX) || 5)
/** Warn if no valid JSON line within this window (ms) after spawn or after last line */
const WEBCAM_STALL_MS = Math.max(15000, Number(process.env.TRACKIFYR_WEBCAM_STALL_MS) || 45000)

/** @type {{ cmd: string, prefixArgs: string[] } | null} */
let resolvedPythonCmd = null
let webcamRelaunchTimer = null
let webcamRelaunchAttempts = 0
/** @type {ReturnType<typeof setInterval> | null} */
let webcamStallTimer = null
let webcamSpawnAt = 0
let webcamLastJsonAt = 0
let webcamStallWarned = false
/** Last `{ _trackifyr_error }` line from Python stdout, if any */
let lastWebcamErrorJson = null

let activityProc = null
let webcamProc = null
let lastActivity = null
let lastWebcam = null
let lastFused = null
let webcamEnabled = false
/** @type {null | 'no_models' | 'exited' | 'dependency'} */
let webcamPipelineError = null
/** Set when a missing Python package or import failure is detected — blocks useless relaunches */
let webcamDependencyBlocked = false
/** Last stderr from webcam_cognitive_load (capped) for UI + debug */
let lastWebcamStderr = ''
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

function daiseeArtifactsDir(root) {
  return path.join(root, 'artifacts', 'daisee')
}

/** Same defaults as webcam_cognitive_load.py / ml.daisee_common.ARTIFACTS_DIR */
function resolveDaiseeModelPaths(root) {
  const dir = daiseeArtifactsDir(root)
  const v1 = String(process.env.TRACKIFYR_V1_MODEL || '').trim() || path.join(dir, 'v1_rf.joblib')
  const v2 = String(process.env.TRACKIFYR_V2_MODEL || '').trim() || path.join(dir, 'v2_rf.joblib')
  const v3 = String(process.env.TRACKIFYR_V3_MODEL || '').trim() || path.join(dir, 'v3_cnn.pt')
  return {
    v1: path.resolve(v1),
    v2: path.resolve(v2),
    v3: path.resolve(v3),
  }
}

function hasWebcamModels(root) {
  if (String(process.env.TRACKIFYR_SKIP_WEBCAM_MODEL_CHECK || '').trim() === '1') return true
  const mp = resolveDaiseeModelPaths(root)
  try {
    return fs.existsSync(mp.v1) && fs.existsSync(mp.v2) && fs.existsSync(mp.v3)
  } catch {
    return false
  }
}

function pythonExecutable() {
  return (process.env.TRACKIFYR_PYTHON || 'python').trim() || 'python'
}

/**
 * Pick a working `python` / `py -3` (Windows) once per process so subprocesses match.
 * Respects TRACKIFYR_PYTHON if set (first token = exe, rest = prefix args).
 */
function resolvePythonCommand() {
  if (resolvedPythonCmd) return resolvedPythonCmd
  const envLine = String(process.env.TRACKIFYR_PYTHON || '').trim()
  if (envLine) {
    const parts = envLine.split(/\s+/).filter(Boolean)
    resolvedPythonCmd = { cmd: parts[0], prefixArgs: parts.slice(1) }
    console.log('[trackifyr] Python from TRACKIFYR_PYTHON:', resolvedPythonCmd.cmd, resolvedPythonCmd.prefixArgs)
    return resolvedPythonCmd
  }
  const candidates =
    process.platform === 'win32'
      ? [
          ['py', ['-3']],
          ['python', []],
          ['py', []],
        ]
      : [
          ['python3', []],
          ['python', []],
        ]
  for (const [cmd, prefixArgs] of candidates) {
    try {
      const r = spawnSync(cmd, [...prefixArgs, '-c', 'print(1)'], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 12000,
      })
      if (r.status === 0 && !r.error) {
        resolvedPythonCmd = { cmd, prefixArgs }
        console.log('[trackifyr] resolved Python:', cmd, prefixArgs.join(' '))
        return resolvedPythonCmd
      }
    } catch {
      /* try next */
    }
  }
  resolvedPythonCmd = { cmd: process.platform === 'win32' ? 'python' : 'python3', prefixArgs: [] }
  console.warn('[trackifyr] could not probe Python; falling back to', resolvedPythonCmd.cmd)
  return resolvedPythonCmd
}

function pythonSpawnArgs(scriptName, scriptArgs) {
  const { cmd, prefixArgs } = resolvePythonCommand()
  return { cmd, args: [...prefixArgs, '-u', scriptName, ...scriptArgs] }
}

function pythonEnv(cwdRoot) {
  const env = {
    ...process.env,
    PYTHONUNBUFFERED: '1',
    PYTHONIOENCODING: 'utf-8',
  }
  if (cwdRoot) {
    const sep = process.platform === 'win32' ? ';' : ':'
    const extra = String(env.PYTHONPATH || '').trim()
    env.PYTHONPATH = extra ? `${cwdRoot}${sep}${extra}` : cwdRoot
  }
  return env
}

/** Match Python 3 ModuleNotFoundError / ImportError text */
const RE_NO_MODULE = /No module named ['"]([^'"]+)['"]/g

/**
 * @param {string} text
 * @returns {string | null}
 */
function parseModuleNotFoundFromStderr(text) {
  if (!text) return null
  RE_NO_MODULE.lastIndex = 0
  let m = RE_NO_MODULE.exec(text)
  let last = null
  while (m) {
    last = m[1]
    m = RE_NO_MODULE.exec(text)
  }
  return last
}

/**
 * Preflight: same interpreter as tracking (`py -3` or TRACKIFYR_PYTHON).
 * Uses importlib (authoritative); optional pip list snippet on failure for logs.
 * @param {string} root
 * @returns {{ ok: boolean, missing?: string, pipSnippet?: string }}
 */
function verifyWebcamPythonDeps(root) {
  const { cmd, prefixArgs } = resolvePythonCommand()
  const probe = [
    'import importlib,sys',
    "mods=('cv2','joblib','numpy','torch','mediapipe','pandas','sklearn','torchvision')",
    'for m in mods:',
    '  try:',
    '    importlib.import_module(m)',
    '  except ImportError as e:',
    '    print(getattr(e,"name",None) or m,file=sys.stderr); sys.exit(2)',
    'sys.exit(0)',
  ].join('\n')
  const r = spawnSync(cmd, [...prefixArgs, '-c', probe], {
    cwd: root,
    env: pythonEnv(root),
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
  })
  if (r.status === 0 && !r.error) return { ok: true }
  const errText = `${r.stderr || ''}\n${r.stdout || ''}`
  const missing = parseModuleNotFoundFromStderr(errText) || String(errText || '').trim().split(/\s+/)[0] || 'unknown'
  let pipSnippet = ''
  try {
    const pip = spawnSync(cmd, [...prefixArgs, '-m', 'pip', 'list'], {
      cwd: root,
      env: pythonEnv(root),
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
    })
    const pl = (pip.stdout || '') + (pip.stderr || '')
    pipSnippet = pl.split('\n').slice(0, 40).join('\n')
  } catch {
    /* ignore */
  }
  return { ok: false, missing, pipSnippet }
}

function markWebcamDependencyFailure(missingLabel, extraStderr) {
  const first = !webcamDependencyBlocked
  webcamDependencyBlocked = true
  webcamPipelineError = 'dependency'
  lastWebcam = null
  const tail = (extraStderr || '').slice(-8000)
  if (tail) lastWebcamStderr = (lastWebcamStderr + '\n' + tail).slice(-32000)
  if (first) console.error('[trackifyr] Missing Python dependency:', missingLabel)
  if (extraStderr && process.env.TRACKIFYR_WEBCAM_DEBUG_DEPS === '1') {
    console.error('[trackifyr] dependency debug stderr:\n', extraStderr.slice(0, 4000))
  }
}

function webcamErrorDetailString() {
  if (lastWebcamErrorJson && typeof lastWebcamErrorJson === 'object') {
    const s = lastWebcamErrorJson
    return [s.stage, s.message, s.exc_type, s.path].filter(Boolean).join(' — ').slice(0, 500)
  }
  return ''
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
    webcamPipelineError,
    webcamStderrTail: lastWebcamStderr.slice(-1200),
    webcamErrorDetail: webcamErrorDetailString(),
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

function pickWebcamProba(w) {
  if (!w || !Array.isArray(w.cognitive_proba) || w.cognitive_proba.length !== 3) return undefined
  return w.cognitive_proba
}

function pickWebcamLabel(w, key) {
  if (!w || typeof w[key] !== 'string') return undefined
  const v = String(w[key]).trim()
  return v === 'Low' || v === 'Medium' || v === 'High' ? v : undefined
}

function fusedWithMode(fused) {
  return fused ? { ...fused, filter_mode: filterMode } : null
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
    lastFused = fusedWithMode(fuseTracking({
      activity_percentage: actPct,
      final_model_load: 'Medium',
      blinks: 0,
      gaze_away: 0,
      face_detected: true,
      synthetic_webcam: true,
      webcam_ml_waiting: true,
    }))
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
    lastFused = fusedWithMode(fuseTracking({
      activity_percentage: 0,
      final_model_load: w.final_model_load,
      blinks: w.blinks,
      gaze_away: w.gaze_away,
      face_detected: w.face_detected,
      synthetic_webcam: false,
      cognitive_proba: pickWebcamProba(w),
      v1_prediction: pickWebcamLabel(w, 'v1_prediction'),
      v2_prediction: pickWebcamLabel(w, 'v2_prediction'),
      v3_prediction: pickWebcamLabel(w, 'v3_prediction'),
    }))
    broadcastUpdate()
    void pushToNextIngest()
    return
  }

  const noWebcamJson = !w || typeof w.final_model_load !== 'string'
  if (!webcamEnabled) {
    lastFused = fusedWithMode(fuseTracking({
      activity_percentage: actPct,
      final_model_load: 'Medium',
      blinks: 0,
      gaze_away: 0,
      face_detected: true,
      synthetic_webcam: true,
      webcam_ml_waiting: false,
    }))
  } else if (noWebcamJson) {
    lastFused = fusedWithMode(fuseTracking({
      activity_percentage: actPct,
      final_model_load: 'Medium',
      blinks: 0,
      gaze_away: 0,
      face_detected: true,
      synthetic_webcam: true,
      webcam_ml_waiting: true,
    }))
  } else {
    lastFused = fusedWithMode(fuseTracking({
      activity_percentage: actPct,
      final_model_load: w.final_model_load,
      blinks: w.blinks,
      gaze_away: w.gaze_away,
      face_detected: w.face_detected,
      synthetic_webcam: false,
      cognitive_proba: pickWebcamProba(w),
      v1_prediction: pickWebcamLabel(w, 'v1_prediction'),
      v2_prediction: pickWebcamLabel(w, 'v2_prediction'),
      v3_prediction: pickWebcamLabel(w, 'v3_prediction'),
    }))
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

function clearWebcamStallWatch() {
  if (webcamStallTimer) {
    try {
      clearInterval(webcamStallTimer)
    } catch {
      /* ignore */
    }
    webcamStallTimer = null
  }
}

function startWebcamStallWatch() {
  clearWebcamStallWatch()
  webcamSpawnAt = Date.now()
  webcamLastJsonAt = 0
  webcamStallWarned = false
  webcamStallTimer = setInterval(() => {
    if (!webcamProc || !webcamEnabled) return
    const ref = webcamLastJsonAt || webcamSpawnAt
    const idle = Date.now() - ref
    if (idle < WEBCAM_STALL_MS) return
    if (webcamStallWarned) return
    webcamStallWarned = true
    console.warn(
      '[trackifyr webcam STALL] no valid JSON on stdout for',
      Math.round(idle / 1000),
      's — check stderr / Python env (torch, opencv, mediapipe)',
    )
  }, 20000)
}

/**
 * Webcam process: log every stdout line; handle `{ _trackifyr_error }` lines; validate fused payload shape.
 */
function wireWebcamStdout(proc, onValidPayload) {
  const rl = readline.createInterface({ input: proc.stdout })
  rl.on('line', (line) => {
    const trimmed = String(line || '').trim()
    if (!trimmed) return
    if (process.env.TRACKIFYR_WEBCAM_DEBUG_STDOUT === '1') {
      console.log('[trackifyr webcam stdout]', trimmed.slice(0, 800))
    }
    const j = safeJsonLine(trimmed)
    if (!j) {
      console.warn(
        '[trackifyr webcam] stdout JSON parse failed, len=',
        trimmed.length,
        'preview=',
        trimmed.slice(0, 200),
      )
      return
    }
    if (j._trackifyr_event) {
      if (process.env.TRACKIFYR_WEBCAM_DEBUG_STDOUT === '1') {
        console.log('[trackifyr webcam event]', j._trackifyr_event)
      }
      return
    }
    if (j._trackifyr_error === true) {
      lastWebcamErrorJson = j
      if (j.error === 'missing_dependency') {
        const mod = j.module || parseModuleNotFoundFromStderr(String(j.message || '')) || 'unknown'
        markWebcamDependencyFailure(mod, '')
        const detail = [j.stage, j.message].filter(Boolean).join(' — ')
        console.error('[trackifyr webcam] Python missing dependency:', detail)
        tryFuse()
        broadcastUpdate()
        return
      }
      const detail = [j.stage, j.message, j.exc_type, j.path].filter(Boolean).join(' — ')
      lastWebcamStderr = (lastWebcamStderr + '\n[stdout-error] ' + detail).slice(-32000)
      webcamPipelineError = 'exited'
      lastWebcam = null
      console.error('[trackifyr webcam] Python reported error:', detail)
      tryFuse()
      broadcastUpdate()
      return
    }
    if (typeof j.final_model_load !== 'string') {
      console.warn('[trackifyr webcam] JSON line missing string final_model_load, keys=', Object.keys(j))
      return
    }
    webcamLastJsonAt = Date.now()
    webcamStallWarned = false
    lastWebcamErrorJson = null
    onValidPayload(j)
  })
}

function safeJsonLine(line) {
  let s = String(line || '').trim()
  if (!s) return null
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1)
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

function stopChildren() {
  if (webcamRelaunchTimer) {
    try {
      clearTimeout(webcamRelaunchTimer)
    } catch {
      /* ignore */
    }
    webcamRelaunchTimer = null
  }
  webcamRelaunchAttempts = 0
  webcamDependencyBlocked = false
  clearWebcamStallWatch()
  lastWebcamErrorJson = null
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
  webcamEnabled = false
  webcamPipelineError = null
}

function scheduleWebcamRelaunch() {
  if (!webcamEnabled) return
  if (webcamDependencyBlocked) return
  if (webcamProc) return
  if (webcamRelaunchAttempts >= WEBCAM_RELAUNCH_MAX) {
    console.warn('[trackifyr] webcam ML: max relaunch attempts reached')
    return
  }
  webcamRelaunchAttempts += 1
  if (webcamRelaunchTimer) clearTimeout(webcamRelaunchTimer)
  webcamRelaunchTimer = setTimeout(() => {
    webcamRelaunchTimer = null
    if (!webcamEnabled || webcamProc) return
    console.warn('[trackifyr] relaunching webcam ML subprocess, attempt', webcamRelaunchAttempts)
    spawnWebcamPipeline()
  }, WEBCAM_RELAUNCH_MS)
}

function spawnWebcamPipeline() {
  if (webcamProc) return
  const root = repoRoot()
  const modelPaths = resolveDaiseeModelPaths(root)
  const hasModels = hasWebcamModels(root)
  // #region agent log
  dbgAgent('H2', 'tracking-bridge:spawnWebcamPipeline', 'pre_check', {
    root,
    hasModels,
    v1: modelPaths.v1,
    v2: modelPaths.v2,
    v3: modelPaths.v3,
  })
  // #endregion
  if (!hasModels) {
    const miss = []
    if (!fs.existsSync(modelPaths.v1)) miss.push(`v1=${modelPaths.v1}`)
    if (!fs.existsSync(modelPaths.v2)) miss.push(`v2=${modelPaths.v2}`)
    if (!fs.existsSync(modelPaths.v3)) miss.push(`v3=${modelPaths.v3}`)
    console.error('[trackifyr] webcam ML missing files:', miss.join(' | '), 'cwd=', root)
    // #region agent log
    dbgAgent('H2', 'tracking-bridge:spawnWebcamPipeline', 'no_models_skip', { miss })
    // #endregion
    webcamPipelineError = 'no_models'
    tryFuse()
    broadcastUpdate()
    return
  }
  if (webcamDependencyBlocked) return

  const depCheck = verifyWebcamPythonDeps(root)
  if (!depCheck.ok) {
    markWebcamDependencyFailure(
      depCheck.missing || 'unknown',
      depCheck.pipSnippet ? `pip list (first lines):\n${depCheck.pipSnippet}` : '',
    )
    tryFuse()
    broadcastUpdate()
    return
  }

  webcamPipelineError = null
  lastWebcamStderr = ''
  lastWebcamErrorJson = null
  const camIdx = String(process.env.TRACKIFYR_WEBCAM_INDEX ?? '0').trim() || '0'
  const { cmd: pyCmd, args: pyArgs } = pythonSpawnArgs('webcam_cognitive_load.py', [
    '--stream-json',
    '--json-interval',
    String(WEBCAM_JSON_INTERVAL),
    '--camera',
    camIdx,
    '--device',
    'auto',
    '--v1-model',
    modelPaths.v1,
    '--v2-model',
    modelPaths.v2,
    '--v3-model',
    modelPaths.v3,
  ])
  console.log(
    '[trackifyr] spawning webcam ML:',
    pyCmd,
    pyArgs.slice(0, 6).join(' '),
    '… cwd=',
    root,
  )
  webcamProc = spawn(pyCmd, pyArgs, { cwd: root, env: pythonEnv(root), windowsHide: true })
  startWebcamStallWatch()
  // #region agent log
  dbgAgent('H2', 'tracking-bridge:spawnWebcamPipeline', 'spawned', { pid: webcamProc.pid, py: pyCmd, camIdx })
  let webcamStderrOnce = false
  // #endregion
  webcamProc.on('error', (err) => {
    console.error('[trackifyr] webcam_cognitive_load spawn error', root, err && err.message)
    // #region agent log
    dbgAgent('H3', 'tracking-bridge:webcamProc', 'spawn_error', { msg: err && err.message })
    // #endregion
    clearWebcamStallWatch()
    webcamProc = null
    lastWebcam = null
    if (webcamEnabled) {
      lastWebcamStderr = (
        lastWebcamStderr + String((err && err.message) || err || 'spawn error')
      ).slice(-32000)
      webcamPipelineError = 'exited'
      if (!webcamDependencyBlocked) scheduleWebcamRelaunch()
      tryFuse()
      broadcastUpdate()
    }
  })
  webcamProc.stderr?.on('data', (d) => {
    const raw = String(d)
    const s = raw.trim()
    lastWebcamStderr = (lastWebcamStderr + raw).slice(-32000)
    const depEarly = parseModuleNotFoundFromStderr(lastWebcamStderr)
    if (depEarly) markWebcamDependencyFailure(depEarly, '')
    if (s) console.error('[trackifyr webcam stderr]', s.slice(0, 800))
    // #region agent log
    if (s && !webcamStderrOnce) {
      webcamStderrOnce = true
      dbgAgent('H3', 'tracking-bridge:webcam_stderr', 'first_chunk', { snippet: s.slice(0, 400) })
    }
    // #endregion
  })
  webcamProc.on('exit', (code, signal) => {
    if (code && code !== 0) {
      console.error('[trackifyr] webcam_cognitive_load exited', code, signal, 'cwd=', root)
    }
    // #region agent log
    dbgAgent('H3', 'tracking-bridge:webcamProc', 'exit', {
      code,
      signal,
      stderrTail: lastWebcamStderr.slice(-8000),
    })
    dbgAgent('H3', 'tracking-bridge:webcam_stderr', 'full_on_exit', {
      text: lastWebcamStderr.slice(-12000),
    })
    // #endregion
    clearWebcamStallWatch()
    webcamProc = null
    lastWebcam = null
    if (code != null && code !== 0 && webcamEnabled) {
      const dep = parseModuleNotFoundFromStderr(lastWebcamStderr)
      if (dep) {
        markWebcamDependencyFailure(dep, lastWebcamStderr.slice(-4000))
      } else {
        webcamPipelineError = 'exited'
        if (!webcamDependencyBlocked) scheduleWebcamRelaunch()
      }
    }
    tryFuse()
    broadcastUpdate()
  })
  let webcamJsonLines = 0
  wireWebcamStdout(webcamProc, (j) => {
    webcamJsonLines += 1
    webcamRelaunchAttempts = 0
    if (webcamRelaunchTimer) {
      try {
        clearTimeout(webcamRelaunchTimer)
      } catch {
        /* ignore */
      }
      webcamRelaunchTimer = null
    }
    // #region agent log
    if (webcamJsonLines === 1) {
      dbgAgent('H4', 'tracking-bridge:webcam_stdout', 'first_json', {
        keys: j && typeof j === 'object' ? Object.keys(j) : [],
        hasFinalLoad: j && typeof j.final_model_load === 'string',
      })
    }
    // #endregion
    lastWebcam = j
    webcamPipelineError = null
    tryFuse()
  })
}

/**
 * Turn ML webcam subprocess on/off without restarting activity tracking (for UI toggle while session runs).
 * @param {boolean} enabled
 */
function setTrackingWebcam(enabled) {
  const want = Boolean(enabled)
  if (!activityProc) {
    return { ok: false, activityActive: false, reason: 'not_tracking' }
  }
  if (webcamEnabled === want) {
    return { ok: true, webcamEnabled, activityActive: true }
  }
  webcamEnabled = want
  if (!want) {
    if (webcamProc) {
      try {
        webcamProc.kill()
      } catch {
        /* ignore */
      }
      webcamProc = null
    }
    lastWebcam = null
    tryFuse()
  } else {
    spawnWebcamPipeline()
    tryFuse()
  }
  broadcastUpdate()
  void pushToNextIngest()
  return { ok: true, webcamEnabled, activityActive: true }
}

function startTracking(opts = {}) {
  stopChildren()
  webcamEnabled = Boolean(opts.webcam)
  const root = repoRoot()
  resolvePythonCommand()
  const actSpawn = pythonSpawnArgs('activity_tracker.py', ['--interval', String(ACTIVITY_INTERVAL_SEC)])

  activityProc = spawn(actSpawn.cmd, actSpawn.args, { cwd: root, env: pythonEnv(root), windowsHide: true })
  activityProc.on('error', (err) => {
    console.error('[trackifyr] activity_tracker spawn error', root, err && err.message)
  })
  activityProc.on('exit', (code, signal) => {
    if (code && code !== 0) {
      console.error('[trackifyr] activity_tracker exited', code, signal, 'cwd=', root)
    }
  })
  let activityLineN = 0
  wireStdoutJson(activityProc, (j) => {
    activityLineN += 1
    // #region agent log
    if (activityLineN === 1) {
      dbgAgent('H5', 'tracking-bridge:activity_stdout', 'first_json', {
        activity_percentage: j && j.activity_percentage,
      })
    }
    // #endregion
    lastActivity = j
    tryFuse()
  })

  if (webcamEnabled) {
    spawnWebcamPipeline()
  }

  broadcastUpdate()
}

/** Lets the dashboard (browser) POST filter changes to the local bridge. */
const BRIDGE_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(res, code, obj) {
  res.writeHead(code, { ...BRIDGE_CORS, 'Content-Type': 'application/json' })
  res.end(JSON.stringify(obj))
}

function startHttpServer() {
  if (httpServer) return
  httpServer = http.createServer((req, res) => {
    const u = String(req.url || '').split('?')[0]
    if (req.method === 'OPTIONS' && u.startsWith('/bridge/')) {
      res.writeHead(204, BRIDGE_CORS)
      res.end()
      return
    }
    if (req.method === 'GET' && u === '/bridge/live') {
      json(res, 200, {
        ok: true,
        activityData: lastActivity,
        webcamData: lastWebcam,
        fused: lastFused,
        filterMode,
        webcamEnabled,
        webcamPipelineError,
        webcamStderrTail: lastWebcamStderr.slice(-1200),
        webcamErrorDetail: webcamErrorDetailString(),
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
  httpServer.on('error', (err) => {
    console.error(
      '[trackifyr] bridge HTTP server error (port',
      DEFAULT_BRIDGE_PORT,
      '):',
      err && err.message,
    )
  })
  httpServer.listen(DEFAULT_BRIDGE_PORT, '127.0.0.1', () => {
    console.log('[trackifyr] desktop bridge listening on http://127.0.0.1:' + DEFAULT_BRIDGE_PORT)
  })
}

function registerIpc(ipcMain) {
  ipcMain.handle('trackifyr:tracking:start', (_e, payload) => {
    // #region agent log
    dbgAgent('H2', 'ipc:trackifyr:tracking:start', 'invoke', {
      webcam: Boolean(payload && payload.webcam),
    })
    // #endregion
    startTracking({ webcam: Boolean(payload && payload.webcam) })
    return { ok: true }
  })
  ipcMain.handle('trackifyr:tracking:stop', () => {
    stopChildren()
    broadcastUpdate()
    return { ok: true }
  })
  ipcMain.handle('trackifyr:tracking:setWebcam', (_e, payload) => {
    const on = Boolean(payload && payload.webcam)
    return setTrackingWebcam(on)
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
    webcamPipelineError,
    webcamStderrTail: lastWebcamStderr.slice(-1200),
    webcamErrorDetail: webcamErrorDetailString(),
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
  setTrackingWebcam,
}
