// ============================================================================
// Image Generation API Route - Supports text-to-image and image-to-image
// Used by ContentNode AI 生成 and ImageNode AI 生成
// ============================================================================
import { NextRequest, NextResponse } from "next/server"
import { getAiProviderConfig } from "@/lib/ai/provider-config"
import { normalizeUpstreamError, normalizeClientError } from "@/lib/ai/errors"

/**
 * Build the prompt enhancement system prompt.
 * When sourceImage is present (image-to-image), the enhancement
 * MUST preserve the reference image's content and only describe
 * how to transform it.
 */
function buildEnhanceSystemPrompt(hasSourceImage: boolean): string {
  if (hasSourceImage) {
    return `You are an expert image prompt engineer. The user will provide a transformation request for an existing image (e.g., "turn this into a night scene").

Rules:
1. Translate Chinese to English if needed
2. The prompt MUST describe how to transform the SOURCE image — do NOT invent a new subject
3. Focus on lighting, atmosphere, style transfer, and mood changes
4. Explicitly mention: "modify the uploaded image", "preserve the original composition"
5. Output ONLY the final prompt text, no explanations
6. Keep under 200 words`
  }
  return `You are an expert image prompt engineer specializing in translating Chinese creative requests into high-quality English image generation prompts.

Rules:
1. Translate all Chinese content to English
2. Preserve the exact creative intent — do not change the subject matter
3. Add specific details: composition, lighting, style, mood, color palette
4. For character design requests, explicitly request: "orthographic three-view character design sheet, front view + side view + back view, clean white background, consistent character design, detailed line art style, professional concept art"
5. For scene/environment requests, add: "cinematic lighting, highly detailed, 8K quality, professional photography"
6. Output ONLY the final prompt text, no explanations
7. Keep under 250 words`
}

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
    const sourceImage = typeof body.sourceImage === "string" ? body.sourceImage : body.image
    const model = (typeof reqModel === "string" ? reqModel : undefined) ?? config.defaultImageModel

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    // Enhance prompt (always — ensures Chinese prompts work well)
    let finalPrompt = prompt
    const isChinese = /[\u4e00-\u9fa5]/.test(prompt)

    if (isChinese || prompt.length < 30) {
      try {
        const hasSource = !!sourceImage
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
                content: buildEnhanceSystemPrompt(hasSource),
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
    // gpt-image-2 supports image-to-image via the "image" parameter (base64)
    const requestBody: Record<string, any> = {
      model,
      prompt: finalPrompt,
      n: 1,
      size,
      response_format: "b64_json",
    }

    if (sourceImage && typeof sourceImage === "string") {
      // sourceImage is expected to be a data URI: "data:image/png;base64,..."
      // gpt-image-2 accepts base64 images in the "image" field
      requestBody["image"] = sourceImage
    }

    const imageRes = await fetch(`${config.baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
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
