/**
 * @fileoverview Session logs table — displays rows from props (empty until backend provides sessions).
 */

'use client'

const LOAD_BADGE_COLORS = {
  Low: 'bg-green-100 text-green-800 border-green-200',
  Medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  High: 'bg-red-100 text-red-800 border-red-200',
}

const ENGAGEMENT_BADGE_COLORS = {
  High: 'bg-blue-100 text-blue-800 border-blue-200',
  Medium: 'bg-purple-100 text-purple-800 border-purple-200',
  Low: 'bg-orange-100 text-orange-800 border-orange-200',
}

const DEFAULT_BADGE_COLOR = 'bg-gray-100 text-gray-800 border-gray-200'

const getLoadBadgeColor = (level) => {
  return LOAD_BADGE_COLORS[level] || DEFAULT_BADGE_COLOR
}

const getEngagementBadgeColor = (level) => {
  return ENGAGEMENT_BADGE_COLORS[level] || DEFAULT_BADGE_COLOR
}

export default function SessionLogsTable({ sessions = [] }) {
  const rows = Array.isArray(sessions) ? sessions : []

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Session logs</h2>
            <p className="text-sm text-gray-500 mt-1">Aggregated every 5 minutes from desktop tracking (same account)</p>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{rows.length} session{rows.length === 1 ? '' : 's'}</span>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        {rows.length === 0 ? (
          <div className="px-6 py-16 text-center text-gray-500 text-sm">No session logs yet</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Time (5 min)</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Avg activity
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Cognitive load
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Engagement</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Duration</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rows.map((session) => (
                <tr key={session.id} className="hover:bg-indigo-50/50 transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-900">{session.time}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-semibold text-gray-800">{session.avgActivity ?? '—'}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-3 py-1.5 inline-flex text-xs leading-5 font-semibold rounded-lg border ${getLoadBadgeColor(session.cognitiveLoad)}`}
                    >
                      {session.cognitiveLoad}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-3 py-1.5 inline-flex text-xs leading-5 font-semibold rounded-lg border ${getEngagementBadgeColor(session.engagement)}`}
                    >
                      {session.engagement}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-700">{session.duration}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
