// ============================================================================
// Node Run History Types (P1-5)
// ============================================================================
// 每次节点运行的完整输入/输出/错误/耗时持久化为结构化历史记录。
// 与 P1-3 NodeRunMeta 和 P1-4 NodeExecutionContext 衔接。
// ============================================================================

import type {
  ContextTextInput,
  ContextImageRef,
  ContextVideoRef,
  MentionRef,
  PromptPart,
} from "./execution-context"

// ============================================================================
// 核心类型
// ============================================================================

/** 历史记录中的运行状态（子集：只记录终态） */
export type NodeRunHistoryStatus = "succeeded" | "failed" | "cancelled"

/** 运行触发来源 */
export type NodeRunHistorySource = "manual" | "ai" | "workflow" | "retry" | "system"

/**
 * 历史记录的输入快照。
 * 从 NodeExecutionContext 选取关键字段，可独立恢复重试。
 */
export interface NodeRunHistoryInput {
  /** 模型实际收到的 prompt */
  prompt: string
  /** 用户可见的原始 prompt */
  displayPrompt: string
  /** 结构化 prompt 片段（用于精确恢复） */
  promptParts: PromptPart[]

  /** @引用解析结果 */
  mentions: MentionRef[]

  /** 上游文本输入 */
  inputTexts: ContextTextInput[]
  /** 图片引用列表 */
  referenceImages: ContextImageRef[]
  /** 视频引用列表 */
  referenceVideos: ContextVideoRef[]

  /** 运行时的 settings snapshot */
  settingsSnapshot?: Record<string, unknown>
}

/**
 * 历史记录的输出。
 */
export interface NodeRunHistoryOutput {
  /** 文本输出 */
  text?: string
  /** 图片 URL 列表 */
  imageUrls?: string[]
  /** 视频 URL 列表 */
  videoUrls?: string[]
  /** 资产库资产 ID 列表 */
  assetIds?: string[]

  /** 原始响应（不保证结构稳定） */
  raw?: unknown
}

/**
 * 单条节点运行历史记录。
 */
export interface NodeRunHistoryItem {
  /** 历史记录唯一 ID */
  id: string
  /** 对应的运行 ID（与 NodeRunMeta.runId 对齐） */
  runId: string
  /** 节点 ID */
  nodeId: string
  /** 节点类型 */
  nodeType?: string

  /** 终态 */
  status: NodeRunHistoryStatus

  /** 输入快照 */
  input: NodeRunHistoryInput
  /** 输出（失败时可能为空） */
  output?: NodeRunHistoryOutput

  /** 错误信息（status === "failed" 时） */
  error?: string
  /** 人类可读的运行摘要 */
  message?: string

  /** 运行开始时间 (ISO 8601) */
  startedAt: string
  /** 运行结束时间 (ISO 8601) */
  finishedAt: string
  /** 运行耗时（毫秒） */
  durationMs: number

  /** 触发来源 */
  source?: NodeRunHistorySource

  /** 记录创建时间 */
  createdAt: string
}

// ============================================================================
// 存储模型
// ============================================================================

/**
 * 按 nodeId 分组的运行历史。
 * key = nodeId, value = 该节点的所有历史记录（按时间降序）。
 */
export type NodeRunHistoryMap = Record<string, NodeRunHistoryItem[]>

/**
 * 历史记录修剪配置。
 */
export interface HistoryTrimOptions {
  /** 每个节点最多保留多少条历史 */
  maxPerNode?: number
  /** 全局最多保留多少条历史 */
  maxTotal?: number
}

/** 默认限制：比 smart-canvas 全局 100 条更灵活 */
export const DEFAULT_MAX_HISTORY_PER_NODE = 50
export const DEFAULT_MAX_HISTORY_TOTAL = 500
