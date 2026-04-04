/**
 * API origin: TRACKIFYR_API_BASE env and/or release-config.json { "apiBase": "https://..." } next to main.js.
 */
const { app, BrowserWindow, ipcMain, session, Menu } = require('electron')
const path = require('path')
const fs = require('fs')

function loadReleaseConfigApiBase() {
  try {
    const p = path.join(__dirname, 'release-config.json')
    if (fs.existsSync(p)) {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'))
      return String(j.apiBase || '').trim()
    }
  } catch {
    /* ignore */
  }
  return ''
}

const FIXED_API_BASE = (process.env.TRACKIFYR_API_BASE || loadReleaseConfigApiBase() || '').trim()
const API_BASE_LOCKED = Boolean(FIXED_API_BASE)
const API_BASE_DEFAULT = FIXED_API_BASE || 'http://localhost:3000'

function normalizeBase(url) {
  return String(url || 'http://localhost:3000').replace(/\/$/, '')
}

if (!String(process.env.TRACKIFYR_API_BASE || '').trim()) {
  process.env.TRACKIFYR_API_BASE = normalizeBase(API_BASE_DEFAULT)
}

let desktopSessionToken = ''

// #region agent log
const AGENT_LOG_MAIN = 'http://127.0.0.1:7902/ingest/12dc9b3d-fb1e-4500-92ef-90b256789304'
const DEBUG_LOG_FILE_MAIN = path.join(__dirname, '..', '.cursor', 'debug-6cdaaf.log')
function appendDebugNdjsonMain(payload) {
  try {
    const dir = path.dirname(DEBUG_LOG_FILE_MAIN)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(DEBUG_LOG_FILE_MAIN, `${JSON.stringify(payload)}\n`, 'utf8')
  } catch {
    /* ignore */
  }
}
function dbgMain(hypothesisId, message, data) {
  const payload = {
    sessionId: '6cdaaf',
    hypothesisId,
    location: 'main.js',
    message,
    data: data || {},
    timestamp: Date.now(),
  }
  appendDebugNdjsonMain(payload)
  fetch(AGENT_LOG_MAIN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '6cdaaf' },
    body: JSON.stringify(payload),
  }).catch(() => {})
}
// #endregion

const trackingBridge = require('./tracking-bridge.js')
trackingBridge.setIngestTokenGetter(() => desktopSessionToken)

const { startHttpServer, registerIpc, setMainWindowGetter, stopChildren } = trackingBridge

async function apiFetch(base, pathname, options = {}) {
  try {
    const url = `${normalizeBase(base)}${pathname}`
    const res = await fetch(url, options)
    let data = {}
    try {
      data = await res.json()
    } catch {
      /* empty */
    }
    return { ok: res.ok, status: res.status, data }
  } catch (err) {
    const code = err && err.code ? ` (${err.code})` : ''
    const msg = (err && err.message) || String(err)
    return { ok: false, status: 0, data: {}, fetchError: `${msg}${code}` }
  }
}

let mainWindow = null

function createWindow() {
  const win = new BrowserWindow({
    width: 400,
    height: 620,
    minWidth: 300,
    minHeight: 320,
    maximizable: false,
    title: 'Trackifyr',
    backgroundColor: '#f8fafc',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  })

  win.once('ready-to-show', () => win.show())
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'))

  win.webContents.on('context-menu', (_event, params) => {
    const menu = Menu.buildFromTemplate([
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
      { type: 'separator' },
      {
        label: 'Inspect element',
        click: () => win.webContents.inspectElement(params.x, params.y),
      },
      {
        label: 'Open Developer Tools',
        click: () => {
          if (!win.webContents.isDevToolsOpened()) win.webContents.openDevTools({ mode: 'detach' })
        },
      },
    ])
    menu.popup({ window: win })
  })

  mainWindow = win
  win.on('closed', () => {
    mainWindow = null
  })
}

function installAppMenu() {
  const isMac = process.platform === 'darwin'
  const toggleDevTools = (focusedWindow) => {
    const w = focusedWindow || mainWindow
    if (!w || w.isDestroyed()) return
    w.webContents.toggleDevTools()
  }
  const template = [
    ...(isMac
      ? [{ label: app.name, submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }] }]
      : []),
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        {
          label: 'Toggle Developer Tools (F12)',
          accelerator: 'F12',
          click: (_item, fw) => toggleDevTools(fw),
        },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    // #region agent log
    dbgMain('H6', 'permission_request', { permission })
    // #endregion
    if (permission === 'media' || permission === 'camera') {
      callback(true)
      return
    }
    callback(false)
  })

  ipcMain.handle('trackifyr:debugLog', (_e, payload) => {
    try {
      const p =
        payload && typeof payload === 'object'
          ? { ...payload, timestamp: payload.timestamp || Date.now() }
          : { raw: String(payload), timestamp: Date.now() }
      appendDebugNdjsonMain(p)
    } catch {
      /* ignore */
    }
    return { ok: true }
  })

  ipcMain.handle('trackifyr:config', () => ({
    apiBaseLocked: API_BASE_LOCKED,
    apiBaseDefault: normalizeBase(API_BASE_DEFAULT),
  }))

  ipcMain.handle('trackifyr:setContentSize', (event, { width, height }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win || typeof width !== 'number' || typeof height !== 'number') return
    const w = Math.min(560, Math.max(300, Math.round(width)))
    const h = Math.min(900, Math.max(320, Math.round(height)))
    win.setContentSize(w, h)
  })

  /** Keeps Python ingest URL identical to the API base the renderer uses (sign-in / me). */
  ipcMain.handle('trackifyr:setTrackingApiBase', (_e, { base }) => {
    const b = String(base || '').trim()
    if (b) process.env.TRACKIFYR_API_BASE = normalizeBase(b)
    return { ok: true, apiBase: normalizeBase(process.env.TRACKIFYR_API_BASE || API_BASE_DEFAULT) }
  })

  ipcMain.handle('trackifyr:setSessionToken', (_e, { token }) => {
    desktopSessionToken = String(token || '').trim()
    return { ok: true }
  })

  ipcMain.handle('trackifyr:signin', async (_e, { apiBase, email, password }) => {
    return apiFetch(apiBase, '/api/auth/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Trackifyr-Desktop': '1',
      },
      body: JSON.stringify({ email, password }),
    })
  })

  ipcMain.handle('trackifyr:me', async (_e, { apiBase, sessionToken }) => {
    return apiFetch(apiBase, '/api/auth/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    })
  })

  ipcMain.handle('trackifyr:signout', async (_e, { apiBase, sessionToken }) => {
    return apiFetch(apiBase, '/api/auth/signout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    })
  })

  setMainWindowGetter(() => mainWindow)
  registerIpc(ipcMain)
  startHttpServer()

  installAppMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  stopChildren()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
