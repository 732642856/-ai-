// ============================================================================
// StarCanvas 全流程演示视频录制 — 真浏览器实录
// ============================================================================
import { test } from "@playwright/test"

const BASE = process.env.STARCANVAS_E2E_BASE_URL || "http://localhost:3000"

test("全流程实录 — 首页→画布→画风库→分镜→Chat→Agent→导出", async ({ page }) => {
  // ═══════════════════════════════════════
  // Step 1: 打开首页
  // ═══════════════════════════════════════
  await page.goto(BASE, { timeout: 120000, waitUntil: "domcontentloaded" })
  await page.waitForTimeout(3000)

  // ═══════════════════════════════════════
  // Step 2: 点击"进入画布"
  // ═══════════════════════════════════════
  const enterBtn = page.getByText("进入画布").first()
  if (await enterBtn.isVisible({ timeout: 30000 })) {
    await enterBtn.click()
  } else {
    await page.goto(`${BASE}/canvas`, { timeout: 120000, waitUntil: "domcontentloaded" })
  }
  await page.waitForTimeout(35000)

  // ═══════════════════════════════════════
  // Step 3: 浏览顶部工具栏
  // ═══════════════════════════════════════
  await page.waitForTimeout(2000)

  // ═══════════════════════════════════════
  // Step 4: 打开画风库
  // ═══════════════════════════════════════
  const styleBtn = page.getByRole("button", { name: "画风" })
  if (await styleBtn.isVisible({ timeout: 10000 })) {
    await styleBtn.click()
    await page.waitForTimeout(3000)
  }

  // ═══════════════════════════════════════
  // Step 5: 关闭画风库，打开分镜列表
  // ═══════════════════════════════════════
  await page.keyboard.press("Escape")
  await page.waitForTimeout(1000)
  const shotBtn = page.getByRole("button", { name: "分镜" })
  if (await shotBtn.isVisible({ timeout: 5000 })) {
    await shotBtn.click()
    await page.waitForTimeout(3000)
  }

  // ═══════════════════════════════════════
  // Step 6: 关闭分镜，查看 ChatPanel
  // ═══════════════════════════════════════
  await page.keyboard.press("Escape")
  await page.waitForTimeout(1000)
  await page.waitForTimeout(3000)

  // ═══════════════════════════════════════
  // Step 7: Agent 模式切换器
  // ═══════════════════════════════════════
  // ChatPanel 内的 Agent 模式按钮
  await page.waitForTimeout(2000)

  // ═══════════════════════════════════════
  // Step 8: 回到首页
  // ═══════════════════════════════════════
  await page.goto(BASE, { timeout: 60000, waitUntil: "domcontentloaded" })
  await page.waitForTimeout(5000)
})
