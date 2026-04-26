import { dominantCognitiveLoadForBucketRow } from '@/lib/trackingSessionsDb'

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
 * When `useWallClockStreak` is true (default): feedback is emitted once when High/Low
 * is sustained on every ingest for 5 minutes wall-clock (legacy / in-memory ingest).
 * When false: only carries prior messages; per-bucket dominant feedback is applied
 * separately for authenticated DB-backed users (PKT 5-minute buckets, same rule as Session logs).
 *
 * @param {object} currentPayload
 * @param {object | null} previousPayload
 * @param {number} [nowMs]
 * @param {{ useWallClockStreak?: boolean }} [options]
 */
export function applySustainedLoadFeedback(currentPayload, previousPayload, nowMs = Date.now(), options = {}) {
  const useWallClock = options.useWallClockStreak !== false
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

  if (useWallClock && tracked) {
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
  if (useWallClock) {
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
  } else {
    next._feedback_state = {
      level: null,
      start_ms: nowMs,
      emitted: false,
    }
  }
  return next
}

/**
 * When the current PKT 5-minute bucket is dominantly High or Low, emit the matching
 * message once per bucket window (deduped by bucket_start). Uses the same dominant rule
 * as Session logs ({@link dominantCognitiveLoadForBucketRow}).
 *
 * @param {object} payload
 * @param {object | null} previousPayload
 * @param {object | null} latestBucketRow
 * @param {number} [nowMs]
 */
export function applyBucketDominantFeedback(payload, previousPayload, latestBucketRow, nowMs = Date.now()) {
  const next = {
    ...(payload && typeof payload === 'object' ? payload : {}),
  }
  const prev = previousPayload && typeof previousPayload === 'object' ? previousPayload : null
  const prevMark =
    prev?._bucket_pair_feedback && typeof prev._bucket_pair_feedback === 'object' ? prev._bucket_pair_feedback : {}
  const nextMark = { ...prevMark }

  const baseList = Array.isArray(next.feedback_messages) ? next.feedback_messages : []
  const list = baseList.slice(0, 19)

  if (!latestBucketRow) {
    next.feedback_messages = list.slice(0, 19)
    next._bucket_pair_feedback = nextMark
    return next
  }

  const dom = dominantCognitiveLoadForBucketRow(latestBucketRow)
  const rawStart = latestBucketRow.bucket_start
  const bucketKey =
    rawStart instanceof Date ? rawStart.toISOString() : String(rawStart ?? '')

  if (dom === 'High' && nextMark.high_newer !== bucketKey) {
    const cfg = feedbackForLevel('High')
    list.unshift({
      id: `bucket-high-${bucketKey}`,
      type: cfg.type,
      message: cfg.message,
      timestamp: nowMs,
    })
    nextMark.high_newer = bucketKey
  }
  if (dom === 'Low' && nextMark.low_newer !== bucketKey) {
    const cfg = feedbackForLevel('Low')
    list.unshift({
      id: `bucket-low-${bucketKey}`,
      type: cfg.type,
      message: cfg.message,
      timestamp: nowMs,
    })
    nextMark.low_newer = bucketKey
  }

  next.feedback_messages = list.slice(0, 19)
  next._bucket_pair_feedback = nextMark
  return next
}

/**
 * Strips internal fields from a live payload before returning to clients.
 * @param {object | null | undefined} payload
 */
export function sanitizeTrackingLivePayload(payload) {
  if (!payload || typeof payload !== 'object') return payload
  const { _feedback_state: _ignored, _bucket_pair_feedback: _ignored2, ...safe } = payload
  return safe
}
