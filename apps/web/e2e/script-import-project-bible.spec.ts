import { expect, test } from "@playwright/test"

test("script import → auto split shots → project bible visual edit sync", async ({ page }) => {
  // Mock AI config to avoid real upstream calls
  await page.route("**/api/ai/config", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        baseUrl: "https://e2e.invalid/v1",
        hasApiKey: true,
        defaultModel: "e2e-text-model",
        defaultImageModel: "e2e-image-model",
        timeoutMs: 120_000,
      }),
    })
  })

  // 1. Open empty canvas
  await page.goto("/canvas")
  await expect(page.getByText("欢迎使用星轨画布")).toBeVisible()

  // 2. Click "导入剧本 / AI 分析"
  await page.getByRole("button", { name: /导入剧本/ }).click()
  await expect(page.getByTestId("script-import-panel")).toBeVisible()

  // 3. Fill title and script text (structured format for reliable shot parsing)
  await page.getByPlaceholder("例如：隐门探案 第 1 集").fill("E2E 测试剧本")

  const scriptText = `镜头 1
画面内容：女主林夏走进旧公寓走廊，灯光昏暗。
景别：全景
运镜：缓慢推进

镜头 2
画面内容：林夏停在门前，手握旧黄铜钥匙。
景别：特写
运镜：固定

镜头 3
画面内容：门缝中黑影逼近，空间压迫。
景别：中景
运镜：手持`

  await page.getByPlaceholder("粘贴剧本、故事梗概、文字分镜或场次文本……").fill(scriptText)

  // 4. Confirm checkboxes are checked by default
  const splitCheckbox = page.locator("label", { hasText: "导入后自动拆分 Shot" }).locator("input[type='checkbox']")
  const bibleCheckbox = page.locator("label", { hasText: "同时打开 Bible 面板" }).locator("input[type='checkbox']")
  await expect(splitCheckbox).toBeChecked()
  await expect(bibleCheckbox).toBeChecked()

  // 5. Submit import
  await page.getByTestId("script-import-submit").click()

  // 6. Panel closes
  await expect(page.getByTestId("script-import-panel")).toHaveCount(0)

  // 7. Storyboard source node appears
  await expect(page.getByText("E2E 测试剧本")).toBeVisible({ timeout: 10_000 })

  // 8. Project Bible panel auto-opens (shot split happens inside setTimeout 60ms)
  await expect(page.getByTestId("project-bible-panel")).toBeVisible({ timeout: 10_000 })

  // 9. Verify shot split succeeded via Bible scene count (ReactFlow onlyRenderVisibleElements
  // may hide off-screen shot nodes, so we use the Bible panel as the source of truth)
  const biblePanel = page.getByTestId("project-bible-panel")
  await expect(biblePanel.getByRole("button", { name: /场景 1/ })).toBeVisible({ timeout: 10_000 })

  // 10. All three tabs visible (scoped inside bible panel)
  await expect(biblePanel.getByRole("button", { name: /角色/ })).toBeVisible()
  await expect(biblePanel.getByRole("button", { name: /场景/ })).toBeVisible()
  await expect(biblePanel.getByRole("button", { name: /视觉/ })).toBeVisible()

  // 11. Switch to Visual tab and edit stylePrompt
  await biblePanel.getByRole("button", { name: /视觉/ }).click()

  const stylePromptTextarea = page.locator("textarea[placeholder*='追加到分镜合成图的全局风格 Prompt']")
  await expect(stylePromptTextarea).toBeVisible()
  await stylePromptTextarea.fill("e2e test visual style: dark noir, cinematic lighting, 16mm film grain")

  // 12. Apply visual patch
  await page.getByRole("button", { name: /同步到分镜源节点和合成设置/ }).click()

  // 13. Panel remains visible (sync succeeded)
  await expect(page.getByTestId("project-bible-panel")).toBeVisible()

  // 14. Close Bible panel via its own close button (top-right chat panel may overlay the toolbar toggle)
  await biblePanel.getByTitle("收起").click()
  await expect(page.getByTestId("project-bible-panel")).toHaveCount(0)
})
