// ============================================================================
// Execution Plan — 执行计划构建器 (P2-2)
// ============================================================================
// 纯函数，不依赖 React / DOM / global state。
// 将图拓扑遍历结果转换为可执行的 ExecutionPlan。
// ============================================================================

import type { AppNode, AppEdge } from "./graph-traversal"
import {
  topologicalOrder,
  downstreamTopologicalOrder,
  topologicalSortAll,
  detectCyclesInSet,
  hasCycle,
} from "./graph-traversal"

// ============================================================================
// 类型定义
// ============================================================================

/** 执行计划模式 */
export type ExecutionPlanMode = "single" | "upstream" | "downstream" | "selected" | "full"

/** 执行步骤状态 */
export type ExecutionPlanStepStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped"
  | "cancelled"

/** 执行计划中的单个步骤 */
export interface ExecutionPlanStep {
  id: string
  nodeId: string
  depth: number
  dependencies: string[]
  dependents: string[]
  status: ExecutionPlanStepStatus
  startedAt?: string
  finishedAt?: string
  durationMs?: number
  error?: string
}

/** 执行计划 */
export interface ExecutionPlan {
  id: string
  canvasId: string
  mode: ExecutionPlanMode
  rootNodeIds: string[]
  steps: ExecutionPlanStep[]
  startedAt?: string
  finishedAt?: string
  status: "pending" | "running" | "succeeded" | "failed" | "cancelled"
  warnings: string[]
}

// ============================================================================
// 构建选项
// ============================================================================

export interface BuildExecutionPlanOptions {
  mode: ExecutionPlanMode
  rootNodeIds: string[]
  selectedNodeIds?: string[]
  nodes: AppNode[]
  edges: AppEdge[]
  canvasId: string
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 生成唯一的 step ID。
 * 格式: step-<nodeId>
 */
function makeStepId(nodeId: string): string {
  return `step-${nodeId}`
}

/**
 * 构建 step 之间的依赖关系。
 */
function buildStepRelations(
  orderedNodeIds: string[],
  edges: AppEdge[],
  stepIdMap: Map<string, string>,
): { dependencies: Map<string, string[]>; dependents: Map<string, string[]> } {
  const dependencies = new Map<string, string[]>()
  const dependents = new Map<string, string[]>()

  for (const id of orderedNodeIds) {
    dependencies.set(makeStepId(id), [])
    dependents.set(makeStepId(id), [])
  }

  for (const edge of edges) {
    const { source, target } = edge
    if (!orderedNodeIds.includes(source) || !orderedNodeIds.includes(target)) continue

    const sourceStep = stepIdMap.get(source)
    const targetStep = stepIdMap.get(target)
    if (!sourceStep || !targetStep) continue

    // target 依赖 source
    const deps = dependents.get(sourceStep) ?? []
    deps.push(targetStep)
    dependents.set(sourceStep, deps)

    const revDeps = dependencies.get(targetStep) ?? []
    revDeps.push(sourceStep)
    dependencies.set(targetStep, revDeps)
  }

  return { dependencies, dependents }
}

/**
 * 生成计划 ID。
 */
function generatePlanId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for test environments
  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// ============================================================================
// buildExecutionPlan — 主构建函数
// ============================================================================

export function buildExecutionPlan(options: BuildExecutionPlanOptions): ExecutionPlan {
  const { mode, rootNodeIds, selectedNodeIds, nodes, edges, canvasId } = options
  const warnings: string[] = []

  // ── 确定节点 ID 顺序 ──────────────────────────────────
  let orderedIds: string[]
  const allNodeIds = nodes.map((n) => n.id)

  function computeDepthUpstream(ids: string[]): number[] {
    // upstream 拓扑顺序: 深层在前 (index 0), root 在最后
    // depth = totalLength - 1 - index
    const total = ids.length
    return ids.map((_, i) => total - 1 - i)
  }

  function computeDepthDownstream(ids: string[]): number[] {
    // downstream 拓扑顺序: root 在 index 0, 近端在前
    return ids.map((_, i) => i)
  }

  function computeDepthKahn(ids: string[], nodes: AppNode[], edges: AppEdge[]): number[] {
    // 使用 Kahn 算法计算每个节点的层级
    const nodeSet = new Set(ids)
    const inDegree = new Map<string, number>()
    const adj = new Map<string, string[]>()
    const depth = new Map<string, number>()

    for (const id of ids) {
      inDegree.set(id, 0)
      adj.set(id, [])
    }
    for (const edge of edges) {
      const { source, target } = edge
      if (!nodeSet.has(source) || !nodeSet.has(target)) continue
      adj.get(source)!.push(target)
      inDegree.set(target, (inDegree.get(target) ?? 0) + 1)
    }

    const queue: string[] = []
    for (const [id, degree] of inDegree) {
      if (degree === 0) {
        queue.push(id)
        depth.set(id, 0)
      }
    }
    queue.sort()

    while (queue.length > 0) {
      const level = [...queue]
      queue.length = 0

      for (const id of level) {
        const currentDepth = depth.get(id) ?? 0
        for (const neighbor of adj.get(id) ?? []) {
          const newDegree = (inDegree.get(neighbor) ?? 1) - 1
          inDegree.set(neighbor, newDegree)
          const nd = currentDepth + 1
          const existingDepth = depth.get(neighbor)
          if (existingDepth === undefined || nd > existingDepth) {
            depth.set(neighbor, nd)
          }
          if (newDegree === 0) {
            queue.push(neighbor)
          }
        }
      }
      queue.sort()
    }

    return ids.map((id) => depth.get(id) ?? 0)
  }

  switch (mode) {
    case "single": {
      orderedIds = [...rootNodeIds]
      // 验证 rootNodeId 是否存在于 nodes 中
      if (rootNodeIds.length !== 1) {
        warnings.push(`single 模式只接受一个 rootNodeId，收到 ${rootNodeIds.length} 个`)
      }
      const rootId = rootNodeIds[0]
      if (rootId && !nodes.some((n) => n.id === rootId)) {
        warnings.push(`节点 ${rootId} 不存在于当前画布中`)
      }
      break
    }

    case "upstream": {
      const rootId = rootNodeIds[0]
      if (!rootId) {
        warnings.push("upstream 模式需要至少一个 rootNodeId")
        orderedIds = []
        break
      }
      if (!nodes.some((n) => n.id === rootId)) {
        warnings.push(`节点 ${rootId} 不存在于当前画布中`)
        orderedIds = []
        break
      }
      orderedIds = topologicalOrder(rootId, edges)
      break
    }

    case "downstream": {
      const rootId = rootNodeIds[0]
      if (!rootId) {
        warnings.push("downstream 模式需要至少一个 rootNodeId")
        orderedIds = []
        break
      }
      if (!nodes.some((n) => n.id === rootId)) {
        warnings.push(`节点 ${rootId} 不存在于当前画布中`)
        orderedIds = []
        break
      }
      orderedIds = downstreamTopologicalOrder(rootId, edges)
      break
    }

    case "selected": {
      const ids = selectedNodeIds ?? rootNodeIds
      if (ids.length === 0) {
        warnings.push("selected 模式需要至少一个节点 ID")
        orderedIds = []
        break
      }
      // 环检测
      if (detectCyclesInSet(ids, edges)) {
        warnings.push("检测到循环引用，环内节点将被排除在执行计划之外")
      }
      const sorted = topologicalSortAll(ids, edges)
      // 被环排除的节点
      if (sorted.length < ids.length) {
        warnings.push(
          `共 ${ids.length - sorted.length} 个节点因循环引用被排除`,
        )
      }
      orderedIds = sorted.filter((id) => nodes.some((n) => n.id === id))
      if (orderedIds.length < sorted.length) {
        warnings.push(
          `共 ${sorted.length - orderedIds.length} 个节点不存在于当前画布中`,
        )
      }
      break
    }

    case "full": {
      if (allNodeIds.length === 0) {
        warnings.push("画布中没有节点")
        orderedIds = []
        break
      }
      if (detectCyclesInSet(allNodeIds, edges)) {
        warnings.push("检测到循环引用，环内节点将被排除在执行计划之外")
      }
      const sorted = topologicalSortAll(allNodeIds, edges)
      if (sorted.length < allNodeIds.length) {
        warnings.push(
          `共 ${allNodeIds.length - sorted.length} 个节点因循环引用被排除`,
        )
      }
      orderedIds = sorted.filter((id) => nodes.some((n) => n.id === id))
      break
    }

    default: {
      orderedIds = []
      warnings.push(`未知的执行模式: ${mode}`)
    }
  }

  // ── 计算 depth ─────────────────────────────────────────
  let depths: number[]
  switch (mode) {
    case "upstream":
      depths = computeDepthUpstream(orderedIds)
      break
    case "downstream":
      depths = computeDepthDownstream(orderedIds)
      break
    case "selected":
    case "full":
      depths = computeDepthKahn(orderedIds, nodes, edges)
      break
    case "single":
      depths = Array(orderedIds.length).fill(0)
      break
    default:
      depths = Array(orderedIds.length).fill(0)
  }

  // ── 构建 step ID 映射 ──────────────────────────────────
  const stepIdMap = new Map<string, string>()
  for (const id of orderedIds) {
    stepIdMap.set(id, makeStepId(id))
  }

  // ── 构建步骤依赖关系 ──────────────────────────────────
  const { dependencies, dependents } = buildStepRelations(
    orderedIds,
    edges,
    stepIdMap,
  )

  // ── 组装 steps ─────────────────────────────────────────
  const steps: ExecutionPlanStep[] = orderedIds.map((nodeId, i) => {
    const sid = makeStepId(nodeId)
    return {
      id: sid,
      nodeId,
      depth: depths[i] ?? 0,
      dependencies: dependencies.get(sid) ?? [],
      dependents: dependents.get(sid) ?? [],
      status: "pending" as ExecutionPlanStepStatus,
    }
  })

  return {
    id: generatePlanId(),
    canvasId,
    mode,
    rootNodeIds,
    steps,
    status: "pending",
    warnings,
  }
}
