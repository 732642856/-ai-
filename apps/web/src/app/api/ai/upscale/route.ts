// ============================================================================
// POST /api/ai/upscale — 图片高清放大
// ============================================================================
// 当前状态：服务端 upscale 模型未部署，返回处理建议和前准备信息。
// 后续可接入 Real-ESRGAN、ESRGAN+、Stable Diffusion img2img 等模型。
// ============================================================================

import { NextRequest, NextResponse } from "next/server"

interface UpscaleOptions {
  scale: 2 | 4 | 8
  denoise: number // 0-1
  faceEnhance: boolean
  model: "realesrgan" | "esrgan" | "sd-upscale"
}

const UPGRADE_GUIDE = `
## 高清放大方案

### 方案一：Real-ESRGAN（推荐）
- **适用**：照片、插画、动漫
- **优点**：速度快，细节恢复好
- **部署**：docker run -v /models:/models -p 7860:7860 realesrgan:latest
- **API**：POST http://localhost:7860/api/predict

### 方案二：Stable Diffusion img2img
- **适用**：艺术风格图、需要创意增强
- **优点**：可结合提示词优化细节
- **参数**：denoising 0.2-0.4，保留原图结构

### 方案三：云端 API
- **推荐**：Bigjpg、Let's Enhance、Upscayl
- **优点**：无需本地 GPU
- **注意**：注意隐私和版权

### 客户端临时方案
- 使用 Canvas API 进行双三次插值放大
- 配合轻微锐化（unsharp mask）
- 适合预览，不适合最终输出
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
  const scale = (body.scale as 2 | 4 | 8) || 4
  const options: UpscaleOptions = {
    scale,
    denoise: typeof body.denoise === "number" ? body.denoise : 0.5,
    faceEnhance: body.faceEnhance === true,
    model: (body.model as UpscaleOptions["model"]) || "realesrgan",
  }

  if (!imageData) {
    return NextResponse.json(
      { error: { code: "invalid_request", message: "image (base64 or data URL) is required" } },
      { status: 400 },
    )
  }

  // 当前服务端 upscale 模型未部署
  // 返回处理建议和前准备信息
  return NextResponse.json({
    status: "not_ready",
    message: "服务端高清放大模型尚未部署",
    options,
    guide: UPGRADE_GUIDE,
    recommendedNextSteps: [
      "1. 部署 Real-ESRGAN 服务（docker run realesrgan）",
      "2. 配置 UPSCALE_SERVICE_URL 环境变量",
      "3. 重新启动服务即可生效",
    ],
    clientFallback: {
      available: true,
      method: "canvas-bicubic",
      note: "前端已支持 Canvas 双三次插值放大，适合预览",
    },
  })
}
