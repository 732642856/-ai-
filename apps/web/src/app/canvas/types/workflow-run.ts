// ============================================================================
// WorkflowRunPanel 类型定义 (P2-3A)
// ============================================================================
// 纯类型 + 枚举 + 工具函数，不依赖 React / DOM / global state。
// ============================================================================

// ── 工作流整体运行状态 ──────────────────────────────────
export type WorkflowRunStatus =
  | "idle"
  | "running"
  | "success"
  | "failed"
  | "cancelled"

// ── 工作流中单个节点运行状态 ────────────────────────────
export type WorkflowNodeRunStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "skipped"
  | "cancelled"

// ── 工作流运行记录 ──────────────────────────────────────
export interface WorkflowRunRecord {
  /** 运行唯一标识 */
  id: string
  /** 整体运行状态 */
  status: WorkflowRunStatus
  /** 运行启动时间 (ISO 8601) */
  startedAt: string
  /** 运行结束时间 (ISO 8601) */
  endedAt?: string
  /** 总耗时 (ms) */
  durationMs?: number
  /** 所有参与节点的运行记录 */
  nodes: WorkflowNodeRunRecord[]
  /** 整体错误信息 */
  error?: string
  /** 总节点数 */
  totalCount: number
  /** 已成功节点数 */
  succeededCount: number
  /** 已失败节点数 */
  failedCount: number
  /** 运行模式 */
  mode?: string
}

// ── 单节点运行记录 ──────────────────────────────────────
export interface WorkflowNodeRunRecord {
  /** 节点 ID */
  nodeId: string
  /** 节点类型 */
  nodeType: string
  /** 节点标题 */
  title?: string
  /** 节点运行状态 */
  status: WorkflowNodeRunStatus
  /** 开始时间 (ISO 8601) */
  startedAt?: string
  /** 结束时间 (ISO 8601) */
  endedAt?: string
  /** 耗时 (ms) */
  durationMs?: number
  /** 输入摘要 */
  inputSummary?: string
  /** 输出摘要 */
  outputSummary?: string
  /** 错误信息 */
  error?: string
  /** 执行深度 (相对于 root) */
  depth?: number
}

// ── 工作流运行事件 (reducer 入参) ───────────────────────
export type WorkflowRunEvent =
  | {
      type: "run-started"
      runId: string
      startedAt: string
      nodes: Array<{
        nodeId: string
        nodeType: string
        title?: string
        depth?: number
      }>
      mode?: string
    }
  | {
      type: "node-started"
      runId: string
      nodeId: string
      startedAt: string
      inputSummary?: string
    }
  | {
      type: "node-succeeded"
      runId: string
      nodeId: string
      endedAt: string
      outputSummary?: string
    }
  | {
      type: "node-failed"
      runId: string
      nodeId: string
      endedAt: string
      error: string
    }
  | {
      type: "node-skipped"
      runId: string
      nodeId: string
      reason?: string
    }
  | {
      type: "run-finished"
      runId: string
      endedAt: string
      status: "success" | "failed" | "cancelled"
      error?: string
    }

// ── 工具函数 ─────────────────────────────────────────────

/** 获取状态对应的图标字符（用于 UI 展示） */
export function getRunStatusIcon(status: WorkflowNodeRunStatus): string {
  switch (status) {
    case "running":
      return "●"
    case "success":
      return "✓"
    case "failed":
      return "✕"
    case "pending":
      return "○"
    case "skipped":
      return "⏭"
    case "cancelled":
      return "⊘"
  }
}

/** 获取状态对应的颜色类名 */
export function getRunStatusColor(status: WorkflowNodeRunStatus): string {
  switch (status) {
    case "running":
      return "text-blue-400"
    case "success":
      return "text-emerald-400"
    case "failed":
      return "text-red-400"
    case "pending":
      return "text-zinc-500"
    case "skipped":
      return "text-amber-400"
    case "cancelled":
      return "text-zinc-600"
  }
}

/** 格式化耗时 (ms) 为可读字符串 */
export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = ((ms % 60000) / 1000).toFixed(0)
  return `${minutes}m ${seconds}s`
}

/** 计算从 startedAt 到现在的耗时 (ms) */
export function elapsedMs(startedAt: string, endedAt?: string): number {
  const end = endedAt ? new Date(endedAt).getTime() : Date.now()
  return end - new Date(startedAt).getTime()
}
