// ============================================================================
// AI Payload Sanitization Tests (N1-2-4)
// ============================================================================
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  sanitizeRunPayload,
  containsObjectStringified,
  cleanObjectStringified,
  truncateString,
  sanitizeModel,
  sanitizeProviderOverrides,
} from "./payload-sanitize.ts"
import type { RawRunPayload } from "./payload-sanitize.ts"

// ============================================================================
// Helper
// ============================================================================

/** 构造最简有效 payload */
function validPayload(overrides?: Partial<RawRunPayload>): RawRunPayload {
  return {
    message: "Hello world",
    model: "gpt-5.5",
    ...overrides,
  }
}

// ============================================================================
// 1. containsObjectStringified
// ============================================================================

describe("containsObjectStringified", () => {
  it("detects standard [object Object] pattern", () => {
    assert.equal(containsObjectStringified("before [object Object] after"), true)
  })

  it("detects multiple [object Object] occurrences", () => {
    assert.equal(containsObjectStringified("[object Object] foo [object Object]"), true)
  })

  it("returns false for clean string", () => {
    assert.equal(containsObjectStringified("A normal prompt without issues"), false)
  })

  it("returns false for non-string input", () => {
    assert.equal(containsObjectStringified(42), false)
    assert.equal(containsObjectStringified(null), false)
    assert.equal(containsObjectStringified(undefined), false)
  })
})

// ============================================================================
// 2. cleanObjectStringified
// ============================================================================

describe("cleanObjectStringified", () => {
  it("removes [object Object] and collapses whitespace", () => {
    assert.equal(
      cleanObjectStringified("a [object Object] b"),
      "a b",
    )
  })

  it("handles string with only [object Object]", () => {
    assert.equal(
      cleanObjectStringified("[object Object]"),
      "",
    )
  })

  it("handles multiple occurrences", () => {
    const input = "Start [object Object] middle [object Object] end"
    assert.equal(cleanObjectStringified(input), "Start middle end")
  })

  it("preserves surrounding text unchanged", () => {
    const input = "A cinematic scene with dramatic lighting"
    assert.equal(cleanObjectStringified(input), input)
  })
})

// ============================================================================
// 3. truncateString
// ============================================================================

describe("truncateString", () => {
  it("does not truncate short strings", () => {
    const input = "Short prompt"
    assert.equal(truncateString(input, 100, "..."), input)
  })

  it("truncates at exactly maxLen boundary", () => {
    const input = "A".repeat(200)
    const result = truncateString(input, 100, "[...truncated]")
    assert.ok(result.length <= 115) // 100 chars + suffix
    assert.ok(result.endsWith("[...truncated]"))
  })

  it("prefers newline as truncation point", () => {
    const before = "A".repeat(50)
    const after = "B".repeat(100)
    const input = before + "\n" + after
    const result = truncateString(input, 90, "\n\n[...truncated]")
    assert.ok(result.includes("\n\n[...truncated]"))
    // Should not include the after part (it's past the newline)
    assert.ok(!result.includes("B".repeat(50)))
  })

  it("handles suffix longer than maxLen", () => {
    const result = truncateString("Hello", 3, "[...truncated]")
    assert.ok(result.length > 0)
  })
})

// ============================================================================
// 4. sanitizeModel
// ============================================================================

describe("sanitizeModel", () => {
  it("returns trimmed valid string", () => {
    assert.equal(sanitizeModel("  gpt-5.5  "), "gpt-5.5")
  })

  it("returns undefined for empty string", () => {
    assert.equal(sanitizeModel(""), undefined)
    assert.equal(sanitizeModel("   "), undefined)
  })

  it("returns undefined for non-string", () => {
    assert.equal(sanitizeModel(undefined), undefined)
    assert.equal(sanitizeModel(null), undefined)
    assert.equal(sanitizeModel(42), undefined)
    assert.equal(sanitizeModel({}), undefined)
  })
})

// ============================================================================
// 5. sanitizeProviderOverrides
// ============================================================================

describe("sanitizeProviderOverrides", () => {
  it("removes undefined and null values", () => {
    const result = sanitizeProviderOverrides({
      baseUrl: "https://api.example.com",
      apiKey: undefined,
      timeoutMs: null,
    })
    assert.deepEqual(result, { baseUrl: "https://api.example.com" })
  })

  it("removes NaN values", () => {
    const result = sanitizeProviderOverrides({
      timeoutMs: NaN,
      defaultModel: "gpt-5.5",
    })
    assert.deepEqual(result, { defaultModel: "gpt-5.5" })
  })

  it("trims string values and removes empty strings", () => {
    const result = sanitizeProviderOverrides({
      baseUrl: "  https://api.example.com  ",
      defaultModel: "   ",
      imageModel: "gpt-image-2",
    })
    assert.deepEqual(result, {
      baseUrl: "https://api.example.com",
      imageModel: "gpt-image-2",
    })
  })

  it("returns undefined for all-invalid input", () => {
    assert.equal(sanitizeProviderOverrides({}), undefined)
    assert.equal(sanitizeProviderOverrides(null), undefined)
    assert.equal(sanitizeProviderOverrides(undefined), undefined)
  })

  it("preserves valid number values", () => {
    const result = sanitizeProviderOverrides({
      timeoutMs: 30000,
      baseUrl: "https://api.example.com",
    })
    assert.deepEqual(result, {
      timeoutMs: 30000,
      baseUrl: "https://api.example.com",
    })
  })

  it("filters out non-string/non-number types silently", () => {
    const result = sanitizeProviderOverrides({
      baseUrl: "https://api.example.com",
      timeoutMs: 30000,
      weirdFlag: true,        // boolean → skipped
      weirdObj: { a: 1 },    // object → skipped
      weirdArr: [1, 2],      // array → skipped
    })
    assert.deepEqual(result, {
      baseUrl: "https://api.example.com",
      timeoutMs: 30000,
    })
  })
})

// ============================================================================
// 6. sanitizeRunPayload — integration tests
// ============================================================================

describe("sanitizeRunPayload", () => {
  // --- 6a. Happy path ---
  it("passes through valid payload unchanged", () => {
    const result = sanitizeRunPayload(validPayload())
    assert.equal(result.payload.message, "Hello world")
    assert.equal(result.payload.model, "gpt-5.5")
    assert.equal(result.warnings.length, 0)
  })

  // --- 6b. [object Object] in message ---
  it("cleans [object Object] from message and adds warning", () => {
    const result = sanitizeRunPayload(validPayload({
      message: "Generate: [object Object] with style [object Object]",
    }))
    assert.equal(result.payload.message, "Generate: with style")
    assert.equal(result.warnings.length, 1)
    assert.ok(result.warnings[0].includes("[object Object]"))
  })

  // --- 6c. undefined/null message ---
  it("handles undefined message with warning", () => {
    const result = sanitizeRunPayload(validPayload({ message: undefined }))
    assert.equal(result.payload.message, "")
    assert.ok(result.warnings.some((w) => w.includes("undefined/null")))
  })

  it("handles null message with warning", () => {
    const result = sanitizeRunPayload(validPayload({ message: null }))
    assert.equal(result.payload.message, "")
    assert.ok(result.warnings.some((w) => w.includes("undefined/null")))
  })

  // --- 6d. Non-string message (object) ---
  it("JSON.stringifies non-string message with warning", () => {
    const result = sanitizeRunPayload(validPayload({ message: { prompt: "test" } }))
    assert.equal(result.payload.message, '{"prompt":"test"}')
    assert.ok(result.warnings.some((w) => w.includes("non-string")))
  })

  // --- 6e. Model sanitization ---
  it("handles empty/whitespace-only model with warning", () => {
    const result = sanitizeRunPayload(validPayload({ model: "   " }))
    assert.equal(result.payload.model, "")
    assert.ok(result.warnings.some((w) => w.includes("model was empty")))
  })

  it("handles undefined model with warning", () => {
    const result = sanitizeRunPayload(validPayload({ model: undefined }))
    assert.equal(result.payload.model, "")
    assert.ok(result.warnings.some((w) => w.includes("model was empty")))
  })

  // --- 6f. Prompt truncation ---
  it("truncates overly long message with warning", () => {
    const longMsg = "A".repeat(40000)
    const result = sanitizeRunPayload(validPayload({
      message: longMsg,
    }))
    assert.ok(result.payload.message.length < 40000)
    assert.ok(result.payload.message.endsWith("[...truncated]"))
    assert.ok(result.warnings.some((w) => w.includes("truncated")))
  })

  it("respects custom maxPromptLen option", () => {
    const msg = "A".repeat(500)
    const result = sanitizeRunPayload(validPayload({
      message: msg,
    }), { maxPromptLen: 100 })
    assert.ok(result.payload.message.length <= 115) // 100 + suffix
  })

  // --- 6g. Context sanitization ---
  it("keeps valid context.systemOverride", () => {
    const result = sanitizeRunPayload(validPayload({
      context: { systemOverride: "You are a helpful assistant" },
    }))
    assert.equal(result.payload.context?.systemOverride, "You are a helpful assistant")
  })

  it("removes empty context.systemOverride", () => {
    const result = sanitizeRunPayload(validPayload({
      context: { systemOverride: "" },
    }))
    assert.equal(result.payload.context?.systemOverride, undefined)
  })

  it("handles non-object context gracefully", () => {
    const result = sanitizeRunPayload(validPayload({
      context: "not an object" as any,
    }))
    assert.equal(result.payload.context, undefined)
  })

  // --- 6h. _providerOverrides sanitization ---
  it("sanitizes _providerOverrides (removes undefined/NaN, trims strings)", () => {
    const result = sanitizeRunPayload(validPayload({
      _providerOverrides: {
        baseUrl: "  https://api.example.com  ",
        apiKey: undefined,
        timeoutMs: NaN,
        defaultModel: "gpt-5.5",
      },
    }))
    assert.deepEqual(result.payload._providerOverrides, {
      baseUrl: "https://api.example.com",
      defaultModel: "gpt-5.5",
    })
  })

  it("omits _providerOverrides when all values are invalid", () => {
    const result = sanitizeRunPayload(validPayload({
      _providerOverrides: { apiKey: null, timeoutMs: NaN },
    }))
    assert.equal(result.payload._providerOverrides, undefined)
  })

  // --- 6i. Combined: multiple issues in one payload ---
  it("handles multiple sanitization issues simultaneously", () => {
    const result = sanitizeRunPayload({
      message: "Generate [object Object] scene " + "X".repeat(40000),
      model: "   ",
      context: { systemOverride: 42 },
      _providerOverrides: { baseUrl: null, timeoutMs: NaN },
    })
    // message should be cleaned and truncated
    assert.ok(!result.payload.message.includes("[object Object]"))
    assert.ok(result.payload.message.length < 40000)
    // model should be empty
    assert.equal(result.payload.model, "")
    // context.systemOverride should be removed (was number)
    assert.equal(result.payload.context?.systemOverride, undefined)
    // _providerOverrides should be omitted
    assert.equal(result.payload._providerOverrides, undefined)
    // should have multiple warnings
    assert.ok(result.warnings.length >= 3)
  })

  // --- 6j. Empty payload ---
  it("handles completely empty payload", () => {
    const result = sanitizeRunPayload({})
    assert.equal(result.payload.message, "")
    assert.equal(result.payload.model, "")
    assert.ok(result.warnings.length >= 2) // message + model warnings
  })
})
