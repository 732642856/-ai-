// ============================================================================
// AI Provider Configuration (P2-5A)
// ============================================================================
// 统一读取服务端环境变量，提供类型安全的 AI Provider 配置。
// 本模块仅在服务端使用（Next.js Route Handlers / API Routes），
// 绝不暴露 API Key 到浏览器。
// ============================================================================

// ============================================================================
// Types
// ============================================================================

/** 支持的 Provider 类型 */
export type AiProviderType = "openai-compatible"

/** 服务端 AI Provider 配置（API Key 不暴露给前端） */
export interface AiProviderConfig {
  type: AiProviderType
  /** OpenAI 兼容的 Base URL（自动去除尾部斜杠） */
  baseUrl: string
  /** API Key（服务端专用，绝不传给前端） */
  apiKey: string
  /** 默认文本模型 */
  defaultModel: string
  /** 默认图片模型（可选，不配则走文本模型） */
  defaultImageModel: string
  /** 视频分析专用模型（可选） */
  videoModel?: string
  /** 请求超时毫秒数 */
  timeoutMs: number
}

// ============================================================================
// Config Reader
// ============================================================================

/**
 * 从环境变量读取 AI Provider 配置。
 * 优先使用 AI_ 前缀的新变量，兼容旧变量名。
 *
 * @throws 缺少 AI_BASE_URL / AI_API_KEY / AI_DEFAULT_MODEL 时报错
 */
export function getAiProviderConfig(): AiProviderConfig {
  const baseUrl =
    process.env.AI_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""

  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || ""

  const defaultModel =
    process.env.AI_DEFAULT_MODEL ||
    "gpt-5.5"

  const defaultImageModel =
    process.env.AI_DEFAULT_IMAGE_MODEL ||
    "gpt-image-2"

  const videoModel = process.env.AI_VIDEO_MODEL || undefined

  const timeoutMs = Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 120000)

  if (!baseUrl) {
    throw new Error(
      "Missing AI_BASE_URL. Set it in .env.local, e.g.: AI_BASE_URL=https://your-proxy.example.com/v1",
    )
  }

  if (!apiKey) {
    throw new Error(
      "Missing AI_API_KEY. Set it in .env.local, e.g.: AI_API_KEY=sk-your-key",
    )
  }

  if (!defaultModel) {
    throw new Error(
      "Missing AI_DEFAULT_MODEL. Set it in .env.local, e.g.: AI_DEFAULT_MODEL=gpt-4o-mini",
    )
  }

  return {
    type: "openai-compatible",
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    defaultModel,
    defaultImageModel,
    videoModel,
    timeoutMs,
  }
}

/**
 * 返回可暴露给前端的配置（不含 API Key）。
 * 供 SettingsPanel 等 UI 组件使用。
 */
export function getAiProviderConfigSafe(): Omit<AiProviderConfig, "apiKey"> & {
  hasApiKey: boolean
} {
  const config = getAiProviderConfig()
  return {
    type: config.type,
    baseUrl: config.baseUrl,
    hasApiKey: Boolean(config.apiKey),
    defaultModel: config.defaultModel,
    defaultImageModel: config.defaultImageModel,
    videoModel: config.videoModel,
    timeoutMs: config.timeoutMs,
  }
}

// ============================================================================
// Local Override Types (P2-5B)
// ============================================================================

/** 前端可通过请求体传入的局部覆盖项（P2-5B Lite） */
export interface AiProviderOverrides {
  /** 覆盖 Base URL（可选） */
  baseUrl?: string
  /** 覆盖 API Key（可选，⚠️ 仅适合本地自用） */
  apiKey?: string
  /** 覆盖默认文本模型（可选） */
  defaultModel?: string
  /** 覆盖图片生成模型（可选） */
  imageModel?: string
  /** 覆盖视频分析模型（可选） */
  videoModel?: string
  /** 覆盖请求超时（可选，单位 ms） */
  timeoutMs?: number
}

/**
 * 合并服务端 .env 配置与请求传入的局部覆盖。
 * 覆盖项优先级高于 .env。
 * 当 .env 未配置（如纯 Local Override 模式）时，用 overrides 作为基础配置。
 */
export function mergeProviderConfig(
  overrides?: AiProviderOverrides,
): AiProviderConfig {
  let env: Partial<AiProviderConfig> = {}
  let envOk = false

  try {
    env = getAiProviderConfig()
    envOk = true
  } catch {
    // .env 未配置，依赖 overrides 提供必填项
  }

  if (!envOk && !overrides) {
    throw new Error(
      "No server .env config and no overrides provided. " +
      "Set AI_BASE_URL / AI_API_KEY in .env.local, or use Local Override mode in SettingsPanel.",
    )
  }

  const baseUrl =
    overrides?.baseUrl ?? env.baseUrl ?? ""
  const apiKey =
    overrides?.apiKey ?? env.apiKey ?? ""
  const defaultModel =
    overrides?.defaultModel ?? env.defaultModel ?? "gpt-5.5"
  const defaultImageModel =
    overrides?.imageModel ?? env.defaultImageModel ?? "gpt-image-2"
  const videoModel =
    overrides?.videoModel ?? env.videoModel
  const timeoutMs =
    overrides?.timeoutMs ?? env.timeoutMs ?? 120000

  if (!baseUrl || !apiKey || !defaultModel) {
    throw new Error(
      "Missing required config. " +
      "Provide AI_BASE_URL / AI_API_KEY / AI_DEFAULT_MODEL in .env.local, " +
      "or fill them in SettingsPanel > Local Override mode.",
    )
  }

  return {
    type: "openai-compatible",
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    defaultModel,
    defaultImageModel,
    videoModel,
    timeoutMs,
  }
}

/**
 * 检测请求是否携带了局部覆盖。供 route.ts 快速判断。
 */
export function hasLocalOverrides(
  overrides?: AiProviderOverrides,
): boolean {
  if (!overrides) return false
  return Boolean(
    overrides.baseUrl ||
    overrides.apiKey ||
    overrides.defaultModel ||
    overrides.imageModel ||
    overrides.videoModel,
  )
}
