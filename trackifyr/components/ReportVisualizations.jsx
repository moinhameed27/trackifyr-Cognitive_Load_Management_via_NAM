/**
 * @fileoverview Extra charts for Reports — cognitive mix, per-window activity, weekly activity trend.
 */

'use client'

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const COG_COLORS = { High: '#dc2626', Medium: '#ca8a04', Low: '#16a34a', '—': '#9ca3af' }
const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(255, 255, 255, 0.96)',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
}

function parseActivityPct(s) {
  if (s == null) return null
  const n = Number(String(s).replace(/%/g, '').trim())
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null
}

function shortTimeLabel(timeWindow) {
  if (!timeWindow || typeof timeWindow !== 'string') return ''
  const part = timeWindow.split('–')[0]?.trim() || timeWindow
  return part.length > 14 ? `${part.slice(0, 12)}…` : part
}

export default function ReportVisualizations({ dailyRows = [], weeklyRows = [], chartSeries = [] }) {
  const cognitiveCounts = { High: 0, Medium: 0, Low: 0 }
  for (const r of dailyRows) {
    const k = String(r.cognitiveLoad || '').trim()
    if (k === 'High' || k === 'Medium' || k === 'Low') cognitiveCounts[k] += 1
  }
  const pieData = Object.entries(cognitiveCounts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }))

  const activityBars = dailyRows
    .map((r, i) => ({
      slot: shortTimeLabel(r.time) || `Slot ${i + 1}`,
      activity: parseActivityPct(r.avgActivity),
    }))
    .filter((x) => x.activity != null)
    .slice(0, 48)

  const activityTrend = Array.isArray(chartSeries)
    ? chartSeries.map((p, i) => ({
        t: p.time || `${i + 1}`,
        load: typeof p.load === 'number' ? p.load : null,
      }))
    : []

  const weeklyTrend = Array.isArray(weeklyRows)
    ? weeklyRows.map((r) => ({
        day: r.day || '—',
        avgActivity: typeof r.avgActivity === 'number' ? r.avgActivity : 0,
        windows: typeof r.sessions === 'number' ? r.sessions : 0,
      }))
    : []

  const hasPie = pieData.length > 0
  const hasActivityBars = activityBars.length > 0
  const hasTrend = activityTrend.some((p) => p.load != null)
  const hasWeekly = weeklyTrend.some((r) => r.avgActivity > 0 || r.windows > 0)

  if (!hasPie && !hasActivityBars && !hasTrend && !hasWeekly) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 p-8 text-center text-sm text-gray-500 mb-6">
        No chart data yet — ingest tracking from the desktop app to see distributions and trends.
      </div>
    )
  }

  return (
    <div className="space-y-6 mb-8">
      <h2 className="text-lg font-semibold text-gray-900">Visual analytics</h2>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {hasPie ? (
          <div className="bg-white/90 rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-1">Cognitive load mix (today, PKT)</h3>
            <p className="text-xs text-gray-500 mb-4">Share of 5-minute windows by dominant level</p>
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={COG_COLORS[entry.name] || '#6366f1'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}

        {hasActivityBars ? (
          <div className="bg-white/90 rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-1">Avg activity by window (today)</h3>
            <p className="text-xs text-gray-500 mb-4">Each bar is one 5-minute bucket (PKT)</p>
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityBars} margin={{ top: 8, right: 8, left: 0, bottom: 64 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="slot" angle={-45} textAnchor="end" height={70} tick={{ fontSize: 9, fill: '#6b7280' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} label={{ value: '%', angle: 0, position: 'insideTop', fill: '#6b7280' }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="activity" fill="#6366f1" name="Avg activity %" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}

        {hasTrend ? (
          <div className="bg-white/90 rounded-2xl border border-gray-100 shadow-sm p-5 xl:col-span-2">
            <h3 className="text-sm font-semibold text-gray-800 mb-1">Activity load over the PKT day</h3>
            <p className="text-xs text-gray-500 mb-4">Line follows stored 5-minute buckets (same series as dashboard)</p>
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activityTrend} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="t" angle={-35} textAnchor="end" height={60} tick={{ fontSize: 10, fill: '#6b7280' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend />
                  <Line type="monotone" dataKey="load" stroke="#6366f1" strokeWidth={2} dot={{ r: 2 }} name="Activity %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}

        {hasWeekly ? (
          <div className="bg-white/90 rounded-2xl border border-gray-100 shadow-sm p-5 xl:col-span-2">
            <h3 className="text-sm font-semibold text-gray-800 mb-1">7-day trend (PKT)</h3>
            <p className="text-xs text-gray-500 mb-4">Average activity % (line) and 5-minute windows with data (bars)</p>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={weeklyTrend} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis yAxisId="act" orientation="left" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="win" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend />
                  <Bar yAxisId="win" dataKey="windows" fill="#10b981" name="5-min windows" radius={[6, 6, 0, 0]} />
                  <Line
                    yAxisId="act"
                    type="monotone"
                    dataKey="avgActivity"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                    name="Avg activity %"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
