// ============================================================================
// Stale Propagation — 对标 TapNow: 上游变化 → 下游自动标记 stale
// ============================================================================
// 当节点内容/prompt/输出发生变化时，沿边向下游传播 stale 状态
// 配合 NodeRunStatusIndicator 的 stale 视觉指示
// ============================================================================

import type { Node, Edge } from "@xyflow/react"
import type { CanvasNodeData } from "../components/canvas/types"
import { createStaleRunMeta } from "./nodeRunMeta"

/**
 * 标记下游所有节点为 stale
 * 从给定节点出发，沿边 BFS 遍历，标记所有可达下游节点为 stale
 *
 * @param sourceNodeId 源节点 ID（内容发生了变化）
 * @param nodes 当前所有节点（引用会被修改）
 * @param edges 当前所有边
 * @returns 修改后的 nodes 数组 + 被标记的 nodeId 列表
 */
export function propagateStaleDownstream(
  sourceNodeId: string,
  nodes: Node<CanvasNodeData>[],
  edges: Edge[],
): { nodes: Node<CanvasNodeData>[]; staleIds: string[] } {
  const visited = new Set<string>()
  const queue = [sourceNodeId]
  const staleIds: string[] = []
  const nodeMap = new Map(nodes.map((n) => [n.id, { ...n }]))

  while (queue.length > 0) {
    const currentId = queue.shift()!
    if (visited.has(currentId)) continue
    visited.add(currentId)

    // Find all outgoing edges from current node
    for (const edge of edges) {
      if (edge.source === currentId) {
        const targetId = edge.target
        if (!visited.has(targetId)) {
          // Mark target as stale
          const targetNode = nodeMap.get(targetId)
          if (targetNode) {
            const staleMeta = createStaleRunMeta({
              upstreamNodeId: sourceNodeId,
            })
            nodeMap.set(targetId, {
              ...targetNode,
              data: {
                ...targetNode.data,
                runMeta: staleMeta,
              },
            })
            staleIds.push(targetId)
            queue.push(targetId)
          }
        }
      }
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    staleIds,
  }
}

/**
 * 清除指定节点的 stale 状态（恢复为上次完成的状态或 idle）
 */
export function clearStaleStatus(
  nodeId: string,
  nodes: Node<CanvasNodeData>[],
): Node<CanvasNodeData>[] {
  return nodes.map((n) => {
    if (n.id !== nodeId) return n
    if (n.data.runMeta?.runStatus !== "stale") return n

    return {
      ...n,
      data: {
        ...n.data,
        runMeta: { runStatus: "idle" },
      },
    }
  })
}

/**
 * 检查图中是否还有 stale 节点
 */
export function hasStaleNodes(nodes: Node<CanvasNodeData>[]): boolean {
  return nodes.some((n) => n.data.runMeta?.runStatus === "stale")
}

/**
 * 获取所有 stale 节点 ID
 */
export function getStaleNodeIds(nodes: Node<CanvasNodeData>[]): string[] {
  return nodes
    .filter((n) => n.data.runMeta?.runStatus === "stale")
    .map((n) => n.id)
}
