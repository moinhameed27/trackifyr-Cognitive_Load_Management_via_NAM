/**
 * Copies the Windows installer to public/releases/trackifyr-desktop-setup.exe and zips it
 * to public/releases/trackifyr-desktop.zip so /download can serve either from your site.
 *
 * NSIS installers are already compressed; ZIP usually saves little but keeps one file to ship.
 * If 7-Zip is installed, uses -mx=9; otherwise PowerShell Compress-Archive.
 *
 * Usage: npm run release:desktop   (after cd desktop && npm run dist)
 */
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const releaseDir = path.join(root, 'desktop', 'release')
const outDir = path.join(root, 'public', 'releases')
const zipPath = path.join(outDir, 'trackifyr-desktop.zip')
const stableExePath = path.join(outDir, 'trackifyr-desktop-setup.exe')
const setupMdPath = path.join(outDir, 'SETUP.md')

function findExe() {
  if (!fs.existsSync(releaseDir)) return null
  const files = fs.readdirSync(releaseDir)
  const exe = files.find(
    (f) => /\.exe$/i.test(f) && /^trackifyr-Setup-/i.test(f) && !f.startsWith('__'),
  )
  return exe ? path.join(releaseDir, exe) : null
}

function find7z() {
  if (process.platform !== 'win32') return null
  const candidates = [
    path.join(process.env['ProgramFiles'] || 'C:\\Program Files', '7-Zip', '7z.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', '7-Zip', '7z.exe'),
  ]
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c
  }
  return null
}

const exePath = findExe()
if (!exePath) {
  console.error(
    'Could not find desktop/release/trackifyr-Setup-*.exe.\nBuild it first: cd desktop && npm run dist',
  )
  process.exit(1)
}

fs.mkdirSync(outDir, { recursive: true })
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath)

const exeStat = fs.statSync(exePath)
console.log(`Source: ${path.basename(exePath)} (${(exeStat.size / 1024 / 1024).toFixed(1)} MB)`)

const setupInZip = fs.existsSync(setupMdPath)
const seven = find7z()
if (seven) {
  const extra = setupInZip ? ` "${setupMdPath}"` : ''
  execSync(`"${seven}" a -tzip -mx=9 "${zipPath}" "${exePath}"${extra}`, { stdio: 'inherit' })
} else if (process.platform === 'win32') {
  const src = exePath.replace(/'/g, "''")
  const dst = zipPath.replace(/'/g, "''")
  if (setupInZip) {
    const sm = setupMdPath.replace(/'/g, "''")
    execSync(
      `powershell -NoProfile -Command "$files = @('${src}','${sm}'); Compress-Archive -LiteralPath $files -DestinationPath '${dst}' -CompressionLevel Optimal -Force"`,
      { stdio: 'inherit' },
    )
  } else {
    execSync(
      `powershell -NoProfile -Command "Compress-Archive -LiteralPath '${src}' -DestinationPath '${dst}' -CompressionLevel Optimal -Force"`,
      { stdio: 'inherit' },
    )
  }
} else {
  const extra = setupInZip ? ` "${setupMdPath}"` : ''
  execSync(`zip -9 -j "${zipPath}" "${exePath}"${extra}`, { stdio: 'inherit' })
}

fs.copyFileSync(exePath, stableExePath)
const stableStat = fs.statSync(stableExePath)
console.log(`Wrote: ${stableExePath} (${(stableStat.size / 1024 / 1024).toFixed(1)} MB)`)

const outStat = fs.statSync(zipPath)
const saved = exeStat.size > 0 ? ((1 - outStat.size / exeStat.size) * 100).toFixed(1) : '0'
console.log(`Wrote: ${zipPath} (${(outStat.size / 1024 / 1024).toFixed(1)} MB, ~${saved}% vs raw exe)`)
if (setupInZip) {
  console.log(`Included SETUP.md in ${path.basename(zipPath)} (keep public/releases/SETUP.md committed for the site + ZIP).`)
} else {
  console.warn('\nNote: public/releases/SETUP.md not found — add it so the release ZIP can include setup instructions.')
}
console.log(
  '\nCommit public/releases/trackifyr-desktop-setup.exe (and optional .zip) and deploy, or set NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL to a hosted URL.',
)
if (outStat.size > 95 * 1024 * 1024) {
  console.warn('\nWarning: ZIP is very large. Vercel/Git may reject huge files; use GitHub Releases + env URL if needed.')
}
