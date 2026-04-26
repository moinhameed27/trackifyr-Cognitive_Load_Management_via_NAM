import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['pg'],
  // Next.js 16+: top-level `turbopack` (replaces experimental.turbo).
  turbopack: {
    root: __dirname,
    resolveAlias: {
      '@': path.join(__dirname),
    },
  },
}

export default nextConfig



