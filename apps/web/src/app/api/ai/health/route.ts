// ============================================================================
// GET+POST /api/ai/health — AI 连接测试 (P2-5A, P2-5B fix)
// ============================================================================
// GET: 测试 .env 服务端配置的连接。
// POST: 接受 { _providerOverrides } 测试 Local Override 配置。
// 发一个最小 chat 请求到中转站验证配置是否正确。
// ============================================================================

import { NextRequest, NextResponse } from "next/server"
import type { AiProviderOverrides } from "../../../../lib/ai/provider-config"
import { handleHealthGet, handleHealthPost } from "./health-core"

// ────────────────────────────────────────────────────────────────────────────
// GET — 测试 .env 服务端配置
// ────────────────────────────────────────────────────────────────────────────
export async function GET() {
  const result = await handleHealthGet()
  return NextResponse.json(result.body, result.status ? { status: result.status } : undefined)
}

// ────────────────────────────────────────────────────────────────────────────
// POST — 测试 Local Override 配置 (P2-5B fix)
// ────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  let overrides: AiProviderOverrides | undefined

  // 解析请求体
  try {
    const body = await request.json()
    overrides = body._providerOverrides
  } catch {
    // 无请求体或无覆盖配置，fallback 到 GET 行为
  }

  const result = await handleHealthPost(overrides)
  return NextResponse.json(result.body, result.status ? { status: result.status } : undefined)
}
