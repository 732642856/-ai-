// ============================================================================
// Bible Director API Route — 一致性导演 API
// 利用 Bible 数据（角色/场景/风格）增强分镜生成
// ============================================================================
import { NextRequest, NextResponse } from "next/server"
import { mergeProviderConfig } from "@/lib/ai/provider-config"
import { normalizeUpstreamError, normalizeClientError } from "@/lib/ai/errors"
import { fetchWithTimeout } from "@/lib/ai/server-fetch"
import {
  buildBibleDirectorSystemPrompt,
  buildBibleDirectorUserPrompt,
  type BibleDirectorInput,
} from "@/lib/ai/bible-director-agent"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // 输入验证
    if (!body || typeof body.task !== "string" || body.task.trim().length === 0) {
      return NextResponse.json(
        { error: { message: "缺少必填字段 task", code: "INVALID_INPUT" } },
        { status: 400 },
      )
    }
    
    const input = body as BibleDirectorInput & { _providerOverrides?: any }
    const { _providerOverrides, ...bibleInput } = input

    // 获取 AI 配置
    const config = mergeProviderConfig(_providerOverrides)
    const model = config.defaultModel
    const timeoutMs = config.timeoutMs || 120000

    // 构建 system + user prompt
    const systemPrompt = buildBibleDirectorSystemPrompt(bibleInput as BibleDirectorInput)
    const userPrompt = buildBibleDirectorUserPrompt(bibleInput as BibleDirectorInput)

    // 调用 OpenAI 兼容 API
    const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`
    const upstream = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
    }, timeoutMs)

    if (!upstream.ok) {
      const errorText = await upstream.text().catch(() => "")
      const error = normalizeUpstreamError(upstream.status, errorText, config.type)
      return NextResponse.json({ error }, { status: upstream.status })
    }

    const data = await upstream.json()
    const content = data.choices?.[0]?.message?.content || ""

    // 尝试解析 JSON 输出
    let parsed: any = null
    try {
      // 尝试从 markdown code block 中提取 JSON
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
      const jsonStr = jsonMatch ? jsonMatch[1] : content
      parsed = JSON.parse(jsonStr.trim())
    } catch {
      // JSON 解析失败，返回原始文本
    }

    return NextResponse.json({
      success: true,
      content,
      parsed,
      meta: {
        model,
        task: bibleInput.task,
        charactersCount: bibleInput.characters?.length || 0,
        scenesCount: bibleInput.scenes?.length || 0,
        stylesCount: bibleInput.styles?.length || 0,
      },
    })
  } catch (error: any) {
    const normalized = normalizeClientError(error)
    return NextResponse.json({ error: normalized }, { status: 500 })
  }
}
