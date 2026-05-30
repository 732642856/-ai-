import { persistImageDataUrl } from "@/lib/assets/localImageStore"

export const IMAGE_GENERATION_CLIENT_TIMEOUT_MS = 75_000

export type ImageGenerationErrorCode =
  | "CLIENT_TIMEOUT"
  | "NETWORK_ERROR"
  | "API_ERROR"
  | "INVALID_RESPONSE"
  | string

export class ImageGenerationError extends Error {
  code: ImageGenerationErrorCode
  status?: number
  requestId?: string
  attempts?: number
  retryable: boolean
  detail?: string

  constructor(params: {
    message: string
    code: ImageGenerationErrorCode
    status?: number
    requestId?: string
    attempts?: number
    retryable?: boolean
    detail?: string
  }) {
    super(params.message)
    this.name = "ImageGenerationError"
    this.code = params.code
    this.status = params.status
    this.requestId = params.requestId
    this.attempts = params.attempts
    this.retryable = params.retryable ?? true
    this.detail = params.detail
  }
}

function createTimeoutError(): ImageGenerationError {
  return new ImageGenerationError({
    message: "图片生成超时，请稍后重试。",
    code: "CLIENT_TIMEOUT",
    retryable: true,
    detail: `前端等待超过 ${Math.round(IMAGE_GENERATION_CLIENT_TIMEOUT_MS / 1000)} 秒后主动结束请求。`,
  })
}

function parseRetryableFromStatus(status: number): boolean {
  return [408, 429, 500, 502, 503, 504].includes(status)
}

async function readJsonSafely(res: Response): Promise<any> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

function normalizeApiError(payload: any, status: number): ImageGenerationError {
  const error = payload?.error
  if (typeof error === "string") {
    return new ImageGenerationError({
      message: error || `API error: ${status}`,
      code: "API_ERROR",
      status,
      requestId: payload?.requestId,
      attempts: payload?.attempts,
      retryable: parseRetryableFromStatus(status),
    })
  }

  return new ImageGenerationError({
    message: error?.userMessage || error?.message || `API error: ${status}`,
    code: error?.code || "API_ERROR",
    status: error?.status || status,
    requestId: payload?.requestId,
    attempts: payload?.attempts,
    retryable: error?.retryable ?? parseRetryableFromStatus(status),
    detail: error?.detail,
  })
}

export async function generateImageFromPrompt(input: {
  prompt: string
  model?: string
  size?: string
  requestId?: string
  timeoutMs?: number
}) {
  const controller = new AbortController()
  const timeoutMs = input.timeoutMs ?? IMAGE_GENERATION_CLIENT_TIMEOUT_MS
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetch("/api/ai/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        prompt: input.prompt,
        model: input.model || "gpt-image-2",
        size: input.size || "1792x1024",
        requestId: input.requestId,
      }),
    })
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw createTimeoutError()
    }
    throw new ImageGenerationError({
      message: "图片生成请求失败，请检查网络后重试。",
      code: "NETWORK_ERROR",
      retryable: true,
      detail: error?.message,
    })
  } finally {
    clearTimeout(timeout)
  }

  const payload = await readJsonSafely(res)
  if (!res.ok) {
    throw normalizeApiError(payload, res.status)
  }

  if (!payload?.imageUrl || typeof payload.imageUrl !== "string") {
    throw new ImageGenerationError({
      message: "图片生成服务没有返回可用图片，请重试。",
      code: "INVALID_RESPONSE",
      status: res.status,
      requestId: payload?.requestId,
      attempts: payload?.attempts,
      retryable: true,
    })
  }

  let displayUrl = payload.imageUrl
  let assetId: string | undefined

  if (payload.imageUrl.startsWith("data:image")) {
    const persisted = await persistImageDataUrl(payload.imageUrl, {
      fileName: `generated-${Date.now()}.png`,
    })
    displayUrl = persisted.objectUrl
    assetId = persisted.assetId
  }

  return {
    ...payload,
    imageUrl: displayUrl,
    assetId,
  }
}
