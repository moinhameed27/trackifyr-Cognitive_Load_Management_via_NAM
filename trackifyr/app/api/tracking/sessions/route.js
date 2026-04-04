import { getSessionTokenFromRequest } from '@/lib/auth-session'
import { getUserIdFromSessionToken } from '@/lib/trackingLiveDb'
import { SESSION_LOG_PAGE_SIZE } from '@/lib/trackingConstants'
import {
  countFiveMinuteBucketsForUser,
  listFiveMinuteSessionsForUser,
  listRollingDailyAggregatesForUser,
} from '@/lib/trackingSessionsDb'

export async function GET(request) {
  const token = await getSessionTokenFromRequest()
  if (!token) {
    return Response.json({ ok: false, sessions: [], weekly: [] }, { status: 401 })
  }
  const userId = await getUserIdFromSessionToken(token)
  if (!userId) {
    return Response.json({ ok: false, sessions: [], weekly: [] }, { status: 401 })
  }

  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get('limit') || String(SESSION_LOG_PAGE_SIZE), 10) || SESSION_LOG_PAGE_SIZE),
  )
  const includeWeekly = url.searchParams.get('weekly') !== '0'

  try {
    const offset = (page - 1) * limit
    const [total, sessions] = await Promise.all([
      countFiveMinuteBucketsForUser(userId),
      listFiveMinuteSessionsForUser(userId, limit, offset),
    ])
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const weekly = includeWeekly ? await listRollingDailyAggregatesForUser(userId) : []

    return Response.json({
      ok: true,
      sessions,
      total,
      page,
      limit,
      totalPages,
      weekly,
    })
  } catch {
    return Response.json({ ok: false, sessions: [], weekly: [] }, { status: 500 })
  }
}
