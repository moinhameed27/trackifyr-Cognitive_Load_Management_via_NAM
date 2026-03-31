/**
 * @fileoverview Feedback panel — renders messages from props only (empty by default).
 */

'use client'

const FEEDBACK_CONFIGS = {
  warning: {
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
    ),
    bg: 'bg-yellow-50',
    border: 'border-yellow-400',
    text: 'text-yellow-800',
    iconBg: 'bg-yellow-100',
  },
  info: {
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clipRule="evenodd"
        />
      </svg>
    ),
    bg: 'bg-blue-50',
    border: 'border-blue-400',
    text: 'text-blue-800',
    iconBg: 'bg-blue-100',
  },
  success: {
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
    ),
    bg: 'bg-green-50',
    border: 'border-green-400',
    text: 'text-green-800',
    iconBg: 'bg-green-100',
  },
}

const DEFAULT_FEEDBACK_CONFIG = {
  icon: null,
  bg: 'bg-gray-50',
  border: 'border-gray-400',
  text: 'text-gray-800',
  iconBg: 'bg-gray-100',
}

const getFeedbackConfig = (type) => {
  return FEEDBACK_CONFIGS[type] || DEFAULT_FEEDBACK_CONFIG
}

export default function FeedbackPanel({ messages = [] }) {
  const list = Array.isArray(messages) ? messages : []

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Feedback</h2>
          <p className="text-sm text-gray-500 mt-1">From your monitoring pipeline when available</p>
        </div>
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
          No feedback yet
        </p>
      ) : (
        <div className="space-y-4">
          {list.map((feedback) => {
            const config = getFeedbackConfig(feedback.type)
            return (
              <div
                key={feedback.id}
                className={`p-4 rounded-xl border-l-4 ${config.border} ${config.bg} hover:shadow-md transition-all duration-200`}
              >
                <div className="flex items-start space-x-3">
                  <div className={`p-2 rounded-lg ${config.iconBg} ${config.text} flex-shrink-0`}>{config.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${config.text} mb-1`}>{feedback.message}</p>
                    {feedback.timestamp ? (
                      <div className="flex items-center space-x-1 text-xs text-gray-500 mt-2">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{new Date(feedback.timestamp).toLocaleString()}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
