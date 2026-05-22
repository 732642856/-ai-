#!/usr/bin/env node --experimental-strip-types
// ============================================================================
// V1 Video E2E Tests — Mock 帧生成 + Mock 分析 + 执行计划级联
// ============================================================================
// 运行方式：node --experimental-strip-types utils/execution-plan-video.test.ts
// ============================================================================

export {} // make this a module

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
  deepEqual(actual: unknown, expected: unknown, msg?: string) {
    this.equal(actual, expected, msg)
  },
  notEqual(actual: unknown, expected: unknown, msg?: string) {
    const a = JSON.stringify(actual)
    const e = JSON.stringify(expected)
    if (a === e) throw new Error(`${msg ?? "should not be equal"}\n  both: ${e}`)
  },
  includes(arr: unknown[], val: unknown, msg?: string) {
    if (!arr.includes(val)) {
      throw new Error(`${msg ?? `expected ${JSON.stringify(val)} to be in ${JSON.stringify(arr)}`}`)
    }
  },
  throws(fn: () => void, _expected?: unknown, msg?: string) {
    let threw = false
    try { fn() } catch { threw = true }
    if (!threw) throw new Error(msg ?? "expected to throw")
  },
  greaterThan(actual: number, expected: number, msg?: string) {
    if (!(actual > expected)) {
      throw new Error(`${msg ?? `expected ${actual} > ${expected}`}`)
    }
  },
  lessThanOrEqual(actual: number, expected: number, msg?: string) {
    if (!(actual <= expected)) {
      throw new Error(`${msg ?? `expected ${actual} <= ${expected}`}`)
    }
  },
}

// ============================================================================
// Test 1: generateMockFrameUrls — 基础行为
// ============================================================================
async function test1_generateMockFrameUrls() {
  console.log("\n  Test 1: generateMockFrameUrls 基础行为")

  const { generateMockFrameUrls, MAX_MOCK_FRAMES } = await import("./mock-video-analyzer.ts")

  // 正常生成
  const frames = generateMockFrameUrls("video-001", 4)
  assert.equal(frames.length, 4, "应生成 4 个帧")
  assert.equal(frames[0].sourceVideoId, "video-001", "帧的 sourceVideoId 正确")
  assert.equal(frames[0].frameIndex, 0, "第一帧 index = 0")
  assert.equal(frames[0].timestampMs, 0, "第一帧 timestamp = 0ms")
  assert.ok(frames[0].imageUrl.startsWith("data:image/svg+xml"), "帧 URL 是 SVG data URL")
  assert.equal(frames[3].timestampMs, 3000, "第四帧 timestamp = 3000ms")

  // 超过上限
  const capped = generateMockFrameUrls("video-002", 20)
  assert.lessThanOrEqual(capped.length, MAX_MOCK_FRAMES, "超过上限应截断")

  // 零帧
  const empty = generateMockFrameUrls("video-003", 0)
  assert.equal(empty.length, 0, "count=0 应返回空数组")

  console.log("  ✓ Test 1 passed")
}

// ============================================================================
// Test 2: runMockVideoAnalyze — Mock 分析结果
// ============================================================================
async function test2_runMockVideoAnalyze() {
  console.log("\n  Test 2: runMockVideoAnalyze Mock 分析")

  const { generateMockFrameUrls, runMockVideoAnalyze } = await import("./mock-video-analyzer.ts")

  // 有帧的情况
  const frames = generateMockFrameUrls("video-001", 4)
  const result = runMockVideoAnalyze(frames)
  assert.ok(result.summary.length > 0, "应有摘要")
  assert.ok(result.summary.includes("4"), "摘要应包含帧数量")
  assert.equal(result.keyframes.length, 4, "关键帧数量为 4")
  assert.ok(result.captions !== undefined, "captions 字段存在")
  assert.ok(result.events !== undefined, "events 字段存在")
  assert.ok(result.objects !== undefined, "objects 字段存在")
  assert.ok(result.raw !== undefined, "raw 字段存在")
  assert.equal((result.raw as any)?.mode, "mock", "raw.mode = mock")
  assert.equal((result.raw as any)?.frameCount, 4, "raw.frameCount = 4")

  // 无帧的情况
  const empty = runMockVideoAnalyze([])
  assert.ok(empty.summary.includes("未检测到上游帧数据"), "空帧应有提示")
  assert.equal(empty.keyframes.length, 0, "空帧时关键帧列表为空")
  assert.equal((empty.raw as any)?.frameCount, 0, "raw.frameCount = 0")

  console.log("  ✓ Test 2 passed")
}

// ============================================================================
// Test 3: VideoAnalysisResult 类型结构完整性
// ============================================================================
async function test3_videoAnalysisResultType() {
  console.log("\n  Test 3: VideoAnalysisResult 类型结构完整性")

  const { generateMockFrameUrls, runMockVideoAnalyze } = await import("./mock-video-analyzer.ts")

  const frames = generateMockFrameUrls("video-001", 3)
  const result = runMockVideoAnalyze(frames)

  // 验证关键帧结构
  const kf = result.keyframes[0]
  assert.ok(typeof kf.sourceVideoId === "string", "sourceVideoId 应为字符串")
  assert.ok(typeof kf.timestampMs === "number", "timestampMs 应为数字")
  assert.ok(typeof kf.frameIndex === "number", "frameIndex 应为数字")
  assert.ok(typeof kf.imageUrl === "string", "imageUrl 应为字符串")

  // 验证 summary
  assert.ok(typeof result.summary === "string", "summary 应为字符串")

  // 验证可选字段存在
  assert.ok(Array.isArray(result.captions), "captions 应为数组")
  assert.ok(Array.isArray(result.events), "events 应为数组")
  assert.ok(Array.isArray(result.objects), "objects 应为数组")

  console.log("  ✓ Test 3 passed")
}

// ============================================================================
// Test 4: 帧数据时间戳化验证
// ============================================================================
async function test4_frameTimestamping() {
  console.log("\n  Test 4: 帧数据时间戳化验证")

  const { generateMockFrameUrls } = await import("./mock-video-analyzer.ts")

  const frames = generateMockFrameUrls("video-src", 5)
  assert.equal(frames.length, 5, "生成 5 帧")

  // 验证时间戳单调递增
  for (let i = 1; i < frames.length; i++) {
    assert.ok(
      frames[i].timestampMs > frames[i - 1].timestampMs,
      `帧 ${i} 时间戳应大于帧 ${i - 1}`,
    )
  }

  // 验证每帧都有时间戳和帧序号
  for (let i = 0; i < frames.length; i++) {
    assert.equal(frames[i].frameIndex, i, `帧 ${i} index = ${i}`)
    assert.ok(frames[i].timestampMs >= 0, `帧 ${i} timestampMs >= 0`)
    assert.equal(frames[i].sourceVideoId, "video-src", "整个批次 sourceVideoId 一致")
  }

  console.log("  ✓ Test 4 passed")
}

// ============================================================================
// Test 5: Mock 结果去重 — sourceVideoIds
// ============================================================================
async function test5_sourceVideoIdsDedup() {
  console.log("\n  Test 5: sourceVideoIds 去重")

  const { generateMockFrameUrls, runMockVideoAnalyze } = await import("./mock-video-analyzer.ts")

  // 模拟多来源帧混合
  const framesA = generateMockFrameUrls("video-A", 2)
  const framesB = generateMockFrameUrls("video-B", 2)
  const mixed = [...framesA, ...framesB]

  const result = runMockVideoAnalyze(mixed)
  const raw = result.raw as any
  const ids: string[] = raw?.sourceVideoIds ?? []
  assert.equal(ids.length, 2, "去重后应有 2 个 sourceVideoId")
  assert.includes(ids, "video-A", "包含 video-A")
  assert.includes(ids, "video-B", "包含 video-B")

  console.log("  ✓ Test 5 passed")
}

// ============================================================================
// Test 6: 安全限制验证
// ============================================================================
async function test6_safetyLimits() {
  console.log("\n  Test 6: 安全限制验证")

  const { generateMockFrameUrls, MAX_MOCK_FRAMES } = await import("./mock-video-analyzer.ts")

  // 超过上限
  const frames = generateMockFrameUrls("video-safe", MAX_MOCK_FRAMES + 10)
  assert.equal(frames.length, MAX_MOCK_FRAMES, `应限制在 ${MAX_MOCK_FRAMES} 帧`)

  // 负数
  const neg = generateMockFrameUrls("video-neg", -1)
  assert.equal(neg.length, 0, "负数应返回 0 帧")

  console.log("  ✓ Test 6 passed")
}

// ============================================================================
// Runner
// ============================================================================

console.log("\n========================================")
console.log("  Video V1 E2E Tests")
console.log("========================================")

let passed = 0
let failed = 0
const tests = [
  test1_generateMockFrameUrls,
  test2_runMockVideoAnalyze,
  test3_videoAnalysisResultType,
  test4_frameTimestamping,
  test5_sourceVideoIdsDedup,
  test6_safetyLimits,
]

for (const testFn of tests) {
  try {
    await testFn()
    passed++
  } catch (e) {
    failed++
    console.error(`\n  ✗ FAILED:`, (e as Error).message)
  }
}

console.log(`\n========================================`)
console.log(`  Results: ${passed} passed, ${failed} failed`)
console.log(`========================================\n`)

if (failed > 0) process.exit(1)
