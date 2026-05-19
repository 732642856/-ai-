import path from "node:path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // Keep both dev and build on webpack.
  // Turbopack currently panics when this workspace lives under a Chinese path.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
}

export default nextConfig
