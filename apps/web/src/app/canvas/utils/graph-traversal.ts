// ============================================================================
// Graph Traversal Utilities (P1-4)
// ============================================================================
// 纯函数，不依赖 React / DOM / global state。
// 使用 React Flow 的 Node<CanvasNodeData> / Edge 类型。
// ============================================================================

import type { Node, Edge } from "@xyflow/react"
import type { CanvasNodeData } from "../components/canvas/types"

/** AppNode — 携带 CanvasNodeData 的 React Flow Node */
export type AppNode = Node<CanvasNodeData>

/** AppEdge — React Flow Edge */
export type AppEdge = Edge

// ============================================================================
// Edge 查询
// ============================================================================

/**
 * 获取指向目标节点的所有入边
 */
export function getIncomingEdges(nodeId: string, edges: AppEdge[]): AppEdge[] {
  return edges.filter((edge) => edge.target === nodeId)
}

/**
 * 获取从源节点出发的所有出边
 */
export function getOutgoingEdges(nodeId: string, edges: AppEdge[]): AppEdge[] {
  return edges.filter((edge) => edge.source === nodeId)
}

// ============================================================================
// 上游节点查询
// ============================================================================

/**
 * 获取直接上游节点（一层，通过 edges 连接）
 */
export function getDirectUpstreamNodes(
  nodeId: string,
  nodes: AppNode[],
  edges: AppEdge[],
): AppNode[] {
  const incoming = getIncomingEdges(nodeId, edges)
  const upstreamIds = new Set(incoming.map((e) => e.source))
  return nodes.filter((node) => upstreamIds.has(node.id))
}

/**
 * 获取直接下游节点（一层）
 */
export function getDirectDownstreamNodes(
  nodeId: string,
  nodes: AppNode[],
  edges: AppEdge[],
): AppNode[] {
  const outgoing = getOutgoingEdges(nodeId, edges)
  const downstreamIds = new Set(outgoing.map((e) => e.target))
  return nodes.filter((node) => downstreamIds.has(node.id))
}

// ============================================================================
// 递归上游遍历
// ============================================================================

/**
 * 递归获取所有上游节点 ID（BFS，保证从远到近的顺序）
 * 结果按拓扑顺序排列：更远的上游在前，更近的在后。
 */
export function getUpstreamNodeIds(
  nodeId: string,
  edges: AppEdge[],
  maxDepth: number = 10,
): string[] {
  const pairs = getUpstreamIdDepthPairs(nodeId, edges, maxDepth)
  return pairs.map((p) => p.id)
}

/** ID + depth 对，用于后续位置排序 */
interface IdDepthPair {
  id: string
  depth: number
}

function getUpstreamIdDepthPairs(
  nodeId: string,
  edges: AppEdge[],
  maxDepth: number,
): IdDepthPair[] {
  const result: IdDepthPair[] = []
  const visited = new Set<string>()

  function walk(currentId: string, currentDepth: number): void {
    if (currentDepth > maxDepth) return

    for (const edge of edges) {
      if (edge.target !== currentId) continue
      const upstreamId = edge.source
      if (!upstreamId || visited.has(upstreamId)) continue

      visited.add(upstreamId)
      walk(upstreamId, currentDepth + 1)
      // 后序追加：先处理更深的上游，保证拓扑顺序
      result.push({ id: upstreamId, depth: currentDepth + 1 })
    }
  }

  walk(nodeId, 0)
  return result
}

/**
 * 递归获取所有上游节点对象（BFS，拓扑顺序）
 * 同 depth 的节点按画布位置排序（x → y → id），保证引用顺序稳定。
 */
export function getUpstreamNodes(
  nodeId: string,
  nodes: AppNode[],
  edges: AppEdge[],
  maxDepth: number = 10,
): AppNode[] {
  const pairs = getUpstreamIdDepthPairs(nodeId, edges, maxDepth)
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  return pairs
    .map((p) => nodeMap.get(p.id))
    .filter((n): n is AppNode => n != null)
    .sort((a, b) => {
      const da = pairs.find((p) => p.id === a.id)?.depth ?? 0
      const db = pairs.find((p) => p.id === b.id)?.depth ?? 0
      // 深层优先（拓扑顺序）
      if (da !== db) return da - db
      // 同深：按画布位置 → x → y → id
      const ax = a.position.x
      const bx = b.position.x
      if (ax !== bx) return ax - bx
      const ay = a.position.y
      const by = b.position.y
      if (ay !== by) return ay - by
      return a.id.localeCompare(b.id)
    })
}

/**
 * 以 nodeId 为起点，按拓扑顺序返回上游节点 ID + 当前节点 ID。
 * 适合工作流执行：先执行上游，最后执行当前节点。
 */
export function topologicalOrder(
  nodeId: string,
  edges: AppEdge[],
  maxDepth: number = 10,
): string[] {
  return [...getUpstreamNodeIds(nodeId, edges, maxDepth), nodeId]
}

// ============================================================================
// 循环检测
// ============================================================================

/**
 * 检查从 nodeId 出发是否构成循环
 */
export function hasCycle(
  nodeId: string,
  edges: AppEdge[],
  maxDepth: number = 20,
): boolean {
  const visited = new Set<string>()
  const stack = new Set<string>()

  function dfs(currentId: string, depth: number): boolean {
    if (depth > maxDepth) return false
    if (stack.has(currentId)) return true
    if (visited.has(currentId)) return false

    visited.add(currentId)
    stack.add(currentId)

    for (const edge of edges) {
      if (edge.source !== currentId) continue
      if (dfs(edge.target, depth + 1)) return true
    }

    stack.delete(currentId)
    return false
  }

  return dfs(nodeId, 0)
}

// ============================================================================
// 递归下游遍历 (P2-2)
// ============================================================================

/**
 * 递归获取所有下游节点 ID（BFS，前序：当前节点先入，保证执行顺序）。
 * 结果按拓扑顺序排列：更近的下游在前，更远的在后。
 */
export function getDownstreamNodeIds(
  nodeId: string,
  edges: AppEdge[],
  maxDepth: number = 10,
): string[] {
  const result: string[] = []
  const visited = new Set<string>()

  function walk(currentId: string, currentDepth: number): void {
    if (currentDepth >= maxDepth) return

    for (const edge of edges) {
      if (edge.source !== currentId) continue
      const downstreamId = edge.target
      if (!downstreamId || visited.has(downstreamId)) continue

      visited.add(downstreamId)
      // 前序追加：当前节点先入 result，保证 root → 近端 → 远端 的执行顺序
      result.push(downstreamId)
      walk(downstreamId, currentDepth + 1)
    }
  }

  walk(nodeId, 0)
  return result
}

/** ID + depth 对，用于下游位置排序 */
interface DownstreamIdDepthPair {
  id: string
  depth: number
}

function getDownstreamIdDepthPairs(
  nodeId: string,
  edges: AppEdge[],
  maxDepth: number,
): DownstreamIdDepthPair[] {
  const result: DownstreamIdDepthPair[] = []
  const visited = new Set<string>()

  function walk(currentId: string, currentDepth: number): void {
    if (currentDepth >= maxDepth) return

    for (const edge of edges) {
      if (edge.source !== currentId) continue
      const downstreamId = edge.target
      if (!downstreamId || visited.has(downstreamId)) continue

      visited.add(downstreamId)
      result.push({ id: downstreamId, depth: currentDepth + 1 })
      walk(downstreamId, currentDepth + 1)
    }
  }

  walk(nodeId, 0)
  return result
}

/**
 * 递归获取所有下游节点对象（BFS，拓扑顺序）。
 * 同 depth 的节点按画布位置排序（x → y → id）。
 */
export function getDownstreamNodes(
  nodeId: string,
  nodes: AppNode[],
  edges: AppEdge[],
  maxDepth: number = 10,
): AppNode[] {
  const pairs = getDownstreamIdDepthPairs(nodeId, edges, maxDepth)
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  return pairs
    .map((p) => nodeMap.get(p.id))
    .filter((n): n is AppNode => n != null)
    .sort((a, b) => {
      const da = pairs.find((p) => p.id === a.id)?.depth ?? 0
      const db = pairs.find((p) => p.id === b.id)?.depth ?? 0
      // 近层优先（拓扑顺序：root → 近端 → 远端）
      if (da !== db) return da - db
      // 同深：按画布位置 → x → y → id
      const ax = a.position.x
      const bx = b.position.x
      if (ax !== bx) return ax - bx
      const ay = a.position.y
      const by = b.position.y
      if (ay !== by) return ay - by
      return a.id.localeCompare(b.id)
    })
}

/**
 * 以 nodeId 为起点，按拓扑顺序返回当前节点 ID + 下游节点 ID。
 * 适合工作流执行：先执行当前节点，再执行下游。
 */
export function downstreamTopologicalOrder(
  nodeId: string,
  edges: AppEdge[],
  maxDepth: number = 10,
): string[] {
  return [nodeId, ...getDownstreamNodeIds(nodeId, edges, maxDepth)]
}

// ============================================================================
// 通用拓扑排序 (P2-2)
// ============================================================================

/**
 * Kahn 算法对任意节点集合做拓扑排序。
 * 仅考虑 nodeIds 集合内的边。
 * 同层级节点按 ID 字典序稳定排序（确定性）。
 * 如果有环，环内节点不会被包含在结果中。
 */
export function topologicalSortAll(
  nodeIds: string[],
  edges: AppEdge[],
): string[] {
  const nodeSet = new Set(nodeIds)
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()
  const result: string[] = []

  // 初始化
  for (const id of nodeIds) {
    inDegree.set(id, 0)
    adj.set(id, [])
  }

  // 构建入度和邻接表（仅统计 nodeIds 内的边）
  for (const edge of edges) {
    const { source, target } = edge
    if (!nodeSet.has(source) || !nodeSet.has(target)) continue
    adj.get(source)!.push(target)
    inDegree.set(target, (inDegree.get(target) ?? 0) + 1)
  }

  // Kahn 算法：从入度为 0 的节点开始
  const queue: string[] = []
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id)
  }
  // 同层稳定排序
  queue.sort((a, b) => a.localeCompare(b))

  while (queue.length > 0) {
    // 当前层级：全部出队
    const level = [...queue]
    queue.length = 0

    for (const id of level) {
      result.push(id)
      for (const neighbor of adj.get(id) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 1) - 1
        inDegree.set(neighbor, newDegree)
        if (newDegree === 0) {
          queue.push(neighbor)
        }
      }
    }
    // 下一层稳定排序
    queue.sort((a, b) => a.localeCompare(b))
  }

  return result
}

// ============================================================================
// 子图环检测 (P2-2)
// ============================================================================

/**
 * 检测节点集合中是否存在环。
 * 遍历 nodeIds 中的每个节点，使用已有的 hasCycle() 检查。
 * 一旦发现环立即返回 true。
 */
export function detectCyclesInSet(
  nodeIds: string[],
  edges: AppEdge[],
  maxDepth: number = 20,
): boolean {
  for (const nodeId of nodeIds) {
    if (hasCycle(nodeId, edges, maxDepth)) return true
  }
  return false
}
