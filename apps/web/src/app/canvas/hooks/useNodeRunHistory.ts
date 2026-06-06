// ============================================================================
// useNodeRunHistory — 节点历史记录查询 hook (P1-6.1)
// ============================================================================
// 封装 useRunHistoryStore，提供对指定节点历史的全部访问能力。
// 内置 currentHistoryId 安全降级（裁剪后悬空兜底）。
// ============================================================================

import { useCallback, useMemo } from "react"
import { useRunHistoryStore } from "../stores/useRunHistoryStore"
import type { NodeRunHistoryItem } from "../types/node-run-history"
import { resolveCurrentHistory } from "../utils/history-safety"

export interface UseNodeRunHistoryReturn {
  /** 该节点的所有历史记录（按时间升序） */
  histories: NodeRunHistoryItem[]

  /** 最新一条历史记录 */
  latestHistory: NodeRunHistoryItem | undefined

  /**
   * 当前历史记录。
   * 优先匹配 runMeta.currentHistoryId，如果被裁剪后悬空则降级到最新。
   */
  currentHistory: NodeRunHistoryItem | undefined

  /** 清空该节点的所有历史 */
  clearHistory: () => void

  /** 查找指定 historyId 的历史记录 */
  findById: (historyId: string) => NodeRunHistoryItem | undefined
}

/**
 * 查询指定节点的运行历史记录。
 *
 * @param nodeId - 节点 ID，为 null 时返回空。
 * @param currentHistoryId - 来自 NodeRunMeta.currentHistoryId，用于精确定位当前运行。
 */
export function useNodeRunHistory(
  nodeId: string | null,
  currentHistoryId?: string,
): UseNodeRunHistoryReturn {
  const getByNode = useRunHistoryStore((s) => s.getByNode)
  const historiesAll = useRunHistoryStore((s) => s.histories)
  const findByIdStore = useRunHistoryStore((s) => s.findById)
  const clearNode = useRunHistoryStore((s) => s.clearNode)

  const histories = useMemo<NodeRunHistoryItem[]>(() => {
    if (!nodeId) return []
    return getByNode(nodeId)
  }, [nodeId, getByNode, historiesAll])

  const latestHistory = useMemo<NodeRunHistoryItem | undefined>(() => {
    if (histories.length === 0) return undefined
    return histories[histories.length - 1]
  }, [histories])

  const currentHistory = useMemo<NodeRunHistoryItem | undefined>(() => {
    if (!nodeId) return undefined
    return resolveCurrentHistory(historiesAll, nodeId, currentHistoryId)
  }, [nodeId, currentHistoryId, historiesAll])

  const clearHistory = useCallback(() => {
    if (nodeId) clearNode(nodeId)
  }, [nodeId, clearNode])

  const findById = useCallback(
    (historyId: string) => findByIdStore(historyId),
    [findByIdStore],
  )

  return {
    histories,
    latestHistory,
    currentHistory,
    clearHistory,
    findById,
  }
}
