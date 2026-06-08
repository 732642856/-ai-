import { expect, test } from "@playwright/test"

test.describe("StarCanvas startup smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear()
      window.sessionStorage.clear()
    })
  })

  test("empty canvas exposes script-first onboarding and diagnostics", async ({ page }) => {
    const consoleErrors: string[] = []
    page.on("console", (message) => {
      if (message.type() === "error") {
        const text = message.text()
        if (!text.includes("favicon") && !text.includes("Failed to load resource")) {
          consoleErrors.push(text)
        }
      }
    })

    await page.goto("/canvas")

    await expect(page.getByRole("heading", { name: "欢迎使用星轨画布" })).toBeVisible()
    await expect(page.getByTestId("empty-guide-import-script")).toBeVisible()
    await expect(page.getByTestId("empty-guide-create-ai-film-workflow")).toBeVisible()

    await page.getByTestId("canvas-diagnostics-toggle").click()
    await expect(page.getByTestId("canvas-diagnostics-toggle")).toBeVisible()

    await page.evaluate(() => {
      const button = document.querySelector('[data-testid="empty-guide-import-script"]') as HTMLButtonElement | null
      button?.click()
    })
    await expect(page.getByText("拖拽剧本文件到此处")).toBeVisible()

    expect(consoleErrors).toEqual([])
  })
})
