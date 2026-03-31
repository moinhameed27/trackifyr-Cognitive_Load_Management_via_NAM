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

function labelToPercent(label) {
  if (label === 'High') return 85
  if (label === 'Medium') return 55
  return 30
}

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
  const [viewFilter, setViewFilter] = useState('combined')
  const [trackingBusy, setTrackingBusy] = useState(false)
  const [trackingNote, setTrackingNote] = useState('')
  const [webcamForTracking, setWebcamForTracking] = useState(false)

  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch('/api/tracking/live', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setLive(data)
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
    const id = setInterval(fetchLive, 2500)
    return () => clearInterval(id)
  }, [isAuthenticated, fetchLive])

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
    setChartSeries((prev) => {
      const row = {
        time: label,
        load: typeof live.activity_load === 'number' ? live.activity_load : 0,
        engagement: live.engagement ? labelToPercent(live.engagement) : 0,
      }
      return [...prev, row].slice(-48)
    })
  }, [live])

  const startRemoteTracking = useCallback(async () => {
    setTrackingBusy(true)
    setTrackingNote('')
    try {
      const res = await fetch('/api/tracking/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webcam: webcamForTracking }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setTrackingNote(
          data.error === 'electron_bridge_unavailable'
            ? 'Desktop bridge unavailable. Open the Trackifyr desktop app on this PC and use Start under Local tracking, or see Tracking setup.'
            : 'Could not start tracking from the server.',
        )
      } else {
        setTrackingNote('Start sent. If numbers stay empty, start tracking in the desktop app (it owns the Python processes).')
      }
    } catch {
      setTrackingNote('Network error talking to /api/tracking/start.')
    } finally {
      setTrackingBusy(false)
    }
  }, [webcamForTracking])

  const stopRemoteTracking = useCallback(async () => {
    setTrackingBusy(true)
    setTrackingNote('')
    try {
      const res = await fetch('/api/tracking/stop', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setTrackingNote(
          data.error === 'electron_bridge_unavailable'
            ? 'Stop failed — desktop app may not be running.'
            : 'Could not stop tracking.',
        )
      } else {
        setTrackingNote('Stop sent to the desktop bridge.')
      }
    } catch {
      setTrackingNote('Network error talking to /api/tracking/stop.')
    } finally {
      setTrackingBusy(false)
    }
  }, [])

  if (isAuthLoading || !isAuthenticated) {
    return null
  }

  const hasData = Boolean(live?.hasData)
  const filterLabel =
    viewFilter === 'activity' ? 'Activity only' : viewFilter === 'webcam' ? 'Webcam only' : 'Combined'

  const statsCards = [
    {
      title: 'Activity load',
      value: hasData && typeof live.activity_load === 'number' ? `${Math.round(live.activity_load)}%` : '—',
      change: hasData ? filterLabel : '—',
      trend: 'neutral',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      color: 'indigo',
    },
    {
      title: 'Engagement',
      value:
        hasData && live.engagement ? `${labelToPercent(live.engagement)}%` : '—',
      change: hasData && live.engagement ? String(live.engagement) : '—',
      trend: 'neutral',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      color: 'green',
    },
    {
      title: 'Final cognitive load',
      value: hasData && live.final_cognitive_load ? String(live.final_cognitive_load) : '—',
      change: hasData ? 'Fused estimate' : '—',
      trend: 'neutral',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'blue',
    },
    {
      title: 'Blinks · Gaze away',
      value:
        hasData && (live.blinks != null || live.gaze_away != null)
          ? `${live.blinks ?? '—'} · ${live.gaze_away ?? '—'}`
          : '—',
      change: hasData ? 'Webcam interval (desktop)' : '—',
      trend: 'neutral',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
      color: 'purple',
    },
  ]

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 lg:pl-64">
        <Header title="Dashboard" subtitle={`Welcome back, ${user?.fullName?.split(' ')[0] || 'User'}! 👋`} />

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-950">
            <p className="font-medium text-indigo-900">Live cognitive load</p>
            <p className="mt-1 text-indigo-800/90">
              Data is produced by the <strong>desktop app</strong> (Python activity + optional webcam ML) and shown here.{' '}
              <Link href="/tracking-setup" className="underline font-semibold hover:text-indigo-950">
                Setup guide
              </Link>
              {' · '}
              <Link href="/download" className="underline font-semibold hover:text-indigo-950">
                Download desktop
              </Link>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={trackingBusy}
                onClick={() => void startRemoteTracking()}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                {trackingBusy ? 'Working…' : 'Request start (bridge)'}
              </button>
              <button
                type="button"
                disabled={trackingBusy}
                onClick={() => void stopRemoteTracking()}
                className="px-3 py-1.5 rounded-lg bg-white border border-indigo-200 text-indigo-900 text-xs font-semibold hover:bg-indigo-100/50 disabled:opacity-50"
              >
                Request stop (bridge)
              </button>
              <label className="flex items-center gap-2 text-xs text-indigo-900 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={webcamForTracking}
                  onChange={(e) => setWebcamForTracking(e.target.checked)}
                  className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                />
                Webcam ML in start request
              </label>
            </div>
            {trackingNote ? <p className="mt-2 text-xs text-indigo-900/90">{trackingNote}</p> : null}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
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
              engagement={hasData && live.engagement ? labelToPercent(live.engagement) : null}
              updatedAt={lastUpdated}
            />
          </div>

          <div className="mb-4">
            <CognitiveLoadCharts loadSeries={chartSeries} dailySeries={[]} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <SessionLogsTable sessions={[]} />
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
