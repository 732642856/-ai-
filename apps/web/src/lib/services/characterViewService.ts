// ============================================================================
// characterViewService — 角色三视图生成服务
//
// 封装 /api/ai/generate-character-view 的 SSE 流式调用。
// 支持进度回调与超时处理。
// ============================================================================

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

export type CharacterViewType = "front" | "side" | "back"

export type CharacterViewResult = {
  frontViewUrl?: string
  sideViewUrl?: string
  backViewUrl?: string
}

export type CharacterViewProgress = {
  stage: string
  percent: number
  message: string
}

export type CharacterViewProgressCallback = (progress: CharacterViewProgress) => void

// ---------------------------------------------------------------------------
// 错误类
// ---------------------------------------------------------------------------

export type CharacterViewErrorCode =
  | "NETWORK_ERROR"
  | "API_ERROR"
  | "TIMEOUT"
  | "PARAM_INVALID"

export class CharacterViewError extends Error {
  code: CharacterViewErrorCode
  retryable: boolean

  constructor(params: {
    message: string
    code: CharacterViewErrorCode
    retryable?: boolean
  }) {
    super(params.message)
    this.name = "CharacterViewError"
    this.code = params.code
    this.retryable = params.retryable ?? true
  }
}

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

export const CHARACTER_VIEW_TIMEOUT_MS = 120_000 // 2 分钟

// ---------------------------------------------------------------------------
// 核心函数
// ---------------------------------------------------------------------------

/**
 * 生成角色三视图（正面 / 侧面 / 背面）。
 *
 * 通过 SSE 流式 API 调用后端，支持实时进度回调。
 *
 * @param params - 生成参数
 * @param params.characterDescription - 角色描述文本
 * @param params.referenceImageUrl - 可选参考图片 URL
 * @param params.viewType - 要生成的视图类型，默认 "all"（正+侧+背）
 * @param onProgress - 可选进度回调
 * @returns CharacterViewResult - 各视图图片 URL
 */
export async function generateCharacterViews(
  params: {
    characterDescription: string
    referenceImageUrl?: string
    viewType?: "front" | "side" | "back" | "all"
  },
  onProgress?: CharacterViewProgressCallback,
): Promise<CharacterViewResult> {
  // 参数校验
  if (!params.characterDescription || !params.characterDescription.trim()) {
    throw new CharacterViewError({
      message: "角色描述不能为空",
      code: "PARAM_INVALID",
      retryable: false,
    })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), CHARACTER_VIEW_TIMEOUT_MS)

  try {
    const res = await fetch("/api/ai/generate-character-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterDescription: params.characterDescription,
        referenceImageUrl: params.referenceImageUrl,
        viewType: params.viewType ?? "all",
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "未知错误")
      throw new CharacterViewError({
        message: `角色三视图 API 错误: ${text}`,
        code: "API_ERROR",
        retryable: res.status >= 500,
      })
    }

    if (!res.body) {
      throw new CharacterViewError({
        message: "角色三视图 API 返回空响应体",
        code: "NETWORK_ERROR",
        retryable: true,
      })
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    let result: CharacterViewResult = {}

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        let eventName = ""
        let eventData = ""

        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.startsWith("event:")) {
            eventName = trimmed.slice(6).trim()
          } else if (trimmed.startsWith("data:")) {
            eventData = trimmed.slice(5).trim()
          } else if (trimmed === "" && eventName && eventData) {
            try {
              const data = JSON.parse(eventData)

              if (eventName === "progress") {
                onProgress?.({
                  stage: data.stage,
                  percent: data.percent,
                  message: data.message,
                })
              } else if (eventName === "result") {
                if (data.frontViewUrl) result.frontViewUrl = data.frontViewUrl
                if (data.sideViewUrl) result.sideViewUrl = data.sideViewUrl
                if (data.backViewUrl) result.backViewUrl = data.backViewUrl
              } else if (eventName === "error") {
                throw new CharacterViewError({
                  message: data.message || "角色三视图生成失败",
                  code: data.code || "API_ERROR",
                  retryable: false,
                })
              }
            } catch (e) {
              // 如果是我们自己抛出的 CharacterViewError，继续抛出
              if (e instanceof CharacterViewError) throw e
              // 其他解析错误则忽略，继续读取后续事件
            }
            eventName = ""
            eventData = ""
          }
        }
      }

      return result
    } finally {
      reader.releaseLock()
    }
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new CharacterViewError({
        message: "角色三视图生成超时，请稍后重试",
        code: "TIMEOUT",
        retryable: true,
      })
    }
    if (error instanceof CharacterViewError) throw error
    throw new CharacterViewError({
      message: `角色三视图生成失败: ${error?.message || "未知错误"}`,
      code: "NETWORK_ERROR",
      retryable: true,
    })
  } finally {
    clearTimeout(timeout)
  }
}

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

/**
 * 从 CharacterIdentityAsset 字段合成角色描述字符串。
 *
 * 将角色身份的各维度信息整合为一段自然语言描述，用于生成 prompt。
 *
 * @param identity - 角色身份信息
 * @returns 完整的角色描述文本
 */
export function inferCharacterDescription(identity: {
  name?: string
  visualSignature?: string
  costume?: string
  props?: string[]
  physicalTraits?: string[]
  colorPalette?: string[]
}): string {
  const parts: string[] = []

  // 外貌特征
  if (identity.physicalTraits && identity.physicalTraits.length > 0) {
    parts.push(identity.physicalTraits.join("，"))
  }

  // 着装
  if (identity.costume) {
    parts.push(identity.costume)
  }

  // 道具
  if (identity.props && identity.props.length > 0) {
    parts.push(`手持${identity.props.join("、")}`)
  }

  // 视觉标识
  if (identity.visualSignature) {
    parts.push(identity.visualSignature)
  }

  // 色彩基调
  if (identity.colorPalette && identity.colorPalette.length > 0) {
    parts.push(`色彩基调: ${identity.colorPalette.join("、")}`)
  }

  return parts.join("。")
}
