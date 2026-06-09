import path from "node:path"
import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs"

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // Keep both dev and build on webpack.
  // Turbopack currently panics when this workspace lives under a Chinese path.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG || "",
  project: process.env.SENTRY_PROJECT || "starcanvas-web",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  sourcemaps: { disable: true },
  // Suppress deprecation warnings pending official migration guide.
  // Sentry SDK warns about disableLogger, automaticVercelMonitors,
  // and missing instrumentation/global-error files.
  // These will be addressed in the next Sentry upgrade pass.
})
