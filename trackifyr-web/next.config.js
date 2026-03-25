import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Native driver — avoid bundling issues on Vercel.
  serverExternalPackages: ['pg'],
  // Pin Turbopack root when a parent folder has its own lockfile (wrong inference breaks @/ imports).
  turbopack: {
    root: __dirname,
    resolveAlias: {
      '@': path.join(__dirname),
    },
  },
}

export default nextConfig



