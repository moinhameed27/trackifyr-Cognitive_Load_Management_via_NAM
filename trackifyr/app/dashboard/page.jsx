// codacy test trigger

/**
 * @fileoverview Dashboard — live metrics from /api/tracking only (no mock data).
 */

'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import CognitiveLoadCard from '@/components/CognitiveLoadCard'
import CognitiveLoadCharts from '@/components/CognitiveLoadCharts'
import SessionLogsTable from '@/components/SessionLogsTable'
import FeedbackPanel from '@/components/FeedbackPanel'
import { fusionEngagementToTier } from '@/lib/engagementTier'
import { postTrackingFilterToBridge } from '@/lib/trackingBridgeClient'
import { SESSION_LOG_PAGE_SIZE } from '@/lib/trackingConstants'

const DESKTOP_LINK = '/download?from=dashboard'
/** Dashboard data refresh (live metrics, charts, session list poll). */
const DASH_POLL_MS = 11000

const STATS_CARD_COLORS = {
  indigo: 'bg-indigo-100 text-indigo-600',
  green: 'bg-green-100 text-green-600',
  blue: 'bg-blue-100 text-blue-600',
  purple: 'bg-purple-100 text-purple-600',
}

export default function DashboardPage() {
  const router = useRouter()
  const { isAuthenticated, user, isAuthLoading } = useAuth()
  const [live, setLive] = useState(null)
  const [chartSeries, setChartSeries] = useState([])
  const [lastUpdated, setLastUpdated] = useState(null)
  const [sessions, setSessions] = useState([])
  const [sessionPage, setSessionPage] = useState(1)
  const [sessionTotal, setSessionTotal] = useState(0)
  const [sessionTotalPages, setSessionTotalPages] = useState(1)
  const [weeklySeries, setWeeklySeries] = useState([])
  const sessionPageRef = useRef(1)

  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch('/api/tracking/live', {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      if (!res.ok) return
      const data = await res.json()
      setLive(data)
    } catch {
      /* ignore */
    }
  }, [])

  /** Today's 5-min buckets for the cognitive load chart (PKT day), even when the desktop app is off. */
  const fetchDayChart = useCallback(async () => {
    try {
      const res = await fetch('/api/tracking/chart-day', {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      if (!res.ok) return
      const data = await res.json()
      if (data?.ok && Array.isArray(data.points)) setChartSeries(data.points)
    } catch {
      /* ignore */
    }
  }, [])

  const fetchWeekly = useCallback(async () => {
    try {
      const res = await fetch('/api/tracking/weekly', {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      if (!res.ok) return
      const data = await res.json()
      if (data?.ok && Array.isArray(data.weekly)) setWeeklySeries(data.weekly)
    } catch {
      /* ignore */
    }
  }, [])

  /** Session table only — `weekly=0` avoids the heavier weekly aggregation on every page change. */
  const fetchSessionsData = useCallback(async (page = 1) => {
    try {
      const res = await fetch(
        `/api/tracking/sessions?page=${page}&limit=${SESSION_LOG_PAGE_SIZE}&weekly=0`,
        {
          cache: 'no-store',
          credentials: 'same-origin',
        },
      )
      if (!res.ok) return
      const data = await res.json()
      if (!data?.ok) return
      if (Array.isArray(data.sessions)) setSessions(data.sessions)
      if (typeof data.page === 'number') setSessionPage(data.page)
      if (typeof data.total === 'number') setSessionTotal(data.total)
      if (typeof data.totalPages === 'number') setSessionTotalPages(data.totalPages)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.push('/signin')
    }
  }, [isAuthLoading, isAuthenticated, router])

  useEffect(() => {
    sessionPageRef.current = sessionPage
  }, [sessionPage])

  useEffect(() => {
    if (!isAuthenticated) return
    fetchLive()
    void fetchDayChart()
    void fetchWeekly()
    const idLive = setInterval(fetchLive, DASH_POLL_MS)
    const idChart = setInterval(fetchDayChart, DASH_POLL_MS)
    const idWeekly = setInterval(fetchWeekly, DASH_POLL_MS * 4)
    return () => {
      clearInterval(idLive)
      clearInterval(idChart)
      clearInterval(idWeekly)
    }
  }, [isAuthenticated, fetchLive, fetchDayChart, fetchWeekly])

  useEffect(() => {
    if (!isAuthenticated) return
    void fetchSessionsData(sessionPage)
  }, [isAuthenticated, sessionPage, fetchSessionsData])

  useEffect(() => {
    if (!isAuthenticated) return
    const idSessions = setInterval(() => {
      void fetchSessionsData(sessionPageRef.current)
    }, DASH_POLL_MS)
    return () => clearInterval(idSessions)
  }, [isAuthenticated, fetchSessionsData])

  /** Combined mode via browser → local Electron bridge (127.0.0.1). Do not rely on /api/tracking/filter — the Next server cannot reach the user's machine when deployed remotely. */
  useEffect(() => {
    if (!isAuthenticated) return
    const t1 = setTimeout(() => {
      void postTrackingFilterToBridge('combined')
    }, 300)
    const t2 = setTimeout(() => {
      void postTrackingFilterToBridge('combined')
    }, 2000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!live || !live.hasData) {
      return
    }
    setLastUpdated(Date.now())
  }, [live])

  if (isAuthLoading || !isAuthenticated) {
    return null
  }

  const hasData = Boolean(live?.hasData)
  const engagementTier = hasData ? fusionEngagementToTier(live?.engagement) : null

  const statsCards = [
    {
      title: 'Activity load',
      value: hasData && typeof live.activity_load === 'number' ? `${Math.round(live.activity_load)}%` : '—',
      change: hasData ? '~11s refresh' : '—',
      color: 'indigo',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      title: 'Engagement',
      value: engagementTier ?? '—',
      change: hasData ? 'Webcam ML only' : '—',
      color: 'green',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
    {
      title: 'Final cognitive load',
      value: hasData && live.final_cognitive_load ? String(live.final_cognitive_load) : '—',
      change: hasData ? 'Current (latest ingest)' : '—',
      color: 'blue',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: 'Total activity %',
      value:
        typeof live?.daily_avg_activity_pct === 'number' && !Number.isNaN(live.daily_avg_activity_pct)
          ? `${Math.round(live.daily_avg_activity_pct)}%`
          : '—',
      change: 'Resets 00:00 PKT',
      color: 'purple',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 lg:pl-64">
        <Header title="Dashboard" subtitle={`Welcome back, ${user?.fullName?.split(' ')[0] || 'User'}! 👋`} />

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="mb-4 text-sm text-gray-600">
            Live metrics come only from the{' '}
            <Link href={DESKTOP_LINK} className="font-semibold text-indigo-700 underline hover:text-indigo-900">
              desktop app
            </Link>{' '}
            while it is running and ingesting (same account). If you close the app, numbers clear within about half a minute.{' '}
            <Link href="/tracking-setup" className="text-indigo-600 underline hover:text-indigo-900">
              Setup
            </Link>
            .
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {statsCards.map((stat, index) => (
              <div
                key={index}
                className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md border border-gray-100 p-4 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-lg ${STATS_CARD_COLORS[stat.color] || 'bg-gray-100 text-gray-600'}`}>{stat.icon}</div>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-700 max-w-[min(100%,140px)] truncate" title={stat.change}>
                    {stat.change}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-0.5">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mb-4 flex flex-col gap-3">
            <CognitiveLoadCard
              hasData={hasData}
              level={live?.final_cognitive_load ?? null}
              value={hasData && typeof live.activity_load === 'number' ? live.activity_load : null}
              engagementTier={hasData ? engagementTier : null}
              webcamMlStatus={hasData ? live?.webcam_ml_status ?? 'active' : 'active'}
              updatedAt={lastUpdated}
            />
          </div>

          <div className="mb-4">
            <CognitiveLoadCharts
              loadSeries={chartSeries}
              dailySeries={weeklySeries}
              hasWeeklyData={weeklySeries.some(
                (d) => (d.sessions ?? 0) > 0 || (typeof d.avgActivity === 'number' && d.avgActivity > 0),
              )}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <SessionLogsTable
                sessions={sessions}
                page={sessionPage}
                totalPages={sessionTotalPages}
                total={sessionTotal}
                pageSize={SESSION_LOG_PAGE_SIZE}
                onPageChange={(p) => setSessionPage(p)}
              />
            </div>
            <div>
              <FeedbackPanel messages={[]} />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
