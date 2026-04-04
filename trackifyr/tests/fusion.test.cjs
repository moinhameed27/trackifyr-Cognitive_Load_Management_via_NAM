'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const path = require('path')
const {
  fuseTracking,
  ACTIVITY_HIGH_THRESHOLD,
  ACTIVITY_LOW_THRESHOLD,
} = require(path.join(__dirname, '..', 'desktop', 'fusion.js'))

test('high activity + high model => high', () => {
  const o = fuseTracking({
    activity_percentage: ACTIVITY_HIGH_THRESHOLD,
    final_model_load: 'High',
    blinks: 0,
    gaze_away: 0,
    face_detected: true,
  })
  assert.strictEqual(o.final_cognitive_load, 'High')
  assert.strictEqual(o.webcam_ml_status, 'active')
})

test('activity just below high threshold + high model => not fused High', () => {
  const o = fuseTracking({
    activity_percentage: ACTIVITY_HIGH_THRESHOLD - 1,
    final_model_load: 'High',
    blinks: 0,
    gaze_away: 0,
    face_detected: true,
    synthetic_webcam: false,
    cognitive_proba: [0.05, 0.15, 0.8],
  })
  assert.strictEqual(o.final_cognitive_load, 'Medium')
})

test('low activity + low model => Low final cognitive load', () => {
  const o = fuseTracking({
    activity_percentage: ACTIVITY_LOW_THRESHOLD - 1,
    final_model_load: 'Low',
    blinks: 0,
    gaze_away: 0,
    face_detected: true,
  })
  assert.strictEqual(o.final_cognitive_load, 'Low')
})

test('low activity + ensemble Medium + Low engagement (proba) => final cognitive Low', () => {
  const o = fuseTracking({
    activity_percentage: 0,
    final_model_load: 'Medium',
    blinks: 0,
    gaze_away: 0,
    face_detected: true,
    synthetic_webcam: false,
    cognitive_proba: [0.85, 0.1, 0.05],
  })
  assert.strictEqual(o.engagement, 'Low')
  assert.strictEqual(o.final_cognitive_load, 'Low')
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
  assert.strictEqual(o.engagement_score, 11)
  assert.deepStrictEqual(o.engagement_proba_pct, [100, 0, 0])
})

test('webcam ML off: engagement unset (not from activity)', () => {
  const o = fuseTracking({
    activity_percentage: 80,
    final_model_load: 'Medium',
    blinks: 0,
    gaze_away: 0,
    face_detected: true,
    synthetic_webcam: true,
    webcam_ml_waiting: false,
  })
  assert.strictEqual(o.engagement, null)
  assert.strictEqual(o.engagement_score, null)
  assert.deepStrictEqual(o.engagement_proba_pct, [0, 0, 0])
  assert.strictEqual(o.webcam_ml_status, 'off')
})

test('webcam on but JSON not yet: engagement unset (not from activity)', () => {
  const o = fuseTracking({
    activity_percentage: 80,
    final_model_load: 'Medium',
    blinks: 0,
    gaze_away: 0,
    face_detected: true,
    synthetic_webcam: true,
    webcam_ml_waiting: true,
  })
  assert.strictEqual(o.engagement, null)
  assert.strictEqual(o.engagement_score, null)
  assert.deepStrictEqual(o.engagement_proba_pct, [0, 0, 0])
  assert.strictEqual(o.webcam_ml_status, 'waiting')
})

test('waiting mode: activity does not set engagement', () => {
  const low = fuseTracking({
    activity_percentage: 5,
    final_model_load: 'Medium',
    blinks: 0,
    gaze_away: 0,
    face_detected: true,
    synthetic_webcam: true,
    webcam_ml_waiting: true,
  })
  const high = fuseTracking({
    activity_percentage: 95,
    final_model_load: 'Medium',
    blinks: 0,
    gaze_away: 0,
    face_detected: true,
    synthetic_webcam: true,
    webcam_ml_waiting: true,
  })
  assert.strictEqual(low.engagement, null)
  assert.strictEqual(high.engagement, null)
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

test('cognitive_proba path: engagement_score from softmax blend, not activity_load', () => {
  const o = fuseTracking({
    activity_percentage: 90,
    final_model_load: 'High',
    blinks: 0,
    gaze_away: 0,
    face_detected: true,
    synthetic_webcam: false,
    cognitive_proba: [0.34, 0.33, 0.33],
  })
  assert.strictEqual(o.activity_load, 90)
  assert.strictEqual(o.engagement_score, 55)
  assert.notStrictEqual(o.engagement_score, o.activity_load)
})
