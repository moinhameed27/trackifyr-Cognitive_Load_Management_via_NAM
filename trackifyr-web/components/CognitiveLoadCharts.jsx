/**
 * @fileoverview CognitiveLoadCharts component - displays cognitive load and engagement
 * data using area and bar charts.
 * @author Muhammad Moin U Din (BCSF22M023)
 * @author Muhammad Junaid Malik (BCSF22M031)
 * @author Muhammad Subhan Ul Haq (BCSF22M043)
 */

'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { cognitiveLoadTimeSeries, dailyEngagementData } from '@/data/cognitiveLoadData'

const CHART_HEIGHT = 300
const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
}

export default function CognitiveLoadCharts() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Line Chart - Cognitive Load Over Time */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Cognitive Load Over Time</h2>
            <p className="text-sm text-gray-500 mt-1">7-day trend analysis</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <AreaChart data={cognitiveLoadTimeSeries}>
            <defs>
              <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="time" 
              angle={-45}
              textAnchor="end"
              height={80}
              tick={{ fontSize: 11, fill: '#6b7280' }}
            />
            <YAxis 
              label={{ value: 'Level (%)', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }}
              tick={{ fontSize: 11, fill: '#6b7280' }}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="load" 
              stroke="#6366f1" 
              strokeWidth={2.5}
              fill="url(#colorLoad)"
              name="Cognitive Load"
              dot={{ r: 4, fill: '#6366f1' }}
            />
            <Area 
              type="monotone" 
              dataKey="engagement" 
              stroke="#10b981" 
              strokeWidth={2.5}
              fill="url(#colorEngagement)"
              name="Engagement"
              dot={{ r: 4, fill: '#10b981' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bar Chart - Daily Engagement */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Daily Engagement Analysis</h2>
            <p className="text-sm text-gray-500 mt-1">Weekly performance overview</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <BarChart data={dailyEngagementData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="day" 
              tick={{ fontSize: 11, fill: '#6b7280' }}
            />
            <YAxis 
              label={{ value: 'Level (%)', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }}
              tick={{ fontSize: 11, fill: '#6b7280' }}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend />
            <Bar 
              dataKey="engagement" 
              fill="#6366f1" 
              name="Engagement %"
              radius={[8, 8, 0, 0]}
            />
            <Bar 
              dataKey="sessions" 
              fill="#10b981" 
              name="Sessions"
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}



