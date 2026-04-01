import { query } from '@/lib/db'

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
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, bucket_start)
    );
  `)
  await query(`
    CREATE INDEX IF NOT EXISTS idx_tracking_buckets_user_time
      ON tracking_five_minute_buckets (user_id, bucket_start DESC);
  `)
}

function engagementLabelToScore(label) {
  const s = String(label || '')
  if (s === 'High') return 85
  if (s === 'Low') return 30
  return 55
}

/**
 * @param {object} body ingest payload (fused)
 */
export async function mergeIngestIntoFiveMinuteBucket(userId, body) {
  if (!userId || !body || typeof body !== 'object') return
  await ensureTrackingBucketsTable()

  const ms = 5 * 60 * 1000
  const bucketStart = new Date(Math.floor(Date.now() / ms) * ms)

  const act = typeof body.activity_load === 'number' ? body.activity_load : 0
  const engScore =
    typeof body.engagement_score === 'number' && !Number.isNaN(body.engagement_score)
      ? body.engagement_score
      : engagementLabelToScore(body.engagement)

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
      cognitive_high, cognitive_medium, cognitive_low, sample_count
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
    ON CONFLICT (user_id, bucket_start) DO UPDATE SET
      sum_activity = tracking_five_minute_buckets.sum_activity + EXCLUDED.sum_activity,
      sum_engagement_score = tracking_five_minute_buckets.sum_engagement_score + EXCLUDED.sum_engagement_score,
      cognitive_high = tracking_five_minute_buckets.cognitive_high + EXCLUDED.cognitive_high,
      cognitive_medium = tracking_five_minute_buckets.cognitive_medium + EXCLUDED.cognitive_medium,
      cognitive_low = tracking_five_minute_buckets.cognitive_low + EXCLUDED.cognitive_low,
      sample_count = tracking_five_minute_buckets.sample_count + 1,
      updated_at = now()
  `,
    [userId, bucketStart, act, engScore, ch, cm, cl],
  )
}

function dominantCognitive(row) {
  const h = Number(row.cognitive_high) || 0
  const m = Number(row.cognitive_medium) || 0
  const l = Number(row.cognitive_low) || 0
  if (h >= m && h >= l) return 'High'
  if (l >= m && l >= h) return 'Low'
  return 'Medium'
}

function engagementFromAvgScore(s) {
  if (s < 42) return 'Low'
  if (s < 72) return 'Medium'
  return 'High'
}

/**
 * @param {number} userId
 * @param {number} [limit]
 * @returns {Promise<Array<{ id: string, time: string, cognitiveLoad: string, engagement: string, duration: string, avgActivity: string }>>}
 */
export async function listFiveMinuteSessionsForUser(userId, limit = 48) {
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
      sample_count
    FROM tracking_five_minute_buckets
    WHERE user_id = $1
    ORDER BY bucket_start DESC
    LIMIT $2
  `,
    [userId, limit],
  )

  return r.rows.map((row) => {
    const start = new Date(row.bucket_start)
    const end = new Date(start.getTime() + 5 * 60 * 1000)
    const n = Math.max(1, Number(row.sample_count) || 1)
    const avgAct = Number(row.sum_activity) / n
    const avgEng = Number(row.sum_engagement_score) / n
    return {
      id: String(row.bucket_start),
      time: `${start.toLocaleString()} – ${end.toLocaleTimeString()}`,
      cognitiveLoad: dominantCognitive(row),
      engagement: engagementFromAvgScore(avgEng),
      duration: '5 min',
      avgActivity: `${Math.round(avgAct)}%`,
    }
  })
}
