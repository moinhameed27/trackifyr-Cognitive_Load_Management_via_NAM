const FIVE_MINUTES_MS = 5 * 60 * 1000

const HIGH_MSG = 'You seem overloaded, consider taking a break.'
const LOW_MSG = 'You appear disengaged, try refocusing.'

/**
 * @param {'High'|'Low'} level
 */
function feedbackForLevel(level) {
  if (level === 'High') {
    return { type: 'warning', message: HIGH_MSG }
  }
  return { type: 'info', message: LOW_MSG }
}

/**
 * Returns the next payload with feedback_messages and internal streak state.
 * Feedback is emitted once when High/Low is sustained for 5 minutes straight.
 *
 * @param {object} currentPayload
 * @param {object | null} previousPayload
 * @param {number} [nowMs]
 */
export function applySustainedLoadFeedback(currentPayload, previousPayload, nowMs = Date.now()) {
  const next = {
    ...(currentPayload && typeof currentPayload === 'object' ? currentPayload : {}),
  }
  const prev = previousPayload && typeof previousPayload === 'object' ? previousPayload : null

  const prevState = prev?._feedback_state && typeof prev._feedback_state === 'object' ? prev._feedback_state : null
  const priorList = Array.isArray(prev?.feedback_messages) ? prev.feedback_messages : []
  const nextList = priorList.slice(0, 19)

  const currentLevel = String(next.final_cognitive_load || '')
  const tracked = currentLevel === 'High' || currentLevel === 'Low'

  let streakLevel = null
  let streakStart = nowMs
  let emitted = false

  if (tracked) {
    if (prevState && prevState.level === currentLevel && Number.isFinite(Number(prevState.start_ms))) {
      streakLevel = currentLevel
      streakStart = Number(prevState.start_ms)
      emitted = Boolean(prevState.emitted)
    } else {
      streakLevel = currentLevel
      streakStart = nowMs
      emitted = false
    }

    if (!emitted && nowMs - streakStart >= FIVE_MINUTES_MS) {
      const cfg = feedbackForLevel(/** @type {'High'|'Low'} */ (streakLevel))
      nextList.unshift({
        id: `sustain-${String(streakLevel).toLowerCase()}-${nowMs}`,
        type: cfg.type,
        message: cfg.message,
        timestamp: nowMs,
      })
      emitted = true
    }
  }

  next.feedback_messages = nextList
  next._feedback_state = tracked
    ? {
        level: streakLevel,
        start_ms: streakStart,
        emitted,
      }
    : {
        level: null,
        start_ms: nowMs,
        emitted: false,
      }
  return next
}

/**
 * Strips internal fields from a live payload before returning to clients.
 * @param {object | null | undefined} payload
 */
export function sanitizeTrackingLivePayload(payload) {
  if (!payload || typeof payload !== 'object') return payload
  const { _feedback_state: _ignored, ...safe } = payload
  return safe
}
