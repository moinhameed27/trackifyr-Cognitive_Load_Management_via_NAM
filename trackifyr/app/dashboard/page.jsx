// codacy test trigger


/**
 * @fileoverview Dashboard page component - displays cognitive load monitoring
 * dashboard with statistics, charts, session logs, and feedback.
 * @author Muhammad Moin U Din (BCSF22M023)
 * @author Muhammad Junaid Malik (BCSF22M031)
 * @author Muhammad Subhan Ul Haq (BCSF22M043)
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import CognitiveLoadCard from '@/components/CognitiveLoadCard'
import CognitiveLoadCharts from '@/components/CognitiveLoadCharts'
import SessionLogsTable from '@/components/SessionLogsTable'
import FeedbackPanel from '@/components/FeedbackPanel'
import { currentCognitiveLoad, cognitiveLoadTimeSeries, sessionLogs } from '@/data/cognitiveLoadData'

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
  const [viewFilter, setViewFilter] = useState('combined')

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

  if (isAuthLoading || !isAuthenticated) {
    return null
  }

  const calculateAverage = (data, key) => {
    if (!data || data.length === 0) return 0
    const sum = data.reduce((acc, item) => acc + (item[key] || 0), 0)
    return Math.round(sum / data.length)
  }

  const avgLoad = calculateAverage(cognitiveLoadTimeSeries, 'load')
  const avgEngagement = calculateAverage(cognitiveLoadTimeSeries, 'engagement')
  const totalSessions = sessionLogs.length
  const todaySessions = sessionLogs.filter(s => 
    new Date(s.time).toDateString() === new Date().toDateString()
  ).length

  const liveActivityPct = live != null && typeof live.activity_load === 'number' ? Math.round(live.activity_load) : null
  const liveEngagementPct = live != null && live.engagement ? labelToPercent(live.engagement) : null
  const liveLoadLevel = live != null && live.final_cognitive_load ? live.final_cognitive_load : currentCognitiveLoad.level

  const statsCards = [
    {
      title: 'Average Load',
      value: `${avgLoad}%`,
      change: '+2.5%',
      trend: 'up',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      color: 'indigo',
    },
    {
      title: 'Avg Engagement',
      value: `${avgEngagement}%`,
      change: '+5.2%',
      trend: 'up',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      color: 'green',
    },
    {
      title: 'Total Sessions',
      value: totalSessions.toString(),
      change: `+${todaySessions} today`,
      trend: 'neutral',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'blue',
    },
    {
      title: 'Active Monitoring',
      value: 'Live',
      change: 'Real-time',
      trend: 'up',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
        </svg>
      ),
      color: 'purple',
    },
  ]

  if (liveActivityPct != null) {
    statsCards[0] = {
      ...statsCards[0],
      title: 'Activity load',
      value: `${liveActivityPct}%`,
      change: viewFilter === 'activity' ? 'Activity only' : viewFilter === 'webcam' ? 'Webcam only' : 'Live',
      trend: 'up',
    }
  }
  if (liveEngagementPct != null) {
    statsCards[1] = {
      ...statsCards[1],
      title: 'Engagement',
      value: `${liveEngagementPct}%`,
      change: live?.engagement || 'Live',
      trend: 'up',
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 lg:pl-64">
        <Header 
          title="Dashboard" 
          subtitle={`Welcome back, ${user?.fullName?.split(' ')[0] || 'User'}! 👋`}
        />

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Quick Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {statsCards.map((stat, index) => (
              <div
                key={index}
                className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md border border-gray-100 p-4 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-lg ${STATS_CARD_COLORS[stat.color] || 'bg-gray-100 text-gray-600'}`}>
                    {stat.icon}
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    stat.trend === 'up' ? 'bg-green-100 text-green-700' :
                    stat.trend === 'down' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
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

          {/* Cognitive Load Status Card */}
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
            {live != null && (
              <p className="text-sm text-gray-600">
                Blinks: <span className="font-semibold text-gray-900">{live.blinks ?? 0}</span>
                {' · '}
                Gaze away (frames): <span className="font-semibold text-gray-900">{live.gaze_away ?? 0}</span>
              </p>
            )}
            <CognitiveLoadCard
              level={liveLoadLevel}
              value={live != null && typeof live.activity_load === 'number' ? live.activity_load : currentCognitiveLoad.value}
              engagement={live != null && live.engagement ? labelToPercent(live.engagement) : currentCognitiveLoad.engagement}
            />
          </div>

          {/* Charts Section */}
          <div className="mb-4">
            <CognitiveLoadCharts />
          </div>

          {/* Table and Feedback Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <SessionLogsTable />
            </div>
            <div>
              <FeedbackPanel />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

