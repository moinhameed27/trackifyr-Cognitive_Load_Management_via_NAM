import { query } from '@/lib/db'
import { fusionEngagementToTier, fusionEngagementToTierIndex } from '@/lib/engagementTier'
import {
  fiveMinuteBucketStartUtcMs,
  formatPktChartAxisTime,
  formatPktIsoDate,
  formatPktSessionWindow,
  formatPktWeekdayLabel,
  pktEndOfCalendarDayExclusive,
  pktRollingWindowBounds,
  pktStartOfCalendarDay,
} from '@/lib/pktTime'
import { SESSION_LOG_PAGE_SIZE, WEEKLY_ROLLING_DAYS } from '@/lib/trackingConstants'

export { fiveMinuteBucketStartUtcMs } from '@/lib/pktTime'

export { SESSION_LOG_PAGE_SIZE, WEEKLY_ROLLING_DAYS } from '@/lib/trackingConstants'

export async function ensureTrackingBucketsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS tracking_five_minute_buckets (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      bucket_start TIMESTAMPTZ NOT NULL,
      sum_activity DOUBLE PRECISION NOT NULL DEFAULT 0,
      sum_engagement_score DOUBLE PRECISION NOT NULL DEFAULT 0,
      cognitive_high INTEGER NOT NULL DEFAULT 0,
      cognitive_medium INTEGER NOT NULL DEFAULT 0,
      cognitive_low INTEGER NOT NULL DEFAULT 0,
      sample_count INTEGER NOT NULL DEFAULT 0,
      engagement_sample_count INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, bucket_start)
    );
  `)
  await query(`
    ALTER TABLE tracking_five_minute_buckets
      ADD COLUMN IF NOT EXISTS engagement_sample_count INTEGER NOT NULL DEFAULT 0;
  `)
  await query(`
    UPDATE tracking_five_minute_buckets
    SET engagement_sample_count = sample_count
    WHERE engagement_sample_count = 0 AND sample_count > 0;
  `)
  await query(`
    CREATE INDEX IF NOT EXISTS idx_tracking_buckets_user_time
      ON tracking_five_minute_buckets (user_id, bucket_start DESC);
  `)
}

/**
 * @param {object} body ingest payload (fused)
 */
export async function mergeIngestIntoFiveMinuteBucket(userId, body) {
  if (!userId || !body || typeof body !== 'object') return
  await ensureTrackingBucketsTable()

  const bucketStart = new Date(fiveMinuteBucketStartUtcMs())

  const act = typeof body.activity_load === 'number' ? body.activity_load : 0
  /** Webcam-only: only count samples that include a numeric engagement_score from ML fusion. */
  const hasEngagementSample =
    typeof body.engagement_score === 'number' && !Number.isNaN(body.engagement_score)
  const engScore = hasEngagementSample ? body.engagement_score : 0
  const engCountDelta = hasEngagementSample ? 1 : 0

  const cog = String(body.final_cognitive_load || 'Medium')
  let ch = 0
  let cm = 0
  let cl = 0
  if (cog === 'High') ch = 1
  else if (cog === 'Low') cl = 1
  else cm = 1

  await query(
    `
    INSERT INTO tracking_five_minute_buckets (
      user_id, bucket_start, sum_activity, sum_engagement_score,
      cognitive_high, cognitive_medium, cognitive_low, sample_count, engagement_sample_count
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8)
    ON CONFLICT (user_id, bucket_start) DO UPDATE SET
      sum_activity = tracking_five_minute_buckets.sum_activity + EXCLUDED.sum_activity,
      sum_engagement_score = tracking_five_minute_buckets.sum_engagement_score + EXCLUDED.sum_engagement_score,
      cognitive_high = tracking_five_minute_buckets.cognitive_high + EXCLUDED.cognitive_high,
      cognitive_medium = tracking_five_minute_buckets.cognitive_medium + EXCLUDED.cognitive_medium,
      cognitive_low = tracking_five_minute_buckets.cognitive_low + EXCLUDED.cognitive_low,
      sample_count = tracking_five_minute_buckets.sample_count + 1,
      engagement_sample_count = tracking_five_minute_buckets.engagement_sample_count + EXCLUDED.engagement_sample_count,
      updated_at = now()
  `,
    [userId, bucketStart, act, engScore, ch, cm, cl, engCountDelta],
  )
}

/** @param {object} row bucket row with cognitive_* counts */
export function dominantCognitiveLoadForBucketRow(row) {
  const h = Number(row.cognitive_high) || 0
  const m = Number(row.cognitive_medium) || 0
  const l = Number(row.cognitive_low) || 0
  if (h >= m && h >= l) return 'High'
  if (l >= m && l >= h) return 'Low'
  return 'Medium'
}

function dominantCognitive(row) {
  return dominantCognitiveLoadForBucketRow(row)
}

/**
 * Most recent PKT 5-minute bucket row for the user (same shape as session log aggregation).
 * @param {number} userId
 * @returns {Promise<object | null>}
 */
export async function getLatestBucketForUser(userId) {
  if (!userId) return null
  await ensureTrackingBucketsTable()
  const r = await query(
    `
    SELECT
      bucket_start,
      sum_activity,
      sum_engagement_score,
      cognitive_high,
      cognitive_medium,
      cognitive_low,
      sample_count,
      engagement_sample_count
    FROM tracking_five_minute_buckets
    WHERE user_id = $1
    ORDER BY bucket_start DESC
    LIMIT 1
  `,
    [userId],
  )
  return r.rows?.[0] ?? null
}

function engagementFromAvgScore(s) {
  if (s < 42) return 'Low'
  if (s < 72) return 'Medium'
  return 'High'
}

/**
 * @param {number} userId
 */
export async function countFiveMinuteBucketsForUser(userId) {
  await ensureTrackingBucketsTable()
  const r = await query(
    `SELECT COUNT(*)::int AS c FROM tracking_five_minute_buckets WHERE user_id = $1`,
    [userId],
  )
  return Number(r.rows[0]?.c) || 0
}

/**
 * Mean activity_load (0–100) across every ingest sample for the current PKT calendar day.
 * Uses the same sums as 5-minute buckets: SUM(sum_activity) / SUM(sample_count). Resets at 00:00 PKT.
 * @param {number} userId
 * @returns {Promise<number | null>}
 */
export async function getTodayAverageActivityPercent(userId) {
  if (!userId) return null
  await ensureTrackingBucketsTable()
  const now = new Date()
  const startUtc = pktStartOfCalendarDay(now)
  const endUtc = pktEndOfCalendarDayExclusive(now)
  const r = await query(
    `
    SELECT
      COALESCE(SUM(sum_activity), 0)::double precision AS sa,
      COALESCE(SUM(sample_count), 0)::bigint AS sc
    FROM tracking_five_minute_buckets
    WHERE user_id = $1
      AND bucket_start >= $2::timestamptz
      AND bucket_start < $3::timestamptz
  `,
    [userId, startUtc.toISOString(), endUtc.toISOString()],
  )
  const sc = Number(r.rows[0]?.sc) || 0
  const sa = Number(r.rows[0]?.sa) || 0
  if (sc <= 0) return null
  return Math.max(0, Math.min(100, Math.round(sa / sc)))
}

/**
 * All 5-minute buckets for the current PKT day, ascending — for the cognitive load chart.
 * @param {number} userId
 * @returns {Promise<Array<{ time: string, load: number, engagementTier: number }>>}
 */
export async function listTodayBucketsForChart(userId) {
  if (!userId) return []
  await ensureTrackingBucketsTable()
  const now = new Date()
  const startUtc = pktStartOfCalendarDay(now)
  const endUtc = pktEndOfCalendarDayExclusive(now)
  const r = await query(
    `
    SELECT
      bucket_start,
      sum_activity,
      sum_engagement_score,
      sample_count,
      engagement_sample_count
    FROM tracking_five_minute_buckets
    WHERE user_id = $1
      AND bucket_start >= $2::timestamptz
      AND bucket_start < $3::timestamptz
    ORDER BY bucket_start ASC
  `,
    [userId, startUtc.toISOString(), endUtc.toISOString()],
  )

  return r.rows.map((row) => {
    const n = Math.max(1, Number(row.sample_count) || 1)
    const nEng = Math.max(0, Number(row.engagement_sample_count) || 0)
    const avgAct = Number(row.sum_activity) / n
    const avgEng = nEng > 0 ? Number(row.sum_engagement_score) / nEng : null
    const engLabel = avgEng != null ? engagementFromAvgScore(avgEng) : null
    const tierIdx = engLabel != null ? fusionEngagementToTierIndex(engLabel) ?? 2 : null
    const start = new Date(row.bucket_start)
    return {
      time: formatPktChartAxisTime(start),
      load: Math.round(Math.max(0, Math.min(100, avgAct))),
      engagementTier: tierIdx,
    }
  })
}

/**
 * @param {number} userId
 * @param {number} limit
 * @param {number} offset
 * @returns {Promise<Array<{ id: string, bucketStart: string, time: string, cognitiveLoad: string, engagement: string, duration: string, avgActivity: string }>>}
 */
export async function listFiveMinuteSessionsForUser(userId, limit = SESSION_LOG_PAGE_SIZE, offset = 0) {
  await ensureTrackingBucketsTable()
  const lim = Math.min(Math.max(1, Number(limit) || SESSION_LOG_PAGE_SIZE), 100)
  const off = Math.max(0, Number(offset) || 0)
  const r = await query(
    `
    SELECT
      bucket_start,
      sum_activity,
      sum_engagement_score,
      cognitive_high,
      cognitive_medium,
      cognitive_low,
      sample_count,
      engagement_sample_count
    FROM tracking_five_minute_buckets
    WHERE user_id = $1
    ORDER BY bucket_start DESC
    LIMIT $2 OFFSET $3
  `,
    [userId, lim, off],
  )

  return r.rows.map((row) => {
    const start = new Date(row.bucket_start)
    const end = new Date(start.getTime() + 5 * 60 * 1000)
    const n = Math.max(1, Number(row.sample_count) || 1)
    const nEng = Math.max(0, Number(row.engagement_sample_count) || 0)
    const avgAct = Number(row.sum_activity) / n
    const avgEng = nEng > 0 ? Number(row.sum_engagement_score) / nEng : null
    const engLabel = avgEng != null ? engagementFromAvgScore(avgEng) : null
    return {
      id: String(row.bucket_start),
      bucketStart: start.toISOString(),
      time: formatPktSessionWindow(start, end),
      cognitiveLoad: dominantCognitive(row),
      engagement: engLabel != null ? fusionEngagementToTier(engLabel) || engLabel : '—',
      duration: '5 min',
      avgActivity: `${Math.round(avgAct)}%`,
    }
  })
}

/**
 * All 5-minute buckets for the current PKT day, ascending — for PDF / full-day export.
 * @param {number} userId
 */
export async function listPktDayBucketsAscendingForReport(userId) {
  if (!userId) return []
  await ensureTrackingBucketsTable()
  const now = new Date()
  const startUtc = pktStartOfCalendarDay(now)
  const endUtc = pktEndOfCalendarDayExclusive(now)
  const r = await query(
    `
    SELECT
      bucket_start,
      sum_activity,
      sum_engagement_score,
      cognitive_high,
      cognitive_medium,
      cognitive_low,
      sample_count,
      engagement_sample_count
    FROM tracking_five_minute_buckets
    WHERE user_id = $1
      AND bucket_start >= $2::timestamptz
      AND bucket_start < $3::timestamptz
    ORDER BY bucket_start ASC
  `,
    [userId, startUtc.toISOString(), endUtc.toISOString()],
  )

  return r.rows.map((row) => {
    const start = new Date(row.bucket_start)
    const end = new Date(start.getTime() + 5 * 60 * 1000)
    const n = Math.max(1, Number(row.sample_count) || 1)
    const nEng = Math.max(0, Number(row.engagement_sample_count) || 0)
    const avgAct = Number(row.sum_activity) / n
    const avgEng = nEng > 0 ? Number(row.sum_engagement_score) / nEng : null
    const engLabel = avgEng != null ? engagementFromAvgScore(avgEng) : null
    return {
      id: String(row.bucket_start),
      bucketStart: start.toISOString(),
      time: formatPktSessionWindow(start, end),
      cognitiveLoad: dominantCognitive(row),
      engagement: engLabel != null ? fusionEngagementToTier(engLabel) || engLabel : '—',
      duration: '5 min',
      avgActivity: `${Math.round(avgAct)}%`,
    }
  })
}

/**
 * Rolling last N days (PKT calendar days): avg engagement score and count of 5-minute buckets per day.
 * @param {number} userId
 * @param {number} [days]
 * @returns {Promise<Array<{ day: string, engagement: number, sessions: number, avgActivity: number }>>}
 */
export async function listRollingDailyAggregatesForUser(userId, days = WEEKLY_ROLLING_DAYS) {
  await ensureTrackingBucketsTable()
  const nDays = Math.min(Math.max(1, Number(days) || WEEKLY_ROLLING_DAYS), 31)

  const now = new Date()
  const { start: startUtc, end: endUtc } = pktRollingWindowBounds(now, nDays)

  const r = await query(
    `
    SELECT
      (bucket_start AT TIME ZONE 'Asia/Karachi')::date AS day_date,
      SUM(sample_count)::bigint AS total_samples,
      SUM(sum_activity)::double precision AS sum_act,
      SUM(sum_engagement_score)::double precision AS sum_eng,
      SUM(engagement_sample_count)::bigint AS total_eng_samples,
      COUNT(*)::int AS bucket_count
    FROM tracking_five_minute_buckets
    WHERE user_id = $1
      AND bucket_start >= $2::timestamptz
      AND bucket_start < $3::timestamptz
    GROUP BY 1
    ORDER BY 1 ASC
  `,
    [userId, startUtc.toISOString(), endUtc.toISOString()],
  )

  const byDay = new Map()
  for (const row of r.rows) {
    const raw = row.day_date
    const key =
      raw instanceof Date
        ? raw.toISOString().slice(0, 10)
        : String(raw).length >= 10
          ? String(raw).slice(0, 10)
          : ''
    if (!key) continue
    const samples = Number(row.total_samples) || 0
    const sumAct = Number(row.sum_act) || 0
    const sumEng = Number(row.sum_eng) || 0
    const engSamples = Number(row.total_eng_samples) || 0
    const buckets = Number(row.bucket_count) || 0
    byDay.set(key, {
      avgActivity: samples > 0 ? Math.round(sumAct / samples) : 0,
      avgEngagement: engSamples > 0 ? Math.round(sumEng / engSamples) : 0,
      sessions: buckets,
    })
  }

  const todayStart = pktStartOfCalendarDay(now)
  const out = []
  for (let i = nDays - 1; i >= 0; i--) {
    const dayInstant = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000)
    const key = formatPktIsoDate(dayInstant)
    const agg = byDay.get(key)
    out.push({
      day: formatPktWeekdayLabel(dayInstant),
      engagement: agg?.avgEngagement ?? 0,
      sessions: agg?.sessions ?? 0,
      avgActivity: agg?.avgActivity ?? 0,
    })
  }
  return out
}
