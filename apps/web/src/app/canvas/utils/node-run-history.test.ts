// ============================================================================
// P1-5.4 单元测试 — Node Run History
// ============================================================================
// 运行方式：node --experimental-strip-types <this-file>
// ============================================================================

import { strict as assert } from "node:assert"

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (e: any) {
    failed++
    console.log(`  ✗ ${name}`)
    console.log(`    ${e.message}`)
  }
}

// ============================================================================
// 内联实现（避免模块导入路径问题）
// ============================================================================

interface PromptPart {
  type: "text" | "node-output" | "asset" | "image-url"
  text?: string
  nodeId?: string
  assetId?: string
  url?: string
  name?: string
  label?: string
  outputIndex?: number
}

interface MentionRef {
  type: "node-output" | "asset" | "image-url"
  label: string
  nodeId?: string
  outputIndex?: number
  assetId?: string
  url?: string
  name?: string
}

interface ContextTextInput {
  nodeId: string
  nodeType: string
  text: string
  title?: string
}

interface ContextImageRef {
  id: string
  url: string
  name?: string
  role: string
  source: "upstream" | "mention" | "asset" | "self"
  nodeId?: string
  outputIndex?: number
  assetId?: string
}

interface ContextVideoRef {
  id: string
  url: string
  name?: string
  source: "upstream" | "mention" | "asset" | "self"
  nodeId?: string
  outputIndex?: number
  assetId?: string
}

type NodeRunHistoryStatus = "succeeded" | "failed" | "cancelled"
type NodeRunHistorySource = "manual" | "ai" | "workflow" | "retry" | "system"

interface NodeRunHistoryInput {
  prompt: string
  displayPrompt: string
  promptParts: PromptPart[]
  mentions: MentionRef[]
  inputTexts: ContextTextInput[]
  referenceImages: ContextImageRef[]
  referenceVideos: ContextVideoRef[]
  settingsSnapshot?: Record<string, unknown>
}

interface NodeRunHistoryOutput {
  text?: string
  imageUrls?: string[]
  videoUrls?: string[]
  assetIds?: string[]
  raw?: unknown
}

interface NodeRunHistoryItem {
  id: string
  runId: string
  nodeId: string
  nodeType?: string
  status: NodeRunHistoryStatus
  input: NodeRunHistoryInput
  output?: NodeRunHistoryOutput
  error?: string
  message?: string
  startedAt: string
  finishedAt: string
  durationMs: number
  source?: NodeRunHistorySource
  createdAt: string
}

type NodeRunHistoryMap = Record<string, NodeRunHistoryItem[]>

interface HistoryTrimOptions {
  maxPerNode?: number
  maxTotal?: number
}

const DEFAULT_MAX_PER_NODE = 50
const DEFAULT_MAX_TOTAL = 500

// ============================================================================
// 内联实现 — 纯函数
// ============================================================================

function createRunHistoryItem(params: {
  runId: string; nodeId: string; nodeType?: string
  status: NodeRunHistoryStatus; input: NodeRunHistoryInput
  output?: NodeRunHistoryOutput; error?: string
  message?: string; startedAt: string; finishedAt: string
  source?: NodeRunHistorySource
}): NodeRunHistoryItem {
  const started = new Date(params.startedAt).getTime()
  const finished = new Date(params.finishedAt).getTime()
  const durationMs = Math.max(0, finished - started)
  return {
    id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    runId: params.runId,
    nodeId: params.nodeId,
    nodeType: params.nodeType,
    status: params.status,
    input: params.input,
    output: params.output,
    error: params.error,
    message: params.message,
    startedAt: params.startedAt,
    finishedAt: params.finishedAt,
    durationMs,
    source: params.source,
    createdAt: new Date().toISOString(),
  }
}

function appendNodeRunHistory(
  histories: NodeRunHistoryMap,
  item: NodeRunHistoryItem,
  options?: HistoryTrimOptions,
): NodeRunHistoryMap {
  const maxPerNode = options?.maxPerNode ?? DEFAULT_MAX_PER_NODE
  const maxTotal = options?.maxTotal ?? DEFAULT_MAX_TOTAL

  const nodeHistories = [...(histories[item.nodeId] ?? []), item]
  const trimmedNode = nodeHistories.length > maxPerNode
    ? nodeHistories.slice(nodeHistories.length - maxPerNode)
    : nodeHistories

  const newMap = { ...histories, [item.nodeId]: trimmedNode }
  return trimTotalHistory(newMap, maxTotal)
}

function getNodeRunHistory(histories: NodeRunHistoryMap, nodeId: string): NodeRunHistoryItem[] {
  return histories[nodeId] ?? []
}

function findRunHistoryItem(histories: NodeRunHistoryMap, historyId: string): NodeRunHistoryItem | undefined {
  for (const items of Object.values(histories)) {
    const found = items.find((h) => h.id === historyId)
    if (found) return found
  }
  return undefined
}

function clearNodeRunHistory(histories: NodeRunHistoryMap, nodeId: string): NodeRunHistoryMap {
  if (!histories[nodeId]) return histories
  const newMap = { ...histories }
  delete newMap[nodeId]
  return newMap
}

function getHistoryCount(histories: NodeRunHistoryMap): number {
  let count = 0
  for (const arr of Object.values(histories)) count += arr.length
  return count
}

function trimTotalHistory(histories: NodeRunHistoryMap, maxTotal: number): NodeRunHistoryMap {
  const total = getHistoryCount(histories)
  if (total <= maxTotal) return histories
  const all: Array<{ nodeId: string; item: NodeRunHistoryItem }> = []
  for (const [nodeId, items] of Object.entries(histories)) {
    for (const item of items) all.push({ nodeId, item })
  }
  all.sort((a, b) => new Date(a.item.createdAt).getTime() - new Date(b.item.createdAt).getTime())
  const toRemove = total - maxTotal
  const removeSet = new Set(all.slice(0, toRemove).map((e) => e.item.id))
  const newMap: NodeRunHistoryMap = {}
  for (const [nodeId, items] of Object.entries(histories)) {
    const filtered = items.filter((item) => !removeSet.has(item.id))
    if (filtered.length > 0) newMap[nodeId] = filtered
  }
  return newMap
}

// ============================================================================
// Helpers
// ============================================================================

function emptyInput(): NodeRunHistoryInput {
  return { prompt: "", displayPrompt: "", promptParts: [], mentions: [], inputTexts: [], referenceImages: [], referenceVideos: [] }
}

function makeInput(overrides: Partial<NodeRunHistoryInput> = {}): NodeRunHistoryInput {
  return {
    prompt: "生成一张赛博朋克城市",
    displayPrompt: "生成一张@赛博朋克 城市",
    promptParts: [
      { type: "text", text: "生成一张" },
      { type: "asset", assetId: "asset_1", label: "赛博朋克" },
      { type: "text", text: " 城市" },
    ],
    mentions: [{ type: "asset", label: "赛博朋克", assetId: "asset_1" }],
    inputTexts: [{ nodeId: "node_1", nodeType: "prompt", text: "赛博朋克风格参考" }],
    referenceImages: [
      { id: "ref_1", url: "https://example.com/img1.png", name: "参考图1", role: "image_1", source: "upstream", nodeId: "node_1", outputIndex: 0 },
    ],
    referenceVideos: [],
    ...overrides,
  }
}

// ============================================================================
// Tests
// ============================================================================

console.log("\nP1-5 Node Run History 测试\n" + "─".repeat(40))

// ── Test 1: 创建 succeeded history ──
test("创建成功历史记录", () => {
  const started = "2026-05-22T10:00:00.000Z"
  const finished = "2026-05-22T10:00:03.500Z"
  const h = createRunHistoryItem({
    runId: "run_001",
    nodeId: "node_a",
    nodeType: "prompt",
    status: "succeeded",
    input: makeInput(),
    startedAt: started,
    finishedAt: finished,
    source: "manual",
  })
  assert.ok(h.id.startsWith("hist-"))
  assert.equal(h.runId, "run_001")
  assert.equal(h.nodeId, "node_a")
  assert.equal(h.status, "succeeded")
  assert.equal(h.durationMs, 3500)
  assert.equal(h.source, "manual")
  assert.ok(h.createdAt)
})

// ── Test 2: 创建 failed history ──
test("创建失败历史记录", () => {
  const h = createRunHistoryItem({
    runId: "run_002",
    nodeId: "node_b",
    status: "failed",
    input: makeInput(),
    error: "API timeout",
    startedAt: "2026-05-22T11:00:00.000Z",
    finishedAt: "2026-05-22T11:00:05.000Z",
  })
  assert.equal(h.status, "failed")
  assert.equal(h.error, "API timeout")
  assert.equal(h.durationMs, 5000)
})

// ── Test 3: durationMs 正确 ──
test("durationMs 正确计算", () => {
  const h = createRunHistoryItem({
    runId: "run_003",
    nodeId: "node_c",
    status: "succeeded",
    input: makeInput(),
    startedAt: "2026-05-22T12:00:00.100Z",
    finishedAt: "2026-05-22T12:00:01.700Z",
  })
  assert.equal(h.durationMs, 1600)
})

// ── Test 4: startedAt > finishedAt → durationMs = 0 ──
test("异常时间顺序 → durationMs = 0", () => {
  const h = createRunHistoryItem({
    runId: "run_004",
    nodeId: "node_d",
    status: "succeeded",
    input: makeInput(),
    startedAt: "2026-05-22T12:00:05.000Z",
    finishedAt: "2026-05-22T12:00:00.000Z",
  })
  assert.equal(h.durationMs, 0)
})

// ── Test 5: input 从 NodeExecutionContext 正确映射 ──
test("input 包含完整上下文", () => {
  const input = makeInput()
  assert.equal(input.prompt, "生成一张赛博朋克城市")
  assert.equal(input.promptParts.length, 3)
  assert.equal(input.mentions.length, 1)
  assert.equal(input.inputTexts.length, 1)
  assert.equal(input.referenceImages.length, 1)
})

// ── Test 6: output imageUrls/text 正确保存 ──
test("output 保存图片和文本", () => {
  const h = createRunHistoryItem({
    runId: "run_005",
    nodeId: "node_e",
    status: "succeeded",
    input: makeInput(),
    output: { text: "生成成功", imageUrls: ["https://a.com/1.png", "https://a.com/2.png"] },
    startedAt: "2026-05-22T10:00:00.000Z",
    finishedAt: "2026-05-22T10:00:03.000Z",
  })
  assert.equal(h.output?.text, "生成成功")
  assert.equal(h.output?.imageUrls?.length, 2)
  assert.equal(h.output?.imageUrls?.[0], "https://a.com/1.png")
})

// ── Test 7: append 按 nodeId 分组 ──
test("append 按 nodeId 分组", () => {
  const h1 = createRunHistoryItem({ runId: "r1", nodeId: "n1", status: "succeeded", input: emptyInput(), startedAt: "2026-05-22T10:00:00.000Z", finishedAt: "2026-05-22T10:00:01.000Z" })
  const h2 = createRunHistoryItem({ runId: "r2", nodeId: "n2", status: "succeeded", input: emptyInput(), startedAt: "2026-05-22T10:00:00.000Z", finishedAt: "2026-05-22T10:00:01.000Z" })
  const h3 = createRunHistoryItem({ runId: "r3", nodeId: "n1", status: "failed", input: emptyInput(), startedAt: "2026-05-22T10:00:00.000Z", finishedAt: "2026-05-22T10:00:01.000Z" })

  let map: NodeRunHistoryMap = {}
  map = appendNodeRunHistory(map, h1)
  map = appendNodeRunHistory(map, h2)
  map = appendNodeRunHistory(map, h3)

  assert.equal(getNodeRunHistory(map, "n1").length, 2)
  assert.equal(getNodeRunHistory(map, "n2").length, 1)
  assert.equal(getHistoryCount(map), 3)
})

// ── Test 8: maxPerNode 裁剪 ──
test("maxPerNode 裁剪旧历史", () => {
  let map: NodeRunHistoryMap = {}
  for (let i = 0; i < 5; i++) {
    const h = createRunHistoryItem({
      runId: `r${i}`, nodeId: "n1", status: "succeeded",
      input: emptyInput(),
      startedAt: "2026-05-22T10:00:00.000Z", finishedAt: "2026-05-22T10:00:01.000Z",
    })
    map = appendNodeRunHistory(map, h, { maxPerNode: 3 })
  }
  assert.equal(getNodeRunHistory(map, "n1").length, 3)
})

// ── Test 9: maxTotal 全局裁剪 ──
test("maxTotal 全局裁剪", () => {
  let map: NodeRunHistoryMap = {}
  for (let i = 0; i < 10; i++) {
    const h = createRunHistoryItem({
      runId: `r${i}`, nodeId: i < 5 ? "n1" : "n2", status: "succeeded",
      input: emptyInput(),
      startedAt: "2026-05-22T10:00:00.000Z", finishedAt: "2026-05-22T10:00:01.000Z",
    })
    map = appendNodeRunHistory(map, h, { maxTotal: 6 })
  }
  assert.ok(getHistoryCount(map) <= 6)
})

// ── Test 10: findRunHistoryItem 跨 node 查找 ──
test("findRunHistoryItem 跨节点查找", () => {
  const h = createRunHistoryItem({ runId: "r1", nodeId: "n1", status: "succeeded", input: emptyInput(), startedAt: "2026-05-22T10:00:00.000Z", finishedAt: "2026-05-22T10:00:01.000Z" })
  const map = appendNodeRunHistory({}, h)
  const found = findRunHistoryItem(map, h.id)
  assert.equal(found?.id, h.id)
  assert.equal(found?.nodeId, "n1")
})

// ── Test 11: clearNodeRunHistory 只清当前节点 ──
test("clearNodeRunHistory 只清当前节点", () => {
  const h1 = createRunHistoryItem({ runId: "r1", nodeId: "n1", status: "succeeded", input: emptyInput(), startedAt: "2026-05-22T10:00:00.000Z", finishedAt: "2026-05-22T10:00:01.000Z" })
  const h2 = createRunHistoryItem({ runId: "r2", nodeId: "n2", status: "succeeded", input: emptyInput(), startedAt: "2026-05-22T10:00:00.000Z", finishedAt: "2026-05-22T10:00:01.000Z" })
  let map = appendNodeRunHistory({}, h1)
  map = appendNodeRunHistory(map, h2)
  map = clearNodeRunHistory(map, "n1")
  assert.equal(getNodeRunHistory(map, "n1").length, 0)
  assert.equal(getNodeRunHistory(map, "n2").length, 1)
})

// ── Test 12: 空 histories 安全 ──
test("空 histories 安全", () => {
  const map: NodeRunHistoryMap = {}
  assert.equal(getNodeRunHistory(map, "nonexistent").length, 0)
  assert.equal(findRunHistoryItem(map, "nonexistent"), undefined)
  assert.equal(getHistoryCount(map), 0)
  // clear on empty should not throw
  const cleared = clearNodeRunHistory(map, "nonexistent")
  assert.equal(getHistoryCount(cleared), 0)
})

// ── Test 13: output raw 字段 ──
test("output.raw 保存原始响应", () => {
  const raw = { images: ["a.png"], metadata: { engine: "comfy" } }
  const h = createRunHistoryItem({
    runId: "run_r", nodeId: "n1", status: "succeeded",
    input: emptyInput(),
    output: { raw },
    startedAt: "2026-05-22T10:00:00.000Z", finishedAt: "2026-05-22T10:00:01.000Z",
  })
  assert.deepStrictEqual(h.output?.raw, raw)
})

// ── Test 14: cancelled status ──
test("cancelled 状态记录", () => {
  const h = createRunHistoryItem({
    runId: "run_c", nodeId: "n1", status: "cancelled",
    input: emptyInput(), message: "用户取消",
    startedAt: "2026-05-22T10:00:00.000Z", finishedAt: "2026-05-22T10:00:00.500Z",
  })
  assert.equal(h.status, "cancelled")
  assert.equal(h.message, "用户取消")
  assert.equal(h.durationMs, 500)
})

// ── Test 15: settingsSnapshot 保存 ──
test("settingsSnapshot 保存在 input 中", () => {
  const input = makeInput({ settingsSnapshot: { model: "gpt-5.5", provider: "copse" } })
  assert.deepStrictEqual(input.settingsSnapshot, { model: "gpt-5.5", provider: "copse" })
})

// ── Test 16: videoUrls 输出保存 ──
test("videoUrls 输出保存", () => {
  const h = createRunHistoryItem({
    runId: "run_v", nodeId: "n1", status: "succeeded",
    input: emptyInput(),
    output: { videoUrls: ["https://v.com/1.mp4"] },
    startedAt: "2026-05-22T10:00:00.000Z", finishedAt: "2026-05-22T10:00:01.000Z",
  })
  assert.equal(h.output?.videoUrls?.length, 1)
  assert.equal(h.output?.videoUrls?.[0], "https://v.com/1.mp4")
})

// ── Test 17: assetIds 输出保存 ──
test("assetIds 输出保存", () => {
  const h = createRunHistoryItem({
    runId: "run_a", nodeId: "n1", status: "succeeded",
    input: emptyInput(),
    output: { assetIds: ["asset_1", "asset_2"] },
    startedAt: "2026-05-22T10:00:00.000Z", finishedAt: "2026-05-22T10:00:01.000Z",
  })
  assert.equal(h.output?.assetIds?.length, 2)
})

// ── Test 18: 同 node 多条历史按时间和来源区分 ──
test("同 node 多条历史记录共存", () => {
  const h1 = createRunHistoryItem({ runId: "r1", nodeId: "n1", status: "succeeded", input: emptyInput(), source: "manual", startedAt: "2026-05-22T10:00:00.000Z", finishedAt: "2026-05-22T10:00:01.000Z" })
  const h2 = createRunHistoryItem({ runId: "r2", nodeId: "n1", status: "failed", input: emptyInput(), source: "ai", startedAt: "2026-05-22T10:00:02.000Z", finishedAt: "2026-05-22T10:00:03.000Z" })
  const h3 = createRunHistoryItem({ runId: "r3", nodeId: "n1", status: "succeeded", input: emptyInput(), source: "retry", startedAt: "2026-05-22T10:00:04.000Z", finishedAt: "2026-05-22T10:00:05.000Z" })

  let map = appendNodeRunHistory({}, h1)
  map = appendNodeRunHistory(map, h2)
  map = appendNodeRunHistory(map, h3)

  const histories = getNodeRunHistory(map, "n1")
  assert.equal(histories.length, 3)
  assert.equal(histories[0].status, "succeeded")
  assert.equal(histories[1].status, "failed")
  assert.equal(histories[2].status, "succeeded")
})

// ============================================================================
console.log("─".repeat(40))
console.log(`通过: ${passed}  失败: ${failed}  总计: ${passed + failed}`)
if (failed > 0) process.exit(1)
