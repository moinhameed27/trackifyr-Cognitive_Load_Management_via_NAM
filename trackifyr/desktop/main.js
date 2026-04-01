/**
 * API origin: TRACKIFYR_API_BASE env and/or release-config.json { "apiBase": "https://..." } next to main.js.
 */
const { app, BrowserWindow, ipcMain, session } = require('electron')
const path = require('path')
const fs = require('fs')
const {
  startHttpServer,
  registerIpc,
  setMainWindowGetter,
  stopChildren,
} = require('./tracking-bridge.js')

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
    width: 360,
    height: 420,
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
  mainWindow = win
  win.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media' || permission === 'camera') {
      callback(true)
      return
    }
    callback(false)
  })

  ipcMain.handle('trackifyr:config', () => ({
    apiBaseLocked: API_BASE_LOCKED,
    apiBaseDefault: normalizeBase(API_BASE_DEFAULT),
  }))

  ipcMain.handle('trackifyr:setContentSize', (event, { width, height }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win || typeof width !== 'number' || typeof height !== 'number') return
    const w = Math.min(560, Math.max(300, Math.round(width)))
    const h = Math.min(720, Math.max(320, Math.round(height)))
    win.setContentSize(w, h)
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
