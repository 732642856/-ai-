// ============================================================================
// Node Run History — 纯函数 (P1-5)
// ============================================================================
// 创建、追加、查找、清空历史记录。无副作用，不依赖 React/DOM/localStorage。
// ============================================================================

import type {
  NodeRunHistoryItem,
  NodeRunHistoryStatus,
  NodeRunHistoryInput,
  NodeRunHistoryOutput,
  NodeRunHistoryMap,
  NodeRunHistorySource,
  HistoryTrimOptions,
} from "../types/node-run-history"
import {
  DEFAULT_MAX_HISTORY_PER_NODE,
  DEFAULT_MAX_HISTORY_TOTAL,
} from "../types/node-run-history"

// ============================================================================
// 创建
// ============================================================================

export interface CreateHistoryParams {
  /** 运行 ID */
  runId: string
  /** 节点 ID */
  nodeId: string
  /** 节点类型 */
  nodeType?: string
  /** 终态 */
  status: NodeRunHistoryStatus
  /** 输入快照 */
  input: NodeRunHistoryInput
  /** 输出 */
  output?: NodeRunHistoryOutput
  /** 错误信息 */
  error?: string
  /** 运行摘要 */
  message?: string
  /** 开始时间 */
  startedAt: string
  /** 结束时间 */
  finishedAt: string
  /** 触发来源 */
  source?: NodeRunHistorySource
}

/**
 * 创建一条历史记录。
 * 自动计算 durationMs 和 createdAt。
 */
export function createRunHistoryItem(params: CreateHistoryParams): NodeRunHistoryItem {
  const started = new Date(params.startedAt).getTime()
  const finished = new Date(params.finishedAt).getTime()
  const durationMs = Math.max(0, finished - started)

  return {
    id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    runId: params.runId,
    nodeId: params.nodeId,
    nodeType: params.nodeType,
    status: params.status,
    input: params.input,
    output: params.output,
    error: params.error,
    message: params.message,
    startedAt: params.startedAt,
    finishedAt: params.finishedAt,
    durationMs,
    source: params.source,
    createdAt: new Date().toISOString(),
  }
}

// ============================================================================
// 追加 + 裁剪
// ============================================================================

/**
 * 将一条历史记录追加到按 nodeId 分组的 map 中。
 * 自动按 maxPerNode 和 maxTotal 裁剪最旧记录。
 *
 * @returns 新的 map（不可变更新）
 */
export function appendNodeRunHistory(
  histories: NodeRunHistoryMap,
  item: NodeRunHistoryItem,
  options?: HistoryTrimOptions,
): NodeRunHistoryMap {
  const maxPerNode = options?.maxPerNode ?? DEFAULT_MAX_HISTORY_PER_NODE
  const maxTotal = options?.maxTotal ?? DEFAULT_MAX_HISTORY_TOTAL

  // 追加到对应 nodeId
  const nodeHistories = [...(histories[item.nodeId] ?? []), item]

  // 单节点裁剪：保留最新的 maxPerNode 条
  const trimmedNode = nodeHistories.length > maxPerNode
    ? nodeHistories.slice(nodeHistories.length - maxPerNode)
    : nodeHistories

  const newMap = { ...histories, [item.nodeId]: trimmedNode }

  // 全局裁剪：如果总条数超过 maxTotal，裁最旧的
  return trimTotalHistory(newMap, maxTotal)
}

/**
 * 获取指定节点的所有历史记录（按时间升序）。
 */
export function getNodeRunHistory(
  histories: NodeRunHistoryMap,
  nodeId: string,
): NodeRunHistoryItem[] {
  return histories[nodeId] ?? []
}

/**
 * 在所有历史记录中查找指定 historyId 的记录。
 */
export function findRunHistoryItem(
  histories: NodeRunHistoryMap,
  historyId: string,
): NodeRunHistoryItem | undefined {
  for (const nodeHistories of Object.values(histories)) {
    const found = nodeHistories.find((h) => h.id === historyId)
    if (found) return found
  }
  return undefined
}

/**
 * 清除指定节点的所有历史记录。
 *
 * @returns 新的 map（不可变更新）
 */
export function clearNodeRunHistory(
  histories: NodeRunHistoryMap,
  nodeId: string,
): NodeRunHistoryMap {
  if (!histories[nodeId]) return histories
  const newMap = { ...histories }
  delete newMap[nodeId]
  return newMap
}

/**
 * 获取历史记录总数。
 */
export function getHistoryCount(histories: NodeRunHistoryMap): number {
  let count = 0
  for (const arr of Object.values(histories)) {
    count += arr.length
  }
  return count
}

// ============================================================================
// 内部裁剪
// ============================================================================

function trimTotalHistory(
  histories: NodeRunHistoryMap,
  maxTotal: number,
): NodeRunHistoryMap {
  const total = getHistoryCount(histories)
  if (total <= maxTotal) return histories

  // 收集所有记录，按 createdAt 升序
  const all: Array<{ nodeId: string; item: NodeRunHistoryItem }> = []
  for (const [nodeId, items] of Object.entries(histories)) {
    for (const item of items) {
      all.push({ nodeId, item })
    }
  }

  all.sort((a, b) => {
    const ta = new Date(a.item.createdAt).getTime()
    const tb = new Date(b.item.createdAt).getTime()
    return ta - tb
  })

  // 裁掉最旧的
  const toRemove = total - maxTotal
  const removeSet = new Set(all.slice(0, toRemove).map((e) => e.item.id))

  // 重建 map
  const newMap: NodeRunHistoryMap = {}
  for (const [nodeId, items] of Object.entries(histories)) {
    const filtered = items.filter((item) => !removeSet.has(item.id))
    if (filtered.length > 0) {
      newMap[nodeId] = filtered
    }
  }

  return newMap
}
