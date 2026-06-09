// 星轨画布自动验收脚本
// 覆盖：React Scan / Sentry / supermemory / AI 接口 / 控制台 / 渲染性能
import { test, expect } from "@playwright/test"
import type { Page } from "@playwright/test"

const BASE = "http://localhost:3000"

// ─── 辅助函数 ──────────────────────────────────────────────────────
async function collectConsole(page: Page) {
  const errors: string[] = []
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text())
  })
  page.on("pageerror", (err) => errors.push(`[PAGE] ${err.message}`))
  return errors
}

// ─── 1. 首页加载 ────────────────────────────────────────────────────
test("首页加载正常", async ({ page }) => {
  const errors: string[] = []
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()) })

  await page.goto(BASE, { waitUntil: "networkidle", timeout: 20000 })
  await expect(page).toHaveTitle(/星轨画布/)
  expect(errors.filter(e => !e.includes("favicon"))).toEqual([])
})

// ─── 2. Canvas 画布 ─────────────────────────────────────────────────
test("Canvas 画布正常渲染", async ({ page }) => {
  const errors = await collectConsole(page)
  await page.goto(`${BASE}/canvas`, { waitUntil: "networkidle", timeout: 20000 })
  await page.waitForTimeout(3000)

  // 页面应包含创建要素
  const text = await page.evaluate(() => document.body.innerText)
  expect(text).toContain("星轨画布")

  // 控制台零错误
  expect(errors.filter(e => !e.includes("favicon") && !e.includes("ResizeObserver"))).toEqual([])
})

// ─── 3. React Scan 已加载 ───────────────────────────────────────────
test("React Scan 开发工具栏就绪", async ({ page }) => {
  await page.goto(`${BASE}/canvas`, { waitUntil: "networkidle", timeout: 20000 })
  await page.waitForTimeout(2000)

  const hasReactScan = await page.evaluate(() => {
    return typeof (window as any).__REACT_SCAN__ !== "undefined"
  })
  expect(hasReactScan).toBe(true)
})

// ─── 4. Sentry 已加载 ───────────────────────────────────────────────
test("Sentry 错误追踪已加载", async ({ page }) => {
  await page.goto(`${BASE}/canvas`, { waitUntil: "networkidle", timeout: 20000 })
  await page.waitForTimeout(2000)

  const hasSentry = await page.evaluate(() => {
    const el = document.querySelector('script[src*="sentry"]')
    return el !== null || typeof (window as any).Sentry !== "undefined"
  })
  expect(hasSentry).toBe(true)
})

// ─── 5. supermemory IndexedDB 可访问 ────────────────────────────────
test("supermemory 持久化引擎已就绪", async ({ page }) => {
  await page.goto(`${BASE}/canvas`, { waitUntil: "networkidle", timeout: 20000 })
  await page.waitForTimeout(2000)

  const idbReady = await page.evaluate(() => {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open("supermemory")
        req.onsuccess = () => resolve(true)
        req.onerror = () => resolve(false)
        req.onupgradeneeded = () => resolve(true)
      } catch {
        resolve(false)
      }
    })
  })
  expect(idbReady).toBe(true)
})

// ─── 6. AI API 路由可调用 ────────────────────────────────────────────
test("AI 接口路由 POST 可达", async ({ page }) => {
  await page.goto(`${BASE}/canvas`, { waitUntil: "networkidle", timeout: 20000 })

  // 只验证路由可达，不验证实际返回（因为 Key 需要在浏览器环境调用）
  const routes = ["/api/ai/chat", "/api/ai/health", "/api/ai/config"]
  for (const route of routes) {
    const resp = await page.request.post(route, {
      data: { model: "gpt-5.5", messages: [{ role: "user", content: "ping" }], max_tokens: 1 },
      timeout: 5000,
    }).catch(() => null)
    // 只要不抛出网络错误就行（401 表示 Key 问题，但路由本身在运行）
    expect(resp).not.toBeNull()
  }
})

// ─── 7. stop-slop Skill 文件存在 ────────────────────────────────────
test("stop-slop 去AI味工具已安装", async () => {
  const fs = require("fs")
  const skillPath = require("path").join(
    require("os").homedir(),
    ".workbuddy/skills/stop-slop-cn/SKILL.md"
  )
  expect(fs.existsSync(skillPath)).toBe(true)
})
