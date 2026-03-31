'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function TrackingSetupPage() {
  const [text, setText] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/releases/SETUP.md', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.text()
      })
      .then((t) => {
        if (!cancelled) setText(t)
      })
      .catch((e) => {
        if (!cancelled) setErr(e.message || 'Could not load instructions.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Desktop tracking setup</h1>
          <div className="flex gap-3 text-sm">
            <a
              href="/releases/SETUP.md"
              download
              className="font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Download SETUP.md
            </a>
            <Link href="/download" className="font-semibold text-indigo-600 hover:text-indigo-700">
              Desktop installer
            </Link>
            <Link href="/dashboard" className="font-semibold text-indigo-600 hover:text-indigo-700">
              Dashboard
            </Link>
          </div>
        </div>
        <div className="bg-white/90 rounded-2xl border border-gray-100 shadow-sm p-6">
          {err ? (
            <p className="text-red-600 text-sm">{err}</p>
          ) : !text ? (
            <p className="text-gray-500 text-sm">Loading…</p>
          ) : (
            <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">{text}</pre>
          )}
        </div>
      </div>
    </div>
  )
}
