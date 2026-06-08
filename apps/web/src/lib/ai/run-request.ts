// ============================================================================
// AI Run Request Builder (Phase 1-a)
// ============================================================================
// 纯函数：从 runner 上下文构建统一的 AI 请求 payload。
// 组合 resolveModelForTask() + sanitizeRunPayload()，无 IO、无副作用。
//
// 职责：
// 1. 按优先级解析模型名（resolveModelForTask）
// 2. 构建 raw prompt（含 upstream / cinematic 优先级）
// 3. 清洗 payload（sanitizeRunPayload）
// 4. 附加 _meta 元数据
// ============================================================================

import {
  resolveModelForTask,
} from "./model-resolve"

import type {
  ModelTaskType,
  ModelSource,
} from "./model-resolve"

import {
  sanitizeRunPayload,
} from "./payload-sanitize"

import type {
  SanitizeOptions,
} from "./payload-sanitize"

// ============================================================================
// Types
// ============================================================================

/** buildRunRequest 的输入 */
export interface BuildRunRequestInput {
  // ── 节点信息 ────────────────────────────────────────────
  /** 节点类型，如 "text-generation"、"image-generation" 等 */
  nodeKind: string
  /** 用户输入的 prompt / 节点内容 */
  prompt: string
  /** 上游节点聚合的文本内容 */
  upstreamContent?: string

  // ── 模型相关 ────────────────────────────────────────────
  /** AI 任务类型 */
  taskType: ModelTaskType
  /** 节点级模型覆盖（最高优先级，对应 canvas node 上用户设定的模型） */
  nodeModel?: string
  /** 本地 Override 中的文本模型名 */
  localDefaultModel?: string
  /** 本地 Override 中的图片模型名 */
  localImageModel?: string
  /** 本地 Override 中的视频模型名 */
  localVideoModel?: string
  /** 环境变量 / 服务端 Provider Config 的文本默认模型 */
  envDefaultModel?: string
  /** 环境变量 / 服务端 Provider Config 的图片默认模型 */
  envDefaultImageModel?: string
  /** 环境变量 / 服务端 Provider Config 的视频模型 */
  envVideoModel?: string

  // ── Provider overrides ──────────────────────────────────
  /** 前端传入的 provider 覆盖（baseUrl / apiKey / timeoutMs 等） */
  providerOverrides?: Record<string, unknown>

  // ── Cinematic context（image 专用） ─────────────────────
  /** enhancePromptWithCinematicContext() 的输出，仅 image task 使用 */
  cinematicPrompt?: string

  // ── 可选 ────────────────────────────────────────────────
  /** system prompt 覆盖 */
  systemOverride?: string
}

/** buildRunRequest 的输出 —— 可直接作为 fetch body */
export interface RunRequest {
  /** 清洗后的主 prompt */
  message: string
  /** resolve + sanitize 后的模型名 */
  model: string
  /** 可选的上下文对象 */
  context?: {
    systemOverride?: string
    cinematic?: string
  }
  /** 可选的 provider 覆盖 */
  _providerOverrides?: Record<string, string | number | undefined>
  /** 构建元数据（不发到 API，用于 debug / source trace） */
  _meta: {
    taskType: string
    nodeKind: string
    rawPromptLength: number
    sanitizedPromptLength: number
    modelSource: ModelSource
    fallbackUsed: boolean
    sanitizeWarnings: string[]
  }
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TEXT_PROMPT = "请生成内容。"
const DEFAULT_IMAGE_PROMPT = "A cinematic scene"

// ============================================================================
// Core: buildRunRequest
// ============================================================================

/**
 * 从 runner 上下文构建统一的 AI 请求 payload。
 *
 * 流程：
 * 1. resolveModelForTask() → 解析模型名
 * 2. 构建 raw prompt（按 taskType 和优先级）
 * 3. sanitizeRunPayload() → 清洗 payload
 * 4. 附加 _meta
 *
 * 纯函数，无 IO，无副作用。
 */
export function buildRunRequest(
  input: BuildRunRequestInput,
  sanitizeOptions?: SanitizeOptions,
): RunRequest {
  const {
    nodeKind,
    prompt,
    upstreamContent,
    taskType,
    nodeModel,
    localDefaultModel,
    localImageModel,
    localVideoModel,
    envDefaultModel,
    envDefaultImageModel,
    envVideoModel,
    providerOverrides,
    cinematicPrompt,
    systemOverride,
  } = input

  // ── 1. Model resolution ─────────────────────────────────

  const resolveResult = resolveModelForTask({
    taskType,
    nodeModel,
    overrides: {
      defaultModel: localDefaultModel,
      imageModel: localImageModel,
      videoModel: localVideoModel,
    },
    envConfig: {
      defaultModel: envDefaultModel,
      defaultImageModel: envDefaultImageModel,
      videoModel: envVideoModel,
    },
  })

  // ── 2. Build raw prompt ────────────────────────────────

  let rawPrompt: string

  if (taskType === "text") {
    // text: upstreamContent 优先，其次 prompt，最后 fallback
    if (upstreamContent && upstreamContent.trim()) {
      rawPrompt = prompt
        ? `上游内容:\n${upstreamContent}\n\n当前内容:\n${prompt}`
        : `上游内容:\n${upstreamContent}`
    } else {
      rawPrompt = prompt || DEFAULT_TEXT_PROMPT
    }
  } else if (taskType === "image") {
    // image: cinematicPrompt 优先，其次 upstreamContent，其次 prompt，最后 fallback
    if (cinematicPrompt && cinematicPrompt.trim()) {
      rawPrompt = cinematicPrompt
    } else if (upstreamContent && upstreamContent.trim()) {
      rawPrompt = upstreamContent
    } else {
      rawPrompt = prompt || DEFAULT_IMAGE_PROMPT
    }
  } else {
    // video: 同 text 逻辑（当前 video 是 pass-through）
    if (upstreamContent && upstreamContent.trim()) {
      rawPrompt = prompt
        ? `上游内容:\n${upstreamContent}\n\n当前内容:\n${prompt}`
        : `上游内容:\n${upstreamContent}`
    } else {
      rawPrompt = prompt || DEFAULT_TEXT_PROMPT
    }
  }

  const rawPromptLength = rawPrompt.length

  // ── 3. Sanitize ────────────────────────────────────────

  const sanitizeResult = sanitizeRunPayload(
    {
      message: rawPrompt,
      model: resolveResult.model,
      ...(systemOverride ? { context: { systemOverride } } : {}),
      ...(providerOverrides ? { _providerOverrides: providerOverrides } : {}),
    },
    sanitizeOptions,
  )

  // ── 4. Build context ───────────────────────────────────

  let context: RunRequest["context"] = undefined

  if (sanitizeResult.payload.context || (taskType === "image" && cinematicPrompt && cinematicPrompt.trim())) {
    context = {
      ...sanitizeResult.payload.context,
      ...(taskType === "image" && cinematicPrompt && cinematicPrompt.trim()
        ? { cinematic: cinematicPrompt }
        : {}),
    }
  }

  // ── 5. Assemble ────────────────────────────────────────

  return {
    message: sanitizeResult.payload.message,
    model: sanitizeResult.payload.model,
    ...(context ? { context } : {}),
    ...(sanitizeResult.payload._providerOverrides
      ? { _providerOverrides: sanitizeResult.payload._providerOverrides }
      : {}),
    _meta: {
      taskType,
      nodeKind,
      rawPromptLength,
      sanitizedPromptLength: sanitizeResult.payload.message.length,
      modelSource: resolveResult.source,
      fallbackUsed: resolveResult.fallbackUsed,
      sanitizeWarnings: sanitizeResult.warnings,
    },
  }
}
