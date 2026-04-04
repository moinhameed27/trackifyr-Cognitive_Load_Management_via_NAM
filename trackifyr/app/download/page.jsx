import fs from 'fs'
import path from 'path'
import Link from 'next/link'
import { Suspense } from 'react'
import DownloadBackLink from './DownloadBackLink'

export const metadata = {
  title: 'Download · trackifyr',
  description: 'Download the Windows desktop app for sessions, optional camera, and local cognitive-load tracking.',
}

/**
 * When no env var and no file in `public/releases/`, use latest GitHub Release asset (stable name from Desktop release CI).
 * Override for forks: NEXT_PUBLIC_DESKTOP_GITHUB_EXE
 * Disable: NEXT_PUBLIC_DESKTOP_DOWNLOAD_DISABLE_GITHUB=1
 */
const DEFAULT_GITHUB_LATEST_EXE =
  process.env.NEXT_PUBLIC_DESKTOP_GITHUB_EXE?.trim() ||
  'https://github.com/Subhanulhaq935/trackifyr-Cognitive_Load_Management_via_NAM/releases/latest/download/trackifyr-desktop-setup.exe'

function getBundledRelease() {
  const dir = path.join(process.cwd(), 'public', 'releases')
  try {
    if (!fs.existsSync(dir)) return null
    const exeStable = path.join(dir, 'trackifyr-desktop-setup.exe')
    if (fs.existsSync(exeStable)) {
      const st = fs.statSync(exeStable)
      return { href: '/releases/trackifyr-desktop-setup.exe', bytes: st.size, kind: 'exe' }
    }
    const zipPath = path.join(dir, 'trackifyr-desktop.zip')
    if (fs.existsSync(zipPath)) {
      const st = fs.statSync(zipPath)
      return { href: '/releases/trackifyr-desktop.zip', bytes: st.size, kind: 'zip' }
    }
    const zips = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.zip') && f.startsWith('trackifyr-desktop'))
      .sort()
    if (zips.length) {
      const name = zips[zips.length - 1]
      const st = fs.statSync(path.join(dir, name))
      return { href: `/releases/${name}`, bytes: st.size, kind: 'zip' }
    }
  } catch {
    /* ignore */
  }
  return null
}

function formatMb(bytes) {
  if (!bytes || bytes <= 0) return ''
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function DownloadPage() {
  const envUrl = process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL?.trim() || ''
  const disableGithub = process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_DISABLE_GITHUB === '1'
  const bundled = getBundledRelease()
  const githubExe = !envUrl && !bundled && !disableGithub ? DEFAULT_GITHUB_LATEST_EXE : ''
  const downloadUrl = envUrl || bundled?.href || githubExe
  const isZip =
    Boolean(bundled && !envUrl && bundled.kind === 'zip') ||
    (Boolean(envUrl) && envUrl.toLowerCase().endsWith('.zip'))
  const sizeLabel = !envUrl && bundled?.bytes ? formatMb(bundled.bytes) : ''

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-gray-50 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-5 border-b border-blue-700">
            <h1 className="text-xl font-bold text-white">Desktop app</h1>
            <p className="text-blue-100 text-sm mt-1">
              Sign in, session timer, optional camera — runs local activity + ML tracking for the dashboard
            </p>
          </div>
          <div className="px-8 py-8 space-y-5">
            {downloadUrl ? (
              <>
                <p className="text-gray-600 text-sm">
                  {isZip ? (
                    <>
                      Download the <strong className="font-medium text-gray-800">ZIP</strong>
                      {sizeLabel ? ` (${sizeLabel})` : ''}. Unzip the file, then run the installer inside. Same account as this website.
                    </>
                  ) : (
                    <>
                      Download the Windows installer
                      {sizeLabel ? ` (${sizeLabel})` : ''}. Run the <code className="text-xs bg-gray-100 px-1 rounded">.exe</code> and
                      complete the setup wizard. Same account as this website.
                    </>
                  )}
                </p>
                <a
                  href={downloadUrl}
                  className="flex items-center justify-center gap-2 w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all duration-200"
                >
                  {isZip ? 'Download ZIP for Windows' : 'Download installer (.exe)'}
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </a>
                <p className="text-xs text-gray-500 leading-relaxed">
                  After installing, see{' '}
                  <Link href="/tracking-setup" className="font-semibold text-blue-600 hover:text-blue-700">
                    Tracking setup
                  </Link>{' '}
                  (same as{' '}
                  <a href="/releases/SETUP.md" className="font-semibold text-blue-600 hover:text-blue-700">
                    SETUP.md
                  </a>{' '}
                  in the release folder) for Python, models, and live dashboard steps.
                </p>
                {envUrl && (
                  <p className="text-xs text-gray-500">
                    Link from <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL</code> (overrides other sources).
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-gray-700 text-sm leading-relaxed">
                  Add the installer to the site by running{' '}
                  <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">npm run release:desktop</code> from the repo root
                  (after <code className="text-xs bg-gray-100 px-1 rounded">cd desktop && npm run dist</code>). That creates{' '}
                  <code className="text-xs bg-gray-100 px-1 rounded">public/releases/trackifyr-desktop-setup.exe</code> (and a ZIP).
                  Commit and deploy, or set{' '}
                  <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL</code> to any public URL.
                </p>
                <ol className="list-decimal list-inside text-sm text-gray-600 space-y-2">
                  <li>
                    Build: <code className="text-xs bg-gray-100 px-1 rounded">cd desktop && npm run dist</code>
                  </li>
                  <li>
                    Package: <code className="text-xs bg-gray-100 px-1 rounded">npm run release:desktop</code> (uses 7-Zip max compression if installed)
                  </li>
                  <li>
                    Commit <code className="text-xs bg-gray-100 px-1 rounded">public/releases/trackifyr-desktop-setup.exe</code> (and
                    optional ZIP) and push
                  </li>
                </ol>
              </>
            )}
            <div className="pt-2 border-t border-gray-100">
              <Suspense fallback={<span className="text-sm text-gray-400">Loading…</span>}>
                <DownloadBackLink />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
