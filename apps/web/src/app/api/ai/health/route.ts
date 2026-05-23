// ============================================================================
// GET+POST /api/ai/health — AI 连接测试 (P2-5A, P2-5B fix)
// ============================================================================
// GET: 测试 .env 服务端配置的连接。
// POST: 接受 { _providerOverrides } 测试 Local Override 配置。
// 发一个最小 chat 请求到中转站验证配置是否正确。
// ============================================================================

import { NextRequest, NextResponse } from "next/server"
import {
  getAiProviderConfig,
  getAiProviderConfigSafe,
  mergeProviderConfig,
} from "@/lib/ai/provider-config"
import type { AiProviderOverrides } from "@/lib/ai/provider-config"
import { normalizeUpstreamError } from "@/lib/ai/errors"

/**
 * 执行连接测试的核心逻辑。
 * 向配置的 Base URL 发最小 chat 请求验证连通性。
 */
async function runHealthCheck(baseUrl: string, apiKey: string, model: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)

  const upstream = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Reply with only: ok" }],
      temperature: 0,
      max_tokens: 5,
    }),
    signal: controller.signal,
  })

  clearTimeout(timer)

  const text = await upstream.text()

  return { ok: upstream.ok, status: upstream.status, text }
}

function toSafeConfig(config: ReturnType<typeof mergeProviderConfig>) {
  return {
    type: config.type,
    baseUrl: config.baseUrl,
    hasApiKey: Boolean(config.apiKey),
    defaultModel: config.defaultModel,
    defaultImageModel: config.defaultImageModel,
    videoModel: config.videoModel,
    timeoutMs: config.timeoutMs,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// GET — 测试 .env 服务端配置
// ────────────────────────────────────────────────────────────────────────────
export async function GET() {
  let config

  try {
    config = getAiProviderConfig()
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI provider not configured"
    return NextResponse.json(
      { ok: false, message, config: null },
      { status: 500 },
    )
  }

  try {
    const { ok, status, text } = await runHealthCheck(
      config.baseUrl,
      config.apiKey,
      config.defaultModel,
    )

    if (!ok) {
      const error = normalizeUpstreamError(status, text, config.type)
      return NextResponse.json(
        {
          ok: false,
          message: error.message,
          config: getAiProviderConfigSafe(),
        },
        { status },
      )
    }

    return NextResponse.json({
      ok: true,
      message: `Connected to ${config.baseUrl} (model: ${config.defaultModel})`,
      config: getAiProviderConfigSafe(),
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === "AbortError"
          ? "Connection timed out. Check your Base URL and network."
          : `Connection failed: ${error.message}`
        : "Unknown error"

    return NextResponse.json(
      {
        ok: false,
        message,
        config: toSafeConfig(config),
      },
      { status: 500 },
    )
  }
}

// ────────────────────────────────────────────────────────────────────────────
// POST — 测试 Local Override 配置 (P2-5B fix)
// ────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  let config: ReturnType<typeof mergeProviderConfig>
  let overrides: AiProviderOverrides | undefined

  // 解析请求体
  try {
    const body = await request.json()
    overrides = body._providerOverrides
  } catch {
    // 无请求体或无覆盖配置，fallback 到 GET 行为
  }

  try {
    config = mergeProviderConfig(overrides)
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI provider not configured"
    return NextResponse.json(
      { ok: false, message, config: null },
      { status: 500 },
    )
  }

  try {
    const { ok, status, text } = await runHealthCheck(
      config.baseUrl,
      config.apiKey,
      config.defaultModel,
    )

    if (!ok) {
      const error = normalizeUpstreamError(status, text, config.type)
      return NextResponse.json(
        {
          ok: false,
          message: error.message,
          config: toSafeConfig(config),
        },
        { status },
      )
    }

    const modeLabel = overrides ? " (local override)" : ""
    return NextResponse.json({
      ok: true,
      message: `Connected to ${config.baseUrl} (model: ${config.defaultModel})${modeLabel}`,
      config: toSafeConfig(config),
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === "AbortError"
          ? "Connection timed out. Check your Base URL and network."
          : `Connection failed: ${error.message}`
        : "Unknown error"

    return NextResponse.json(
      {
        ok: false,
        message,
        config: toSafeConfig(config),
      },
      { status: 500 },
    )
  }
}
