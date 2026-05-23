import assert from "node:assert/strict"
import test from "node:test"

import { cleanModel, resolveModelForTask } from "./model-resolve.ts"

// ============================================================================
// cleanModel
// ============================================================================

test("cleanModel: valid string returns trimmed value", () => {
  assert.equal(cleanModel("gpt-5.5"), "gpt-5.5")
  assert.equal(cleanModel("  gpt-5.5  "), "gpt-5.5")
})

test("cleanModel: empty / whitespace → undefined", () => {
  assert.equal(cleanModel(""), undefined)
  assert.equal(cleanModel("   "), undefined)
  assert.equal(cleanModel("\t"), undefined)
})

test("cleanModel: non-string → undefined", () => {
  assert.equal(cleanModel(undefined), undefined)
  assert.equal(cleanModel(null), undefined)
  assert.equal(cleanModel(123), undefined)
  assert.equal(cleanModel({}), undefined)
  assert.equal(cleanModel([1, 2, 3]), undefined)
})

test("cleanModel: '[object Object]' is treated as valid string (caller decides semantics)", () => {
  // cleanModel is a low-level validator — it doesn't reject specific string content.
  // The caller / builder layer should handle semantic validation.
  assert.equal(cleanModel("[object Object]"), "[object Object]")
})

// ============================================================================
// resolveModelForTask — text task
// ============================================================================

test("text task: node model takes highest priority", () => {
  const result = resolveModelForTask({
    taskType: "text",
    nodeModel: "my-node-model",
    overrides: { defaultModel: "my-local-model" },
    envConfig: { defaultModel: "my-env-model" },
  })
  assert.equal(result.model, "my-node-model")
  assert.equal(result.source, "node")
  assert.equal(result.fallbackUsed, false)
  assert.equal(result.warnings.length, 0)
})

test("text task: local override overrides env config", () => {
  const result = resolveModelForTask({
    taskType: "text",
    overrides: { defaultModel: "my-local-model" },
    envConfig: { defaultModel: "my-env-model" },
  })
  assert.equal(result.model, "my-local-model")
  assert.equal(result.source, "localOverride")
  assert.equal(result.fallbackUsed, false)
})

test("text task: env config used when no override", () => {
  const result = resolveModelForTask({
    taskType: "text",
    envConfig: { defaultModel: "my-env-model" },
  })
  assert.equal(result.model, "my-env-model")
  assert.equal(result.source, "env")
  assert.equal(result.fallbackUsed, false)
})

// ============================================================================
// resolveModelForTask — image task
// ============================================================================

test("image task: node model takes highest priority", () => {
  const result = resolveModelForTask({
    taskType: "image",
    nodeModel: "my-node-img",
    overrides: { imageModel: "my-local-img" },
    envConfig: { defaultImageModel: "my-env-img" },
  })
  assert.equal(result.model, "my-node-img")
  assert.equal(result.source, "node")
  assert.equal(result.fallbackUsed, false)
})

test("image task: local override imageModel overrides env defaultImageModel", () => {
  const result = resolveModelForTask({
    taskType: "image",
    overrides: { imageModel: "banana-pro" },
    envConfig: { defaultImageModel: "gpt-image-2" },
  })
  assert.equal(result.model, "banana-pro")
  assert.equal(result.source, "localOverride")
  assert.equal(result.fallbackUsed, false)
})

test("image task: env defaultImageModel used when no override", () => {
  const result = resolveModelForTask({
    taskType: "image",
    envConfig: { defaultImageModel: "gpt-image-2" },
  })
  assert.equal(result.model, "gpt-image-2")
  assert.equal(result.source, "env")
  assert.equal(result.fallbackUsed, false)
})

test("image task: imageModel -> defaultImageModel mapping via envConfig", () => {
  // envConfig.defaultImageModel is the canonical image model field
  const result = resolveModelForTask({
    taskType: "image",
    envConfig: { defaultImageModel: "dall-e-test" },
  })
  assert.equal(result.model, "dall-e-test")
  assert.equal(result.source, "env")
})

test("image task: overrides.defaultModel must NOT override providerConfig.defaultImageModel", () => {
  // defaultModel is text-only; image task should NOT fall back to it.
  const result = resolveModelForTask({
    taskType: "image",
    overrides: { defaultModel: "my-text-model" },
    envConfig: { defaultImageModel: "my-env-img" },
  })
  assert.equal(result.model, "my-env-img")
  assert.equal(result.source, "env")
  assert.equal(result.fallbackUsed, false)
})

// ============================================================================
// resolveModelForTask — video task
// ============================================================================

test("video task: node model takes highest priority", () => {
  const result = resolveModelForTask({
    taskType: "video",
    nodeModel: "my-node-video",
    overrides: { videoModel: "my-local-video" },
    envConfig: { videoModel: "seedance-2.0" },
  })
  assert.equal(result.model, "my-node-video")
  assert.equal(result.source, "node")
  assert.equal(result.fallbackUsed, false)
})

test("video task: local override videoModel overrides env", () => {
  const result = resolveModelForTask({
    taskType: "video",
    overrides: { videoModel: "kling-o3" },
    envConfig: { videoModel: "seedance-2.0" },
  })
  assert.equal(result.model, "kling-o3")
  assert.equal(result.source, "localOverride")
  assert.equal(result.fallbackUsed, false)
})

test("video task: env videoModel used when no override", () => {
  const result = resolveModelForTask({
    taskType: "video",
    envConfig: { videoModel: "seedance-2.0" },
  })
  assert.equal(result.model, "seedance-2.0")
  assert.equal(result.source, "env")
  assert.equal(result.fallbackUsed, false)
})

test("video task: overrides.defaultModel must NOT override providerConfig.videoModel", () => {
  // defaultModel is text-only; video task ignores it.
  const result = resolveModelForTask({
    taskType: "video",
    overrides: { defaultModel: "my-text-model" },
    envConfig: { videoModel: "my-video-model" },
  })
  assert.equal(result.model, "my-video-model")
  assert.equal(result.source, "env")
  assert.equal(result.fallbackUsed, false)
})

test("video task: envConfig.defaultModel must NOT be used when no videoModel (falls back to hardcoded)", () => {
  // defaultModel is text-only; video task should NOT fall back to it.
  const result = resolveModelForTask({
    taskType: "video",
    envConfig: { defaultModel: "gpt-5.5" },
  })
  // No videoModel anywhere → hardcoded fallback "gpt-5.5" (happens to match defaultModel value, but source is "default")
  assert.equal(result.model, "gpt-5.5")
  assert.equal(result.source, "default")
  assert.equal(result.fallbackUsed, true)
  assert.ok(result.warnings.length > 0)
})

// ============================================================================
// resolveModelForTask — fallback (all missing)
// ============================================================================

test("all config missing: text falls back to hardcoded default", () => {
  const result = resolveModelForTask({ taskType: "text" })
  assert.equal(result.model, "gpt-5.5")
  assert.equal(result.source, "default")
  assert.equal(result.fallbackUsed, true)
  assert.ok(result.warnings.length > 0)
})

test("all config missing: image falls back to hardcoded default", () => {
  const result = resolveModelForTask({ taskType: "image" })
  assert.equal(result.model, "gpt-image-2")
  assert.equal(result.source, "default")
  assert.equal(result.fallbackUsed, true)
  assert.ok(result.warnings.length > 0)
})

test("all config missing: video falls back to hardcoded default", () => {
  const result = resolveModelForTask({ taskType: "video" })
  assert.equal(result.model, "gpt-5.5")
  assert.equal(result.source, "default")
  assert.equal(result.fallbackUsed, true)
  assert.ok(result.warnings.length > 0)
})

// ============================================================================
// resolveModelForTask — bad value rejection
// ============================================================================

test("bad values (undefined/null/empty/whitespace) are skipped, fallback used", () => {
  const result = resolveModelForTask({
    taskType: "text",
    nodeModel: "   ",
    overrides: { defaultModel: "" },
    envConfig: { defaultModel: null as unknown as string },
  })
  assert.equal(typeof result.model, "string")
  assert.ok(result.model.length > 0)
  assert.equal(result.source, "default")
  assert.equal(result.fallbackUsed, true)
  assert.ok(result.warnings.length > 0)
})

test("result model is never undefined, null, or empty string", () => {
  const taskTypes = ["text", "image", "video"] as const
  for (const taskType of taskTypes) {
    const result = resolveModelForTask({ taskType })
    assert.notEqual(result.model, undefined, `${taskType}: model must not be undefined`)
    assert.notEqual(result.model, null, `${taskType}: model must not be null`)
    assert.notEqual(result.model, "", `${taskType}: model must not be empty`)
    assert.ok(result.model.trim().length > 0, `${taskType}: model must not be whitespace`)
  }
})

// ============================================================================
// resolveModelForTask — result shape
// ============================================================================

test("result always contains expected fields", () => {
  const result = resolveModelForTask({
    taskType: "text",
    envConfig: { defaultModel: "test-model" },
  })
  assert.equal(result.taskType, "text")
  assert.equal(typeof result.model, "string")
  assert.ok(["node", "localOverride", "env", "default"].includes(result.source))
  assert.equal(typeof result.fallbackUsed, "boolean")
  assert.ok(Array.isArray(result.warnings))
})
