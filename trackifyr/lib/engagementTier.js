/**
 * Normalizes fusion `engagement` to Low / Medium / High for display.
 */

/** @param {string | null | undefined} engagement */
export function fusionEngagementToTier(engagement) {
  const e = String(engagement || '')
  if (e === 'High' || e === 'Medium' || e === 'Low') return e
  return null
}

/** Numeric tier for charts (1 = Low … 3 = High) */
export function fusionEngagementToTierIndex(engagement) {
  const e = String(engagement || '')
  if (e === 'Low') return 1
  if (e === 'Medium') return 2
  if (e === 'High') return 3
  return null
}
