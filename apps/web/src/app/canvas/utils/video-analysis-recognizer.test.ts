#!/usr/bin/env node --experimental-strip-types
// ============================================================================
// V1.5 VideoAnalysisResult 识别函数测试
// ============================================================================
// 运行方式：node --experimental-strip-types utils/video-analysis-recognizer.test.ts
// ============================================================================

export {} // make this a module

import { isVideoAnalysisResult, getVideoAnalysisResult, getVideoAnalysisFromHistoryRaw, isTypedRawOutput } from "../types/video-analysis.ts"
import type { VideoAnalysisResult, TypedRawOutput } from "../types/video-analysis.ts"

const assert = {
  equal(actual: unknown, expected: unknown, msg?: string) {
    const a = JSON.stringify(actual)
    const e = JSON.stringify(expected)
    if (a !== e) {
      throw new Error(`${msg ?? "assertion failed"}\n  expected: ${e}\n  actual:   ${a}`)
    }
  },
  ok(val: unknown, msg?: string) {
    if (!val) throw new Error(msg ?? "expected truthy")
  },
  notOk(val: unknown, msg?: string) {
    if (val) throw new Error(msg ?? "expected falsy")
  },
}

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (err: any) {
    failed++
    console.log(`  ✗ ${name}`)
    console.log(`    ${err.message}`)
  }
}

// ============================================================================
// isVideoAnalysisResult — 类型守卫
// ============================================================================

console.log("\nisVideoAnalysisResult")

test("null → false", () => {
  assert.notOk(isVideoAnalysisResult(null))
})

test("undefined → false", () => {
  assert.notOk(isVideoAnalysisResult(undefined))
})

test("空对象 → false", () => {
  assert.notOk(isVideoAnalysisResult({}))
})

test("普通字符串 → false", () => {
  assert.notOk(isVideoAnalysisResult("hello"))
})

test("只有 summary 字符串 → true", () => {
  assert.ok(isVideoAnalysisResult({ summary: "这是一个视频摘要" }))
})

test("只有非空 keyframes → true", () => {
  assert.ok(isVideoAnalysisResult({
    keyframes: [{ sourceVideoId: "v1", timestampMs: 0, frameIndex: 0, imageUrl: "https://example.com/frame.jpg" }],
  }))
})

test("空 keyframes 数组 + 无 summary → false", () => {
  assert.notOk(isVideoAnalysisResult({ keyframes: [] }))
})

test("只有 captions 数组 → true", () => {
  assert.ok(isVideoAnalysisResult({
    captions: [{ startMs: 0, endMs: 1000, text: "Hello" }],
  }))
})

test("只有 events 数组 → true", () => {
  assert.ok(isVideoAnalysisResult({
    events: [{ startMs: 0, endMs: 1000, label: "爆炸" }],
  }))
})

test("完整 VideoAnalysisResult → true", () => {
  const full: VideoAnalysisResult = {
    summary: "测试摘要",
    keyframes: [{ sourceVideoId: "v1", timestampMs: 1000, frameIndex: 1, imageUrl: "https://example.com/f.jpg" }],
    captions: [{ startMs: 0, endMs: 500, text: "Hi" }],
    events: [{ startMs: 2000, endMs: 3000, label: "Action" }],
    objects: [{ label: "car", confidence: 0.9 }],
    raw: { mode: "mock" },
  }
  assert.ok(isVideoAnalysisResult(full))
})

test("数字 → false", () => {
  assert.notOk(isVideoAnalysisResult(42))
})

test("数组 → false", () => {
  assert.notOk(isVideoAnalysisResult([1, 2, 3]))
})

// ============================================================================
// getVideoAnalysisResult — 提取函数
// ============================================================================

console.log("\ngetVideoAnalysisResult")

test("直接 VideoAnalysisResult → 自身", () => {
  const result: VideoAnalysisResult = {
    summary: "直接结果",
    keyframes: [{ sourceVideoId: "v1", timestampMs: 0, frameIndex: 0, imageUrl: "https://example.com/f.jpg" }],
  }
  const extracted = getVideoAnalysisResult(result)
  assert.ok(extracted !== undefined)
  assert.equal(extracted!.summary, "直接结果")
})

test("包裹在 output.raw 中 → 提取成功", () => {
  const result: VideoAnalysisResult = {
    summary: "包裹结果",
    keyframes: [{ sourceVideoId: "v2", timestampMs: 0, frameIndex: 0, imageUrl: "https://example.com/f2.jpg" }],
  }
  // 模拟 sanitizeHistoryRawOutput 后的 output.raw
  const extracted = getVideoAnalysisResult(result)
  assert.ok(extracted !== undefined)
  assert.equal(extracted!.summary, "包裹结果")
})

test("{ videoAnalysis: VideoAnalysisResult } → 提取成功", () => {
  const inner: VideoAnalysisResult = {
    summary: "嵌套 videoAnalysis",
    keyframes: [{ sourceVideoId: "v3", timestampMs: 0, frameIndex: 0, imageUrl: "https://example.com/f3.jpg" }],
  }
  const extracted = getVideoAnalysisResult({ videoAnalysis: inner })
  assert.ok(extracted !== undefined)
  assert.equal(extracted!.summary, "嵌套 videoAnalysis")
})

test("{ result: VideoAnalysisResult } → 提取成功", () => {
  const inner: VideoAnalysisResult = {
    summary: "嵌套 result",
    keyframes: [{ sourceVideoId: "v4", timestampMs: 0, frameIndex: 0, imageUrl: "https://example.com/f4.jpg" }],
  }
  const extracted = getVideoAnalysisResult({ result: inner })
  assert.ok(extracted !== undefined)
  assert.equal(extracted!.summary, "嵌套 result")
})

test("非视频分析对象 → undefined", () => {
  assert.equal(getVideoAnalysisResult({ foo: "bar" }) as unknown, undefined)
})

test("null → undefined", () => {
  assert.equal(getVideoAnalysisResult(null) as unknown, undefined)
})

test("undefined → undefined", () => {
  assert.equal(getVideoAnalysisResult(undefined) as unknown, undefined)
})

test("普通字符串 → undefined", () => {
  assert.equal(getVideoAnalysisResult("hello") as unknown, undefined)
})

// ============================================================================
// getVideoAnalysisFromHistoryRaw — 历史 raw 专用提取（TypedRawOutput + legacy）
// ============================================================================

console.log("\ngetVideoAnalysisFromHistoryRaw")

const sampleResult: VideoAnalysisResult = {
  summary: "测试视频摘要",
  keyframes: [{ sourceVideoId: "v-test", timestampMs: 1000, frameIndex: 0, imageUrl: "https://example.com/f.jpg" }],
  captions: [{ startMs: 0, endMs: 500, text: "Hello" }],
}

test("TypedRawOutput { kind, version, data } → 提取成功", () => {
  const raw: TypedRawOutput<VideoAnalysisResult> = {
    kind: "video-analysis",
    version: 1,
    data: sampleResult,
  }
  const extracted = getVideoAnalysisFromHistoryRaw(raw)
  assert.ok(extracted !== undefined, "typed raw should extract")
  assert.equal(extracted!.summary, "测试视频摘要")
})

test("TypedRawOutput 不同 version → 仍可提取", () => {
  const raw: TypedRawOutput<VideoAnalysisResult> = {
    kind: "video-analysis",
    version: 2,
    data: sampleResult,
  }
  const extracted = getVideoAnalysisFromHistoryRaw(raw)
  assert.ok(extracted !== undefined, "不同 version 也应兼容")
})

test("TypedRawOutput 未知 kind → undefined", () => {
  const raw = {
    kind: "image-analysis",
    version: 1,
    data: sampleResult,
  }
  assert.equal(getVideoAnalysisFromHistoryRaw(raw) as unknown, undefined)
})

test("TypedRawOutput kind 缺失 → 降级到 legacy 识别", () => {
  // 如果 raw 是直接 VideoAnalysisResult（没有 kind 字段），走 legacy 路径
  const extracted = getVideoAnalysisFromHistoryRaw(sampleResult)
  assert.ok(extracted !== undefined, "legacy direct result should still work")
  assert.equal(extracted!.summary, "测试视频摘要")
})

test("TypedRawOutput data 不是 VideoAnalysisResult → undefined", () => {
  const raw = {
    kind: "video-analysis",
    version: 1,
    data: { foo: "bar" },
  }
  assert.equal(getVideoAnalysisFromHistoryRaw(raw) as unknown, undefined)
})

test("sanitize 截断后的 _truncated 对象 → undefined（安全降级）", () => {
  const truncated = {
    _truncated: true,
    _originalSize: 200000,
    _reason: "Output exceeded 100KB limit",
    summary: "{ summary: string(200), keyframes: object }",
  }
  assert.equal(getVideoAnalysisFromHistoryRaw(truncated) as unknown, undefined)
})

test("null → undefined", () => {
  assert.equal(getVideoAnalysisFromHistoryRaw(null) as unknown, undefined)
})

test("undefined → undefined", () => {
  assert.equal(getVideoAnalysisFromHistoryRaw(undefined) as unknown, undefined)
})

test("普通字符串 → undefined", () => {
  assert.equal(getVideoAnalysisFromHistoryRaw("hello") as unknown, undefined)
})

test("数字 → undefined", () => {
  assert.equal(getVideoAnalysisFromHistoryRaw(42) as unknown, undefined)
})

test("{ videoAnalysis: VideoAnalysisResult } 包裹 → 提取成功", () => {
  const extracted = getVideoAnalysisFromHistoryRaw({ videoAnalysis: sampleResult })
  assert.ok(extracted !== undefined)
  assert.equal(extracted!.summary, "测试视频摘要")
})

test("{ result: VideoAnalysisResult } 包裹 → 提取成功", () => {
  const extracted = getVideoAnalysisFromHistoryRaw({ result: sampleResult })
  assert.ok(extracted !== undefined)
  assert.equal(extracted!.summary, "测试视频摘要")
})

// ============================================================================
// isTypedRawOutput — 通用守卫
// ============================================================================

console.log("\nisTypedRawOutput")

test("null → false", () => {
  assert.notOk(isTypedRawOutput(null))
})

test("undefined → false", () => {
  assert.notOk(isTypedRawOutput(undefined))
})

test("string → false", () => {
  assert.notOk(isTypedRawOutput("hello"))
})

test("number → false", () => {
  assert.notOk(isTypedRawOutput(42))
})

test("plain object without kind → false", () => {
  assert.notOk(isTypedRawOutput({ data: [] }))
})

test("object with kind but no version → false", () => {
  assert.notOk(isTypedRawOutput({ kind: "test", data: {} }))
})

test("object with kind but no data field → false", () => {
  assert.notOk(isTypedRawOutput({ kind: "test", version: 1 }))
})

test("valid TypedRawOutput → true", () => {
  assert.ok(isTypedRawOutput({ kind: "video-analysis", version: 1, data: {} }))
})

test("kind empty string → false", () => {
  assert.notOk(isTypedRawOutput({ kind: "", version: 1, data: {} }))
})

test("version is NaN → false", () => {
  assert.notOk(isTypedRawOutput({ kind: "test", version: NaN, data: {} }))
})

test("version is Infinity → false", () => {
  assert.notOk(isTypedRawOutput({ kind: "test", version: Infinity, data: {} }))
})

test("任意 kind 字符串都接受（不限值）", () => {
  assert.ok(isTypedRawOutput({ kind: "image-analysis", version: 2, data: { foo: "bar" } }))
  assert.ok(isTypedRawOutput({ kind: "custom-whatever", version: 99, data: null }))
})

// ============================================================================
// 报告
// ============================================================================

console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total`)
if (failed > 0) process.exit(1)
