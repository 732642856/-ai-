// ============================================================================
// Handle Role Resolver (P2-1)
// ============================================================================
// 纯函数，将 React Flow edge 的 targetHandle 映射为 ContextMediaRole。
// 对标 ComfyUI 强类型输入口 + Node-RED 端口语义。
// ============================================================================

import type { ContextMediaRole } from "../types/execution-context"
import { HANDLE_TO_ROLE_MAP } from "../types/execution-context"
import type { AppEdge } from "./graph-traversal"

// ============================================================================
// 单 Handle 解析
// ============================================================================

/**
 * 将 handle 名称映射为语义角色。
 * 先在 HANDLE_TO_ROLE_MAP 中精确匹配，失败则尝试模糊匹配（取 handle 名的根部分）。
 *
 * @param handleName edge.sourceHandle 或 edge.targetHandle
 * @returns 语义角色；无法识别时返回 "unknown"
 *
 * @example
 *   resolveMediaRoleFromHandle("mask-in")    → "mask"
 *   resolveMediaRoleFromHandle("image-in")   → "reference"
 *   resolveMediaRoleFromHandle(null)         → "unknown"
 *   resolveMediaRoleFromHandle("weird-port")  → "unknown"
 */
export function resolveMediaRoleFromHandle(
  handleName: string | null | undefined,
): ContextMediaRole {
  if (!handleName) return "unknown"

  // 精确匹配
  const exact = HANDLE_TO_ROLE_MAP[handleName]
  if (exact) return exact

  // 模糊匹配：去掉 -in/-out 后缀，尝试匹配剩余部分的 -in 形式
  const base = handleName.replace(/-out$/, "")
  const candidate = base.endsWith("-in") ? base : `${base}-in`
  const fuzzy = HANDLE_TO_ROLE_MAP[candidate]
  if (fuzzy) return fuzzy

  return "unknown"
}

// ============================================================================
// 入边角色映射（批量）
// ============================================================================

/** 单条入边的角色信息 */
export interface EdgeRoleInfo {
  /** 语义角色 */
  role: ContextMediaRole
  /** 源节点的 sourceHandle */
  sourceHandle?: string
  /** 目标节点的 targetHandle */
  targetHandle?: string
}

/**
 * 一次性构建目标节点所有入边的角色映射。
 *
 * @param targetNodeId 目标节点 ID
 * @param edges         画布所有边
 * @returns Map<sourceNodeId, EdgeRoleInfo>
 *   key = 上游节点 ID
 *   value = { role, sourceHandle, targetHandle }
 *
 * @example
 *   const roleMap = getIncomingEdgeRoleMap("video-gen-1", edges)
 *   // {
 *   //   "img-node-5" → { role: "mask", sourceHandle: "output", targetHandle: "mask-in" },
 *   //   "img-node-3" → { role: "reference", sourceHandle: "output", targetHandle: "image-in" },
 *   //   "txt-node-2" → { role: "prompt", sourceHandle: "output", targetHandle: "prompt-in" },
 *   // }
 */
export function getIncomingEdgeRoleMap(
  targetNodeId: string,
  edges: AppEdge[],
): Map<string, EdgeRoleInfo> {
  const roleMap = new Map<string, EdgeRoleInfo>()

  for (const edge of edges) {
    if (edge.target !== targetNodeId) continue
    const sourceId = edge.source
    if (!sourceId) continue

    // 同名 handle 可能有多条边指向同一源节点？
    // 此时以第一条为准（实际场景中同源对同 targetHandle 只应有一条边）
    if (!roleMap.has(sourceId)) {
      roleMap.set(sourceId, {
        role: resolveMediaRoleFromHandle(edge.targetHandle),
        sourceHandle: edge.sourceHandle ?? undefined,
        targetHandle: edge.targetHandle ?? undefined,
      })
    }
  }

  return roleMap
}
