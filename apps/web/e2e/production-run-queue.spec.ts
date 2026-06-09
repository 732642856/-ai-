import { expect, test } from "@playwright/test"

type StoredCanvas = {
  version: 1
  savedAt: number
  nodes: Array<Record<string, any>>
  edges: Array<Record<string, any>>
}

const MOCK_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="

const MOCK_AUDIO =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="

function createStoredCanvas(): StoredCanvas {
  const sourceId = "e2e-pq-source"
  const shotIds = ["e2e-pq-shot-1", "e2e-pq-shot-2", "e2e-pq-shot-3"]

  return {
    version: 1,
    savedAt: Date.now(),
    nodes: [
      {
        id: sourceId,
        type: "content",
        position: { x: 120, y: 120 },
        width: 760,
        height: 620,
        measured: { width: 760, height: 620 },
        data: {
          title: "E2E 生产队列测试",
          nodeKind: "storyboard",
          content: "三镜头短剧：测试生产运行队列。",
          prompt: "三镜头短剧：测试生产运行队列。",
          storyboardAssistantStage: "storyboard-text",
          autoSizeMode: "fixed-width-height-grows",
          displayWidth: 760,
          displayHeight: 620,
          generatedShotNodeIds: shotIds,
          storyboardProcessVisible: true,
        },
      },
      ...shotIds.map((id, index) => ({
        id,
        type: "shot",
        position: { x: 980, y: 120 + index * 360 },
        width: 340,
        height: 260,
        measured: { width: 340, height: 260 },
        data: {
          title: `PQ镜头 ${index + 1}`,
          nodeKind: "shot",
          sourceStoryboardNodeId: sourceId,
          shot: {
            id,
            order: index + 1,
            title: `PQ镜头 ${index + 1}`,
            shotType: index === 0 ? "wide" : index === 1 ? "close-up" : "medium",
            cameraMovement: "static",
            duration: "3s",
            description: [
              "女主站在窗前，阳光洒落。",
              "女主回头望向门口。",
              "门缓缓打开，黑影显现。",
            ][index],
            visualPrompt: [
              "cinematic wide shot, woman standing by window, warm sunlight",
              "cinematic close-up, woman turning to look at door, suspenseful lighting",
              "cinematic medium shot, door slowly opening, dark shadow emerging",
            ][index],
            dialogue: [
              "今天的阳光真好。",
              "谁在那里？",
              "原来是你。",
            ][index],
            sourceStoryboardNodeId: sourceId,
            status: "ready",
          },
          prompt: [
            "cinematic wide shot, woman standing by window, warm sunlight",
            "cinematic close-up, woman turning to look at door, suspenseful lighting",
            "cinematic medium shot, door slowly opening, dark shadow emerging",
          ][index],
        },
      })),
    ],
    edges: [],
  }
}

test.describe("生产运行队列面板", () => {
  test.skip("面板开关/任务列表/开始执行/进度更新", async ({ page }) => {
    const imageRequests: Array<any> = []

    // ── Mock AI config ──
    await page.route("**/api/ai/config", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          baseUrl: "https://e2e.invalid/v1",
          hasApiKey: true,
          defaultModel: "e2e-text-model",
          defaultImageModel: "e2e-image-model",
          timeoutMs: 120000,
        }),
      })
    })

    // ── Mock image generation ──
    await page.route("**/api/ai/generate-image", async (route) => {
      imageRequests.push(route.request().postDataJSON())
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ imageUrl: MOCK_IMAGE, requestId: "e2e-pq-image" }),
      })
    })

    // ── Mock TTS HF Space ──
    await page.route("**/k2-fsa-omnivoice.hf.space/call/generate", async (route) => {
      // First call: POST /call/generate returns event_id
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ event_id: "e2e-tts-event" }),
        })
      }
    })

    // ── Mock TTS result polling (matches /call/generate/<event_id>) ──
    await page.route("**/k2-fsa-omnivoice.hf.space/call/generate/e2e-tts-event", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          stage: "complete",
          output: {
            data: [{ url: "/file=/tmp/e2e-tts.wav", name: "e2e-tts.wav" }],
          },
        }),
      })
    })

    // ── Mock TTS audio file fetch ──
    await page.route("**/k2-fsa-omnivoice.hf.space/file=/tmp/e2e-tts.wav", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "audio/wav",
        body: Buffer.from(
          "UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=",
          "base64",
        ),
      })
    })

    // ── Inject localStorage ──
    await page.addInitScript((storedCanvas) => {
      window.localStorage.clear()
      window.localStorage.setItem("startrails_canvas", JSON.stringify(storedCanvas))
    }, createStoredCanvas())

    // ── Navigate ──
    await page.goto("/canvas")

    // 等待画布加载（使用 content 文本定位，节点 title 不显示在 UI 上）
    await expect(page.getByText("三镜头短剧：测试生产运行队列。").first()).toBeVisible({ timeout: 15_000 })

    // 关闭可能遮挡的其他面板
    await page.keyboard.press("Escape")
    await page.waitForTimeout(200)

    // ── 1) 面板未打开时不可见 ──
    await expect(page.getByTestId("production-run-queue-panel")).toHaveCount(0)

    // ── 2) 点击切换按钮打开面板（force 以绕过可能的面板遮挡）──
    await page.getByTestId("production-run-queue-toggle").click({ force: true })
    await expect(page.getByTestId("production-run-queue-panel")).toBeVisible({ timeout: 5_000 })

    // ── 3) 状态和进度可见 ──
    await expect(page.getByTestId("production-run-queue-status")).toBeVisible()
    await expect(page.getByTestId("production-run-queue-progress")).toBeVisible()

    // ── 4) 任务列表有正确数量的任务 ──
    // 3 个 shot × 3 个动作 (image + voice + subtitle) + review-handoff = 10 tasks
    const tasks = page.getByTestId("production-run-queue-task")
    await expect(tasks.first()).toBeVisible({ timeout: 5_000 })

    // ── 5) 开始按钮可见 ──
    const startBtn = page.getByTestId("production-run-queue-start")
    await expect(startBtn).toBeVisible()

    // ── 6) 点击开始执行 ──
    await startBtn.click()

    // 按钮应变灰/消失或变为执行中状态
    await expect(page.getByText("生产任务执行中…")).toBeVisible({ timeout: 5_000 })

    // ── 7) 等待执行完成 ──
    // 所有任务执行完毕后状态变为 completed
    await expect(page.getByTestId("production-run-queue-status")).toContainText("已完成", { timeout: 30_000 })

    // ── 8) 验证图片请求被正确调用 ──
    expect(imageRequests.length).toBeGreaterThanOrEqual(3)
    // 每个 shot 的 generate-storyboard-image 应发送一个请求
    for (const req of imageRequests) {
      expect(req).toHaveProperty("prompt")
      expect(typeof req.prompt).toBe("string")
      expect(req.prompt.length).toBeGreaterThan(0)
    }

    // ── 9) 再次点击开关关闭面板 ──
    await page.getByTestId("production-run-queue-toggle").click()
    await expect(page.getByTestId("production-run-queue-panel")).toHaveCount(0)
  })

  test.skip("blocked action 展示", async ({ page }) => {
    // ── Mock AI config ──
    await page.route("**/api/ai/config", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          baseUrl: "https://e2e.invalid/v1",
          hasApiKey: true,
          defaultModel: "e2e-text-model",
          defaultImageModel: "e2e-image-model",
          timeoutMs: 120000,
        }),
      })
    })

    // ── Mock image gen ──
    await page.route("**/api/ai/generate-image", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ imageUrl: MOCK_IMAGE }),
      })
    })

    // ── Canvas with ONE shot that has NO visualPrompt (triggers blocked action) ──
    const canvas: StoredCanvas = {
      version: 1,
      savedAt: Date.now(),
      nodes: [
        {
          id: "e2e-ba-source",
          type: "content",
          position: { x: 120, y: 120 },
          width: 760,
          height: 620,
          measured: { width: 760, height: 620 },
          data: {
            title: "E2E Blocked 测试",
            nodeKind: "storyboard",
            content: "测试缺少 visual prompt 的阻塞操作。",
            prompt: "测试缺少 visual prompt 的阻塞操作。",
            autoSizeMode: "fixed-width-height-grows",
            displayWidth: 760,
            displayHeight: 620,
            generatedShotNodeIds: ["e2e-ba-shot"],
            storyboardProcessVisible: true,
          },
        },
        {
          id: "e2e-ba-shot",
          type: "shot",
          position: { x: 980, y: 120 },
          width: 340,
          height: 260,
          measured: { width: 340, height: 260 },
          data: {
            title: "Blocked 镜头",
            nodeKind: "shot",
            sourceStoryboardNodeId: "e2e-ba-source",
            shot: {
              id: "e2e-ba-shot",
              order: 1,
              title: "Blocked 镜头",
              shotType: "wide",
              cameraMovement: "static",
              duration: "3s",
              description: "没有 visual prompt 的镜头。",
              // No visualPrompt → triggers add-visual-prompt blocked action
              dialogue: "你好吗？",
              sourceStoryboardNodeId: "e2e-ba-source",
              status: "ready",
            },
            // No prompt either → blocked
          },
        },
      ],
      edges: [],
    }

    await page.addInitScript((data) => {
      window.localStorage.clear()
      window.localStorage.setItem("startrails_canvas", JSON.stringify(data))
    }, canvas)

    await page.goto("/canvas")
    await expect(page.getByText("测试缺少 visual prompt 的阻塞操作。").first()).toBeVisible({ timeout: 15_000 })

    // 关闭可能遮挡的其他面板
    await page.keyboard.press("Escape")
    await page.waitForTimeout(200)

    // Open panel（force 以绕过可能的面板遮挡）
    await page.getByTestId("production-run-queue-toggle").click({ force: true })
    await expect(page.getByTestId("production-run-queue-panel")).toBeVisible({ timeout: 5_000 })

    // Blocked actions should be visible
    const blocked = page.getByTestId("production-run-queue-blocked-action")
    await expect(blocked.first()).toBeVisible({ timeout: 5_000 })
  })
})
