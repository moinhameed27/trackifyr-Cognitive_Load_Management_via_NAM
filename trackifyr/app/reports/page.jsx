/**
 * @fileoverview Reports — no mock data; charts empty until session analytics exist.
 */

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import CognitiveLoadCharts from '@/components/CognitiveLoadCharts'

export default function ReportsPage() {
  const router = useRouter()
  const { isAuthenticated, isAuthLoading } = useAuth()

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.push('/signin')
    }
  }, [isAuthLoading, isAuthenticated, router])

  if (isAuthLoading || !isAuthenticated) {
    return null
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 lg:pl-64">
        <Header title="Reports & Analytics" />

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md border border-gray-100 p-6">
              <p className="text-sm font-medium text-gray-600 mb-2">Average cognitive load</p>
              <p className="text-3xl font-bold text-gray-400">—</p>
              <p className="text-xs text-gray-500 mt-2">No aggregated reports yet</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md border border-gray-100 p-6">
              <p className="text-sm font-medium text-gray-600 mb-2">Average engagement</p>
              <p className="text-3xl font-bold text-gray-400">—</p>
              <p className="text-xs text-gray-500 mt-2">No aggregated reports yet</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md border border-gray-100 p-6">
              <p className="text-sm font-medium text-gray-600 mb-2">Total sessions</p>
              <p className="text-3xl font-bold text-gray-400">—</p>
              <p className="text-xs text-gray-500 mt-2">No aggregated reports yet</p>
            </div>
          </div>

          <CognitiveLoadCharts loadSeries={[]} dailySeries={[]} />
        </main>
      </div>
    </div>
  )
}
