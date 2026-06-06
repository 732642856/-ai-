// ============================================================================
// HistoryDragPayload — 历史输出拖回画布的数据契约 (P2-4)
// ============================================================================
// 从 HistoryPanel 拖拽历史产物到画布时使用 "application/x-startrail-history-output" MIME。
// ============================================================================

import type { VideoAnalysisResult } from "./video-analysis"
import { getVideoAnalysisResult } from "./video-analysis"

// ============================================================================
// 拖放 payload 类型
// ============================================================================

/** 拖 Summary 回画布 → 创建 Prompt 节点 */
export interface DragPayloadSummary {
  type: "history-video-analysis-summary"
  /** 摘要文本 */
  text: string
  /** 展示用标题（可选，UI 拖拽手柄旁显示） */
  label?: string
  /** 来源历史条目 ID */
  sourceHistoryId: string
  /** 来源节点 ID（可选） */
  sourceNodeId?: string
}

/** 拖单个 Scene 回画布 → 创建 Prompt 节点 */
export interface DragPayloadScene {
  type: "history-video-analysis-scene"
  /** Scene 序号 (0-based) */
  sceneIndex: number
  /** Scene 描述文本 */
  text: string
  /** 展示用标题 */
  label?: string
  /** 开始时间 (ms) */
  start?: number
  /** 结束时间 (ms) */
  end?: number
  /** 来源历史条目 ID */
  sourceHistoryId: string
  /** 来源节点 ID（可选） */
  sourceNodeId?: string
}

/** 拖完整 VideoAnalysisResult → 创建 Prompt 节点（Markdown 格式） */
export interface DragPayloadFullResult {
  type: "history-video-analysis-result"
  /** 展示用标题 */
  label?: string
  /** 视频分析结果 */
  result: VideoAnalysisResult
  /** 来源历史条目 ID */
  sourceHistoryId: string
  /** 来源节点 ID（可选） */
  sourceNodeId?: string
}

export type HistoryDragPayload =
  | DragPayloadSummary
  | DragPayloadScene
  | DragPayloadFullResult

/** custom MIME type */
export const HISTORY_DRAG_MIME = "application/x-startrail-history-output" as const

// ============================================================================
// 安全解析
// ============================================================================

/**
 * 从拖放 dataTransfer 中安全解析 HistoryDragPayload。
 * 验证关键字段类型，拒绝格式不正确的 payload。
 *
 * @returns HistoryDragPayload 或 null（无效 payload）
 */
export function safeParseHistoryDragPayload(raw: string): HistoryDragPayload | null {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }

  if (!value || typeof value !== "object") return null

  const obj = value as Record<string, unknown>

  // Summary
  if (obj.type === "history-video-analysis-summary" && typeof obj.text === "string") {
    return {
      type: "history-video-analysis-summary",
      text: obj.text,
      label: typeof obj.label === "string" ? obj.label : undefined,
      sourceHistoryId: String(obj.sourceHistoryId ?? ""),
      sourceNodeId: typeof obj.sourceNodeId === "string" ? obj.sourceNodeId : undefined,
    }
  }

  // Scene
  if (
    obj.type === "history-video-analysis-scene" &&
    typeof obj.text === "string" &&
    typeof obj.sceneIndex === "number"
  ) {
    return {
      type: "history-video-analysis-scene",
      text: obj.text,
      label: typeof obj.label === "string" ? obj.label : undefined,
      sceneIndex: obj.sceneIndex,
      start: typeof obj.start === "number" ? obj.start : undefined,
      end: typeof obj.end === "number" ? obj.end : undefined,
      sourceHistoryId: String(obj.sourceHistoryId ?? ""),
      sourceNodeId: typeof obj.sourceNodeId === "string" ? obj.sourceNodeId : undefined,
    }
  }

  // Full result
  if (obj.type === "history-video-analysis-result") {
    const result = getVideoAnalysisResult(obj.result)
    if (!result) return null
    return {
      type: "history-video-analysis-result",
      label: typeof obj.label === "string" ? obj.label : undefined,
      result,
      sourceHistoryId: String(obj.sourceHistoryId ?? ""),
      sourceNodeId: typeof obj.sourceNodeId === "string" ? obj.sourceNodeId : undefined,
    }
  }

  return null
}

// ============================================================================
// Markdown 格式化
// ============================================================================

/**
 * 将 VideoAnalysisResult 格式化为 Markdown 文本。
 * 用于从完整结果创建 Prompt 节点，也用于复制/导出等场景。
 */
export function formatVideoAnalysisAsMarkdown(result: VideoAnalysisResult): string {
  const lines: string[] = []

  if (result.summary) {
    lines.push("# 视频分析")
    lines.push("")
    lines.push("## 摘要")
    lines.push(result.summary)
    lines.push("")
  }

  if (result.keyframes && result.keyframes.length > 0) {
    lines.push("## 关键帧")
    lines.push("")
    result.keyframes.forEach((kf, idx) => {
      const ts = formatTimestampMs(kf.timestampMs)
      lines.push(`- **帧 ${idx + 1}** ${ts}`)
      if (kf.description) lines.push(`  ${kf.description}`)
    })
    lines.push("")
  }

  if (result.captions && result.captions.length > 0) {
    lines.push("## 字幕")
    lines.push("")
    result.captions.forEach((cap) => {
      const speaker = cap.speaker ? `**${cap.speaker}**: ` : ""
      lines.push(`- ${formatTimestampMs(cap.startMs)} ${speaker}${cap.text}`)
    })
    lines.push("")
  }

  if (result.events && result.events.length > 0) {
    lines.push("## 事件")
    lines.push("")
    result.events.forEach((evt) => {
      lines.push(`- ${formatTimestampMs(evt.startMs)} **${evt.label}**`)
      if (evt.description) lines.push(`  ${evt.description}`)
    })
    lines.push("")
  }

  return lines.join("\n").trim()
}

/** 毫秒 → mm:ss.ms 格式（Markdown 内部用） */
function formatTimestampMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const millis = ms % 1000
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${Math.floor(millis / 10).toString().padStart(2, "0")}`
}
