'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const path = require('path')
const { fuseTracking } = require(path.join(__dirname, '..', 'desktop', 'fusion.js'))

test('high activity + high model => high', () => {
  const o = fuseTracking({
    activity_percentage: 80,
    final_model_load: 'High',
    blinks: 0,
    gaze_away: 0,
    face_detected: true,
  })
  assert.strictEqual(o.final_cognitive_load, 'High')
  assert.strictEqual(o.webcam_ml_status, 'active')
})

test('no face => engagement low', () => {
  const o = fuseTracking({
    activity_percentage: 50,
    final_model_load: 'High',
    blinks: 0,
    gaze_away: 0,
    face_detected: false,
  })
  assert.strictEqual(o.engagement, 'Low')
  assert.deepStrictEqual(o.engagement_proba_pct, [100, 0, 0])
})

test('webcam ML off (user disabled): zeros and status off', () => {
  const o = fuseTracking({
    activity_percentage: 80,
    final_model_load: 'Medium',
    blinks: 0,
    gaze_away: 0,
    face_detected: true,
    synthetic_webcam: true,
    webcam_ml_waiting: false,
  })
  assert.strictEqual(o.engagement_score, 0)
  assert.deepStrictEqual(o.engagement_proba_pct, [0, 0, 0])
  assert.strictEqual(o.webcam_ml_status, 'off')
})

test('webcam on but JSON not yet: activity fallback, status waiting', () => {
  const o = fuseTracking({
    activity_percentage: 80,
    final_model_load: 'Medium',
    blinks: 0,
    gaze_away: 0,
    face_detected: true,
    synthetic_webcam: true,
    webcam_ml_waiting: true,
  })
  assert.ok(o.engagement_score > 0)
  assert.strictEqual(o.webcam_ml_status, 'waiting')
  assert.deepStrictEqual(o.engagement_proba_pct, [0, 0, 100])
})

test('ensemble cognitive_proba => active', () => {
  const o = fuseTracking({
    activity_percentage: 50,
    final_model_load: 'Medium',
    blinks: 0,
    gaze_away: 0,
    face_detected: true,
    synthetic_webcam: false,
    cognitive_proba: [0.15, 0.55, 0.3],
  })
  assert.strictEqual(o.webcam_ml_status, 'active')
  assert.deepStrictEqual(o.engagement_proba_pct, [15, 55, 30])

  const hi = fuseTracking({
    activity_percentage: 40,
    final_model_load: 'High',
    blinks: 0,
    gaze_away: 0,
    face_detected: true,
    synthetic_webcam: false,
    cognitive_proba: [0.05, 0.15, 0.8],
  })
  assert.deepStrictEqual(hi.engagement_proba_pct, [5, 15, 80])
})
