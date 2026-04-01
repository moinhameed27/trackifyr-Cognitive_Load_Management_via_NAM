import { query } from '@/lib/db'

export async function ensureTrackingLiveTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS user_tracking_live (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `)
}

/**
 * @param {string} token
 * @returns {Promise<number | null>}
 */
export async function getUserIdFromSessionToken(token) {
  if (!token) return null
  const result = await query(
    `
    SELECT u.id
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = $1 AND s.expires_at > now()
    LIMIT 1
  `,
    [token],
  )
  return result.rows[0]?.id ?? null
}

/**
 * @param {number} userId
 * @param {object} payload
 */
export async function upsertTrackingLiveForUser(userId, payload) {
  await ensureTrackingLiveTable()
  await query(
    `
    INSERT INTO user_tracking_live (user_id, payload, updated_at)
    VALUES ($1, $2::jsonb, now())
    ON CONFLICT (user_id) DO UPDATE SET
      payload = EXCLUDED.payload,
      updated_at = now()
  `,
    [userId, JSON.stringify(payload)],
  )
}

/**
 * @param {number} userId
 * @returns {Promise<object | null>}
 */
export async function getTrackingLivePayloadForUser(userId) {
  await ensureTrackingLiveTable()
  const r = await query(
    `SELECT payload FROM user_tracking_live WHERE user_id = $1 LIMIT 1`,
    [userId],
  )
  const row = r.rows[0]
  if (!row?.payload) return null
  const p = row.payload
  return typeof p === 'object' && p !== null ? p : null
}
