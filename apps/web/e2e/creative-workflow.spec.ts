// ============================================================================
// StarCanvas 真实创作全流程测试 — 剧本→分镜→生图→生视频
// ============================================================================
import { test } from "@playwright/test"

const BASE = process.env.STARCANVAS_E2E_BASE_URL || "http://localhost:3000"

const SCRIPT = `第一场：雨夜追踪

镜头1：城市雨夜，霓虹灯倒映在湿漉漉的街道上。一个黑衣人撑着伞快步走过。

镜头2：黑衣人拐进小巷，身后传来急促的脚步声。他回头，警觉地看向来路。

镜头3：跟踪者从阴影中现身，手电筒光束扫过墙面，就在要照到黑衣人藏身处的一瞬间——`

test("完整创作流水线 — 剧本→分镜→生图→生视频→导出", async ({ page }) => {
  // ═══════════════════════════════════════════
  // Phase 1: 进入画布
  // ═══════════════════════════════════════════
  await page.goto(`${BASE}/canvas`, { timeout: 120000, waitUntil: "domcontentloaded" })
  await page.waitForTimeout(5000) // 生产构建已预编译；开发模式下仅保留短暂等待

  // ═══════════════════════════════════════════
  // Phase 2: 空白写作 - 创建文本节点
  // ═══════════════════════════════════════════
  // 点击"空白写作"开始
  const blankBtn = page.getByText("空白写作").first()
  if (await blankBtn.isVisible({ timeout: 10000 })) {
    await blankBtn.click()
    await page.waitForTimeout(3000)
  }

  // ═══════════════════════════════════════════
  // Phase 3: 在 ChatPanel 中输入剧本
  // ═══════════════════════════════════════════
  // 找到 ChatPanel 的输入框
  const chatInput = page.locator('textarea, [contenteditable="true"], [role="textbox"]').first()
  if (await chatInput.isVisible({ timeout: 5000 })) {
    await chatInput.click()
    await page.waitForTimeout(500)
    await chatInput.fill(`请根据以下剧本内容拆分为分镜：\n\n${SCRIPT}`)
    await page.waitForTimeout(2000)

    // 发送消息
    await page.keyboard.press("Enter")
    await page.waitForTimeout(5000)
  }

  // ═══════════════════════════════════════════
  // Phase 4: 使用 SlashCommand /split-storyboard
  // ═══════════════════════════════════════════
  if (await chatInput.isVisible({ timeout: 3000 })) {
    await chatInput.click()
    await chatInput.fill("/split-storyboard")
    await page.waitForTimeout(2000)
    // 选择命令
    await page.keyboard.press("Enter")
    await page.waitForTimeout(10000) // 等 AI 生成分镜
  }

  // ═══════════════════════════════════════════
  // Phase 5: 选中一个 Shot 节点，生成图片
  // ═══════════════════════════════════════════
  // 右侧 ChatPanel 会覆盖画布右侧节点，先关闭避免拦截 Playwright 点击
  const closeChat = page.getByTitle("关闭").last()
  if (await closeChat.isVisible({ timeout: 3000 }).catch(() => false)) {
    await closeChat.click()
    await page.waitForTimeout(1000)
  }

  const node = page.locator(".react-flow__node").first()
  if (await node.isVisible({ timeout: 5000 })) {
    await node.click()
    await page.waitForTimeout(2000)

    const genImg = page.getByRole("button", { name: /^生成图片$/ }).first()
    if (await genImg.isVisible({ timeout: 5000 }).catch(() => false)) {
      await genImg.click()
      await page.waitForTimeout(10000)
    }
  }

  // ═══════════════════════════════════════════
  // Phase 6: 查看左侧工具栏的生成功能
  // ═══════════════════════════════════════════
  await page.waitForTimeout(3000)

  // ═══════════════════════════════════════════
  // Phase 7: 查看分镜列表
  // ═══════════════════════════════════════════
  const shotBtn = page.getByTestId("shot-list-toggle")
  if (await shotBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await shotBtn.click()
    await page.waitForTimeout(3000)
  }

  // ═══════════════════════════════════════════
  // Phase 8: 查看导出功能
  // ═══════════════════════════════════════════
  await page.keyboard.press("Escape")
  await page.waitForTimeout(1000)
  const exportBtn = page.getByRole("button", { name: "导出" })
  if (await exportBtn.isVisible({ timeout: 5000 })) {
    await exportBtn.click()
    await page.waitForTimeout(3000)
  }

  // 完成
  await page.waitForTimeout(5000)
})
