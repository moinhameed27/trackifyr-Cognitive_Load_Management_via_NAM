import fs from 'fs'
import path from 'path'
import Link from 'next/link'

export const metadata = {
  title: 'Download · trackifyr',
  description: 'Download the trackifyr desktop session app for Windows.',
}

/**
 * When no env var and no ZIP in `public/releases/`, use GitHub Releases (latest).
 * Works with Vercel + connected repo after you run Actions → "Desktop release" once.
 * Override for forks: NEXT_PUBLIC_DESKTOP_GITHUB_ZIP
 * Disable: NEXT_PUBLIC_DESKTOP_DOWNLOAD_DISABLE_GITHUB=1
 */
const DEFAULT_GITHUB_LATEST_ZIP =
  process.env.NEXT_PUBLIC_DESKTOP_GITHUB_ZIP?.trim() ||
  'https://github.com/Subhanulhaq935/trackifyr-Cognitive_Load_Management_via_NAM/releases/latest/download/trackifyr-desktop.zip'

function getBundledRelease() {
  const dir = path.join(process.cwd(), 'public', 'releases')
  try {
    if (!fs.existsSync(dir)) return null
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
  const githubZip = !envUrl && !bundled && !disableGithub ? DEFAULT_GITHUB_LATEST_ZIP : ''
  const downloadUrl = envUrl || bundled?.href || githubZip
  const fromGithubFallback = Boolean(githubZip)
  const isZip =
    Boolean(bundled && !envUrl && bundled.kind === 'zip') ||
    fromGithubFallback ||
    (Boolean(envUrl) && envUrl.toLowerCase().endsWith('.zip'))
  const sizeLabel = !envUrl && bundled?.bytes ? formatMb(bundled.bytes) : ''

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-gray-50 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-5 border-b border-blue-700">
            <h1 className="text-xl font-bold text-white">Desktop app</h1>
            <p className="text-blue-100 text-sm mt-1">Sign in, run a timed session, optional camera</p>
          </div>
          <div className="px-8 py-8 space-y-5">
            {downloadUrl ? (
              <>
                <p className="text-gray-600 text-sm">
                  {isZip ? (
                    <>
                      Download the <strong className="font-medium text-gray-800">ZIP</strong>
                      {sizeLabel ? ` (${sizeLabel})` : ' (compressed installer)'}. Unzip
                      the file, then run <code className="text-xs bg-gray-100 px-1 rounded">trackifyr-Setup-…exe</code> to install. Same
                      account as this website.
                    </>
                  ) : (
                    <>
                      Download the installer for Windows
                      {sizeLabel ? ` (${sizeLabel})` : ''}. After installing, the app uses the same account as this website.
                    </>
                  )}
                </p>
                <a
                  href={downloadUrl}
                  className="flex items-center justify-center gap-2 w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all duration-200"
                >
                  {isZip ? 'Download ZIP for Windows' : 'Download for Windows'}
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </a>
                {envUrl && (
                  <p className="text-xs text-gray-500">
                    Link from <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL</code> (overrides other sources).
                  </p>
                )}
                {fromGithubFallback && (
                  <p className="text-xs text-gray-500">
                    Hosted on <strong className="font-medium text-gray-600">GitHub Releases</strong>. If you get a 404, open the repo →
                    Actions → run <strong className="font-medium text-gray-600">Desktop release</strong> once, then try again.
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-gray-700 text-sm leading-relaxed">
                  Add the installer to the site by running{' '}
                  <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">npm run release:desktop</code> from the repo root
                  (after <code className="text-xs bg-gray-100 px-1 rounded">cd desktop && npm run dist</code>). That creates{' '}
                  <code className="text-xs bg-gray-100 px-1 rounded">public/releases/trackifyr-desktop.zip</code>. Commit that file
                  and deploy, or set{' '}
                  <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL</code> to any public URL.
                </p>
                <ol className="list-decimal list-inside text-sm text-gray-600 space-y-2">
                  <li>
                    Build: <code className="text-xs bg-gray-100 px-1 rounded">cd desktop && npm run dist</code>
                  </li>
                  <li>
                    Package: <code className="text-xs bg-gray-100 px-1 rounded">npm run release:desktop</code> (uses 7-Zip max compression if installed)
                  </li>
                  <li>Commit <code className="text-xs bg-gray-100 px-1 rounded">public/releases/trackifyr-desktop.zip</code> and push</li>
                </ol>
              </>
            )}
            <div className="pt-2 border-t border-gray-100">
              <Link href="/signin" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                ← Back to sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
