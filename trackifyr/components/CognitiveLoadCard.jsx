/**
 * @fileoverview Cognitive load card — activity load % + engagement tier (Major / Moderate / Minor).
 */

'use client'

import { formatPktTimeShort } from '@/lib/pktTime'

const COGNITIVE_LOAD_LEVELS = {
  Low: {
    bg: 'bg-green-50',
    border: 'border-green-500',
    badge: 'bg-green-100 text-green-800 border-green-300',
    progress: 'bg-green-500',
  },
  Medium: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-500',
    badge: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    progress: 'bg-yellow-500',
  },
  High: {
    bg: 'bg-red-50',
    border: 'border-red-500',
    badge: 'bg-red-100 text-red-800 border-red-300',
    progress: 'bg-red-500',
  },
}

const DEFAULT_CONFIG = {
  bg: 'bg-gray-50',
  border: 'border-gray-500',
  badge: 'bg-gray-100 text-gray-800 border-gray-300',
  progress: 'bg-gray-500',
}

const TIER_STYLES = {
  Minor: 'ring-2 ring-orange-400 bg-orange-50 text-orange-900',
  Moderate: 'ring-2 ring-purple-400 bg-purple-50 text-purple-900',
  Major: 'ring-2 ring-blue-500 bg-blue-50 text-blue-900',
}

const getLevelConfig = (level) => {
  if (level == null || level === '') return DEFAULT_CONFIG
  return COGNITIVE_LOAD_LEVELS[level] || DEFAULT_CONFIG
}

export default function CognitiveLoadCard({
  level,
  value,
  engagementTier = null,
  webcamMlStatus = 'active',
  hasData = false,
  updatedAt = null,
}) {
  const config = getLevelConfig(level)
  const safeValue =
    typeof value === 'number' && !Number.isNaN(value) ? Math.max(0, Math.min(100, value)) : null

  if (!hasData) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border-l-4 border-gray-300 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Current Cognitive Load</h3>
            <p className="text-sm text-gray-500 mt-0.5">From desktop tracking (no data yet)</p>
          </div>
          <span className="px-4 py-2 rounded-xl text-sm font-semibold border bg-gray-100 text-gray-600 border-gray-200">
            —
          </span>
        </div>
        <div className="space-y-5">
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-semibold text-gray-700">Activity load</span>
              <span className="text-3xl font-bold text-gray-400">—</span>
            </div>
            <div className="relative w-full bg-gray-200 rounded-full h-4 overflow-hidden">
              <div className="h-4 rounded-full bg-gray-200" style={{ width: '0%' }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-semibold text-gray-700">Engagement</span>
              <span className="text-2xl font-bold text-gray-400">—</span>
            </div>
            <div className="flex gap-2">
              {['Minor', 'Moderate', 'Major'].map((t) => (
                <span
                  key={t}
                  className="flex-1 text-center text-xs font-medium py-2 rounded-lg bg-gray-100 text-gray-400 border border-gray-200"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-5 pt-4 border-t border-gray-200 text-sm text-gray-500">Start tracking in the desktop app to see live metrics.</div>
      </div>
    )
  }

  return (
    <div className={`bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border-l-4 ${config.border} p-6`}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Current Cognitive Load</h3>
          <p className="text-sm text-gray-500 mt-0.5">Real-time monitoring</p>
        </div>
        <span className={`px-4 py-2 rounded-xl text-sm font-semibold border ${config.badge}`}>
          {level ?? '—'}
        </span>
      </div>

      <div className="space-y-5">
        <div>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold text-gray-700">Activity load</span>
            <span className="text-3xl font-bold text-gray-900">{safeValue != null ? `${Math.round(safeValue)}%` : '—'}</span>
          </div>
          <div className="relative w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div
              className={`h-4 rounded-full ${config.progress} transition-all duration-1000`}
              style={{ width: `${safeValue ?? 0}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-gray-700">Engagement</span>
            <div className="flex items-center gap-2">
              {webcamMlStatus === 'off' ? (
                <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  Webcam ML off
                </span>
              ) : null}
              {webcamMlStatus === 'waiting' ? (
                <span className="text-xs font-medium text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                  Starting webcam ML…
                </span>
              ) : null}
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-3">Derived from the webcam ensemble (Low / Medium / High mapped to Minor / Moderate / Major).</p>
          <div className="grid grid-cols-3 gap-2">
            {['Minor', 'Moderate', 'Major'].map((t) => (
              <div
                key={t}
                className={`text-center text-sm font-semibold py-2.5 rounded-lg border transition-colors ${
                  engagementTier === t
                    ? TIER_STYLES[t] || 'bg-indigo-100 text-indigo-900 border-indigo-300'
                    : 'bg-gray-50 text-gray-400 border-gray-200'
                }`}
              >
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Last updated (PKT):{' '}
            {updatedAt ? formatPktTimeShort(new Date(updatedAt)) : formatPktTimeShort(new Date())}
          </span>
        </div>
        <div className="flex items-center space-x-1 text-xs text-green-600 font-medium">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
          <span>Live</span>
        </div>
      </div>
    </div>
  )
}
