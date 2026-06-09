// ============================================================================
// POST /api/ai/talking-photo — 照片说话 / 数字人
// ============================================================================
// 当前状态：服务端数字人模型未部署，返回处理建议和前准备信息。
// 后续可接入 LivePortrait、MuseTalk、SadTalker、HeyGen API 等。
// ============================================================================

import { NextRequest, NextResponse } from "next/server"

type TalkingPhotoMode = "lip-sync" | "full-head" | "avatar"

interface TalkingPhotoOptions {
  mode: TalkingPhotoMode
  audioSource: "text-to-speech" | "upload" | "clone"
  voiceId?: string
  language?: string
  emotion?: "neutral" | "happy" | "sad" | "angry" | "surprised"
  headMovement: boolean
  eyeContact: boolean
  background: "transparent" | "blur" | "original"
}

const DEPLOYMENT_GUIDE = `
## 数字人/照片说话部署方案

### 方案一：LivePortrait + TTS（本地部署）
- **适用**：本地 GPU 充足，注重隐私
- **组件**：
  - LivePortrait：生成面部动画
  - VoxCPM2 / GPT-SoVITS：语音克隆
  - ffmpeg：视频合成
- **部署**：docker-compose up -d
- **API**：POST /api/ai/talking-photo/liveportrait

### 方案二：MuseTalk（实时对口型）
- **适用**：实时应用，低延迟
- **优点**：口型同步质量高
- **要求**：RTX 4090 或更高
- **部署**：详见 MuseTalk GitHub

### 方案三：云端 API（快速上线）
- **推荐**：HeyGen、D-ID、Synthesia
- **优点**：无需本地 GPU，质量稳定
- **注意**：按分钟计费，注意成本控制

### 方案四：SadTalker（轻量级）
- **适用**：快速原型，单张图片
- **优点**：部署简单，显存要求低
- **缺点**：质量不如 LivePortrait
`

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

  const imageData = typeof body.image === "string" ? body.image : ""
  const audioData = typeof body.audio === "string" ? body.audio : ""
  const text = typeof body.text === "string" ? body.text : ""

  const options: TalkingPhotoOptions = {
    mode: (body.mode as TalkingPhotoMode) || "lip-sync",
    audioSource: (body.audioSource as TalkingPhotoOptions["audioSource"]) || "text-to-speech",
    voiceId: typeof body.voiceId === "string" ? body.voiceId : undefined,
    language: typeof body.language === "string" ? body.language : "zh",
    emotion: (body.emotion as TalkingPhotoOptions["emotion"]) || "neutral",
    headMovement: body.headMovement !== false,
    eyeContact: body.eyeContact !== false,
    background: (body.background as TalkingPhotoOptions["background"]) || "original",
  }

  if (!imageData) {
    return NextResponse.json(
      { error: { code: "invalid_request", message: "image (base64 or data URL) is required" } },
      { status: 400 },
    )
  }

  if (!audioData && !text) {
    return NextResponse.json(
      { error: { code: "invalid_request", message: "audio or text is required" } },
      { status: 400 },
    )
  }

  // 当前服务端数字人模型未部署
  return NextResponse.json({
    status: "not_ready",
    message: "服务端数字人模型尚未部署",
    options,
    guide: DEPLOYMENT_GUIDE,
    recommendedNextSteps: [
      "1. 部署 LivePortrait 服务（docker run liveportrait）",
      "2. 配置 TALKING_PHOTO_SERVICE_URL 环境变量",
      "3. 或接入 HeyGen/D-ID 云端 API",
      "4. 重新启动服务即可生效",
    ],
    clientFallback: {
      available: false,
      note: "数字人需要服务端 GPU，暂不支持纯前端方案",
    },
  })
}
