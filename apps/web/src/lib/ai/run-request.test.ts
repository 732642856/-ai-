// ============================================================================
// AI Run Request Builder Tests (Phase 1-a)
// ============================================================================
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { buildRunRequest } from "./run-request.ts"
import type { BuildRunRequestInput } from "./run-request.ts"

// ============================================================================
// Helper
// ============================================================================

/** 构造最简有效输入 */
function validInput(overrides?: Partial<BuildRunRequestInput>): BuildRunRequestInput {
  return {
    nodeKind: "text-generation",
    prompt: "Generate a story",
    taskType: "text",
    ...overrides,
  }
}

// ============================================================================
// 1. Text task normal path
// ============================================================================

describe("buildRunRequest: text task", () => {
  it("produces valid RunRequest for basic text input", () => {
    const result = buildRunRequest(validInput())
    assert.equal(result.message, "Generate a story")
    assert.equal(result.taskType, undefined) // taskType is in _meta
    assert.equal(result._meta.taskType, "text")
    assert.equal(result._meta.nodeKind, "text-generation")
    assert.equal(typeof result.model, "string")
    assert.ok(result.model.length > 0)
    assert.equal(result._meta.modelSource, "default")
    assert.ok(result._meta.fallbackUsed)
  })

  it("uses envDefaultModel when provided (no local override)", () => {
    const result = buildRunRequest(validInput({
      envDefaultModel: "gpt-4o",
    }))
    assert.equal(result.model, "gpt-4o")
    assert.equal(result._meta.modelSource, "env")
    assert.ok(!result._meta.fallbackUsed)
  })

  it("uses localDefaultModel over envDefaultModel", () => {
    const result = buildRunRequest(validInput({
      localDefaultModel: "claude-4",
      envDefaultModel: "gpt-4o",
    }))
    assert.equal(result.model, "claude-4")
    assert.equal(result._meta.modelSource, "localOverride")
  })

  it("uses nodeModel over localDefaultModel", () => {
    const result = buildRunRequest(validInput({
      nodeModel: "gpt-5.5-turbo",
      localDefaultModel: "claude-4",
      envDefaultModel: "gpt-4o",
    }))
    assert.equal(result.model, "gpt-5.5-turbo")
    assert.equal(result._meta.modelSource, "node")
  })
})

// ============================================================================
// 2. Image task normal path
// ============================================================================

describe("buildRunRequest: image task", () => {
  it("produces valid RunRequest for basic image input", () => {
    const result = buildRunRequest(validInput({
      nodeKind: "image-generation",
      taskType: "image",
      prompt: "A cat sitting on a moon",
    }))
    assert.equal(result.message, "A cat sitting on a moon")
    assert.equal(result._meta.taskType, "image")
    assert.equal(result._meta.nodeKind, "image-generation")
    assert.ok(result.model.length > 0)
  })

  it("uses envDefaultImageModel for image task", () => {
    const result = buildRunRequest(validInput({
      nodeKind: "image-generation",
      taskType: "image",
      envDefaultImageModel: "dall-e-4",
    }))
    assert.equal(result.model, "dall-e-4")
    assert.equal(result._meta.modelSource, "env")
  })

  it("uses localImageModel over env", () => {
    const result = buildRunRequest(validInput({
      nodeKind: "image-generation",
      taskType: "image",
      localImageModel: "midjourney-v7",
      envDefaultImageModel: "dall-e-4",
    }))
    assert.equal(result.model, "midjourney-v7")
    assert.equal(result._meta.modelSource, "localOverride")
  })

  it("image task does NOT fallback to defaultModel", () => {
    const result = buildRunRequest(validInput({
      nodeKind: "image-generation",
      taskType: "image",
      envDefaultModel: "gpt-4o",
      // no envDefaultImageModel
    }))
    // Should use hardcoded image fallback, NOT gpt-4o
    assert.equal(result.model, "gpt-image-2")
    assert.equal(result._meta.modelSource, "default")
  })
})

// ============================================================================
// 3. Prompt fallbacks
// ============================================================================

describe("buildRunRequest: prompt fallbacks", () => {
  it("text task: falls back to default when prompt is empty", () => {
    const result = buildRunRequest(validInput({ prompt: "" }))
    assert.equal(result.message, "请生成内容。")
  })

  it("text task: falls back to default when prompt is undefined-like", () => {
    const result = buildRunRequest(validInput({ prompt: "" }))
    assert.equal(result.message, "请生成内容。")
  })

  it("image task: falls back to cinematic prompt when provided", () => {
    const result = buildRunRequest(validInput({
      taskType: "image",
      prompt: "A cat",
      cinematicPrompt: "Cinematic wide shot of a cat on a moonlit rooftop, dramatic lighting",
    }))
    // cinematicPrompt takes priority over prompt
    assert.equal(result.message, "Cinematic wide shot of a cat on a moonlit rooftop, dramatic lighting")
  })

  it("image task: falls back to default when no prompt and no cinematic", () => {
    const result = buildRunRequest(validInput({
      taskType: "image",
      prompt: "",
    }))
    assert.equal(result.message, "A cinematic scene")
  })
})

// ============================================================================
// 4. Upstream content
// ============================================================================

describe("buildRunRequest: upstream content", () => {
  it("text task: upstreamContent is included before prompt", () => {
    const result = buildRunRequest(validInput({
      upstreamContent: "Previous chapter text",
      prompt: "Continue the story",
    }))
    assert.ok(result.message.includes("上游内容:\nPrevious chapter text"))
    assert.ok(result.message.includes("当前内容:\nContinue the story"))
  })

  it("text task: upstreamContent alone when no prompt", () => {
    const result = buildRunRequest(validInput({
      upstreamContent: "Previous chapter text",
      prompt: "",
    }))
    assert.ok(result.message.includes("上游内容:\nPrevious chapter text"))
    assert.ok(!result.message.includes("当前内容:"))
  })

  it("image task: upstreamContent takes priority over prompt", () => {
    const result = buildRunRequest(validInput({
      taskType: "image",
      prompt: "A cat",
      upstreamContent: "Storyboard: a dramatic moonlit scene",
    }))
    // upstreamContent wins over prompt (no cinematic)
    assert.equal(result.message, "Storyboard: a dramatic moonlit scene")
  })

  it("image task: cinematicPrompt > upstreamContent > prompt", () => {
    const result = buildRunRequest(validInput({
      taskType: "image",
      prompt: "A cat",
      upstreamContent: "Storyboard: moonlit scene",
      cinematicPrompt: "Enhanced cinematic moonlit scene",
    }))
    assert.equal(result.message, "Enhanced cinematic moonlit scene")
  })

  it("ignores empty upstreamContent", () => {
    const result = buildRunRequest(validInput({
      upstreamContent: "   ",
      prompt: "Just this",
    }))
    assert.equal(result.message, "Just this")
  })
})

// ============================================================================
// 5. _providerOverrides
// ============================================================================

describe("buildRunRequest: _providerOverrides", () => {
  it("passes through provider overrides after sanitization", () => {
    const result = buildRunRequest(validInput({
      providerOverrides: {
        baseUrl: "https://api.example.com",
        timeoutMs: 30000,
      },
    }))
    assert.equal(result._providerOverrides?.baseUrl, "https://api.example.com")
    assert.equal(result._providerOverrides?.timeoutMs, 30000)
  })

  it("omits _providerOverrides when not provided", () => {
    const result = buildRunRequest(validInput())
    assert.equal(result._providerOverrides, undefined)
  })

  it("sanitizes provider overrides (removes undefined/NaN)", () => {
    const result = buildRunRequest(validInput({
      providerOverrides: {
        baseUrl: "https://api.example.com",
        apiKey: undefined,
        timeoutMs: NaN,
      },
    }))
    assert.equal(result._providerOverrides?.baseUrl, "https://api.example.com")
    assert.equal(result._providerOverrides?.apiKey, undefined)
    assert.equal(result._providerOverrides?.timeoutMs, undefined)
  })
})

// ============================================================================
// 6. context / systemOverride
// ============================================================================

describe("buildRunRequest: context", () => {
  it("includes systemOverride in context when provided", () => {
    const result = buildRunRequest(validInput({
      systemOverride: "You are a helpful assistant",
    }))
    assert.equal(result.context?.systemOverride, "You are a helpful assistant")
  })

  it("omits context when no systemOverride", () => {
    const result = buildRunRequest(validInput())
    assert.equal(result.context, undefined)
  })

  it("includes cinematic in context for image task", () => {
    const result = buildRunRequest(validInput({
      taskType: "image",
      cinematicPrompt: "A dramatic scene",
      systemOverride: "Image generation mode",
    }))
    assert.equal(result.context?.cinematic, "A dramatic scene")
    assert.equal(result.context?.systemOverride, "Image generation mode")
  })
})

// ============================================================================
// 7. _meta
// ============================================================================

describe("buildRunRequest: _meta", () => {
  it("contains all required meta fields", () => {
    const result = buildRunRequest(validInput({
      nodeKind: "script",
      prompt: "Hello",
      envDefaultModel: "gpt-4o",
    }))
    assert.equal(result._meta.taskType, "text")
    assert.equal(result._meta.nodeKind, "script")
    assert.equal(typeof result._meta.rawPromptLength, "number")
    assert.ok(result._meta.rawPromptLength > 0)
    assert.equal(typeof result._meta.sanitizedPromptLength, "number")
    assert.equal(result._meta.modelSource, "env")
    assert.ok(!result._meta.fallbackUsed)
    assert.ok(Array.isArray(result._meta.sanitizeWarnings))
  })

  it("tracks raw vs sanitized prompt length when truncation occurs", () => {
    const longPrompt = "A".repeat(50000)
    const result = buildRunRequest(validInput({
      prompt: longPrompt,
    }))
    assert.ok(result._meta.rawPromptLength > result._meta.sanitizedPromptLength)
    assert.ok(result._meta.sanitizeWarnings.some((w) => w.includes("truncated")))
  })
})

// ============================================================================
// 8. Sanitize integration
// ============================================================================

describe("buildRunRequest: sanitize integration", () => {
  it("cleans [object Object] from prompt", () => {
    const result = buildRunRequest(validInput({
      prompt: "Generate [object Object] scene",
    }))
    assert.ok(!result.message.includes("[object Object]"))
    assert.ok(result._meta.sanitizeWarnings.some((w) => w.includes("[object Object]")))
  })

  it("trims model name", () => {
    const result = buildRunRequest(validInput({
      envDefaultModel: "  gpt-4o  ",
    }))
    assert.equal(result.model, "gpt-4o")
  })

  it("handles empty-string model with fallback", () => {
    const result = buildRunRequest(validInput({
      envDefaultModel: "   ",
    }))
    // empty-string model gets trimmed to empty → falls through to hardcoded fallback
    assert.ok(result.model.length > 0)
    assert.equal(result._meta.modelSource, "default")
  })
})

// ============================================================================
// 9. Edge cases
// ============================================================================

describe("buildRunRequest: edge cases", () => {
  it("handles completely empty input", () => {
    const result = buildRunRequest({
      nodeKind: "",
      prompt: "",
      taskType: "text",
    })
    assert.equal(result.message, "请生成内容。")
    assert.ok(result.model.length > 0) // fallback
    assert.equal(result._meta.nodeKind, "")
    assert.equal(result._meta.taskType, "text")
  })

  it("handles video task type", () => {
    const result = buildRunRequest(validInput({
      taskType: "video",
      nodeKind: "video-generation",
      prompt: "Analyze this video",
      envVideoModel: "video-llm-v2",
    }))
    assert.equal(result.model, "video-llm-v2")
    assert.equal(result._meta.taskType, "video")
  })

  it("video task does NOT fallback to defaultModel", () => {
    const result = buildRunRequest(validInput({
      taskType: "video",
      envDefaultModel: "gpt-4o",
    }))
    // Should NOT use gpt-4o (defaultModel is text-only)
    assert.notEqual(result.model, "gpt-4o")
    assert.equal(result._meta.modelSource, "default")
  })

  it("respects custom sanitize options", () => {
    const result = buildRunRequest(validInput({
      prompt: "A".repeat(500),
    }), { maxPromptLen: 100 })
    assert.ok(result.message.length < 500)
    assert.ok(result.message.endsWith("[...truncated]"))
  })

  it("empty string cinematicPrompt is ignored", () => {
    const result = buildRunRequest(validInput({
      taskType: "image",
      prompt: "A cat",
      cinematicPrompt: "   ",
    }))
    // cinematicPrompt is whitespace-only, should fall through to prompt
    assert.equal(result.message, "A cat")
  })
})
