// ============================================================================
// useHistoryDrop — 处理从 HistoryPanel 拖到画布的历史产物 (P2-4)
// ============================================================================
// 与 useCanvasDropUpload 协作：先检查历史 payload，未命中则 fallback 到文件拖放。
// ============================================================================

import { useCallback } from "react"
import { useReactFlow } from "@xyflow/react"
import type { Node } from "@xyflow/react"
import { generateId } from "../utils/generateId"
import {
  safeParseHistoryDragPayload,
  formatVideoAnalysisAsMarkdown,
  HISTORY_DRAG_MIME,
} from "../types/history-drag"
import type { HistoryDragPayload } from "../types/history-drag"

/** 默认 prompt 节点宽度 */
const PROMPT_NODE_WIDTH = 320

/**
 * 画布侧历史拖放 hook。
 *
 * @param setNodes — ReactFlow setNodes
 * @param onNodeCreated — 可选，节点创建后回调（用于自动选中等）
 * @returns handleHistoryDrop(event) => 是否已处理（true 表示历史 payload，false 应 fallback 到文件处理）
 */
export function useHistoryDrop(
  setNodes: (updater: (nodes: Node[]) => Node[]) => void,
  onNodeCreated?: (nodeId: string) => void,
) {
  const reactFlow = useReactFlow()

  const handleHistoryDrop = useCallback(
    (e: React.DragEvent): boolean => {
      // 检查历史 payload MIME
      const raw = e.dataTransfer.getData(HISTORY_DRAG_MIME)
      if (!raw) return false

      e.preventDefault()
      e.stopPropagation()

      const payload = safeParseHistoryDragPayload(raw)
      if (!payload) return false

      // 屏幕坐标 → 画布坐标
      const canvasPosition = reactFlow.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      })

      const node = createNodeFromHistoryPayload(payload, canvasPosition)
      if (!node) return false

      setNodes((nds) => [...nds, node])

      // 自动选中新创建的节点（由调用方决定行为）
      if (onNodeCreated) {
        onNodeCreated(node.id)
      }

      return true
    },
    [reactFlow, setNodes, onNodeCreated],
  )

  return { handleHistoryDrop }
}

// ============================================================================
// 从 payload 创建节点
// ============================================================================

function createNodeFromHistoryPayload(
  payload: HistoryDragPayload,
  position: { x: number; y: number },
): Node | null {
  const buildSource = (p: HistoryDragPayload) => ({
    type: "history-output" as const,
    historyId: p.sourceHistoryId,
    nodeId: p.sourceNodeId,
    outputType: p.type,
  })

  switch (payload.type) {
    case "history-video-analysis-summary":
      return createPromptNode({
        id: generateId(),
        position,
        text: payload.text,
        title: payload.label ?? "视频摘要",
        metadata: { source: buildSource(payload) },
      })

    case "history-video-analysis-scene": {
      const title = payload.label ?? `场景 ${payload.sceneIndex + 1}`
      const lines = [payload.text]
      if (payload.start !== undefined) {
        lines.push(`\n时间: ${formatMs(payload.start)}`)
        if (payload.end !== undefined) {
          lines.push(` - ${formatMs(payload.end)}`)
        }
      }
      return createPromptNode({
        id: generateId(),
        position,
        text: lines.join(""),
        title,
        metadata: { source: buildSource(payload) },
      })
    }

    case "history-video-analysis-result":
      return createPromptNode({
        id: generateId(),
        position,
        text: formatVideoAnalysisAsMarkdown(payload.result),
        title: payload.label ?? "视频分析报告",
        metadata: { source: buildSource(payload) },
      })

    default:
      return null
  }
}

// ============================================================================
// 节点工厂
// ============================================================================

interface CreatePromptNodeOptions {
  id: string
  position: { x: number; y: number }
  text: string
  title?: string
  metadata?: {
    source: {
      type: string
      historyId?: string
      nodeId?: string
      outputType?: string
    }
  }
}

function createPromptNode(options: CreatePromptNodeOptions): Node {
  const { id, position, text, title, metadata } = options
  return {
    id,
    type: "prompt",
    position,
    data: {
      title: title ?? "Prompt",
      nodeKind: "prompt",
      prompt: text,
      summary: text.slice(0, 100),
      metadata: metadata ?? undefined,
      runMeta: { runStatus: "idle" },
    },
    measured: {
      width: PROMPT_NODE_WIDTH,
      height: 100,
    },
  }
}

// ============================================================================
// 工具函数
// ============================================================================

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}
