// ============================================================================
// History Safety Utilities — 输出/设置安全裁剪 (P1-6)
// ============================================================================
// 防止超大 base64、循环对象、超大 response 污染 localStorage。
// ============================================================================

const MAX_RAW_OUTPUT_SIZE = 100 * 1024 // 100KB
const MAX_SNAPSHOT_SIZE = 50 * 1024    // 50KB

/**
 * 安全化历史记录的 output.raw。
 * 避免保存超大 base64 图片 / 巨型 response / 循环对象。
 *
 * @returns 安全后的 raw 值，超限时返回 { summary, reason }
 */
export function sanitizeHistoryRawOutput(raw: unknown): unknown {
  if (raw === undefined || raw === null) return raw

  try {
    const json = JSON.stringify(raw)
    if (json.length <= MAX_RAW_OUTPUT_SIZE) {
      return JSON.parse(json) // 深拷贝，切断引用
    }
    // 超限：只保存摘要
    return {
      _truncated: true,
      _originalSize: json.length,
      _reason: `Output exceeded ${MAX_RAW_OUTPUT_SIZE / 1024}KB limit`,
      summary: typeof raw === "object" && raw !== null
        ? extractSummary(raw)
        : String(raw).slice(0, 200),
    }
  } catch {
    // 循环引用或其他序列化错误
    return {
      _truncated: true,
      _reason: "Failed to serialize output (circular reference or non-serializable value)",
      summary: String(raw).slice(0, 200),
    }
  }
}

/**
 * 安全化 settingsSnapshot。
 * 深拷贝 + 限制大小。
 */
export function sanitizeSettingsSnapshot(settings: Record<string, unknown>): Record<string, unknown> {
  try {
    const json = JSON.stringify(settings)
    if (json.length <= MAX_SNAPSHOT_SIZE) {
      return JSON.parse(json)
    }
    return {
      _truncated: true,
      _originalSize: json.length,
      _reason: `Settings exceeded ${MAX_SNAPSHOT_SIZE / 1024}KB limit`,
      nodeKind: settings.nodeKind,
    }
  } catch {
    return {
      _truncated: true,
      _reason: "Failed to serialize settings",
      nodeKind: settings.nodeKind,
    }
  }
}

// ============================================================================
// 内部辅助
// ============================================================================

function extractSummary(obj: object): string {
  const keys = Object.keys(obj).slice(0, 10)
  const types = keys.map((k) => {
    const v = (obj as Record<string, unknown>)[k]
    return `${k}: ${typeof v === "string" ? `string(${v.length})` : typeof v}`
  })
  return `{ ${types.join(", ")} }`
}

// ============================================================================
// History ID 存活检查
// ============================================================================

import type { NodeRunHistoryMap, NodeRunHistoryItem, NodeRunHistoryInput } from "../types/node-run-history"
import { findRunHistoryItem } from "./node-run-history"

/**
 * 检查 historyId 是否还存活在历史记录中。
 * 用于解决 maxTotal 裁剪后 currentHistoryId 悬空的问题。
 */
export function isHistoryIdAlive(histories: NodeRunHistoryMap, historyId: string): boolean {
  return findRunHistoryItem(histories, historyId) !== undefined
}

/**
 * 获取节点的"当前历史"——安全降级策略。
 * 1. 先用 currentHistoryId 查找
 * 2. 如果找不到（被裁剪），降级到最新一条
 * 3. 如果还是没有，返回 undefined
 */
export function resolveCurrentHistory(
  histories: NodeRunHistoryMap,
  nodeId: string,
  currentHistoryId?: string,
): NodeRunHistoryItem | undefined {
  if (currentHistoryId) {
    const found = findRunHistoryItem(histories, currentHistoryId)
    if (found && found.nodeId === nodeId) return found
  }

  // 降级到最新（nodeId 和 currentHistoryId 可能不匹配）
  const nodeHistories = histories[nodeId]
  if (nodeHistories && nodeHistories.length > 0) {
    return nodeHistories[nodeHistories.length - 1]
  }

  return undefined
}

// ============================================================================
// Prompt 恢复 (P1-6.3)
// ============================================================================

/**
 * 从历史记录中恢复 prompt 到节点数据。
 * 纯函数，返回要更新到 CanvasNodeData 的 patch。
 *
 * @returns 可直接用于 updateNodeData 的 data patch
 */
export function buildRestorePromptPatch(input: NodeRunHistoryInput): Partial<{
  prompt: string
  content: string
  promptParts: unknown[]
}> {
  const patch: Partial<{
    prompt: string
    content: string
    promptParts: unknown[]
  }> = {}

  if (input.displayPrompt) {
    patch.prompt = input.displayPrompt
    patch.content = input.displayPrompt
  }

  // promptParts: 结构化的 prompt 片段，未来 rich prompt 使用。当前节点数据结构没有此字段，但保留以备用。
  if (input.promptParts && input.promptParts.length > 0) {
    patch.promptParts = input.promptParts as unknown[]
  }

  return patch
}
