// ============================================================================
// StarCanvas 全流程演示视频录制
// ============================================================================
// 运行: STARCANVAS_E2E_BASE_URL=http://localhost:3000 npx playwright test demo-video.spec.ts
// ============================================================================

import { test } from "@playwright/test"

const BASE_URL = process.env.STARCANVAS_E2E_BASE_URL || "http://localhost:3000"

test("全流程演示 - 首页到画布到导出", async ({ page }) => {
  // ==========================================
  // Step 1: 首页
  // ==========================================
  await page.goto(BASE_URL, { timeout: 120000 })
  await page.waitForTimeout(5000)
  // 等待 "从灵感，到画面" 出现
  await page.waitForSelector("text=从灵感", { timeout: 60000 })

  // ==========================================
  // Step 2: 进入画布
  // ==========================================
  await page.click("text=进入画布")
  await page.waitForTimeout(30000) // 等待编译
  // 等空画布引导出现
  await page.waitForSelector("text=选择一个起点", { timeout: 60000 })

  // ==========================================
  // Step 3: 打开画风库
  // ==========================================
  await page.click("button:has-text('画风')")
  await page.waitForTimeout(2000)
  // 等画风库弹出
  await page.waitForSelector("text=影视画风库", { timeout: 10000 })
  // 搜索 "港风"
  const searchInput = page.locator("input[placeholder*='搜索']")
  if (await searchInput.isVisible()) {
    await searchInput.fill("港风")
    await page.waitForTimeout(1000)
  }
  // 关闭
  await page.keyboard.press("Escape")
  await page.waitForTimeout(1000)

  // ==========================================
  // Step 4: 打开分镜列表
  // ==========================================
  await page.click("button:has-text('分镜')")
  await page.waitForTimeout(2000)
  await page.keyboard.press("Escape")
  await page.waitForTimeout(1000)

  // ==========================================
  // Step 5: 打开 ChatPanel，输入斜杠命令
  // ==========================================
  // 找到 ChatPanel 输入框
  const chatInput = page.locator('[data-testid="chat-input"], textarea[placeholder*="消息"], [contenteditable="true"]').first()
  if (await chatInput.isVisible()) {
    await chatInput.click()
    await page.waitForTimeout(500)
    await chatInput.fill("/")
    await page.waitForTimeout(2000) // 等 28 个斜杠菜单弹出
  }
  await page.waitForTimeout(1000)

  // ==========================================
  // Step 6: 浏览工具栏
  // ==========================================
  // 展示顶部工具栏
  await page.waitForTimeout(1000)

  // ==========================================
  // Step 7: 展示 Agent 模式切换
  // ==========================================
  // ChatPanel 内的模式按钮
  const maxButton = page.locator("button:has-text('Max')")
  if (await maxButton.isVisible()) {
    await maxButton.click()
    await page.waitForTimeout(2000)
  }

  // ==========================================
  // Step 8: 回到首页
  // ==========================================
  await page.goto(BASE_URL, { timeout: 60000 })
  await page.waitForSelector("text=从灵感", { timeout: 30000 })

  // ==========================================
  // 完成
  // ==========================================
  await page.waitForTimeout(3000)
})
