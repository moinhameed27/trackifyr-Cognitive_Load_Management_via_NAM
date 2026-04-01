/**
 * @fileoverview Cognitive load card — activity load + three engagement % bars from model distribution.
 */

'use client'

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

const getLevelConfig = (level) => {
  if (level == null || level === '') return DEFAULT_CONFIG
  return COGNITIVE_LOAD_LEVELS[level] || DEFAULT_CONFIG
}

export default function CognitiveLoadCard({
  level,
  value,
  engagementProbaPct,
  webcamMlStatus = 'active',
  hasData = false,
  updatedAt = null,
}) {
  const config = getLevelConfig(level)
  const safeValue =
    typeof value === 'number' && !Number.isNaN(value) ? Math.max(0, Math.min(100, value)) : null

  const p = Array.isArray(engagementProbaPct) && engagementProbaPct.length === 3 ? engagementProbaPct : null
  const pL = p ? Math.max(0, Math.min(100, Number(p[0]) || 0)) : null
  const pM = p ? Math.max(0, Math.min(100, Number(p[1]) || 0)) : null
  const pH = p ? Math.max(0, Math.min(100, Number(p[2]) || 0)) : null

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
          <p className="text-sm text-gray-500">Engagement model (3× %) appears when the desktop app is running with webcam ML on.</p>
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
            <span className="text-sm font-semibold text-gray-700">Engagement (model class %)</span>
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
          <p className="text-xs text-gray-500 mb-3">
            {webcamMlStatus === 'waiting'
              ? 'Bars use activity until the first v1+v2+v3 JSON arrives (~10s). Then they follow model probabilities.'
              : 'Low / Medium / High from fused v1+v2+v3 probabilities when the model stream is active.'}
          </p>
          {p ? (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                  <span>Low</span>
                  <span>{Math.round(pL)}%</span>
                </div>
                <div className="relative w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                  <div className="h-2.5 rounded-full bg-slate-500 transition-all" style={{ width: `${pL}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-medium text-emerald-700 mb-1">
                  <span>Medium</span>
                  <span>{Math.round(pM)}%</span>
                </div>
                <div className="relative w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                  <div className="h-2.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${pM}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-medium text-amber-800 mb-1">
                  <span>High</span>
                  <span>{Math.round(pH)}%</span>
                </div>
                <div className="relative w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                  <div className="h-2.5 rounded-full bg-amber-500 transition-all" style={{ width: `${pH}%` }} />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">—</p>
          )}
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Last updated: {updatedAt ? new Date(updatedAt).toLocaleTimeString() : new Date().toLocaleTimeString()}</span>
        </div>
        <div className="flex items-center space-x-1 text-xs text-green-600 font-medium">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
          <span>Live</span>
        </div>
      </div>
    </div>
  )
}
