// ============================================================================
// Node RunMeta Utilities (P1-3 enhanced — 长任务 + 上游状态归一化)
// ============================================================================
import type {
  NodeRunStatus,
  NodeRunMeta,
  NodeRunSource,
} from "../components/canvas/types"

// Re-export types for consumers who import from this module
export type { NodeRunStatus, NodeRunMeta, NodeRunSource } from "../components/canvas/types"

// ---- 工厂函数 ----

export function createIdleRunMeta(): NodeRunMeta {
  return { runStatus: "idle" }
}

export function normalizeRunMeta(
  runMeta?: Partial<NodeRunMeta>,
): NodeRunMeta {
  return {
    runStatus: runMeta?.runStatus ?? "idle",
    progress: runMeta?.progress,
    message: runMeta?.message,
    error: runMeta?.error,
    lastRunAt: runMeta?.lastRunAt,
    lastFinishedAt: runMeta?.lastFinishedAt,
    runId: runMeta?.runId,
    currentHistoryId: runMeta?.currentHistoryId,
    externalTaskId: runMeta?.externalTaskId,
    rawStatus: runMeta?.rawStatus,
    source: runMeta?.source,
    pendingReason: runMeta?.pendingReason,
  }
}

export function createPendingRunMeta(params?: {
  reason?: string
  message?: string
  source?: NodeRunSource
}): NodeRunMeta {
  return {
    runStatus: "pending",
    pendingReason: params?.reason,
    message: params?.message ?? params?.reason,
    source: params?.source,
  }
}

export function createRunningRunMeta(params?: {
  runId?: string
  currentHistoryId?: string
  externalTaskId?: string
  message?: string
  source?: NodeRunSource
}): NodeRunMeta {
  return {
    runStatus: "running",
    progress: 0,
    message: params?.message,
    error: undefined,
    lastRunAt: new Date().toISOString(),
    runId: params?.runId,
    currentHistoryId: params?.currentHistoryId,
    externalTaskId: params?.externalTaskId,
    source: params?.source,
  }
}

export function createSucceededRunMeta(params?: {
  runId?: string
  currentHistoryId?: string
  externalTaskId?: string
  message?: string
}): NodeRunMeta {
  return {
    runStatus: "succeeded",
    progress: 100,
    message: params?.message,
    error: undefined,
    lastFinishedAt: new Date().toISOString(),
    runId: params?.runId,
    currentHistoryId: params?.currentHistoryId,
    externalTaskId: params?.externalTaskId,
  }
}

export function createFailedRunMeta(params: {
  error: string
  runId?: string
  currentHistoryId?: string
  externalTaskId?: string
  message?: string
}): NodeRunMeta {
  return {
    runStatus: "failed",
    progress: 100,
    message: params.message ?? params.error,
    error: params.error,
    lastFinishedAt: new Date().toISOString(),
    runId: params.runId,
    currentHistoryId: params.currentHistoryId,
    externalTaskId: params.externalTaskId,
  }
}

export function createCancelledRunMeta(params?: {
  runId?: string
  currentHistoryId?: string
  message?: string
}): NodeRunMeta {
  return {
    runStatus: "cancelled",
    progress: 100,
    message: params?.message,
    lastFinishedAt: new Date().toISOString(),
    runId: params?.runId,
    currentHistoryId: params?.currentHistoryId,
  }
}

// ---- 上游状态归一化 ----

/**
 * 长任务上游状态归一化工具（P1-3 增强）。
 *
 * 覆盖：
 * - ModelScope: SUCCEED / FAILED / CANCELED / RUNNING / QUEUED
 * - ComfyUI:    success / error / running / pending
 * - 视频 API:   SUCCESS / COMPLETED / DONE / FAILURE / TIMEOUT / PROCESSING
 * - Canvas 任务: queued / running / succeeded / failed
 *
 * 统一映射到六态 NodeRunStatus，不传递原始字符串给 UI。
 */
export function normalizeExternalRunStatus(raw: string): NodeRunStatus {
  const value = raw.trim().toUpperCase()

  // ---- succeeded ----
  if (
    [
      "SUCCESS",
      "SUCCEED",
      "SUCCEEDED",
      "COMPLETED",
      "COMPLETE",
      "DONE",
      "FINISHED",
      "FINISH",
      "OK",
      "READY",
    ].includes(value)
  ) {
    return "succeeded"
  }

  // ---- cancelled ----
  if (
    [
      "CANCELED",
      "CANCELLED",
      "REVOKED",
    ].includes(value)
  ) {
    return "cancelled"
  }

  // ---- failed ----
  if (
    [
      "FAILURE",
      "FAILED",
      "FAIL",
      "ERROR",
      "ERRORED",
      "TIMEOUT",
      "TIMEDOUT",
      "REJECTED",
      "EXPIRED",
    ].includes(value)
  ) {
    return "failed"
  }

  // ---- pending ----
  if (
    [
      "QUEUED",
      "QUEUE",
      "PENDING",
      "WAITING",
    ].includes(value)
  ) {
    return "pending"
  }

  // ---- running ----
  if (
    [
      "RUNNING",
      "PROCESSING",
      "GENERATING",
      "IN_PROGRESS",
      "SUBMITTED",
      "POLLING",
    ].includes(value)
  ) {
    return "running"
  }

  // fallback to running (treat unknown as in-progress)
  return "running"
}

// ---- 查询函数 ----

export function isNodeBusy(runStatus: NodeRunStatus): boolean {
  return runStatus === "pending" || runStatus === "running"
}

export function isNodeFinished(runStatus: NodeRunStatus): boolean {
  return (
    runStatus === "succeeded" ||
    runStatus === "failed" ||
    runStatus === "cancelled"
  )
}

// ---- 旧字段兼容 ----

/**
 * 兼容读取：优先用 runMeta，否则从旧字段推断 NodeRunMeta。
 * 用于 UI 层兼容旧 localStorage 数据。
 */
export function getCompatibleRunMeta(data: {
  runMeta?: Partial<NodeRunMeta>
  pendingExecution?: boolean
  status?: string
  errorMessage?: string
}): NodeRunMeta {
  // 新字段优先
  if (data.runMeta) {
    return normalizeRunMeta(data.runMeta)
  }

  // 旧 pendingExecution
  if (data.pendingExecution) {
    return createPendingRunMeta({ reason: "等待确认运行" })
  }

  // 旧 status 字段（WorkflowNodeStatus）
  if (data.status === "running") {
    return createRunningRunMeta()
  }
  if (data.status === "done" || data.status === "succeeded") {
    return createSucceededRunMeta()
  }
  if (data.status === "error" || data.status === "failed") {
    return createFailedRunMeta({
      error: data.errorMessage ?? "运行失败",
    })
  }

  // 默认 idle
  return createIdleRunMeta()
}
