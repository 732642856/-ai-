// ============================================================================
// AI Error Normalization (P2-5A / P2-6A)
// ============================================================================
// 将不同来源（中转站、官方 API、网络错误）的 AI 错误统一为
// NormalizedAiError，方便 UI 统一展示。
// ============================================================================

export interface NormalizedAiError {
  /** 错误码（如 "unauthorized", "timeout", "not_found"） */
  code: string
  /** 人类可读的错误消息 */
  message: string
  /** HTTP 状态码 */
  status?: number
  /** Provider 标识 */
  provider?: string
  /** 原始错误对象（调试用） */
  raw?: unknown
}

/**
 * 将上游 API 错误归一化。
 *
 * @param upstreamStatus 上游 HTTP 状态码
 * @param upstreamBody  上游返回的 body 文本或 JSON
 * @param provider      Provider 名称（如 "openai-compatible"）
 */
export function normalizeUpstreamError(
  upstreamStatus: number,
  upstreamBody: string,
  provider?: string,
): NormalizedAiError {
  // 尝试解析 JSON 错误（OpenAI 兼容格式）
  let parsed: Record<string, unknown> | null = null
  try {
    parsed = JSON.parse(upstreamBody)
  } catch {
    // body 不是 JSON，直接用文本
  }

  const errorMessage =
    typeof parsed?.error === "object" && parsed.error !== null
      ? String((parsed.error as Record<string, unknown>).message ?? upstreamBody)
      : typeof parsed?.error === "string"
        ? parsed.error
        : upstreamBody.slice(0, 500) || `HTTP ${upstreamStatus}`

  switch (upstreamStatus) {
    case 401:
    case 403:
      return {
        code: "unauthorized",
        message: `API Key 无效或无权限: ${errorMessage}`,
        status: upstreamStatus,
        provider,
        raw: parsed,
      }

    case 404:
      return {
        code: "not_found",
        message: `Base URL 或模型不存在: ${errorMessage}`,
        status: upstreamStatus,
        provider,
        raw: parsed,
      }

    case 429:
      return {
        code: "rate_limited",
        message: `请求频率超限或余额不足: ${errorMessage}`,
        status: upstreamStatus,
        provider,
        raw: parsed,
      }

    case 500:
    case 502:
    case 503:
      return {
        code: "upstream_error",
        message: `上游服务异常 (${upstreamStatus}): ${errorMessage}`,
        status: upstreamStatus,
        provider,
        raw: parsed,
      }

    case 504:
    case 524:
      return {
        code: "upstream_timeout",
        message: `AI 代理服务响应超时 (${upstreamStatus})。可能是上游模型生成太慢或中转站超时，请稍后重试、缩短输入，或换用更快模型。`,
        status: upstreamStatus,
        provider,
        raw: parsed,
      }

    default:
      if (upstreamStatus >= 400) {
        return {
          code: `http_${upstreamStatus}`,
          message: `AI 请求失败 (${upstreamStatus}): ${errorMessage}`,
          status: upstreamStatus,
          provider,
          raw: parsed,
        }
      }
      return {
        code: "unknown",
        message: errorMessage,
        status: upstreamStatus,
        provider,
        raw: parsed,
      }
  }
}

/**
 * 将 JS Error / AbortError 归一化。
 */
export function normalizeClientError(
  error: unknown,
  provider?: string,
): NormalizedAiError {
  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      code: "timeout",
      message: "AI 请求超时，请检查网络或增大超时时间",
      provider,
    }
  }

  if (error instanceof TypeError && error.message.includes("fetch")) {
    return {
      code: "network_error",
      message: `无法连接 AI 服务: ${error.message}`,
      provider,
      raw: error,
    }
  }

  const message = error instanceof Error ? error.message : String(error)
  return {
    code: "client_error",
    message,
    provider,
    raw: error,
  }
}
