;(async function () {
  // #region agent log
  const AGENT_LOG = 'http://127.0.0.1:7902/ingest/12dc9b3d-fb1e-4500-92ef-90b256789304'
  function dbgAgent(hypothesisId, location, message, data) {
    const payload = {
      sessionId: '6cdaaf',
      hypothesisId,
      location,
      message,
      data: data || {},
      timestamp: Date.now(),
    }
    if (window.trackifyr && typeof window.trackifyr.debugLog === 'function') {
      window.trackifyr.debugLog(payload).catch(() => {})
    }
    fetch(AGENT_LOG, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '6cdaaf' },
      body: JSON.stringify(payload),
    }).catch(() => {})
  }
  // #endregion

  async function preflightCameraThenRelease() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      })
      stream.getTracks().forEach((t) => t.stop())
      await new Promise((r) => {
        requestAnimationFrame(() => requestAnimationFrame(r))
      })
      dbgAgent('H6', 'renderer:preflightCamera', 'tracks_stopped', {})
    } catch (e) {
      dbgAgent('H6', 'renderer:preflightCamera', 'getUserMedia_error', {
        name: e && e.name,
        msg: e && e.message ? String(e.message) : String(e),
      })
    }
  }

  const LS_TOKEN = 'trackifyr_desktop_session_token'
  const LS_USER = 'trackifyr_desktop_user'
  const LS_API_LEGACY = 'trackifyr_desktop_api_base'

  const apiConfig = await window.trackifyr.getConfig()

  async function syncTrackingPipelineConfig() {
    const base = getApiBase()
    if (window.trackifyr.setTrackingApiBase) {
      await window.trackifyr.setTrackingApiBase(base)
    }
  }

  const viewLogin = document.getElementById('view-login')
  const viewSession = document.getElementById('view-session')
  const formLogin = document.getElementById('form-login')
  const inputEmail = document.getElementById('input-email')
  const inputPassword = document.getElementById('input-password')
  const loginError = document.getElementById('login-error')
  const btnLogin = document.getElementById('btn-login')
  const btnLoginText = btnLogin.querySelector('.btn-text')

  const sessionUserName = document.getElementById('session-user-name')
  const sessionUserEmail = document.getElementById('session-user-email')
  const btnSignout = document.getElementById('btn-signout')
  const timerDisplay = document.getElementById('timer-display')
  const timerPulse = document.getElementById('timer-pulse')
  const btnTimerToggle = document.getElementById('btn-timer-toggle')
  const btnCamToggle = document.getElementById('btn-cam-toggle')
  const cameraStatus = document.getElementById('camera-status')

  const trackingStatus = document.getElementById('tracking-status')

  try {
    localStorage.removeItem(LS_API_LEGACY)
  } catch {
    /* ignore */
  }

  function getApiBase() {
    return String(apiConfig.apiBaseDefault || 'http://localhost:3000').replace(/\/$/, '')
  }

  await syncTrackingPipelineConfig()

  function fitWindow() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const active = document.querySelector('.view.view-active')
        if (!active || !window.trackifyr.setContentSize) return
        const pad = 28
        const w = Math.ceil(active.scrollWidth + pad)
        const h = Math.ceil(active.scrollHeight + pad)
        window.trackifyr.setContentSize({ width: w, height: h })
      })
    })
  }

  function formatTime(totalMs) {
    const s = Math.floor(totalMs / 1000)
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(h)}:${pad(m)}:${pad(sec)}`
  }

  function formatPktWallClock() {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Karachi',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date())
  }

  const pktWallClockEl = document.getElementById('pkt-wall-clock')
  function tickPktWallClock() {
    if (pktWallClockEl) pktWallClockEl.textContent = `PKT ${formatPktWallClock()}`
  }
  tickPktWallClock()
  setInterval(tickPktWallClock, 1000)

  function showView(name) {
    const isLogin = name === 'login'
    viewLogin.hidden = !isLogin
    viewSession.hidden = isLogin
    viewLogin.classList.toggle('view-active', isLogin)
    viewSession.classList.toggle('view-active', !isLogin)
    if (!isLogin) {
      viewSession.classList.remove('view-swap-in')
      void viewSession.offsetWidth
      viewSession.classList.add('view-swap-in')
    }
    setTimeout(fitWindow, 80)
  }

  function setLoginLoading(loading) {
    btnLogin.disabled = loading
    btnLogin.classList.toggle('is-loading', loading)
    btnLoginText.textContent = loading ? 'Signing in…' : 'Sign in'
  }

  function showLoginError(msg) {
    if (!msg) {
      loginError.hidden = true
      loginError.textContent = ''
      return
    }
    loginError.hidden = false
    loginError.textContent = msg
  }

  async function persistSession(token, user) {
    localStorage.setItem(LS_TOKEN, token)
    localStorage.setItem(LS_USER, JSON.stringify(user))
  }

  function clearSession() {
    localStorage.removeItem(LS_TOKEN)
    localStorage.removeItem(LS_USER)
  }

  function getStoredToken() {
    return localStorage.getItem(LS_TOKEN) || ''
  }

  function applyUserToSessionUI(user) {
    const name = user.fullName || user.email || 'User'
    sessionUserName.textContent = name
    sessionUserEmail.textContent = user.email || ''
  }

  let accumulatedMs = 0
  let runStart = null
  let running = false
  let rafId = null

  function currentElapsedMs() {
    if (!running || runStart == null) return accumulatedMs
    return accumulatedMs + (performance.now() - runStart)
  }

  function tick() {
    timerDisplay.textContent = formatTime(currentElapsedMs())
    if (running) rafId = requestAnimationFrame(tick)
  }

  function setTimerRunning(next) {
    if (next === running) return
    if (next) {
      runStart = performance.now()
      running = true
      timerPulse.classList.add('active')
      btnTimerToggle.textContent = 'Pause'
    } else {
      if (runStart != null) accumulatedMs += performance.now() - runStart
      runStart = null
      running = false
      if (rafId) cancelAnimationFrame(rafId)
      rafId = null
      timerPulse.classList.remove('active')
      btnTimerToggle.textContent = 'Start'
    }
    timerDisplay.textContent = formatTime(currentElapsedMs())
    if (running) rafId = requestAnimationFrame(tick)
  }

  async function setCamera(on) {
    if (on) {
      btnCamToggle.setAttribute('aria-checked', 'true')
      cameraStatus.textContent = ''
      cameraStatus.classList.add('on')
    } else {
      btnCamToggle.setAttribute('aria-checked', 'false')
      cameraStatus.textContent = ''
      cameraStatus.classList.remove('on')
    }
  }

  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault()
    showLoginError('')
    if (!formLogin.checkValidity()) {
      formLogin.reportValidity()
      return
    }
    const email = inputEmail.value.trim()
    const password = inputPassword.value
    setLoginLoading(true)
    try {
      const result = await window.trackifyr.signin({
        apiBase: getApiBase(),
        email,
        password,
      })
      if (result.fetchError) {
        showLoginError(`Could not reach the server. ${result.fetchError}`)
        return
      }
      const { ok, data } = result
      if (!ok || !data?.success || !data?.sessionToken) {
        showLoginError(data?.error || 'Sign-in failed.')
        return
      }
      await persistSession(data.sessionToken, data.user)
      await syncTrackingPipelineConfig()
      if (window.trackifyr.setSessionToken) {
        await window.trackifyr.setSessionToken(data.sessionToken)
      }
      applyUserToSessionUI(data.user)
      showView('session')
      await resetSessionPanelState()
    } catch {
      showLoginError('Could not reach the server.')
    } finally {
      setLoginLoading(false)
    }
  })

  async function resetSessionPanelState() {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = null
    accumulatedMs = 0
    runStart = null
    running = false
    timerDisplay.textContent = '00:00:00'
    timerPulse.classList.remove('active')
    btnTimerToggle.textContent = 'Start'
    try {
      if (window.trackifyr.trackingStop) await window.trackifyr.trackingStop()
    } catch {
      /* ignore */
    }
    if (trackingStatus) trackingStatus.textContent = ''
    void setCamera(false)
  }

  btnTimerToggle.addEventListener('click', async () => {
    const next = !running
    if (!next) {
      setTimerRunning(false)
      try {
        if (window.trackifyr.trackingStop) await window.trackifyr.trackingStop()
      } catch {
        /* ignore */
      }
      if (trackingStatus) trackingStatus.textContent = ''
      await setCamera(false)
      setTimeout(fitWindow, 80)
      return
    }
    await setCamera(true)
    setTimerRunning(true)
    if (trackingStatus) trackingStatus.textContent = ''
    try {
      await preflightCameraThenRelease()
      if (window.trackifyr.trackingStart) await window.trackifyr.trackingStart({ webcam: true })
      // #region agent log
      dbgAgent('H2', 'renderer:btnTimerToggle', 'trackingStart_resolved', {})
      // #endregion
    } catch (err) {
      // #region agent log
      dbgAgent('H2', 'renderer:btnTimerToggle', 'trackingStart_rejected', {
        msg: err && err.message ? String(err.message) : 'unknown',
      })
      // #endregion
      setTimerRunning(false)
      await setCamera(false)
      if (trackingStatus) trackingStatus.textContent = 'Error.'
    }
    setTimeout(fitWindow, 80)
  })

  btnCamToggle.addEventListener('click', async () => {
    const next = btnCamToggle.getAttribute('aria-checked') !== 'true'
    await setCamera(next)
    if (running && window.trackifyr.trackingSetWebcam) {
      try {
        await window.trackifyr.trackingSetWebcam({ webcam: next })
      } catch {
        /* ignore */
      }
    }
  })

  let offTracking = null
  if (window.trackifyr.onTracking) {
    offTracking = window.trackifyr.onTracking((payload) => {
      if (!trackingStatus) return
      const fused = payload && payload.fused
      const wpe = payload && payload.webcamPipelineError
      const prefix =
        wpe === 'no_models' ? 'ML missing · ' : wpe === 'exited' ? 'ML stopped · ' : ''
      if (!fused) {
        if (running && wpe === 'no_models') trackingStatus.textContent = 'ML missing'
        else if (running) trackingStatus.textContent = ''
        return
      }
      const parts = [
        `Load ${Number(fused.activity_load || 0).toFixed(1)}%`,
        `Engagement ${fused.engagement != null ? fused.engagement : '—'}`,
        `Cognitive ${fused.final_cognitive_load}`,
      ]
      trackingStatus.textContent = prefix + parts.join(' · ')
    })
  }

  btnSignout.addEventListener('click', async () => {
    const token = getStoredToken()
    const apiBase = getApiBase()
    if (typeof offTracking === 'function') offTracking()
    await resetSessionPanelState()
    if (token) {
      try {
        await window.trackifyr.signout({ apiBase, sessionToken: token })
      } catch {
        /* ignore */
      }
    }
    if (window.trackifyr.setSessionToken) {
      await window.trackifyr.setSessionToken('')
    }
    clearSession()
    showView('login')
  })

  async function bootstrap() {
    const token = getStoredToken()
    const raw = localStorage.getItem(LS_USER)
    let user = null
    try {
      user = raw ? JSON.parse(raw) : null
    } catch {
      user = null
    }
    if (!token || !user) {
      showView('login')
      fitWindow()
      return
    }
    try {
      const result = await window.trackifyr.me({ apiBase: getApiBase(), sessionToken: token })
      if (result.fetchError) {
        clearSession()
        showView('login')
        showLoginError(`Could not reach the server. ${result.fetchError}`)
        fitWindow()
        return
      }
      const { ok, data } = result
      if (ok && data?.success && data?.user) {
        applyUserToSessionUI(data.user)
        localStorage.setItem(LS_USER, JSON.stringify(data.user))
        await syncTrackingPipelineConfig()
        if (window.trackifyr.setSessionToken) {
          await window.trackifyr.setSessionToken(token)
        }
        showView('session')
        await resetSessionPanelState()
      } else {
        clearSession()
        showView('login')
      }
    } catch {
      clearSession()
      showView('login')
    }
    fitWindow()
  }

  await bootstrap()
})()
