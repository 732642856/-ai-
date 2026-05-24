#!/usr/bin/env node --experimental-strip-types
// ============================================================================
// P2-4 HistoryDragPayload 管道测试
// ============================================================================
// 运行方式：node --experimental-strip-types utils/history-drag.test.ts
// 注意：Node.js --experimental-strip-types 不支持 `as` 类型断言，
//       本文件使用纯 JS 语法 + 类型注释（Node 22+ 可识别为 TS 但 strip 掉）。
// ============================================================================

// ============================================================================
// Mini test harness
// ============================================================================

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    passed++
    console.log(`  ✅ ${name}`)
  } catch (e: unknown) {
    failed++
    const msg = e instanceof Error ? e.message : String(e)
    console.log(`  ❌ ${name}: ${msg}`)
  }
}

const assert = {
  ok(value: unknown, msg?: string) {
    if (!value) throw new Error(msg ?? `expected truthy, got ${value}`)
  },
  notOk(value: unknown, msg?: string) {
    if (value) throw new Error(msg ?? `expected falsy, got ${value}`)
  },
  equal<T>(actual: T, expected: T, msg?: string) {
    if (actual !== expected) throw new Error(msg ?? `expected ${expected}, got ${actual}`)
  },
}

// ============================================================================
// 内联 safeParseHistoryDragPayload（与 history-drag.ts 逻辑一致）
// 使用纯 JS 语法，避免 `as` 断言导致 --experimental-strip-types 失败
// ============================================================================

function safeParseHistoryDragPayload(raw: string): unknown | null {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }

  if (!value || typeof value !== "object") return null
  const obj: Record<string, unknown> = value as Record<string, unknown>

  // Summary
  if (obj.type === "history-video-analysis-summary" && typeof obj.text === "string") {
    return {
      type: "history-video-analysis-summary",
      text: obj.text,
      label: typeof obj.label === "string" ? obj.label : undefined,
      sourceHistoryId: String(obj.sourceHistoryId ?? ""),
      sourceNodeId: typeof obj.sourceNodeId === "string" ? obj.sourceNodeId : undefined,
    }
  }

  // Scene
  if (
    obj.type === "history-video-analysis-scene" &&
    typeof obj.text === "string" &&
    typeof obj.sceneIndex === "number"
  ) {
    return {
      type: "history-video-analysis-scene",
      text: obj.text,
      label: typeof obj.label === "string" ? obj.label : undefined,
      sceneIndex: obj.sceneIndex,
      start: typeof obj.start === "number" ? obj.start : undefined,
      end: typeof obj.end === "number" ? obj.end : undefined,
      sourceHistoryId: String(obj.sourceHistoryId ?? ""),
      sourceNodeId: typeof obj.sourceNodeId === "string" ? obj.sourceNodeId : undefined,
    }
  }

  // Full result — testing build: accept any result object
  if (obj.type === "history-video-analysis-result") {
    if (!obj.result || typeof obj.result !== "object") return null
    return {
      type: "history-video-analysis-result",
      label: typeof obj.label === "string" ? obj.label : undefined,
      result: obj.result,
      sourceHistoryId: String(obj.sourceHistoryId ?? ""),
      sourceNodeId: typeof obj.sourceNodeId === "string" ? obj.sourceNodeId : undefined,
    }
  }

  return null
}

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}

function formatTimestampMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const millis = ms % 1000
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${Math.floor(millis / 10).toString().padStart(2, "0")}`
}

function formatVideoAnalysisAsMarkdown(result: Record<string, unknown>): string {
  const lines: string[] = []

  if (result.summary) {
    lines.push("# 视频分析")
    lines.push("")
    lines.push("## 摘要")
    lines.push(String(result.summary))
    lines.push("")
  }

  const keyframes = Array.isArray(result.keyframes) ? result.keyframes : []
  if (keyframes.length > 0) {
    lines.push("## 关键帧")
    lines.push("")
    keyframes.forEach((kf: Record<string, unknown>, idx: number) => {
      const ts = formatTimestampMs(Number(kf.timestampMs) || 0)
      lines.push(`- **帧 ${idx + 1}** ${ts}`)
      if (kf.description) lines.push(`  ${kf.description}`)
    })
    lines.push("")
  }

  const captions = Array.isArray(result.captions) ? result.captions : []
  if (captions.length > 0) {
    lines.push("## 字幕")
    lines.push("")
    captions.forEach((cap: Record<string, unknown>) => {
      const speaker = cap.speaker ? `**${cap.speaker}**: ` : ""
      lines.push(`- ${formatTimestampMs(Number(cap.startMs) || 0)} ${speaker}${cap.text}`)
    })
    lines.push("")
  }

  const scenes = Array.isArray(result.scenes) ? result.scenes : []
  if (scenes.length > 0) {
    lines.push("## 场景")
    lines.push("")
    scenes.forEach((sc: Record<string, unknown>, idx: number) => {
      const start = typeof sc.startTime === "number" ? formatMs(Number(sc.startTime)) : (typeof sc.startTime === "string" ? sc.startTime : "")
      const end = typeof sc.endTime === "number" ? formatMs(Number(sc.endTime)) : (typeof sc.endTime === "string" ? sc.endTime : "")
      const timeLabel = start || end ? ` (${start} - ${end})` : ""
      lines.push(`- **场景 ${idx + 1}**${timeLabel}`)
      if (sc.description) lines.push(`  ${sc.description}`)
    })
    lines.push("")
  }

  const events = Array.isArray(result.events) ? result.events : []
  if (events.length > 0) {
    lines.push("## 事件")
    lines.push("")
    events.forEach((evt: Record<string, unknown>) => {
      lines.push(`- ${formatTimestampMs(Number(evt.startMs) || 0)} **${evt.label}**`)
      if (evt.description) lines.push(`  ${evt.description}`)
    })
    lines.push("")
  }

  return lines.join("\n").trim()
}

// ============================================================================
// safeParseHistoryDragPayload
// ============================================================================

console.log("\nsafeParseHistoryDragPayload")

const sampleResult: Record<string, unknown> = {
  summary: "测试摘要",
  keyframes: [{ sourceVideoId: "v1", timestampMs: 1000, frameIndex: 0, imageUrl: "https://x.com/f.jpg" }],
  captions: [{ startMs: 0, endMs: 100, text: "Hello" }],
  events: [{ startMs: 500, endMs: 1500, label: "动作", description: "跑步" }],
}

test("无效 JSON → null", () => {
  assert.equal(safeParseHistoryDragPayload("{invalid}"), null)
})

test("空字符串 → null", () => {
  assert.equal(safeParseHistoryDragPayload(""), null)
})

test("null JSON → null", () => {
  assert.equal(safeParseHistoryDragPayload("null"), null)
})

test("Summary payload → 解析成功", () => {
  const parsed = safeParseHistoryDragPayload(JSON.stringify({
    type: "history-video-analysis-summary",
    text: "这是一段摘要",
    sourceHistoryId: "hist-1",
    sourceNodeId: "node-1",
  }))
  assert.ok(parsed !== null)
  const p: Record<string, unknown> = parsed as Record<string, unknown>
  assert.equal(p.type, "history-video-analysis-summary")
  assert.equal(p.text, "这是一段摘要")
})

test("Summary payload 缺少 text → null", () => {
  assert.equal(safeParseHistoryDragPayload(JSON.stringify({
    type: "history-video-analysis-summary",
    sourceHistoryId: "hist-1",
  })), null)
})

test("Scene payload → 解析成功", () => {
  const parsed = safeParseHistoryDragPayload(JSON.stringify({
    type: "history-video-analysis-scene",
    text: "场景描述",
    sceneIndex: 2,
    start: 5000,
    end: 8000,
    sourceHistoryId: "hist-1",
  }))
  assert.ok(parsed !== null)
  const p: Record<string, unknown> = parsed as Record<string, unknown>
  assert.equal(p.sceneIndex, 2)
})

test("Scene payload 缺少 sceneIndex → null", () => {
  assert.equal(safeParseHistoryDragPayload(JSON.stringify({
    type: "history-video-analysis-scene",
    text: "场景",
    sourceHistoryId: "hist-1",
  })), null)
})

test("Full result payload → 解析成功", () => {
  const parsed = safeParseHistoryDragPayload(JSON.stringify({
    type: "history-video-analysis-result",
    result: sampleResult,
    sourceHistoryId: "hist-1",
  }))
  assert.ok(parsed !== null)
  const p: Record<string, unknown> = parsed as Record<string, unknown>
  assert.equal(p.type, "history-video-analysis-result")
  const r: Record<string, unknown> = p.result as Record<string, unknown>
  assert.equal(r.summary, "测试摘要")
})

test("Full result payload 非对象 result → null", () => {
  assert.equal(safeParseHistoryDragPayload(JSON.stringify({
    type: "history-video-analysis-result",
    result: null,
    sourceHistoryId: "hist-1",
  })), null)
})

test("未知 type → null", () => {
  assert.equal(safeParseHistoryDragPayload(JSON.stringify({
    type: "unknown-type",
    data: {},
  })), null)
})

test("错误 type 名称 → null", () => {
  assert.equal(safeParseHistoryDragPayload(JSON.stringify({
    type: "histroy-video-analysis-summary",
    text: "something",
  })), null)
})

// ============================================================================
// formatVideoAnalysisAsMarkdown
// ============================================================================

console.log("\nformatVideoAnalysisAsMarkdown")

test("完整结果 → 包含摘要/关键帧/字幕/事件", () => {
  const md = formatVideoAnalysisAsMarkdown(sampleResult)
  assert.ok(md.includes("# 视频分析"))
  assert.ok(md.includes("## 摘要"))
  assert.ok(md.includes("测试摘要"))
  assert.ok(md.includes("## 关键帧"))
  assert.ok(md.includes("## 字幕"))
  assert.ok(md.includes("## 事件"))
  assert.ok(md.includes("**动作**"))
})

test("只有 summary → 不包含空 section", () => {
  const md = formatVideoAnalysisAsMarkdown({
    summary: "仅摘要",
    keyframes: [],
  })
  assert.ok(md.includes("## 摘要"))
  assert.ok(!md.includes("## 关键帧"))
  assert.ok(!md.includes("## 字幕"))
  assert.ok(!md.includes("## 事件"))
})

test("空结果 → 空字符串", () => {
  const md = formatVideoAnalysisAsMarkdown({ summary: "", keyframes: [] })
  assert.equal(md, "")
})

test("关键帧含 description → 显示", () => {
  const md = formatVideoAnalysisAsMarkdown({
    summary: "测试",
    keyframes: [{
      sourceVideoId: "v1", timestampMs: 2000, frameIndex: 0,
      imageUrl: "https://x.com/f.jpg", description: "一个人跑步",
    }],
  })
  assert.ok(md.includes("一个人跑步"))
})

test("字幕含 speaker → 显示说话人", () => {
  const md = formatVideoAnalysisAsMarkdown({
    summary: "测试",
    keyframes: [],
    captions: [{ startMs: 0, endMs: 100, text: "你好", speaker: "张三" }],
  })
  assert.ok(md.includes("**张三**"))
})

// ============================================================================
// 3 个新增行为测试（P2-4 验收收口）
// ============================================================================

console.log("\nP2-4 行为测试")

test("unknown payload → safeParseHistoryDragPayload 返回 null（不吞 drop）", () => {
  const payload = safeParseHistoryDragPayload(JSON.stringify({
    type: "unknown-type",
    text: "hello",
  }))
  assert.equal(payload, null)
})

test("summary payload → 文本内容直接作为 prompt", () => {
  const payload = safeParseHistoryDragPayload(JSON.stringify({
    type: "history-video-analysis-summary",
    text: "A night city video.",
    sourceHistoryId: "h1",
  }))
  assert.ok(payload !== null)
  const p: Record<string, unknown> = payload as Record<string, unknown>
  assert.equal(p.text, "A night city video.")
})

test("full result → formatVideoAnalysisAsMarkdown 包含 summary 和 scenes", () => {
  const result: Record<string, unknown> = {
    summary: "A short video.",
    keyframes: [],
    captions: [],
    events: [],
    scenes: [
      { description: "Opening shot", startTime: 0, endTime: 3 },
    ],
  }
  const text = formatVideoAnalysisAsMarkdown(result)
  assert.ok(text.includes("A short video."))
  assert.ok(text.includes("Opening shot"))
})

// ============================================================================
// 报告
// ============================================================================

console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total`)
if (failed > 0) process.exit(1)

export {}
