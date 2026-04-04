/**
 * Pakistan Standard Time (PKT, Asia/Karachi, UTC+5, no DST) for all user-visible
 * times and for bucket / “today” boundaries. Does not depend on the client OS zone.
 */

export const PKT_TIMEZONE = 'Asia/Karachi'

const pad2 = (n) => String(n).padStart(2, '0')

/** Start of the current PKT calendar day (instant in UTC ms). */
export function pktStartOfCalendarDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PKT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  const d = parts.find((p) => p.type === 'day')?.value
  if (!y || !m || !d) return new Date(now)
  return new Date(`${y}-${m}-${d}T00:00:00+05:00`)
}

/** Exclusive end of the current PKT calendar day. */
export function pktEndOfCalendarDayExclusive(now = new Date()) {
  const s = pktStartOfCalendarDay(now)
  return new Date(s.getTime() + 24 * 60 * 60 * 1000)
}

/**
 * Wall-clock range for the last `nDays` PKT calendar days including today:
 * [start, end) where end is start of tomorrow PKT.
 */
export function pktRollingWindowBounds(now = new Date(), nDays = 7) {
  const n = Math.min(Math.max(1, Number(nDays) || 7), 31)
  const todayStart = pktStartOfCalendarDay(now)
  const end = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
  const start = new Date(todayStart.getTime() - (n - 1) * 24 * 60 * 60 * 1000)
  return { start, end }
}

/** YYYY-MM-DD for the PKT calendar date of this instant. */
export function formatPktIsoDate(date = new Date()) {
  const d = typeof date === 'number' ? new Date(date) : date
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PKT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value
  if (!y || !m || !day) return ''
  return `${y}-${m}-${day}`
}

/**
 * 5-minute bucket start (UTC ms), aligned to :00, :05, … in PKT wall clock.
 */
export function fiveMinuteBucketStartUtcMs(nowMs = Date.now()) {
  const d = new Date(nowMs)
  const dtf = new Intl.DateTimeFormat('en-GB', {
    timeZone: PKT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const parts = dtf.formatToParts(d)
  const get = (type) => parts.find((p) => p.type === type)?.value
  const y = get('year')
  const mo = get('month')
  const day = get('day')
  let h = Number(get('hour'))
  let min = Number(get('minute'))
  const totalMin = h * 60 + min
  const floored = Math.floor(totalMin / 5) * 5
  h = Math.floor(floored / 60)
  min = floored % 60
  return new Date(`${y}-${mo}-${day}T${pad2(h)}:${pad2(min)}:00+05:00`).getTime()
}

export function formatPktTimeShort(date = new Date()) {
  const d = typeof date === 'number' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: PKT_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d)
}

/** Chart axis: HH:mm in PKT. */
export function formatPktChartAxisTime(date) {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: PKT_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

function formatPktDateTimeMedium(date) {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: PKT_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

/** Session log range label in PKT. */
export function formatPktSessionWindow(start, end) {
  return `${formatPktDateTimeMedium(start)} – ${formatPktDateTimeMedium(end)}`
}

export function formatPktWeekdayLabel(date) {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: PKT_TIMEZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(d)
}

/** Longer stamp for feedback / lists (PKT). */
export function formatPktDateTimeFull(date = new Date()) {
  const d = typeof date === 'number' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: PKT_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d)
}
