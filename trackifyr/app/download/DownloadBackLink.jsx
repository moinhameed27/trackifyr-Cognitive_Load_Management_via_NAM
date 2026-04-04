'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export default function DownloadBackLink() {
  const sp = useSearchParams()
  const from = sp.get('from')
  let href = '/signin'
  if (from === 'dashboard') href = '/dashboard'
  else if (from === 'tracking-setup') href = '/tracking-setup'
  else if (from === 'signin') href = '/signin'

  return (
    <Link href={href} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
      ← Back
    </Link>
  )
}
