/**
 * @fileoverview Reports page component - displays analytics and reports
 * for cognitive load monitoring.
 * @author Muhammad Moin U Din (BCSF22M023)
 * @author Muhammad Junaid Malik (BCSF22M031)
 * @author Muhammad Subhan Ul Haq (BCSF22M043)
 */

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import CognitiveLoadCharts from '@/components/CognitiveLoadCharts'
import { cognitiveLoadTimeSeries, dailyEngagementData } from '@/data/cognitiveLoadData'

const calculateAverage = (data, key) => {
  if (!data || data.length === 0) return 0
  const sum = data.reduce((acc, item) => acc + (item[key] || 0), 0)
  return Math.round(sum / data.length)
}

export default function ReportsPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/signin')
    }
  }, [isAuthenticated, router])

  if (!isAuthenticated) {
    return null
  }

  const avgLoad = calculateAverage(cognitiveLoadTimeSeries, 'load')
  const avgEngagement = calculateAverage(cognitiveLoadTimeSeries, 'engagement')
  const totalSessions = dailyEngagementData.reduce((sum, day) => sum + (day.sessions || 0), 0)

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 lg:pl-64">
        <Header title="Reports & Analytics" />

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-6">
              <p className="text-sm font-medium text-gray-600 mb-2">Average Cognitive Load</p>
              <p className="text-3xl font-bold text-gray-900">{avgLoad}%</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-6">
              <p className="text-sm font-medium text-gray-600 mb-2">Average Engagement</p>
              <p className="text-3xl font-bold text-gray-900">{avgEngagement}%</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-6">
              <p className="text-sm font-medium text-gray-600 mb-2">Total Sessions</p>
              <p className="text-3xl font-bold text-gray-900">{totalSessions}</p>
            </div>
          </div>

          <CognitiveLoadCharts />
        </main>
      </div>
    </div>
  )
}



