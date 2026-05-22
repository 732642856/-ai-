// ============================================================================
// Image Generation API Route - Non-streaming JSON response
// Used by ContentNode AI生图 and ImageHoverToolbar AI变体
// ============================================================================
import { NextRequest, NextResponse } from "next/server"
import { getAiProviderConfig } from "@/lib/ai/provider-config"
import { normalizeUpstreamError, normalizeClientError } from "@/lib/ai/errors"

export async function POST(request: NextRequest) {
  let config
  try {
    config = getAiProviderConfig()
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI provider not configured"
    return NextResponse.json({ error: message }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { prompt, model: reqModel, size = "1024x1024" } = body
    const model = (typeof reqModel === "string" ? reqModel : undefined) ?? config.defaultImageModel

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    // Always enhance prompt for better image generation quality
    let finalPrompt = prompt
    const isChinese = /[\u4e00-\u9fa5]/.test(prompt)

    if (isChinese || prompt.length < 30) {
      try {
        const enhanceRes = await fetch(`${config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.defaultModel,
            messages: [
              {
                role: "system",
                content: `You are an expert image prompt engineer specializing in translating Chinese creative requests into high-quality English image generation prompts.

Rules:
1. Translate all Chinese content to English
2. Preserve the exact creative intent - do not change the subject matter
3. Add specific details: composition, lighting, style, mood, color palette
4. For character design requests (三视图/orthographic views), explicitly request: "orthographic three-view character design sheet, front view + side view + back view, clean white background, consistent character design, detailed line art style, professional concept art"
5. For scene/environment requests, add: "cinematic lighting, highly detailed, 8K quality, professional photography"
6. Output ONLY the final prompt text, no explanations
7. Keep under 250 words`,
              },
              { role: "user", content: prompt },
            ],
            stream: false,
            temperature: 0.7,
          }),
        })

        if (enhanceRes.ok) {
          const enhanceData = await enhanceRes.json()
          const enhanced = enhanceData.choices?.[0]?.message?.content?.trim()
          if (enhanced) finalPrompt = enhanced
        }
      } catch {
        // Enhancement failed, use original
      }
    }

    // Call image generation API
    const imageRes = await fetch(`${config.baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt: finalPrompt,
        n: 1,
        size,
        response_format: "b64_json",
      }),
    })

    if (!imageRes.ok) {
      const errorText = await imageRes.text()
      const error = normalizeUpstreamError(imageRes.status, errorText, config.type)
      return NextResponse.json({ error: error.message }, { status: imageRes.status })
    }

    const imageData = await imageRes.json()
    const b64Json = imageData.data?.[0]?.b64_json

    if (!b64Json) {
      const url = imageData.data?.[0]?.url
      if (url) {
        return NextResponse.json({
          imageUrl: url,
          prompt: finalPrompt,
          model,
          revisedPrompt: imageData.data?.[0]?.revised_prompt || finalPrompt,
        })
      }
      return NextResponse.json({ error: "No image data returned" }, { status: 500 })
    }

    return NextResponse.json({
      imageUrl: `data:image/png;base64,${b64Json}`,
      prompt: finalPrompt,
      model,
      revisedPrompt: imageData.data?.[0]?.revised_prompt || finalPrompt,
    })
  } catch (error) {
    console.error("[Generate Image API Error]", error)
    const normalized = normalizeClientError(error, config.type)
    return NextResponse.json({ error: normalized.message }, { status: normalized.status ?? 500 })
  }
}
