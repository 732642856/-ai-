// ============================================================================
// VoxCPM TTS API Route — 声音克隆 + 多语言 TTS + 情感控制
// ============================================================================
// 集成 OpenBMB/VoxCPM2 (Apache-2.0, 2B参数, 30+语言, 48kHz)
// 需要: VoxCPM vLLM-Omni 服务器运行在 VOXCPM_BASE_URL
// 文档: https://github.com/OpenBMB/VoxCPM
// ============================================================================

import { NextRequest, NextResponse } from "next/server"

// ============================================================================
// Types
// ============================================================================

interface VoxCPMRequest {
  text: string
  voice?: "default" | string        // 声音ID
  referenceAudioUrl?: string         // 参考音频URL（声音克隆）
  referenceText?: string             // 参考音频文本（极致克隆）
  speed?: number                     // 语速 (0.5-2.0)
  emotion?: "neutral" | "happy" | "sad" | "angry" | "gentle" | "excited"
  language?: string                  // 语言代码 (zh/en/ja/ko/...)
}

interface VoxCPMResponse {
  audioData: string                  // Base64 encoded WAV
  format: "wav"
  sampleRate: number
  duration: number
  voiceUsed: string
}

// ============================================================================
// Helpers
// ============================================================================

/** Convert ArrayBuffer to Base64 string (Node.js + Edge Runtime compatible) */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// ============================================================================
// Configuration
// ============================================================================

const VOXCPM_BASE_URL =
  process.env.VOXCPM_BASE_URL ||
  process.env.NEXT_PUBLIC_VOXCPM_URL ||
  "http://localhost:8000"

const VOXCPM_MODEL = process.env.VOXCPM_MODEL || "openbmb/VoxCPM2"

// ============================================================================
// API Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: VoxCPMRequest = await request.json()

    if (!body.text || body.text.trim().length === 0) {
      return NextResponse.json(
        { error: "text is required" },
        { status: 400 },
      )
    }

    // Build enhanced prompt with style instructions
    let enhancedText = body.text
    const styleTags: string[] = []

    if (body.emotion && body.emotion !== "neutral") {
      const emotionMap: Record<string, string> = {
        happy: "cheerful and bright tone",
        sad: "sorrowful and slow tone",
        angry: "intense and powerful tone",
        gentle: "soft and warm tone",
        excited: "energetic and enthusiastic tone",
      }
      styleTags.push(emotionMap[body.emotion] || body.emotion)
    }

    if (body.speed) {
      const speedDesc = body.speed > 1.2 ? "faster pace" : body.speed < 0.8 ? "slower pace" : ""
      if (speedDesc) styleTags.push(speedDesc)
    }

    if (styleTags.length > 0) {
      enhancedText = `(${styleTags.join(", ")})${body.text}`
    }

    // Build vLLM-Omni compatible request
    const voxcpmPayload: Record<string, unknown> = {
      model: VOXCPM_MODEL,
      input: enhancedText,
      voice: body.voice || "default",
    }

    // Voice cloning via reference audio
    if (body.referenceAudioUrl) {
      voxcpmPayload.reference_audio = body.referenceAudioUrl
      if (body.referenceText) {
        voxcpmPayload.prompt_text = body.referenceText
      }
    }

    // Language hint
    if (body.language) {
      voxcpmPayload.language = body.language
    }

    console.log(`[VoxCPM] Generating TTS: text=${body.text.slice(0, 50)}... voice=${body.voice || "default"}`)

    // Call VoxCPM vLLM-Omni endpoint (OpenAI-compatible)
    const startTime = Date.now()
    const response = await fetch(`${VOXCPM_BASE_URL}/v1/audio/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(voxcpmPayload),
      signal: AbortSignal.timeout(60000),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => "Unknown error")
      console.error(`[VoxCPM] API error ${response.status}: ${errText.slice(0, 200)}`)
      return NextResponse.json(
        { error: `VoxCPM API error: ${response.status}` },
        { status: 502 },
      )
    }

    // Get audio as ArrayBuffer and convert to Base64
    const audioBuffer = await response.arrayBuffer()
    const audioBase64 = arrayBufferToBase64(audioBuffer)
    const duration = Date.now() - startTime

    console.log(`[VoxCPM] Generated in ${duration}ms, size=${(audioBuffer.byteLength / 1024).toFixed(1)}KB`)

    const result: VoxCPMResponse = {
      audioData: audioBase64,
      format: "wav",
      sampleRate: 48000,
      duration: duration / 1000,
      voiceUsed: (body.voice || "default") as string,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[VoxCPM] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}

// ============================================================================
// GET — Health Check / Available Voices
// ============================================================================

export async function GET() {
  try {
    // Check if VoxCPM server is reachable
    const response = await fetch(`${VOXCPM_BASE_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    }).catch(() => null)

    const available = response !== null && response.ok

    return NextResponse.json({
      service: "VoxCPM2",
      model: VOXCPM_MODEL,
      available,
      baseUrl: VOXCPM_BASE_URL,
      features: {
        voiceCloning: true,
        voiceDesign: true,
        emotionControl: true,
        languages: 30,
        dialects: ["四川话", "粤语", "吴语", "东北话", "河南话", "陕西话", "山东话", "天津话", "闽南话"],
        sampleRate: 48000,
      },
      license: "Apache-2.0",
      source: "https://github.com/OpenBMB/VoxCPM",
    })
  } catch {
    return NextResponse.json({
      service: "VoxCPM2",
      available: false,
      message: "VoxCPM server not reachable. Deploy with: vllm serve openbmb/VoxCPM2 --omni --port 8000",
    })
  }
}
