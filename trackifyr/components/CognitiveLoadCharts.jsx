/**
 * @fileoverview Cognitive load charts — activity % and engagement tier (today PKT + weekly rollups).
 */

'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from 'recharts'

const CHART_HEIGHT = 300
const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
}

function tierIndexToLabel(v) {
  if (v === 1) return 'Minor'
  if (v === 2) return 'Moderate'
  if (v === 3) return 'Major'
  return '—'
}

function EmptyChart({ title, subtitle }) {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
      </div>
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/80 text-gray-500 text-sm px-4 text-center"
        style={{ minHeight: CHART_HEIGHT }}
      >
        No data yet
      </div>
    </div>
  )
}

export default function CognitiveLoadCharts({
  loadSeries = [],
  dailySeries = [],
  hasWeeklyData: hasWeeklyDataProp,
}) {
  const hasLoad = Array.isArray(loadSeries) && loadSeries.length > 0
  const hasDaily =
    typeof hasWeeklyDataProp === 'boolean'
      ? hasWeeklyDataProp
      : Array.isArray(dailySeries) &&
        dailySeries.length > 0 &&
        dailySeries.some((d) => (d.sessions ?? 0) > 0 || (d.engagement ?? 0) > 0)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Cognitive load (today)</h2>
            <p className="text-sm text-gray-500 mt-1">
              Activity load (%) and engagement tier (Minor → Major) from stored 5-minute buckets for the current PKT day
            </p>
          </div>
        </div>
        {!hasLoad ? (
          <div
            className="flex items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/80 text-gray-500 text-sm px-4 text-center"
            style={{ minHeight: CHART_HEIGHT }}
          >
            No 5-minute data for today (PKT) yet — run the desktop app to record activity; past buckets stay visible after you close it
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <AreaChart data={loadSeries}>
              <defs>
                <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="time" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis
                yAxisId="left"
                label={{ value: 'Activity %', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                domain={[0, 100]}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                label={{ value: 'Engagement tier', angle: 90, position: 'insideRight', style: { fill: '#6b7280' } }}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                domain={[0.5, 3.5]}
                ticks={[1, 2, 3]}
                tickFormatter={(x) => tierIndexToLabel(x)}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value, name) => {
                  if (name === 'Engagement tier') return [tierIndexToLabel(value), 'Engagement']
                  return [value, name]
                }}
              />
              <Legend />
              <Area
                yAxisId="left"
                type="stepAfter"
                dataKey="load"
                stroke="#6366f1"
                strokeWidth={2.5}
                fill="url(#colorLoad)"
                name="Activity load %"
                dot={{ r: 3, fill: '#6366f1' }}
              />
              <Area
                yAxisId="right"
                type="stepAfter"
                dataKey="engagementTier"
                stroke="#10b981"
                strokeWidth={2.5}
                fill="url(#colorEngagement)"
                name="Engagement tier"
                dot={{ r: 3, fill: '#10b981' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {!hasDaily ? (
        <EmptyChart
          title="Weekly aggregates"
          subtitle="Ingest tracking for a few minutes — 5-minute buckets roll up into the last 7 PKT days here"
        />
      ) : (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900">Weekly aggregates</h2>
            <p className="text-sm text-gray-500 mt-1">
              Rolling 7 days (PKT calendar days): average engagement score and number of 5-minute windows with data —
              updates while you ingest
            </p>
          </div>
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <BarChart data={dailySeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis
                yAxisId="eng"
                label={{ value: 'Avg engagement (0–100)', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                domain={[0, 100]}
              />
              <YAxis
                yAxisId="win"
                orientation="right"
                label={{ value: '5-min windows', angle: 90, position: 'insideRight', style: { fill: '#6b7280' } }}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                allowDecimals={false}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend />
              <Bar
                yAxisId="eng"
                dataKey="engagement"
                fill="#6366f1"
                name="Avg engagement"
                radius={[8, 8, 0, 0]}
              />
              <Bar
                yAxisId="win"
                dataKey="sessions"
                fill="#10b981"
                name="5-min windows"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
