import { defineConfig, devices } from "@playwright/test"

const PORT = Number(process.env.STARCANVAS_E2E_PORT || 3107)
const baseURL = process.env.STARCANVAS_E2E_BASE_URL || `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: "./e2e",
  outputDir: process.env.STARCANVAS_E2E_OUTPUT_DIR || "/tmp/starcanvas-playwright-test-results",
  timeout: 45_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.STARCANVAS_E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm exec next dev --webpack --hostname 127.0.0.1 --port ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
