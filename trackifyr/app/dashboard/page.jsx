// codacy test trigger

/**
 * @fileoverview Dashboard — live metrics from /api/tracking only (no mock data).
 */

'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import CognitiveLoadCard from '@/components/CognitiveLoadCard'
import CognitiveLoadCharts from '@/components/CognitiveLoadCharts'
import SessionLogsTable from '@/components/SessionLogsTable'
import FeedbackPanel from '@/components/FeedbackPanel'

function engagementProbaTriple(live) {
  if (!live?.hasData || !Array.isArray(live.engagement_proba_pct) || live.engagement_proba_pct.length !== 3) {
    return null
  }
  return live.engagement_proba_pct.map((x) => Math.max(0, Math.min(100, Number(x) || 0)))
}

const STATS_CARD_COLORS = {
  indigo: 'bg-indigo-100 text-indigo-600',
  slate: 'bg-slate-100 text-slate-600',
  green: 'bg-green-100 text-green-600',
  amber: 'bg-amber-100 text-amber-600',
  blue: 'bg-blue-100 text-blue-600',
  purple: 'bg-purple-100 text-purple-600',
}

export default function DashboardPage() {
  const router = useRouter()
  const { isAuthenticated, user, isAuthLoading } = useAuth()
  const [live, setLive] = useState(null)
  const [chartSeries, setChartSeries] = useState([])
  const [lastUpdated, setLastUpdated] = useState(null)
  const [viewFilter, setViewFilter] = useState('combined')
  const [sessions, setSessions] = useState([])

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

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/tracking/sessions', {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      if (!res.ok) return
      const data = await res.json()
      if (data?.ok && Array.isArray(data.sessions)) setSessions(data.sessions)
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
    if (!isAuthenticated) return
    fetchLive()
    fetchSessions()
    const id = setInterval(fetchLive, 2500)
    const idS = setInterval(fetchSessions, 15000)
    return () => {
      clearInterval(id)
      clearInterval(idS)
    }
  }, [isAuthenticated, fetchLive, fetchSessions])

  useEffect(() => {
    if (!isAuthenticated) return
    void fetch('/api/tracking/filter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: viewFilter }),
    }).catch(() => {})
  }, [viewFilter, isAuthenticated])

  useEffect(() => {
    if (!live || !live.hasData) {
      setChartSeries([])
      return
    }
    setLastUpdated(Date.now())
    const label = new Date().toLocaleTimeString()
    const ep = Array.isArray(live.engagement_proba_pct) && live.engagement_proba_pct.length === 3
      ? live.engagement_proba_pct.map((x) => Math.max(0, Math.min(100, Number(x) || 0)))
      : [0, 0, 0]
    const row = {
      time: label,
      load: typeof live.activity_load === 'number' ? live.activity_load : 0,
      engLow: ep[0],
      engMed: ep[1],
      engHigh: ep[2],
    }
    setChartSeries((prev) => {
      const last = prev[prev.length - 1]
      if (
        last &&
        last.load === row.load &&
        last.engLow === row.engLow &&
        last.engMed === row.engMed &&
        last.engHigh === row.engHigh
      ) {
        return prev
      }
      return [...prev, row].slice(-48)
    })
  }, [live])

  if (isAuthLoading || !isAuthenticated) {
    return null
  }

  const hasData = Boolean(live?.hasData)
  const filterLabel =
    viewFilter === 'activity' ? 'Activity only' : viewFilter === 'webcam' ? 'Webcam only' : 'Combined'
  const eng = engagementProbaTriple(live)

  const statsCards = [
    {
      title: 'Activity load',
      value: hasData && typeof live.activity_load === 'number' ? `${Math.round(live.activity_load)}%` : '—',
      change: hasData ? filterLabel : '—',
      color: 'indigo',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      title: 'Eng. Low %',
      value: hasData && eng ? `${Math.round(eng[0])}%` : '—',
      change: hasData ? 'Model class' : '—',
      color: 'slate',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      ),
    },
    {
      title: 'Eng. Medium %',
      value: hasData && eng ? `${Math.round(eng[1])}%` : '—',
      change: hasData ? 'Model class' : '—',
      color: 'green',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
        </svg>
      ),
    },
    {
      title: 'Eng. High %',
      value: hasData && eng ? `${Math.round(eng[2])}%` : '—',
      change: hasData ? 'Model class' : '—',
      color: 'amber',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      ),
    },
    {
      title: 'Final cognitive load',
      value: hasData && live.final_cognitive_load ? String(live.final_cognitive_load) : '—',
      change: hasData ? 'Fused estimate' : '—',
      color: 'blue',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: 'Blinks · Gaze away',
      value:
        hasData && (live.blinks != null || live.gaze_away != null)
          ? `${live.blinks ?? '—'} · ${live.gaze_away ?? '—'}`
          : '—',
      change: hasData ? 'Webcam interval' : '—',
      color: 'purple',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
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
            <Link href="/download" className="font-semibold text-indigo-700 underline hover:text-indigo-900">
              desktop app
            </Link>{' '}
            while it is running and ingesting (same account). If you close the app, numbers clear within about half a minute.{' '}
            <Link href="/tracking-setup" className="text-indigo-600 underline hover:text-indigo-900">
              Setup
            </Link>
            .
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-4">
            {statsCards.map((stat, index) => (
              <div
                key={index}
                className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md border border-gray-100 p-4 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-lg ${STATS_CARD_COLORS[stat.color] || 'bg-gray-100 text-gray-600'}`}>{stat.icon}</div>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-700">{stat.change}</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-0.5">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mb-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-600">Tracking view:</span>
              {['combined', 'activity', 'webcam'].map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setViewFilter(key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    viewFilter === key
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {key === 'combined' ? 'Combined' : key === 'activity' ? 'Activity only' : 'Webcam only'}
                </button>
              ))}
            </div>
            <CognitiveLoadCard
              hasData={hasData}
              level={live?.final_cognitive_load ?? null}
              value={hasData && typeof live.activity_load === 'number' ? live.activity_load : null}
              engagementProbaPct={hasData ? live?.engagement_proba_pct : null}
              webcamMlStatus={hasData ? live?.webcam_ml_status ?? 'active' : 'active'}
              updatedAt={lastUpdated}
            />
          </div>

          <div className="mb-4">
            <CognitiveLoadCharts loadSeries={chartSeries} dailySeries={[]} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <SessionLogsTable sessions={sessions} />
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
