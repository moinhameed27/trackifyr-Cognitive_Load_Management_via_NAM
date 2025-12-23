'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import CognitiveLoadCard from '@/components/CognitiveLoadCard'
import CognitiveLoadCharts from '@/components/CognitiveLoadCharts'
import SessionLogsTable from '@/components/SessionLogsTable'
import FeedbackPanel from '@/components/FeedbackPanel'
import { currentCognitiveLoad, cognitiveLoadTimeSeries, dailyEngagementData, sessionLogs } from '@/data/cognitiveLoadData'

export default function DashboardPage() {
  const router = useRouter()
  const { isAuthenticated, user } = useAuth()

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/signin')
    }
  }, [isAuthenticated, router])


  if (!isAuthenticated) {
    return null
  }

  // Calculate statistics
  const avgLoad = Math.round(
    cognitiveLoadTimeSeries.reduce((sum, item) => sum + item.load, 0) /
      cognitiveLoadTimeSeries.length
  )
  const avgEngagement = Math.round(
    cognitiveLoadTimeSeries.reduce((sum, item) => sum + item.engagement, 0) /
      cognitiveLoadTimeSeries.length
  )
  const totalSessions = sessionLogs.length
  const todaySessions = sessionLogs.filter(s => 
    new Date(s.time).toDateString() === new Date().toDateString()
  ).length

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

  const colorClasses = {
    indigo: 'bg-indigo-100 text-indigo-600',
    green: 'bg-green-100 text-green-600',
    blue: 'bg-blue-100 text-blue-600',
    purple: 'bg-purple-100 text-purple-600',
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
                  <div className={`p-2 rounded-lg ${colorClasses[stat.color] || 'bg-gray-100 text-gray-600'}`}>
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
          <div className="mb-4">
            <CognitiveLoadCard
              level={currentCognitiveLoad.level}
              value={currentCognitiveLoad.value}
              engagement={currentCognitiveLoad.engagement}
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

