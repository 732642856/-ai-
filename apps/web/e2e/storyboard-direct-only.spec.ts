import { expect, test } from "@playwright/test"

type StoredCanvas = {
  version: 1
  savedAt: number
  nodes: Array<Record<string, any>>
  edges: Array<Record<string, any>>
}

const ONE_BY_ONE_FORBIDDEN_MESSAGES = [
  "正在生成镜头图",
  "正在生成单镜头分镜图",
  "逐张生成",
  "逐镜头生成",
]

const MOCK_STORYBOARD_IMAGE = "https://e2e.invalid/storyboard-grid.png"

function createStoredCanvas(): StoredCanvas {
  const sourceId = "e2e-storyboard-source"
  const shotIds = ["e2e-shot-1", "e2e-shot-2", "e2e-shot-3"]

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
          title: "E2E 故事分镜",
          nodeKind: "storyboard",
          content: "三镜头短剧：女主在旧公寓走廊发现黑影，灯闪，门开。",
          prompt: "三镜头短剧：女主在旧公寓走廊发现黑影，灯闪，门开。",
          storyboardAssistantStage: "storyboard-text",
          autoSizeMode: "fixed-width-height-grows",
          displayWidth: 760,
          displayHeight: 620,
          generatedShotNodeIds: shotIds,
          generatedStoryboardGridNodeId: "e2e-grid",
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
          title: `镜头 ${index + 1}`,
          nodeKind: "shot",
          sourceStoryboardNodeId: sourceId,
          shot: {
            id,
            order: index + 1,
            title: `镜头 ${index + 1}`,
            shotType: index === 0 ? "wide" : index === 1 ? "close-up" : "medium",
            cameraMovement: index === 0 ? "slow push-in" : index === 1 ? "static" : "handheld",
            duration: "3s",
            description: [
              "旧公寓走廊冷色灯光，女主停在门前。",
              "女主眼睛特写，灯光闪烁，恐惧压住呼吸。",
              "门缝后的黑影缓慢逼近，空间压迫。",
            ][index],
            visualPrompt: [
              "cinematic wide shot, old apartment corridor, cold light, woman standing before door",
              "cinematic close-up, woman's fearful eyes, flickering light, tense silence",
              "cinematic medium shot, dark shadow behind door gap, handheld suspense",
            ][index],
            sourceStoryboardNodeId: sourceId,
            status: "ready",
            characterIdentities: [
              {
                id: "manual-character-linxia",
                name: "女主林夏",
                role: "protagonist",
                visualSignature: "global e2e edit: exact oval face, short black bob haircut, mole under left eye, unchanged across panels",
                costume: "global e2e edit: same red wool coat with brass buttons and dark scarf",
                props: ["silver locket", "black umbrella"],
              },
            ],
            cinematicShot: {
              order: index + 1,
              sceneId: "scene-1",
              shotId: id,
              dramaticBeat: ["建立空间", "揭示恐惧", "威胁逼近"][index],
              shotPurpose: ["交代旧公寓走廊与门的位置关系", "用眼神表现人物意识到危险", "让黑影进入画面制造悬念"][index],
              emotionalState: index === 0 ? "suspense" : index === 1 ? "fear" : "tense",
              dramaticWeight: index + 6,
              shotSize: index === 0 ? "wide" : index === 1 ? "close-up" : "medium",
              cameraAngle: "eye-level",
              cameraMovement: index === 2 ? "handheld" : "push-in",
              composition: "door frame creates pressure lines around the character",
              blocking: "the woman stays foreground, shadow remains partially hidden behind the door",
              durationEstimate: 3,
              visualPrompt: [
                "professional storyboard panel, wide shot, old apartment corridor, cold blue light, red coat woman",
                "professional storyboard panel, close-up, fearful eyes, flickering corridor light, red coat continuity",
                "professional storyboard panel, medium shot, shadow behind door gap, red coat woman foreground",
              ][index],
              voiceIntent: "low breath, restrained fear",
              riskFlags: ["keep the red coat consistent across panels"],
            },
          },
        },
      })),
      {
        id: "e2e-grid",
        type: "storyboardGrid",
        position: { x: 1450, y: 120 },
        hidden: false,
        width: 420,
        height: 320,
        data: {
          title: "分镜合成预览",
          nodeKind: "storyboard-grid",
          sourceStoryboardNodeId: sourceId,
          storyboardGrid: {
            id: "e2e-grid-data",
            title: "分镜合成预览",
            sourceStoryboardNodeId: sourceId,
            shotNodeIds: shotIds,
            columns: 3,
            maxShots: 9,
            status: "draft",
          },
        },
      },
    ],
    edges: [],
  }
}

test("one-click storyboard image uses one direct grid request and never falls back to per-shot generation", async ({ page }) => {
  const imageRequests: Array<any> = []
  const chatRequests: Array<any> = []

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

  await page.route("**/api/ai/chat", async (route) => {
    chatRequests.push(route.request().postDataJSON())
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: { message: "Chat API must not be called by direct storyboard image generation" } }),
    })
  })

  await page.route("**/api/ai/generate-image", async (route) => {
    imageRequests.push(route.request().postDataJSON())
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ imageUrl: MOCK_STORYBOARD_IMAGE, requestId: "e2e-storyboard-grid" }),
    })
  })

  await page.addInitScript((storedCanvas) => {
    window.localStorage.clear()
    window.localStorage.setItem("startrails_canvas", JSON.stringify(storedCanvas))
    indexedDB.deleteDatabase("supermemory")
  }, createStoredCanvas())

  await page.goto("/canvas")

  // Wait for canvas to load using content text (node title is not displayed in ContentNode header)
  await expect(page.getByText("三镜头短剧：女主在旧公寓走廊发现黑影，灯闪，门开。").first()).toBeVisible({ timeout: 15_000 })

  // Click the "一键生成分镜图" button inside the content node
  await page.getByRole("button", { name: /一键生成分镜图/ }).click()

  const batchOverlay = page.getByTestId("storyboard-batch-progress-overlay")
  await expect(batchOverlay).toBeVisible({ timeout: 15_000 })

  // Wait for batch completion (status should become "已完成")
  await expect(page.getByTestId("storyboard-batch-status")).toHaveText("已完成", { timeout: 30_000 })
  await expect(page.getByTestId("storyboard-batch-message")).toContainText("分镜图已生成")

  await expect(page.getByText("分镜图已生成").first()).toBeVisible({ timeout: 15_000 })

  expect(chatRequests, "direct storyboard image generation must not invoke storyboard text/chat flow").toHaveLength(0)
  expect(imageRequests, "multi-shot storyboard generation must use exactly one image API call").toHaveLength(1)

  const imageRequest = imageRequests[0]
  expect(imageRequest.model).toBe("e2e-image-model")
  expect(imageRequest.size).toBe("1792x1024")
  expect(imageRequest.prompt).toContain("Create ONE professional cinematic storyboard sheet")
  expect(imageRequest.prompt).toContain("Do not create separate standalone images for individual shots")
  expect(imageRequest.prompt).toContain("Panel 1")
  expect(imageRequest.prompt).toContain("Panel 2")
  expect(imageRequest.prompt).toContain("Panel 3")
  expect(imageRequest.prompt).toContain("dramatic beat")
  expect(imageRequest.prompt).toContain("keep the red coat consistent across panels")
  expect(imageRequest.prompt).toContain("Character Identity Bible")
  expect(imageRequest.prompt).toContain("女主林夏")
  expect(imageRequest.prompt).toContain("global e2e edit: exact oval face, short black bob haircut, mole under left eye, unchanged across panels")
  expect(imageRequest.prompt).toContain("global e2e edit: same red wool coat with brass buttons and dark scarf")
  expect(imageRequest.prompt).toContain("silver locket, black umbrella")
  expect(imageRequest.prompt).toContain("Character identity continuity: 女主林夏")

  for (const forbidden of ONE_BY_ONE_FORBIDDEN_MESSAGES) {
    await expect(page.getByText(forbidden)).toHaveCount(0)
  }
})
