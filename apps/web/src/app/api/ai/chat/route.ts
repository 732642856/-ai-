// ============================================================================
// POST /api/ai/chat — 非流式 AI 对话代理 (P2-5A)
// ============================================================================
// 前端 `callAiChat()` 调用此端点，后端转发到中转站。
// 与 /api/ai/chat/stream 的区别：此端点不使用 SSE，返回完整 JSON。
// ============================================================================

import { NextRequest, NextResponse } from "next/server"
import { mergeProviderConfig, getAiProviderConfig } from "@/lib/ai/provider-config"
import type { AiProviderOverrides } from "@/lib/ai/provider-config"
import { normalizeUpstreamError, normalizeClientError } from "@/lib/ai/errors"
import { fetchWithTimeout } from "@/lib/ai/server-fetch"

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>

  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_request", message: "Invalid JSON body" } },
      { status: 400 },
    )
  }

  // P2-5B: 支持前端传入局部覆盖
  const overrides: AiProviderOverrides | undefined =
    body._providerOverrides && typeof body._providerOverrides === "object"
      ? (body._providerOverrides as AiProviderOverrides)
      : undefined

  let config
  try {
    config = mergeProviderConfig(overrides)
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI provider not configured"
    return NextResponse.json(
      { error: { code: "config_error", message } },
      { status: 500 },
    )
  }

  const model = (typeof body.model === "string" ? body.model : undefined) ?? config.defaultModel
  const messages = Array.isArray(body.messages) ? body.messages : []
  const temperature = typeof body.temperature === "number" ? body.temperature : undefined

  if (messages.length === 0) {
    return NextResponse.json(
      { error: { code: "invalid_request", message: "Messages array is required" } },
      { status: 400 },
    )
  }

  try {
    const upstream = await fetchWithTimeout(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: temperature ?? 0.7,
        ...(body.response_format ? { response_format: body.response_format } : {}),
      }),
    }, config.timeoutMs)

    const text = await upstream.text()

    if (!upstream.ok) {
      const error = normalizeUpstreamError(upstream.status, text, config.type)
      return NextResponse.json({ error }, { status: upstream.status })
    }

    try {
      const data = JSON.parse(text)
      return NextResponse.json({
        content: data.choices?.[0]?.message?.content ?? text,
        model: data.model ?? model,
        usage: data.usage,
      })
    } catch {
      return NextResponse.json({ content: text, model })
    }
  } catch (error) {
    const normalized = normalizeClientError(error, config.type)
    return NextResponse.json({ error: normalized }, { status: normalized.status ?? 500 })
  }
}
