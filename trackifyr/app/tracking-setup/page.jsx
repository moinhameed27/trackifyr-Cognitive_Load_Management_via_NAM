'use client'

import Link from 'next/link'

export default function TrackingSetupPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border border-indigo-100 bg-white/90 p-8 shadow-lg backdrop-blur-sm sm:p-10">
          <h1 className="mb-8 text-center text-2xl font-bold text-gray-900 sm:text-3xl">
            Desktop Tracking Setup
          </h1>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a
              href="/releases/SETUP.md"
              download
              className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 sm:w-auto"
            >
              Download Setup
            </a>
            <Link
              href="/dashboard"
              className="inline-flex w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 sm:w-auto"
            >
              Go Back
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
