/**
 * @fileoverview Reports — charts match dashboard data; PDF export for daily / weekly PKT summaries.
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import CognitiveLoadCharts from '@/components/CognitiveLoadCharts'
import ReportVisualizations from '@/components/ReportVisualizations'
import {
  downloadDailyPdf,
  downloadWeeklyPdf,
  fetchReportPayload,
} from '@/components/TrackingReportPdf'

function dominantCognitiveLabel(rows) {
  if (!Array.isArray(rows) || !rows.length) return '—'
  const c = {}
  for (const r of rows) {
    const k = r.cognitiveLoad || '—'
    c[k] = (c[k] || 0) + 1
  }
  return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
}

export default function ReportsPage() {
  const router = useRouter()
  const { isAuthenticated, user, isAuthLoading } = useAuth()
  const [chartSeries, setChartSeries] = useState([])
  const [weeklySeries, setWeeklySeries] = useState([])
  const [dailyReport, setDailyReport] = useState(null)
  const [weeklyReport, setWeeklyReport] = useState(null)
  const [pdfBusy, setPdfBusy] = useState(null)
  const [pdfError, setPdfError] = useState('')

  const loadData = useCallback(async () => {
    try {
      const [dayRes, weekRes, dailyRepRes, weekRepRes] = await Promise.all([
        fetch('/api/tracking/chart-day', { cache: 'no-store', credentials: 'same-origin' }),
        fetch('/api/tracking/weekly', { cache: 'no-store', credentials: 'same-origin' }),
        fetch('/api/tracking/report?period=daily', { cache: 'no-store', credentials: 'same-origin' }),
        fetch('/api/tracking/report?period=weekly', { cache: 'no-store', credentials: 'same-origin' }),
      ])
      const dayJson = await dayRes.json().catch(() => ({}))
      const weekJson = await weekRes.json().catch(() => ({}))
      const dailyRepJson = await dailyRepRes.json().catch(() => ({}))
      const weekRepJson = await weekRepRes.json().catch(() => ({}))
      if (dayJson?.ok && Array.isArray(dayJson.points)) setChartSeries(dayJson.points)
      if (weekJson?.ok && Array.isArray(weekJson.weekly)) setWeeklySeries(weekJson.weekly)
      if (dailyRepJson?.ok) setDailyReport(dailyRepJson)
      if (weekRepJson?.ok) setWeeklyReport(weekRepJson)
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
    void loadData()
    const id = setInterval(loadData, 11000)
    return () => clearInterval(id)
  }, [isAuthenticated, loadData])

  const onDownloadDaily = async () => {
    setPdfError('')
    setPdfBusy('daily')
    try {
      const p = await fetchReportPayload('daily')
      await downloadDailyPdf(p)
    } catch (e) {
      setPdfError(e?.message || 'Could not generate PDF')
    } finally {
      setPdfBusy(null)
    }
  }

  const onDownloadWeekly = async () => {
    setPdfError('')
    setPdfBusy('weekly')
    try {
      const p = await fetchReportPayload('weekly')
      await downloadWeeklyPdf(p)
    } catch (e) {
      setPdfError(e?.message || 'Could not generate PDF')
    } finally {
      setPdfBusy(null)
    }
  }

  if (isAuthLoading || !isAuthenticated) {
    return null
  }

  const dailyRows = dailyReport?.daily?.rows ?? []
  const summary = dailyReport?.daily?.summary
  const weeklyRows = weeklyReport?.weekly?.rows ?? []
  const weeklyWindows = weeklyRows.reduce((acc, r) => acc + (Number(r.sessions) || 0), 0)
  const dayAvg =
    typeof summary?.dailyAvgActivityPct === 'number' && !Number.isNaN(summary.dailyAvgActivityPct)
      ? `${summary.dailyAvgActivityPct}%`
      : '—'

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 lg:pl-64">
        <Header title="Reports & Analytics" subtitle={user?.fullName ? `Signed in as ${user.fullName}` : undefined} />

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="mb-6 rounded-2xl border border-indigo-100 bg-white/90 p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Export PDF (PKT)</h2>
            <p className="mt-1 text-sm text-gray-600">
              PDFs include summary text plus simple charts (activity sparkline, cognitive mix, weekly bars). Same data
              as below — daily lists every 5-minute window today; weekly summarizes the last seven PKT days.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={pdfBusy !== null}
                onClick={onDownloadDaily}
                className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-50"
              >
                {pdfBusy === 'daily' ? 'Preparing…' : 'Download daily PDF'}
              </button>
              <button
                type="button"
                disabled={pdfBusy !== null}
                onClick={onDownloadWeekly}
                className="rounded-lg border border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-800 shadow-sm hover:bg-indigo-50 disabled:opacity-50"
              >
                {pdfBusy === 'weekly' ? 'Preparing…' : 'Download weekly PDF'}
              </button>
            </div>
            {pdfError ? <p className="mt-2 text-sm text-red-600">{pdfError}</p> : null}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md border border-gray-100 p-6">
              <p className="text-sm font-medium text-gray-600 mb-2">Average activity (today, PKT)</p>
              <p className="text-3xl font-bold text-gray-900">{dayAvg}</p>
              <p className="text-xs text-gray-500 mt-2">Mean across all samples ingested today</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md border border-gray-100 p-6">
              <p className="text-sm font-medium text-gray-600 mb-2">Dominant cognitive load (today)</p>
              <p className="text-3xl font-bold text-gray-900">{dominantCognitiveLabel(dailyRows)}</p>
              <p className="text-xs text-gray-500 mt-2">Most frequent level across 5-minute windows</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md border border-gray-100 p-6">
              <p className="text-sm font-medium text-gray-600 mb-2">5-minute windows (rolling 7 PKT days)</p>
              <p className="text-3xl font-bold text-gray-900">{weeklyWindows}</p>
              <p className="text-xs text-gray-500 mt-2">Total windows with data in the weekly chart</p>
            </div>
          </div>

          <ReportVisualizations
            dailyRows={dailyRows}
            weeklyRows={weeklyRows}
            chartSeries={chartSeries}
          />

          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Detailed charts (dashboard parity)</h2>
            <CognitiveLoadCharts
              loadSeries={chartSeries}
              dailySeries={weeklySeries}
              hasWeeklyData={weeklySeries.some(
                (d) => (d.sessions ?? 0) > 0 || (typeof d.avgActivity === 'number' && d.avgActivity > 0),
              )}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
