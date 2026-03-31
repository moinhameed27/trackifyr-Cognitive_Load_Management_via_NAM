/**
 * @fileoverview Cognitive load charts — only renders series passed in (no mock data).
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

export default function CognitiveLoadCharts({ loadSeries = [], dailySeries = [] }) {
  const hasLoad = Array.isArray(loadSeries) && loadSeries.length > 0
  const hasDaily = Array.isArray(dailySeries) && dailySeries.length > 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Cognitive load (session)</h2>
            <p className="text-sm text-gray-500 mt-1">Points from live tracking while this page is open</p>
          </div>
        </div>
        {!hasLoad ? (
          <div
            className="flex items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/80 text-gray-500 text-sm px-4 text-center"
            style={{ minHeight: CHART_HEIGHT }}
          >
            No samples yet — start desktop tracking and keep the dashboard open
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
                label={{ value: 'Level (%)', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                domain={[0, 100]}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend />
              <Area
                type="monotone"
                dataKey="load"
                stroke="#6366f1"
                strokeWidth={2.5}
                fill="url(#colorLoad)"
                name="Activity load %"
                dot={{ r: 3, fill: '#6366f1' }}
              />
              <Area
                type="monotone"
                dataKey="engagement"
                stroke="#10b981"
                strokeWidth={2.5}
                fill="url(#colorEngagement)"
                name="Engagement %"
                dot={{ r: 3, fill: '#10b981' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {!hasDaily ? (
        <EmptyChart title="Weekly aggregates" subtitle="Not available from the app yet" />
      ) : (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900">Weekly engagement</h2>
            <p className="text-sm text-gray-500 mt-1">Aggregated sessions</p>
          </div>
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <BarChart data={dailySeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis
                label={{ value: 'Level (%)', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }}
                tick={{ fontSize: 11, fill: '#6b7280' }}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend />
              <Bar dataKey="engagement" fill="#6366f1" name="Engagement %" radius={[8, 8, 0, 0]} />
              <Bar dataKey="sessions" fill="#10b981" name="Sessions" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
