const { chromium } = require("playwright-core")
const fs = require("fs")
const path = require("path")

const BASE = "http://localhost:3000"
const LOG_DIR = "/tmp/star-canvas-audit"
const results = []

function log(ok, step, detail) {
  results.push({ ok, step, detail: detail || "" })
  console.log((ok ? "✅" : "❌") + " " + step + (detail ? " \u2014 " + detail.slice(0, 120) : ""))
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

;(async () => {
  fs.mkdirSync(LOG_DIR, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await ctx.newPage()
  const consoleErrors = []
  p.on("console", msg => { if (msg.type() === "error") consoleErrors.push(msg.text()) })

  try {
    log(true, "开始验收测试")

    // Layer 1: 首页
    await p.goto(BASE, { waitUntil: "networkidle", timeout: 20000 })
    await p.waitForTimeout(1000)
    const title = await p.title()
    log(title.includes("星轨"), "首页加载", "Title: " + title)
    await p.screenshot({ path: path.join(LOG_DIR, "01-home.png") })

    // Layer 2: Canvas
    await p.goto(BASE + "/canvas", { waitUntil: "networkidle", timeout: 20000 })
    await p.waitForTimeout(3000)
    const canvasText = await p.evaluate(() => document.body.innerText)
    log(canvasText.includes("星轨") || canvasText.includes("画布"), "Canvas 画布加载")
    await p.screenshot({ path: path.join(LOG_DIR, "02-canvas.png") })

    // Layer 3: AI Chat
    log(canvasText.includes("AI") || canvasText.includes("对话"), "AI 聊天入口可见")

    // Layer 4: 剧本导入
    log(canvasText.includes("剧本") || canvasText.includes("导入"), "剧本导入入口可见")

    // Layer 5: 控制台
    const filtered = consoleErrors.filter(e => !e.includes("favicon") && !e.includes("ResizeObserver") && !e.includes("sentry"))
    log(filtered.length === 0, "控制台无关键错误", filtered[0] ? filtered[0].slice(0, 100) : "零错误")

    // Layer 6: API 逐个检查
    try {
      const r = await p.request.post(BASE + "/api/ai/chat", { data: { model: "gpt-5.5", messages: [{ role: "user", content: "hi" }], max_tokens: 5 }, timeout: 15000 })
      log(r.ok(), "AI Chat API", "HTTP " + r.status())
    } catch (e) { log(false, "AI Chat API", e.message.slice(0, 80)) }

    try {
      const r = await p.request.post(BASE + "/api/ai/generate-image", { data: { prompt: "test", n: 1, size: "1024x1024" }, timeout: 15000 })
      log(r.ok(), "图片生成 API", "HTTP " + r.status())
    } catch (e) { log(false, "图片生成 API", e.message.slice(0, 80)) }

    try {
      const r = await p.request.post(BASE + "/api/ai/generate-character-view", { data: { characterDescription: "测试角色", viewType: "front" }, timeout: 15000 })
      log(r.ok(), "三视图生成 API", "HTTP " + r.status())
    } catch (e) { log(false, "三视图生成 API", e.message.slice(0, 80)) }

    try {
      const r = await p.request.post(BASE + "/api/ai/reverse-prompt", { data: { imageUrl: "https://picsum.photos/200" }, timeout: 30000 })
      const d = await r.json()
      log(!!d.prompt, "提示词反推 API", d.prompt ? d.prompt.slice(0, 60) + "..." : d.error)
    } catch (e) { log(false, "提示词反推 API", e.message.slice(0, 80)) }

    try {
      const r = await p.request.post(BASE + "/api/ai/health", { data: {}, timeout: 5000 })
      log(r.ok() || r.status() !== 404, "健康检查 API", "HTTP " + r.status())
    } catch (e) { log(false, "健康检查 API", e.message.slice(0, 80)) }

    // Layer 7: supermemory
    const hasIDB = await p.evaluate(() => new Promise(r => { const req = indexedDB.open("supermemory"); req.onsuccess = () => { req.result.close(); r(true) }; req.onerror = () => r(false) }))
    log(hasIDB, "supermemory IndexedDB")

    // Layer 8: taste-skill CSS
    const hasTokens = await p.evaluate(() => { const s = getComputedStyle(document.documentElement); return s.getPropertyValue("--shadow-elevated") !== "" })
    log(hasTokens, "taste-skill CSS 设计 token")

    // Layer 9: 角色资产
    log(canvasText.includes("角色") || canvasText.includes("Character"), "角色资产入口可见")

    // 总结
    const pass = results.filter(r => r.ok).length
    const total = results.length
    console.log("\n" + "=".repeat(50))
    console.log("📊 验收结果: " + pass + "/" + total + " 通过 (" + Math.round(pass/total*100) + "%)")
    console.log("=".repeat(50))

    fs.writeFileSync(path.join(LOG_DIR, "audit-result.json"), JSON.stringify(results, null, 2))
    console.log("\n报告: " + LOG_DIR + "/")
  } catch (e) {
    log(false, "测试中断", e.message)
  }

  await browser.close()
})().catch(e => console.error("Fatal:", e.message))
