// ============================================================================
// GET /api/ai/config — 获取当前 Provider 配置（不含 API Key）(P2-5A)
// ============================================================================
// 前端 SettingsPanel 等组件调用此接口获取可展示的配置信息。
// ============================================================================

import { NextResponse } from "next/server"
import { getAiProviderConfigSafe } from "@/lib/ai/provider-config"

export async function GET() {
  try {
    const config = getAiProviderConfigSafe()
    return NextResponse.json(config)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Config unavailable"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
