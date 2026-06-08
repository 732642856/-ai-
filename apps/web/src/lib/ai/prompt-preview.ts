// ============================================================================
// Prompt Preview Builder (Phase 1-c)
// ============================================================================
// 纯函数：从 React Flow 节点上下文构建 prompt preview。
// 复用 buildRunRequest()，无 IO、无副作用。
//
// 注意：
// - enhancePromptWithCinematicContext 是异步的，preview 中跳过
// - getDefaultModel() / getDefaultImageModel() 是异步的，由调用方获取后传入
// - 纯同步函数，React 组件用 useMemo 包装即可
// ============================================================================

import type { Node, Edge } from "@xyflow/react"
import type { CanvasNodeData, CanvasNodeKind } from "../../app/canvas/components/canvas/types"
import { buildRunRequest } from "./run-request"
import type { RunRequest } from "./run-request"

// ============================================================================
// Types
// ============================================================================

/** 提供给 preview builder 的输入参数 */
export interface PromptPreviewInput {
  /** 当前节点 */
  node: Node<CanvasNodeData>
  /** 全部节点（用于遍历上游） */
  allNodes: Node<CanvasNodeData>[]
  /** 全部边 */
  edges: Edge[]

  // ── 可选：环境默认模型（异步获取后传入） ─────────────
  /** 环境默认文本模型 */
  envDefaultModel?: string
  /** 环境默认图片模型 */
  envDefaultImageModel?: string
}

/** Prompt preview 的输出 */
export interface PromptPreviewResult {
  /** 完整的 RunRequest（包含 message / model / context / _providerOverrides / _meta） */
  runRequest: RunRequest
  /** 是否有上游内容 */
  hasUpstream: boolean
  /** 上游节点 ID 列表 */
  upstreamNodeIds: string[]
}

// ============================================================================
// Helpers
// ============================================================================

/** 判断 nodeKind 对应的 AI 任务类型 */
export function inferTaskType(kind: CanvasNodeKind): "text" | "image" {
  const textKinds: CanvasNodeKind[] = ["text", "script", "storyboard", "subtitle"]
  const imageKinds: CanvasNodeKind[] = ["image-generation", "image-result"]
  if (imageKinds.includes(kind)) return "image"
  return "text"
}

/**
 * 从边列表中提取上游节点的文本内容。
 * 与 useWorkflowRunner.executeStep() 中的 upstream 逻辑一致。
 */
export function extractUpstreamContent(
  nodeId: string,
  allNodes: Node<CanvasNodeData>[],
  edges: Edge[],
): { text: string; nodeIds: string[] } {
  const upstreamEdges = edges.filter((e) => e.target === nodeId)
  const parts: string[] = []
  const ids: string[] = []

  for (const edge of upstreamEdges) {
    const upstream = allNodes.find((n) => n.id === edge.source)
    if (upstream) {
      const d = upstream.data
      const content = d.content || d.prompt || d.summary || d.instruction || ""
      if (content.trim()) {
        parts.push(content.trim())
        ids.push(upstream.id)
      }
    }
  }

  return { text: parts.join("\n\n"), nodeIds: ids }
}

/**
 * 从 node.data 提取 prompt。
 * 优先级：prompt > content > instruction
 */
export function extractNodePrompt(node: Node<CanvasNodeData>): string {
  const d = node.data
  return (d.prompt || d.content || d.instruction || "")
}

/**
 * 从 node.data 提取节点级模型覆盖。
 */
export function extractNodeModel(node: Node<CanvasNodeData>): string | undefined {
  const d = node.data
  const model = d.model?.trim()
  return model || undefined
}

// ============================================================================
// Core: buildPromptPreview
// ============================================================================

/**
 * 从 React Flow 节点上下文构建 prompt preview。
 *
 * 纯函数，无 IO，无副作用。
 * 不包含 enhancePromptWithCinematicContext（异步，需调用方单独处理）。
 *
 * @returns PromptPreviewResult — 包含完整 RunRequest 和上游信息
 */
export function buildPromptPreview(input: PromptPreviewInput): PromptPreviewResult {
  const { node, allNodes, edges, envDefaultModel, envDefaultImageModel } = input
  const kind = (node.data.nodeKind || "text") as CanvasNodeKind
  const taskType = inferTaskType(kind)
  const prompt = extractNodePrompt(node)
  const nodeModel = extractNodeModel(node)
  const upstream = extractUpstreamContent(node.id, allNodes, edges)

  const runRequest = buildRunRequest({
    nodeKind: kind,
    taskType,
    prompt,
    upstreamContent: upstream.text || undefined,
    nodeModel,
    envDefaultModel,
    envDefaultImageModel,
  })

  return {
    runRequest,
    hasUpstream: upstream.nodeIds.length > 0,
    upstreamNodeIds: upstream.nodeIds,
  }
}
