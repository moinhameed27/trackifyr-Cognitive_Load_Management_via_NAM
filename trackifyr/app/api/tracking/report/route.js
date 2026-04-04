import { getSessionTokenFromRequest } from '@/lib/auth-session'
import { query } from '@/lib/db'
import { ensureUsersTable } from '@/lib/usersSchema'
import { formatPktDateTimeFull, formatPktIsoDate } from '@/lib/pktTime'
import { getUserIdFromSessionToken } from '@/lib/trackingLiveDb'
import {
  getTodayAverageActivityPercent,
  listPktDayBucketsAscendingForReport,
  listRollingDailyAggregatesForUser,
  listTodayBucketsForChart,
} from '@/lib/trackingSessionsDb'

export const runtime = 'nodejs'

export async function GET(request) {
  const token = await getSessionTokenFromRequest(request)
  if (!token) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  const userId = await getUserIdFromSessionToken(token)
  if (!userId) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const period = url.searchParams.get('period') === 'weekly' ? 'weekly' : 'daily'

  try {
    await ensureUsersTable()
    const ur = await query(`SELECT full_name, email FROM users WHERE id = $1 LIMIT 1`, [userId])
    const urow = ur.rows[0]
    const user = {
      fullName: urow?.full_name || '',
      email: urow?.email || '',
    }
    const generatedAtPkt = formatPktDateTimeFull(new Date())
    const pktDateLabel = formatPktIsoDate(new Date())

    if (period === 'daily') {
      const rows = await listPktDayBucketsAscendingForReport(userId)
      const chartPoints = await listTodayBucketsForChart(userId)
      const dailyAvg = await getTodayAverageActivityPercent(userId)
      return Response.json({
        ok: true,
        period: 'daily',
        user,
        generatedAtPkt,
        pktDateLabel,
        daily: {
          rows,
          chartPoints,
          summary: {
            bucketCount: rows.length,
            dailyAvgActivityPct: dailyAvg,
          },
        },
      })
    }

    const weeklyRows = await listRollingDailyAggregatesForUser(userId)
    return Response.json({
      ok: true,
      period: 'weekly',
      user,
      generatedAtPkt,
      pktDateLabel,
      weekly: {
        rows: weeklyRows.map((r) => ({
          day: r.day,
          avgActivity: r.avgActivity,
          sessions: r.sessions,
          engagement: r.engagement,
        })),
      },
    })
  } catch {
    return Response.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
