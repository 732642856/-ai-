// ============================================================================
// AI Model Resolution (N1-2-2)
// ============================================================================
// 纯函数：根据 taskType + 各级配置，解析出最终模型名。
// 无 IO、无 process.env、无 localStorage，适合服务端/前端/单测复用。
// ============================================================================

// ============================================================================
// Types
// ============================================================================

/** 支持的 AI 任务类型 */
export type ModelTaskType = "text" | "image" | "video"

/** 模型来源优先级（从高到低） */
export type ModelSource = "node" | "localOverride" | "env" | "default"

/** 本地 Provider Override 中的模型相关字段（不含 baseUrl/apiKey/timeoutMs） */
export interface ModelOverrides {
  defaultModel?: string
  imageModel?: string
  videoModel?: string
}

/** 环境变量 / Provider Config 中的模型相关字段（不含 apiKey） */
export interface ModelEnvConfig {
  defaultModel?: string
  defaultImageModel?: string
  videoModel?: string
}

/** resolveModelForTask 的输入 */
export interface ModelResolveInput {
  taskType: ModelTaskType
  /** 节点级模型覆盖（最高优先级） */
  nodeModel?: string
  /** Local Provider Override */
  overrides?: ModelOverrides
  /** 环境变量 / 服务端 Provider Config */
  envConfig?: ModelEnvConfig
}

/** resolveModelForTask 的输出 */
export interface ModelResolveResult {
  taskType: ModelTaskType
  model: string
  source: ModelSource
  fallbackUsed: boolean
  warnings: string[]
}

// ============================================================================
// Hardcoded Fallback Defaults
// ============================================================================

const FALLBACK_DEFAULTS: Record<ModelTaskType, string> = {
  text: "gpt-5.5",
  image: "gpt-image-2",
  video: "gpt-5.5",
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * 清洗模型值：非 string / trim 后为空 → undefined；有效 string → trim 返回。
 * 防止 undefined / null / "" / "   " / [object Object] 进入 payload。
 */
export function cleanModel(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

// ============================================================================
// Core: resolveModelForTask
// ============================================================================

/**
 * 根据 taskType 解析最终模型名。
 *
 * 优先级：node model > localOverride > env/providerConfig > hardcoded fallback
 *
 * 保证返回非空 string，永不返回 undefined / null / ""。
 * 使用 fallback 时会填充 warnings。
 */
export function resolveModelForTask(input: ModelResolveInput): ModelResolveResult {
  const { taskType, nodeModel, overrides, envConfig } = input
  const warnings: string[] = []

  // -- 1. 按 taskType 确定候选来源链 --

  const candidates: Array<{ value: string | undefined; source: ModelSource }> = []

  // 1a. 节点级模型覆盖（最高优先级）
  candidates.push({ value: nodeModel, source: "node" })

  // 1b. Local Override（按 taskType 取对应字段）
  // defaultModel 只服务 text task；image/video 使用各自专用字段，不 fallback 到 defaultModel。
  if (taskType === "text") {
    candidates.push({ value: overrides?.defaultModel, source: "localOverride" })
  } else if (taskType === "image") {
    candidates.push({ value: overrides?.imageModel, source: "localOverride" })
  } else if (taskType === "video") {
    candidates.push({ value: overrides?.videoModel, source: "localOverride" })
  }

  // 1c. Env / Provider Config
  // 同理：defaultModel 只服务 text task。
  if (taskType === "text") {
    candidates.push({ value: envConfig?.defaultModel, source: "env" })
  } else if (taskType === "image") {
    candidates.push({ value: envConfig?.defaultImageModel, source: "env" })
  } else if (taskType === "video") {
    candidates.push({ value: envConfig?.videoModel, source: "env" })
  }

  // -- 2. 依次尝试，找到第一个有效值 --

  let resolved: { model: string; source: ModelSource } | undefined

  for (const candidate of candidates) {
    const cleaned = cleanModel(candidate.value)
    if (cleaned) {
      resolved = { model: cleaned, source: candidate.source }
      break
    }
  }

  // -- 3. 全部失败则使用 hardcoded fallback --

  let fallbackUsed = false

  if (!resolved) {
    resolved = { model: FALLBACK_DEFAULTS[taskType], source: "default" }
    fallbackUsed = true
    warnings.push(
      `No model configured for task "${taskType}"; using fallback "${FALLBACK_DEFAULTS[taskType]}".`,
    )
  }

  return {
    taskType,
    model: resolved.model,
    source: resolved.source,
    fallbackUsed,
    warnings,
  }
}
