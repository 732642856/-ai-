// ============================================================================
// SSE Streaming Chat API Route
// Implements Server-Sent Events for real-time AI response streaming
// Supports: text models (OpenAI-compatible), image models, video models
// ============================================================================
import { NextRequest, NextResponse } from "next/server"

// ============================================================================
// CONFIGURATION - read from environment
// ============================================================================
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.openai.com/v1"
const API_KEY = process.env.OPENAI_API_KEY || ""

// ============================================================================
// MODEL ENDPOINT MAPPING
// Different model types use different API endpoints
// ============================================================================
const getEndpointForModel = (model: string): { endpoint: string; bodyTransformer: (body: any) => any } => {
  // 文本对话模型 → /v1/chat/completions
  if (["gpt-4o", "claude-3.5-sonnet", "gemini-pro", "glm-4", "gpt-5.5", "gpt-4o-audio-preview"].includes(model)) {
    return {
      endpoint: `${API_BASE_URL}/chat/completions`,
      bodyTransformer: (body) => ({
        model: model,
        messages: body.messages,
        stream: true,
      }),
    }
  }

  // 图像生成模型 → /v1/images/generations
  if (["banana-pro", "mj-v7", "gpt-image-2"].includes(model)) {
    return {
      endpoint: `${API_BASE_URL}/images/generations`,
      bodyTransformer: (body) => ({
        model: model === "gpt-image-2" ? "dall-e-3" : model,
        prompt: body.messages?.[body.messages.length - 1]?.content || "",
        n: 1,
        size: "1024x1024",
      }),
    }
  }

  // 视频生成模型 → 各自独立 API（需用户自行配置）
  if (["seedance-2.0", "kling-o3", "wan-2.6", "vidu"].includes(model)) {
    return {
      endpoint: `${API_BASE_URL}/chat/completions`, // fallback to chat
      bodyTransformer: (body) => ({
        model: model,
        messages: body.messages,
        stream: true,
      }),
    }
  }

  // 默认 → chat/completions
  return {
    endpoint: `${API_BASE_URL}/chat/completions`,
    bodyTransformer: (body) => ({
      model: model,
      messages: body.messages,
      stream: true,
    }),
  }
}

// ============================================================================
// CONTEXT DETERMINATION
// ============================================================================
const CASUAL_PATTERNS = /^(你好|您好|嗨|哈喽|hello|hi|hey|在吗|早上好|下午好|晚上好|谢谢|感谢|辛苦了|ok|好的|收到|嗯|啊|哈)$/i

const isCasualMessage = (text: string): boolean => {
  return CASUAL_PATTERNS.test(text.trim().replace(/[。！!？?~～,.，\s]/g, ""))
}

const wantsCanvasContext = (input: string): boolean => {
  const contextKeywords = [
    "当前画布", "画布上", "这些节点", "所有节点", "节点们", "节点",
    "这些图片", "素材", "全部素材", "项目", "画布",
    "这张图", "这张图片", "根据这张图", "根据这张图片", "分析这张图", "分析这张图片",
    "图片", "首帧", "图生成", "生成图",
    "改短一点", "改长一点", "改一下", "改写", "润色", "优化这段", "这段", "这个文本",
    "这段话", "这句话", "这个 prompt", "这段 prompt", "prompt改", "改 prompt",
    "拆分镜", "拆成", "分镜", "继续分镜", "首帧",
    "生成首帧", "生成图", "生成图片", "生成 prompt", "生成 Prompt",
    "根据素材", "根据图片", "分析素材",
    "参照", "参考", "这张", "那张",
  ]
  return contextKeywords.some(k => input.includes(k))
}

// ============================================================================
// MESSAGE BUILDING
// ============================================================================
type CanvasNodeContext = {
  id: string
  type?: string
  nodeKind?: string
  title?: string
  prompt?: string
  content?: string
  summary?: string
  workflowRole?: string
  status?: string
  model?: string
  duration?: string
  fileName?: string
  mimeType?: string
  imageUrl?: string
  assetUrl?: string
  inputs?: Array<{ label?: string; type?: string }>
  outputs?: Array<{ label?: string; type?: string; url?: string }>
}

function summarizeNode(node: CanvasNodeContext): string {
  const pieces = [
    `[${node.nodeKind || node.type || "node"}] ${node.title || "未命名节点"}`,
    node.workflowRole ? `角色: ${node.workflowRole}` : undefined,
    node.status ? `状态: ${node.status}` : undefined,
    node.model ? `模型: ${node.model}` : undefined,
    node.duration ? `时长: ${node.duration}` : undefined,
    node.prompt ? `Prompt: ${node.prompt.slice(0, 180)}` : undefined,
    node.content ? `内容: ${node.content.slice(0, 180)}` : undefined,
    node.summary ? `摘要: ${node.summary.slice(0, 180)}` : undefined,
    node.fileName ? `文件: ${node.fileName}` : undefined,
    node.imageUrl ? "包含图片素材" : undefined,
    node.inputs?.length ? `输入: ${node.inputs.map((item) => item.label).join("/")}` : undefined,
    node.outputs?.length ? `输出: ${node.outputs.map((item) => item.label).join("/")}` : undefined,
  ]

  return pieces.filter(Boolean).join(" | ")
}

function buildSystemPrompt(context?: {
  nodes?: CanvasNodeContext[]
  selectedNode?: CanvasNodeContext
  selectedNodeId?: string
  mentionedNodes?: CanvasNodeContext[]
  attachments?: Array<{ id?: string; type?: string; name?: string; size?: number; mimeType?: string; width?: number; height?: number }>
  canvasStats?: { total?: number; byKind?: Record<string, number> }
  mode?: string
}): string {
  let prompt = `你是星轨（StarTrails）的创作助手，一个专注于影视创作的 AI 工具。星轨帮助用户：
1. 把导演意图整理成 Prompt
2. 拆分镜头和分镜
3. 生成首帧图像
4. 组织文生视频 / 图生视频 / 音频 / 字幕 / 合成工作流
5. 在画布上理解并串联创作节点

请用中文简洁、专业的语言回答。若用户正在讨论画布，请优先基于下方画布上下文回答，不要假装没看见节点。`

  const selectedNode = context?.selectedNode || (context?.selectedNodeId ? context.nodes?.find(n => n.id === context.selectedNodeId) : undefined)
  if (selectedNode) {
    prompt += `\n\n【当前选中节点】\n- ${summarizeNode(selectedNode)}`
  }

  if (context?.mentionedNodes?.length) {
    prompt += `\n\n【用户 @ 提到的节点】`
    context.mentionedNodes.slice(0, 8).forEach((node, i) => {
      prompt += `\n${i + 1}. ${summarizeNode(node)}`
    })
  }

  if (context?.canvasStats?.total || context?.nodes?.length) {
    const byKind = context.canvasStats?.byKind
      ? Object.entries(context.canvasStats.byKind).map(([kind, count]) => `${kind}:${count}`).join("，")
      : ""
    prompt += `\n\n【画布概况】\n- 节点总数：${context.canvasStats?.total ?? context.nodes?.length ?? 0}`
    if (byKind) prompt += `\n- 类型分布：${byKind}`
  }

  if (context?.nodes?.length) {
    prompt += `\n\n【画布节点摘要】`
    context.nodes.slice(0, 20).forEach((node, i) => {
      prompt += `\n${i + 1}. ${summarizeNode(node)}`
    })
    if (context.nodes.length > 20) {
      prompt += `\n... 还有 ${context.nodes.length - 20} 个节点未展开。`
    }
  }

  if (context?.attachments?.length) {
    prompt += `\n\n【本轮附件】`
    context.attachments.forEach((attachment, i) => {
      const sizeKb = attachment.size ? `${Math.round(attachment.size / 1024)}KB` : "未知大小"
      const dimensions = attachment.width && attachment.height ? `，尺寸 ${attachment.width}x${attachment.height}` : ""
      prompt += `\n${i + 1}. [${attachment.type || "file"}] ${attachment.name || attachment.id || "未命名附件"}，${attachment.mimeType || "未知类型"}，${sizeKb}${dimensions}`
    })
  }

  return prompt
}

// ============================================================================
// MOCK RESPONSE GENERATOR
// ============================================================================
async function* generateMockResponse(message: string): AsyncGenerator<string> {
  let response = ""
  
  if (isCasualMessage(message)) {
    response = "你好！我是星轨Ai，你的创作助手。有什么可以帮你的吗？"
  } else if (message.includes("prompt") || message.includes("Prompt")) {
    response = `[PROMPT: 一个充满未来感的科幻场景，城市夜景，霓虹灯，赛博朋克风格，高质量，8K]`
  } else if (message.includes("分镜") || message.includes("拆分")) {
    response = "我已经为你拆好了分镜：\n\n1. 开场：远景展现城市天际线\n2. 中景：主角走入街道\n3. 近景：主角面部表情\n4. 特写：手中的装置发光"
  } else {
    response = "我理解了你的需求。让我帮你在画布上整理一下思路。"
  }

  for (let i = 0; i < response.length; i++) {
    yield response[i]
    await new Promise(resolve => setTimeout(resolve, 30))
  }
}

// ============================================================================
// REAL API CALLER
// ============================================================================
async function* streamFromRealAPI(
  messages: Array<{role: string; content: string}>,
  model: string,
  apiBaseUrl: string,
  apiKey: string
): AsyncGenerator<string> {
  const { endpoint, bodyTransformer } = getEndpointForModel(model)
  
  const body = bodyTransformer({
    messages,
    model,
  })

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`AI API error (${response.status}): ${errorText}`)
  }

  if (!response.body) {
    throw new Error("AI API returned empty body")
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() || ""

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6)

        if (data === "[DONE]" || data === "data: [DONE]") {
          continue
        }

        try {
          const parsed = JSON.parse(data)

          // Extract content from various API response formats
          let content = ""
          if (parsed.choices?.[0]?.delta?.content) {
            content = parsed.choices[0].delta.content
          } else if (parsed.choices?.[0]?.message?.content) {
            content = parsed.choices[0].message.content
          } else if (parsed.content) {
            content = parsed.content
          } else if (parsed.text) {
            content = parsed.text
          } else if (parsed.data?.[0]?.url) {
            // Image generation response
            content = `![generated image](${parsed.data[0].url})`
          }

          if (content) {
            // Yield character by character for streaming effect
            for (let i = 0; i < content.length; i++) {
              yield content[i]
            }
          }
        } catch (e) {
          // Ignore parse errors for incomplete JSON
        }
      }
    }
  }
}

// ============================================================================
// API ROUTE HANDLER
// ============================================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, model = "gpt-4o", context } = body

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      )
    }

    // Determine if we need canvas context. Explicit canvas payload from the UI should be honored;
    // casual greetings can still skip it to keep replies light.
    const hasCanvasPayload = Boolean(context?.selectedNode || context?.nodes?.length || context?.mentionedNodes?.length || context?.attachments?.length)
    const needsCanvasContext = !isCasualMessage(message) && (hasCanvasPayload || wantsCanvasContext(message))
    
    // Build messages
    const systemPrompt = buildSystemPrompt(needsCanvasContext ? context : undefined)
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ]

    // Create SSE response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (USE_MOCK) {
            // Use mock response for testing
            for await (const char of generateMockResponse(message)) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content: char })}\n\n`)
              )
            }
          } else {
            // Call the actual AI API
            const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.openai.com/v1"
            const apiKey = process.env.OPENAI_API_KEY || ""

            if (!apiKey) {
              throw new Error("OPENAI_API_KEY is not configured. Please set it in .env.local or settings.")
            }

            for await (const char of streamFromRealAPI(messages, model, apiBaseUrl, apiKey)) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content: char })}\n\n`)
              )
            }
          }

          // Send completion signal
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
        } catch (error: any) {
          console.error("[SSE Stream Error]", error)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: error.message || "Stream error" })}\n\n`)
          )
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    })
  } catch (error: any) {
    console.error("[Chat SSE Route Error]", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET - Not supported for SSE
// ============================================================================
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST to send messages." },
    { status: 405 }
  )
}
