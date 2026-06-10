// ============================================================================
// POST /api/ai/talking-photo — 照片说话 / 数字人
// 后端代理到本地部署的 MuseTalk / LivePortrait / SadTalker 服务
// ============================================================================
// 服务端数字人模型需要单独部署 Docker 容器。
// 环境变量 TALKING_PHOTO_SERVICE_URL 指定后端服务地址，例如：
//   - "http://localhost:8090" (MuseTalk-API)
//   - "http://localhost:8091" (faster-SadTalker-API)
// ============================================================================

import { NextRequest, NextResponse } from "next/server"
import { fetchWithTimeout } from "@/lib/ai/server-fetch"

// ── 类型定义 ────────────────────────────────────────────────────────────────

type TalkingPhotoMode = "lip-sync" | "full-head" | "avatar"
type AudioSource = "text-to-speech" | "upload" | "clone"

interface TalkingPhotoRequest {
  image: string          // base64 或 data URL
  audio?: string         // base64 音频（audioSource=upload）
  text?: string          // TTS 文本（audioSource=text-to-speech）
  mode: TalkingPhotoMode
  audioSource: AudioSource
  voiceId?: string
  language?: string
  emotion?: string
  headMovement?: boolean
  eyeContact?: boolean
  background?: string
}

interface TalkingPhotoResponse {
  status: "processing" | "completed" | "failed"
  videoUrl?: string          // 结果视频 URL
  videoBase64?: string       // 结果视频 base64（非持久化）
  durationMs?: number
  error?: string
  /**
   * 如果后端未部署，返回 not_ready 状态
   */
  deploymentGuide?: string
}

// ── 配置 ────────────────────────────────────────────────────────────────────

const TALKING_PHOTO_SERVICE_URL = process.env.TALKING_PHOTO_SERVICE_URL || ""
const REQUEST_TIMEOUT = 120_000 // 120s（视频生成可能较慢）

const DEPLOYMENT_GUIDE = `
## 数字人/照片说话部署方案

### 方式一：MuseTalk （MIT, 6k⭐，推荐）
- docker run --gpus all -p 8090:8090 musetalk-api
- 基于 MuseTalk-API 封装（github.com/ruxir-ig/MuseTalk-API）
- 实时口型同步，需要 RTX 4090+

### 方式二：SadTalker（Apache-2.0, 13.9k⭐）
- docker-compose -f sad-talker-api/docker-compose.yml up
- 基于 faster-SadTalker-API 封装（github.com/kenwaytis/faster-SadTalker-API）
- 单张图片生成说话视频，显卡要求低

### 方式三：云端 API（快速上线）
- HeyGen / D-ID / Synthesia
- 无需本地 GPU，按分钟计费
`

// ── 路由 ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: TalkingPhotoRequest

  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_request", message: "Invalid JSON body" } },
      { status: 400 },
    )
  }

  // 输入验证
  if (!body.image) {
    return NextResponse.json(
      { error: { code: "invalid_request", message: "image (base64 or data URL) is required" } },
      { status: 400 },
    )
  }

  const hasAudio = body.audioSource === "upload" ? !!body.audio : !!body.text
  if (!hasAudio) {
    return NextResponse.json(
      { error: { code: "invalid_request", message: "audio or text is required" } },
      { status: 400 },
    )
  }

  // 如果后端未部署，返回部署指南
  if (!TALKING_PHOTO_SERVICE_URL) {
    return NextResponse.json({
      status: "not_ready",
      message: "数字人服务未部署。请部署 MuseTalk/SadTalker Docker 容器后设置 TALKING_PHOTO_SERVICE_URL",
      guide: DEPLOYMENT_GUIDE,
      recommendedNextSteps: [
        "1. 部署 LivePortrait 或 MuseTalk 服务",
        "2. 设置 TALKING_PHOTO_SERVICE_URL 环境变量",
        "3. 或接入 HeyGen/D-ID 云端 API",
      ],
    })
  }

  // 调用后端服务
  try {
    const response = await fetchWithTimeout(
      `${TALKING_PHOTO_SERVICE_URL}/api/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: body.image,
          audio: body.audioSource === "upload" ? body.audio : undefined,
          text: body.audioSource === "text-to-speech" ? body.text : undefined,
          mode: body.mode,
          voice_id: body.voiceId,
          language: body.language || "zh",
          emotion: body.emotion || "neutral",
        }),
      },
      REQUEST_TIMEOUT,
    )

    if (!response.ok) {
      const errorText = await response.text().catch(() => "")
      return NextResponse.json(
        { error: { code: "upstream_error", message: `数字人服务返回错误 [${response.status}]: ${errorText}` } },
        { status: response.status },
      )
    }

    const data: TalkingPhotoResponse = await response.json()

    return NextResponse.json({
      status: data.status,
      videoBase64: data.videoBase64,
      videoUrl: data.videoUrl,
      durationMs: data.durationMs,
      error: data.error,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "未知错误"
    console.error("[TalkingPhoto] 调用数字人服务失败:", message)
    return NextResponse.json(
      { error: { code: "service_unavailable", message: `数字人服务不可用: ${message}` } },
      { status: 503 },
    )
  }
}
