;(async function () {
  const LS_TOKEN = 'trackifyr_desktop_session_token'
  const LS_USER = 'trackifyr_desktop_user'
  const LS_API_LEGACY = 'trackifyr_desktop_api_base'

  const apiConfig = await window.trackifyr.getConfig()

  const viewLogin = document.getElementById('view-login')
  const viewSession = document.getElementById('view-session')
  const formLogin = document.getElementById('form-login')
  const inputEmail = document.getElementById('input-email')
  const inputPassword = document.getElementById('input-password')
  const loginApiHint = document.getElementById('login-api-hint')
  const loginError = document.getElementById('login-error')
  const btnLogin = document.getElementById('btn-login')
  const btnLoginText = btnLogin.querySelector('.btn-text')

  const sessionUserName = document.getElementById('session-user-name')
  const sessionUserEmail = document.getElementById('session-user-email')
  const btnSignout = document.getElementById('btn-signout')
  const timerDisplay = document.getElementById('timer-display')
  const timerPulse = document.getElementById('timer-pulse')
  const btnTimerToggle = document.getElementById('btn-timer-toggle')
  const timerHint = document.getElementById('timer-hint')
  const btnCamToggle = document.getElementById('btn-cam-toggle')
  const cameraStatus = document.getElementById('camera-status')

  const btnTrackingToggle = document.getElementById('btn-tracking-toggle')
  const trackingStatus = document.getElementById('tracking-status')
  let trackingRunning = false

  try {
    localStorage.removeItem(LS_API_LEGACY)
  } catch {
    /* ignore */
  }

  function getApiBase() {
    return String(apiConfig.apiBaseDefault || 'http://localhost:3000').replace(/\/$/, '')
  }

  if (loginApiHint) {
    loginApiHint.textContent = `Server: ${getApiBase()}`
  }

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
      timerHint.textContent = 'Running — pause anytime.'
    } else {
      if (runStart != null) accumulatedMs += performance.now() - runStart
      runStart = null
      running = false
      if (rafId) cancelAnimationFrame(rafId)
      rafId = null
      timerPulse.classList.remove('active')
      btnTimerToggle.textContent = 'Start'
      timerHint.textContent =
        accumulatedMs > 0 ? 'Paused — press Start to continue.' : 'Start or pause the session timer.'
    }
    timerDisplay.textContent = formatTime(currentElapsedMs())
    if (running) rafId = requestAnimationFrame(tick)
  }

  let mediaStream = null

  async function setCamera(on) {
    if (on) {
      if (mediaStream) return
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        })
        btnCamToggle.setAttribute('aria-checked', 'true')
        cameraStatus.textContent = 'Webcam is on and working.'
        cameraStatus.classList.add('on')
      } catch (e) {
        btnCamToggle.setAttribute('aria-checked', 'false')
        cameraStatus.textContent =
          e.name === 'NotAllowedError'
            ? 'Camera access denied.'
            : 'Could not start the camera.'
        cameraStatus.classList.remove('on')
        mediaStream = null
      }
    } else {
      if (mediaStream) {
        mediaStream.getTracks().forEach((t) => t.stop())
        mediaStream = null
      }
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
    timerHint.textContent = 'Start or pause the session timer.'
    try {
      if (trackingRunning && window.trackifyr.trackingStop) await window.trackifyr.trackingStop()
    } catch {
      /* ignore */
    }
    setTrackingUiRunning(false)
    if (trackingStatus) trackingStatus.textContent = ''
    void setCamera(false)
  }

  btnTimerToggle.addEventListener('click', () => {
    setTimerRunning(!running)
  })

  btnCamToggle.addEventListener('click', () => {
    const next = btnCamToggle.getAttribute('aria-checked') !== 'true'
    setCamera(next)
  })

  function setTrackingUiRunning(running) {
    trackingRunning = Boolean(running)
    if (!btnTrackingToggle) return
    btnTrackingToggle.textContent = trackingRunning ? 'Stop' : 'Start'
    btnTrackingToggle.classList.toggle('btn-primary', !trackingRunning)
    btnTrackingToggle.classList.toggle('btn-tracking-stop', trackingRunning)
    btnTrackingToggle.setAttribute('aria-pressed', trackingRunning ? 'true' : 'false')
  }

  let offTracking = null
  if (window.trackifyr.onTracking) {
    offTracking = window.trackifyr.onTracking((payload) => {
      const fused = payload && payload.fused
      if (!trackingStatus) return
      if (!fused) {
        if (trackingRunning) trackingStatus.textContent = 'Waiting for data…'
        return
      }
      const parts = [
        `Load ${Number(fused.activity_load || 0).toFixed(1)}%`,
        `Engagement ${fused.engagement}`,
        `Cognitive ${fused.final_cognitive_load}`,
        `Blinks ${fused.blinks}`,
        `Gaze away ${fused.gaze_away}`,
      ]
      trackingStatus.textContent = parts.join(' · ')
    })
  }

  async function toggleTracking() {
    if (!window.trackifyr.trackingStart || !window.trackifyr.trackingStop) return
    if (trackingRunning) {
      try {
        await window.trackifyr.trackingStop()
      } catch {
        /* ignore */
      }
      setTrackingUiRunning(false)
      if (trackingStatus) trackingStatus.textContent = ''
      setTimeout(fitWindow, 80)
      return
    }
    try {
      await window.trackifyr.trackingStart({ webcam: false })
      setTrackingUiRunning(true)
    } catch {
      /* ignore */
    }
    setTimeout(fitWindow, 80)
  }

  if (btnTrackingToggle) {
    btnTrackingToggle.addEventListener('click', () => void toggleTracking())
  }

  btnSignout.addEventListener('click', async () => {
    const token = getStoredToken()
    const apiBase = getApiBase()
    if (rafId) cancelAnimationFrame(rafId)
    if (typeof offTracking === 'function') offTracking()
    try {
      if (window.trackifyr.trackingStop) await window.trackifyr.trackingStop()
    } catch {
      /* ignore */
    }
    setTrackingUiRunning(false)
    if (trackingStatus) trackingStatus.textContent = ''
    await setCamera(false)
    if (token) {
      try {
        await window.trackifyr.signout({ apiBase, sessionToken: token })
      } catch {
        /* ignore */
      }
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
