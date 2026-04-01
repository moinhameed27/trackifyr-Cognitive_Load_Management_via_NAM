'use strict'

/** Frames with gaze_away count at or above this are treated as "high gaze" for engagement. */
const GAZE_AWAY_ENGAGEMENT_LOW = 12

/**
 * When webcam ML output is not ready yet, derive a coarse engagement label from activity (keyboard/mouse).
 * @param {number} activity_load 0–100
 * @returns {'Low' | 'Medium' | 'High'}
 */
function engagementFromActivityLoad(activity_load) {
  const a = Number(activity_load) || 0
  if (a < 18) return 'Low'
  if (a < 52) return 'Medium'
  return 'High'
}

/**
 * @param {unknown} p [pLow, pMedium, pHigh] from mean softmax (v1+v2+v3)
 * @returns {[number, number, number] | null}
 */
function normalizeProba(p) {
  if (!Array.isArray(p) || p.length !== 3) return null
  const a = p.map((x) => Math.max(0, Number(x) || 0))
  const s = a[0] + a[1] + a[2]
  if (s <= 0) return [1 / 3, 1 / 3, 1 / 3]
  return [a[0] / s, a[1] / s, a[2] / s]
}

/**
 * Map model class labels to three % bars (sum ~100) when we only have a discrete label.
 */
function labelToProbaPct(engagement) {
  const e = String(engagement || 'Medium')
  if (e === 'High') return [0, 0, 100]
  if (e === 'Low') return [100, 0, 0]
  return [0, 100, 0]
}

function probaToPctTriple(modelProba) {
  const [a, b, c] = modelProba
  return [Math.round(a * 100), Math.round(b * 100), Math.round(c * 100)]
}

/**
 * Continuous 0–100 engagement from ensemble class probabilities + gaze / face (trained-model path).
 */
function engagementScoreFromModelProba(p, face_detected, gaze_away) {
  const [pL, pM, pH] = normalizeProba(p)
  let score = pL * 28 + pM * 55 + pH * 82
  if (!face_detected) {
    score *= 0.32
  } else {
    const g = Math.min(Number(gaze_away) / GAZE_AWAY_ENGAGEMENT_LOW, 1)
    score *= 1 - 0.42 * g
  }
  return Math.max(0, Math.min(100, Math.round(score)))
}

function engagementLabelFromScore(score) {
  if (score < 38) return 'Low'
  if (score < 68) return 'Medium'
  return 'High'
}

function discreteEngagementToScore(engagement) {
  if (engagement === 'High') return 85
  if (engagement === 'Low') return 30
  return 55
}

/**
 * @param {object} input
 * @param {boolean} [input.synthetic_webcam] placeholder fusion without live model line (activity-only, or waiting)
 * @param {boolean} [input.webcam_ml_waiting] webcam enabled in app but JSON/proba not ready yet — use activity fallback, not zeros
 * @param {number[]} [input.cognitive_proba]
 */
function fuseTracking(input) {
  const activity_load = Number(
    input.activity_percentage != null ? input.activity_percentage : input.activity_load ?? 0,
  )
  const final_model_load = String(input.final_model_load || 'Medium')
  const blinks = Number(input.blinks ?? 0)
  const gaze_away = Number(input.gaze_away ?? 0)
  const face_detected = Boolean(input.face_detected)
  const synthetic_webcam = Boolean(input.synthetic_webcam)
  const webcam_ml_waiting = Boolean(input.webcam_ml_waiting)
  const modelProba = normalizeProba(input.cognitive_proba)

  const highAct = activity_load >= 50
  const lowAct = activity_load < 30
  const mHigh = final_model_load === 'High'
  const mLow = final_model_load === 'Low'

  let final_cognitive_load = 'Medium'
  if (highAct && mHigh) final_cognitive_load = 'High'
  else if (highAct && mLow) final_cognitive_load = 'Medium'
  else if (lowAct && mHigh) final_cognitive_load = 'Medium'
  else if (lowAct && mLow) final_cognitive_load = 'Low'
  else {
    if (mHigh) final_cognitive_load = 'Medium'
    else if (mLow) final_cognitive_load = 'Low'
    else final_cognitive_load = 'Medium'
  }

  let engagement = 'Medium'
  let engagement_score = 55
  let engagement_proba_pct = [0, 0, 0]
  /** @type {'off' | 'waiting' | 'active'} */
  let webcam_ml_status = 'active'

  if (synthetic_webcam) {
    if (webcam_ml_waiting) {
      webcam_ml_status = 'waiting'
      const eng = engagementFromActivityLoad(activity_load)
      engagement = eng
      engagement_score = discreteEngagementToScore(eng)
      engagement_proba_pct = labelToProbaPct(eng)
    } else {
      webcam_ml_status = 'off'
      engagement = 'Low'
      engagement_score = 0
      engagement_proba_pct = [0, 0, 0]
    }
  } else if (modelProba) {
    webcam_ml_status = 'active'
    engagement_score = engagementScoreFromModelProba(input.cognitive_proba, face_detected, gaze_away)
    engagement = engagementLabelFromScore(engagement_score)
    engagement_proba_pct = probaToPctTriple(modelProba)
  } else if (!face_detected || gaze_away >= GAZE_AWAY_ENGAGEMENT_LOW) {
    webcam_ml_status = 'active'
    engagement = 'Low'
    engagement_score = 30
    engagement_proba_pct = labelToProbaPct(engagement)
  } else if (final_model_load === 'Low') {
    webcam_ml_status = 'active'
    engagement = 'Medium'
    engagement_score = 55
    engagement_proba_pct = labelToProbaPct(engagement)
  } else {
    webcam_ml_status = 'active'
    engagement = final_model_load
    engagement_score = discreteEngagementToScore(engagement)
    engagement_proba_pct = labelToProbaPct(engagement)
  }

  return {
    activity_load,
    engagement,
    engagement_score,
    engagement_proba_pct,
    webcam_ml_status,
    cognitive_proba: modelProba ? [modelProba[0], modelProba[1], modelProba[2]] : undefined,
    final_cognitive_load,
    blinks,
    gaze_away,
  }
}

module.exports = {
  fuseTracking,
  GAZE_AWAY_ENGAGEMENT_LOW,
  normalizeProba,
  engagementScoreFromModelProba,
  engagementFromActivityLoad,
}
