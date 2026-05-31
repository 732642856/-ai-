import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { ImageGenerationError, generateImageFromPrompt, IMAGE_GENERATION_CLIENT_TIMEOUT_MS } from "./imageGeneration.ts"

const originalFetch = globalThis.fetch

function mockFetch(response: Response) {
  globalThis.fetch = async () => response
}

describe("generateImageFromPrompt", () => {
  it("keeps the client timeout longer than the API route timeout", () => {
    assert.equal(IMAGE_GENERATION_CLIENT_TIMEOUT_MS, 150_000)
  })

  it("surfaces structured API error details", async () => {
    mockFetch(new Response(JSON.stringify({
      ok: false,
      requestId: "req-1",
      attempts: 2,
      error: {
        code: "PROVIDER_BAD_GATEWAY",
        userMessage: "图片生成服务暂时不可用，请稍后重试。",
        detail: "上游服务返回 502 Bad Gateway，可能是服务超时。",
        retryable: true,
        status: 502,
      },
    }), { status: 502 }))

    try {
      await generateImageFromPrompt({ prompt: "一只猫", requestId: "req-1" })
      assert.fail("Expected generateImageFromPrompt to throw")
    } catch (error) {
      assert.ok(error instanceof ImageGenerationError)
      assert.equal(error.code, "PROVIDER_BAD_GATEWAY")
      assert.equal(error.status, 502)
      assert.equal(error.requestId, "req-1")
      assert.equal(error.attempts, 2)
      assert.match(error.message, /图片生成服务暂时不可用/)
      assert.match(error.message, /502 Bad Gateway/)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("passes sourceImage in the request body when provided", async () => {
    let requestBody: Record<string, unknown> | null = null
    globalThis.fetch = async (url, opts) => {
      requestBody = JSON.parse((opts?.body as string) ?? "{}")
      return new Response(JSON.stringify({
        imageUrl: "blob:mock",
        prompt: "test",
        model: "gpt-image-2",
      }), { status: 200 })
    }

    await generateImageFromPrompt({
      prompt: "a character",
      sourceImage: "data:image/png;base64,mockref",
    })

    assert.ok(requestBody, "fetch was called")
    assert.equal(requestBody?.sourceImage, "data:image/png;base64,mockref")
    assert.equal(requestBody?.prompt, "a character")
    globalThis.fetch = originalFetch
  })
})
