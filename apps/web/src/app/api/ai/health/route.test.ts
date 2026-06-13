import assert from "node:assert/strict"
import test from "node:test"

import { handleHealthPost } from "./health-core.ts"

const AI_ENV_KEYS = [
  "AI_BASE_URL",
  "NEXT_PUBLIC_API_BASE_URL",
  "AI_API_KEY",
  "OPENAI_API_KEY",
  "AI_DEFAULT_MODEL",
  "AI_DEFAULT_IMAGE_MODEL",
  "AI_VIDEO_MODEL",
  "AI_REQUEST_TIMEOUT_MS",
] as const

type AiEnvSnapshot = Partial<Record<(typeof AI_ENV_KEYS)[number], string>>

function snapshotEnv(): AiEnvSnapshot {
  const snapshot: AiEnvSnapshot = {}
  for (const key of AI_ENV_KEYS) snapshot[key] = process.env[key]
  return snapshot
}

function restoreEnv(snapshot: AiEnvSnapshot) {
  for (const key of AI_ENV_KEYS) {
    const value = snapshot[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

function clearAiEnv() {
  for (const key of AI_ENV_KEYS) delete process.env[key]
}

test("POST /api/ai/health: uses non-secret Local Override and returns safe config without raw API key", async (t) => {
  const envSnapshot = snapshotEnv()
  const originalFetch = globalThis.fetch
  clearAiEnv()
  process.env.AI_BASE_URL = "https://env.example/v1"
  process.env.AI_API_KEY = "sk-env-secret"
  process.env.AI_DEFAULT_MODEL = "env-text-model"
  process.env.AI_DEFAULT_IMAGE_MODEL = "env-image-model"

  const upstreamCalls: Array<{ url: string; init: RequestInit }> = []
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    upstreamCalls.push({ url: String(input), init: init ?? {} })
    return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }

  t.after(() => {
    globalThis.fetch = originalFetch
    restoreEnv(envSnapshot)
  })

  const result = await handleHealthPost({
    baseUrl: "https://override.example/v1/",
    defaultModel: "override-text-model",
    imageModel: "override-image-model",
    videoModel: "override-video-model",
    timeoutMs: 23456,
  })

  const data = result.body as any
  const serialized = JSON.stringify(data)

  assert.strictEqual(result.status, undefined)
  assert.strictEqual(data.ok, true)
  assert.strictEqual(data.config.baseUrl, "https://override.example/v1")
  assert.strictEqual(data.config.hasApiKey, true)
  assert.strictEqual(data.config.defaultModel, "override-text-model")
  assert.strictEqual(data.config.defaultImageModel, "override-image-model")
  assert.strictEqual(data.config.videoModel, "override-video-model")
  assert.strictEqual(data.config.timeoutMs, 23456)
  assert.strictEqual(Object.hasOwn(data.config, "apiKey"), false)
  assert.equal(serialized.includes("sk-env-secret"), false)

  assert.strictEqual(upstreamCalls.length, 1)
  assert.strictEqual(upstreamCalls[0].url, "https://override.example/v1/chat/completions")
  assert.deepStrictEqual(upstreamCalls[0].init.headers, {
    Authorization: "Bearer sk-env-secret",
    "Content-Type": "application/json",
  })

  const upstreamBody = JSON.parse(String(upstreamCalls[0].init.body))
  assert.strictEqual(upstreamBody.model, "override-text-model")
  assert.deepStrictEqual(upstreamBody.messages, [
    { role: "user", content: "Reply with only: ok" },
  ])
  assert.strictEqual(upstreamBody.temperature, 0)
  assert.strictEqual(upstreamBody.max_tokens, 5)
})

test("POST /api/ai/health: returns safe config and no raw key when upstream fails", async (t) => {
  const envSnapshot = snapshotEnv()
  const originalFetch = globalThis.fetch
  clearAiEnv()
  process.env.AI_BASE_URL = "https://env.example/v1"
  process.env.AI_API_KEY = "sk-env-failing-secret"
  process.env.AI_DEFAULT_MODEL = "env-text-model"

  globalThis.fetch = async () => new Response("upstream says no", { status: 401 })

  t.after(() => {
    globalThis.fetch = originalFetch
    restoreEnv(envSnapshot)
  })

  const result = await handleHealthPost({
    baseUrl: "https://override.example/v1",
    defaultModel: "override-text-model",
    imageModel: "override-image-model",
    timeoutMs: 34567,
  })

  const data = result.body as any
  const serialized = JSON.stringify(data)

  assert.strictEqual(result.status, 401)
  assert.strictEqual(data.ok, false)
  assert.strictEqual(data.config.baseUrl, "https://override.example/v1")
  assert.strictEqual(data.config.hasApiKey, true)
  assert.strictEqual(data.config.defaultModel, "override-text-model")
  assert.strictEqual(data.config.defaultImageModel, "override-image-model")
  assert.strictEqual(data.config.timeoutMs, 34567)
  assert.strictEqual(Object.hasOwn(data.config, "apiKey"), false)
  assert.equal(serialized.includes("sk-env-failing-secret"), false)
})

test("POST /api/ai/health: returns merged safe config when fetch throws", async (t) => {
  const envSnapshot = snapshotEnv()
  const originalFetch = globalThis.fetch
  clearAiEnv()
  process.env.AI_BASE_URL = "https://env.example/v1"
  process.env.AI_API_KEY = "sk-env-e2e-secret"
  process.env.AI_DEFAULT_MODEL = "env-text-model"

  globalThis.fetch = async () => {
    throw new TypeError("fetch failed")
  }

  t.after(() => {
    globalThis.fetch = originalFetch
    restoreEnv(envSnapshot)
  })

  const result = await handleHealthPost({
    baseUrl: "https://e2e.local/v1",
    defaultModel: "e2e-text-model",
    imageModel: "e2e-image-model",
    timeoutMs: 120000,
  })

  const data = result.body as any
  const serialized = JSON.stringify(data)

  assert.strictEqual(result.status, 500)
  assert.strictEqual(data.ok, false)
  assert.strictEqual(data.message, "Connection failed: fetch failed")
  assert.strictEqual(data.config.baseUrl, "https://e2e.local/v1")
  assert.strictEqual(data.config.hasApiKey, true)
  assert.strictEqual(data.config.defaultModel, "e2e-text-model")
  assert.strictEqual(data.config.defaultImageModel, "e2e-image-model")
  assert.strictEqual(data.config.timeoutMs, 120000)
  assert.strictEqual(Object.hasOwn(data.config, "apiKey"), false)
  assert.equal(serialized.includes("sk-env-e2e-secret"), false)
})

test("POST /api/ai/health: Local Override wins over env config except API key", async (t) => {
  const envSnapshot = snapshotEnv()
  const originalFetch = globalThis.fetch
  clearAiEnv()
  process.env.AI_BASE_URL = "https://env.example/v1"
  process.env.AI_API_KEY = "sk-env-secret"
  process.env.AI_DEFAULT_MODEL = "env-text-model"
  process.env.AI_DEFAULT_IMAGE_MODEL = "env-image-model"
  process.env.AI_REQUEST_TIMEOUT_MS = "99999"

  const upstreamCalls: Array<{ url: string; init: RequestInit }> = []
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    upstreamCalls.push({ url: String(input), init: init ?? {} })
    return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }

  t.after(() => {
    globalThis.fetch = originalFetch
    restoreEnv(envSnapshot)
  })

  const result = await handleHealthPost({
    baseUrl: "https://override.example/v1",
    defaultModel: "override-text-model",
    imageModel: "override-image-model",
    timeoutMs: 23456,
  })

  const data = result.body as any
  const serialized = JSON.stringify(data)

  assert.strictEqual(result.status, undefined)
  assert.strictEqual(data.ok, true)
  assert.strictEqual(upstreamCalls.length, 1)
  assert.strictEqual(upstreamCalls[0].url, "https://override.example/v1/chat/completions")
  assert.deepStrictEqual(upstreamCalls[0].init.headers, {
    Authorization: "Bearer sk-env-secret",
    "Content-Type": "application/json",
  })

  const upstreamBody = JSON.parse(String(upstreamCalls[0].init.body))
  assert.strictEqual(upstreamBody.model, "override-text-model")
  assert.strictEqual(data.config.baseUrl, "https://override.example/v1")
  assert.strictEqual(data.config.hasApiKey, true)
  assert.strictEqual(data.config.defaultModel, "override-text-model")
  assert.strictEqual(data.config.defaultImageModel, "override-image-model")
  assert.strictEqual(data.config.timeoutMs, 23456)
  assert.strictEqual(Object.hasOwn(data.config, "apiKey"), false)
  assert.equal(serialized.includes("sk-env-secret"), false)
})
