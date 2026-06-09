// ============================================================================
// /api/ai/tts — 星轨画布 TTS（文本转语音）API 代理
//
// 后端：VoxCPM2（通过 vLLM-Omni 暴露的 OpenAI 兼容 API）
// 端点：POST /v1/audio/speech
// 协议：SSE 流式返回进度 + base64 WAV 结果
// ============================================================================

import { NextRequest } from "next/server"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TtsGenerateRequest {
  text: string
  voice?: string
  voiceDescription?: string
  referenceWav?: string
  model?: string
  streaming?: boolean
  speed?: number
}

interface VoxcpmSpeechResponse {
  audioBase64: string
  format: string
  durationMs: number
  model: string
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const VOXCPM_BASE_URL = process.env.VOXCPM_BASE_URL || ""
const DEFAULT_MODEL = "openbmb/VoxCPM2"
const FETCH_TIMEOUT_MS = 120_000 // 2 分钟，长文本 TTS 可能需要较长时间

// ---------------------------------------------------------------------------
// SSE helpers
// ---------------------------------------------------------------------------

function sseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

// ---------------------------------------------------------------------------
// Estimate audio duration from text length (rough heuristic)
// ---------------------------------------------------------------------------

function estimateDurationMs(text: string, speed: number): number {
  // 中文约每秒 3-4 字，英文约每秒 3-4 词；取平均约 3.5 字/秒
  const charCount = text.length
  const baseDurationMs = (charCount / 3.5) * 1000
  return Math.round(baseDurationMs / speed)
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // 检查 VoxCPM2 后端地址是否配置
  if (!VOXCPM_BASE_URL) {
    return new Response(
      sseEvent("error", {
        message: "VOXCPM_BASE_URL 未配置，请在环境变量中设置 VoxCPM2 服务地址",
        code: "CONFIG_MISSING",
      }),
      {
        status: 500,
        headers: { "Content-Type": "text/event-stream; charset=utf-8" },
      },
    )
  }

  // 解析请求体
  let body: TtsGenerateRequest
  try {
    body = await req.json()
  } catch {
    return new Response(
      sseEvent("error", { message: "请求体不是有效的 JSON", code: "INVALID_JSON" }),
      {
        status: 400,
        headers: { "Content-Type": "text/event-stream; charset=utf-8" },
      },
    )
  }

  if (!body.text || typeof body.text !== "string" || body.text.trim().length === 0) {
    return new Response(
      sseEvent("error", { message: "text 字段不能为空", code: "MISSING_TEXT" }),
      {
        status: 400,
        headers: { "Content-Type": "text/event-stream; charset=utf-8" },
      },
    )
  }

  const {
    text,
    voice = "default",
    voiceDescription,
    referenceWav,
    model = DEFAULT_MODEL,
    streaming = false,
    speed = 1.0,
  } = body

  // 构造发送给 VoxCPM2 的文本
  // 如果是 voice design 模式，在 input 前加描述前缀
  const inputText = voiceDescription
    ? `(${voiceDescription})${text}`
    : text

  // 构造 OpenAI TTS 兼容的请求体
  const voxcpmBody: Record<string, unknown> = {
    model,
    input: inputText,
    voice,
    response_format: "wav",
    speed,
  }

  // 如果有参考音频（声音克隆），添加参数
  if (referenceWav) {
    voxcpmBody.reference_wav = referenceWav
  }

  // 创建 SSE 流
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseEvent(event, data)))
      }

      try {
        // Step 1: 发送进度 — 正在连接 VoxCPM2
        send("progress", {
          stage: "connecting",
          percent: 10,
          message: "正在连接语音合成服务...",
        })

        // Step 2: 调用 VoxCPM2 的 /v1/audio/speech
        const estimatedDuration = estimateDurationMs(text, speed)

        send("progress", {
          stage: "synthesizing",
          percent: 30,
          message: "语音合成中...",
          estimatedDurationMs: estimatedDuration,
        })

        const controllerObj = new AbortController()
        const timeoutId = setTimeout(() => controllerObj.abort(), FETCH_TIMEOUT_MS)

        let response: Response
        try {
          response = await fetch(`${VOXCPM_BASE_URL}/audio/speech`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(voxcpmBody),
            signal: controllerObj.signal,
          })
        } finally {
          clearTimeout(timeoutId)
        }

        if (!response.ok) {
          let errorText: string
          try {
            errorText = await response.text()
          } catch {
            errorText = "Unknown error"
          }

          let errorJson: { message?: string; code?: string } = {}
          try {
            errorJson = JSON.parse(errorText)
          } catch {
            // 尝试解析错误体失败，使用原始文本
          }

          send("error", {
            message: errorJson.message || `语音合成服务返回错误 [${response.status}]`,
            code: errorJson.code || String(response.status),
          })
          controller.close()
          return
        }

        send("progress", {
          stage: "synthesizing",
          percent: 60,
          message: "音频数据接收中...",
        })

        if (streaming) {
          // ==================================================================
          // streaming 模式：直接转发 WAV Chunk（二进制流）
          // ==================================================================
          const contentType = response.headers.get("content-type") || "audio/wav"

          // 先发送 result 事件告知前端即将开始流式传输
          send("progress", {
            stage: "streaming",
            percent: 80,
            message: "开始流式传输音频数据...",
          })

          // 使用 ReadableStream 转发二进制数据
          if (!response.body) {
            send("error", {
              message: "后端未返回可读流",
              code: "STREAM_ERROR",
            })
            controller.close()
            return
          }

          const reader = response.body.getReader()
          const pump = async () => {
            try {
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                // 将二进制 chunk 编码为 base64 并通过 SSE 发送
                const base64Chunk = Buffer.from(value).toString("base64")
                send("audio_chunk", {
                  data: base64Chunk,
                  format: "wav",
                  model,
                })
              }
            } finally {
              reader.releaseLock()
            }
          }

          await pump()

          send("progress", {
            stage: "done",
            percent: 100,
            message: "语音合成完成",
          })
          controller.close()
        } else {
          // ==================================================================
          // 非 streaming 模式：等待完整 WAV，返回 base64
          // ==================================================================
          send("progress", {
            stage: "synthesizing",
            percent: 80,
            message: "合成完成，处理音频数据中...",
          })

          // 用 Buffer 读取完整的二进制响应（WAV 可能很大）
          const arrayBuffer = await response.arrayBuffer()
          const audioBuffer = Buffer.from(arrayBuffer)

          send("progress", {
            stage: "synthesizing",
            percent: 90,
            message: "正在编码音频数据...",
          })

          send("progress", {
            stage: "done",
            percent: 100,
            message: "语音合成完成！",
          })

          // 返回 base64 编码的音频数据
          const result: VoxcpmSpeechResponse = {
            audioBase64: audioBuffer.toString("base64"),
            format: "wav",
            durationMs: estimatedDuration,
            model,
          }

          send("result", result)
          controller.close()
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          send("error", {
            message: "语音合成请求超时，请尝试缩短文本长度",
            code: "TIMEOUT",
          })
        } else {
          const message = err instanceof Error ? err.message : "未知错误"
          send("error", { message, code: "INTERNAL_ERROR" })
        }
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
}
