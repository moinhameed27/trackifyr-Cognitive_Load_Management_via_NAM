/**
 * @fileoverview Session logs — 5-minute bucket rows with pagination (10 per page).
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

/** Up to 9 page buttons around the current page when there are many pages */
function visiblePageNumbers(current, total) {
  if (total <= 9) return Array.from({ length: total }, (_, i) => i + 1)
  const w = 7
  let start = Math.max(1, current - 3)
  let end = Math.min(total, start + w - 1)
  if (end - start < w - 1) start = Math.max(1, end - w + 1)
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

export default function SessionLogsTable({
  sessions = [],
  page = 1,
  totalPages = 1,
  total = 0,
  pageSize = 10,
  onPageChange,
}) {
  const rows = Array.isArray(sessions) ? sessions : []
  const safeTotalPages = Math.max(1, totalPages)
  const safePage = Math.min(Math.max(1, page), safeTotalPages)
  const pageButtons = visiblePageNumbers(safePage, safeTotalPages)

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Session logs</h2>
            <p className="text-sm text-gray-500 mt-1">
              One row per 5-minute window (PKT-aligned). Values are averages of all samples ingested in that window only.
            </p>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              {total} window{total === 1 ? '' : 's'} total · page {safePage} of {safeTotalPages}
            </span>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        {rows.length === 0 ? (
          <div className="px-6 py-16 text-center text-gray-500 text-sm">No session logs yet — run the desktop app and ingest for a few minutes</div>
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
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Engagement
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Duration</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rows.map((session) => (
                <tr key={session.id} className="hover:bg-indigo-50/50 transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      {total > 0 && typeof onPageChange === 'function' && safeTotalPages > 1 ? (
        <div className="px-6 py-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 bg-gray-50/50">
          <p className="text-xs text-gray-500">
            Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, total)} of {total}
          </p>
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => onPageChange(safePage - 1)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            {pageButtons[0] > 1 ? (
              <span className="px-1 text-gray-400 text-sm" aria-hidden>
                …
              </span>
            ) : null}
            {pageButtons.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`min-w-[2.25rem] px-2 py-1.5 text-sm rounded-lg border ${
                  p === safePage
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                }`}
              >
                {p}
              </button>
            ))}
            {pageButtons[pageButtons.length - 1] < safeTotalPages ? (
              <span className="px-1 text-gray-400 text-sm" aria-hidden>
                …
              </span>
            ) : null}
            <button
              type="button"
              disabled={safePage >= safeTotalPages}
              onClick={() => onPageChange(safePage + 1)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
