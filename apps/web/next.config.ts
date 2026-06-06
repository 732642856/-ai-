import type { NextConfig } from 'next'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const monorepoRoot = resolve(__dirname, '../../..')

const nextConfig: NextConfig = {
  transpilePackages: ['@creative-canvas/shared', '@creative-canvas/canvas', '@xyflow/react'],
  outputFileTracingRoot: monorepoRoot,
}

export default nextConfig
