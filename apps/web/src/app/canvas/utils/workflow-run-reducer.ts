// ============================================================================
// workflowRunReducer — 纯函数状态机 (P2-3A)
// ============================================================================
// 接收 WorkflowRunEvent 事件流，输出 WorkflowRunRecord。
// 纯函数，无副作用，独立于 React/Runner/UI，方便单元测试。
// ============================================================================

import type {
  WorkflowRunRecord,
  WorkflowNodeRunRecord,
  WorkflowRunEvent,
} from "../types/workflow-run"

/**
 * 工作流运行 reducer。
 * @param state  当前运行记录 (null 表示尚未开始)
 * @param event  下一个事件
 * @returns      新的运行记录 (immutable)
 */
export function workflowRunReducer(
  state: WorkflowRunRecord | null,
  event: WorkflowRunEvent,
): WorkflowRunRecord | null {
  switch (event.type) {
    // ── run-started ─────────────────────────────────────
    case "run-started": {
      const nodes: WorkflowNodeRunRecord[] = event.nodes.map((n) => ({
        nodeId: n.nodeId,
        nodeType: n.nodeType,
        title: n.title,
        status: "pending",
        depth: n.depth,
      }))
      return {
        id: event.runId,
        status: "running",
        startedAt: event.startedAt,
        nodes,
        totalCount: nodes.length,
        succeededCount: 0,
        failedCount: 0,
        mode: event.mode,
      }
    }

    // ── node-started ────────────────────────────────────
    case "node-started": {
      if (!state || state.id !== event.runId) return state
      const nodes = state.nodes.map((nr) =>
        nr.nodeId === event.nodeId
          ? {
              ...nr,
              status: "running" as const,
              startedAt: event.startedAt,
              inputSummary: event.inputSummary ?? nr.inputSummary,
            }
          : nr,
      )
      return { ...state, nodes }
    }

    // ── node-succeeded ──────────────────────────────────
    case "node-succeeded": {
      if (!state || state.id !== event.runId) return state
      const nodes = state.nodes.map((nr) => {
        if (nr.nodeId !== event.nodeId) return nr
        const startedAt = nr.startedAt ?? event.endedAt
        const durationMs =
          new Date(event.endedAt).getTime() - new Date(startedAt).getTime()
        return {
          ...nr,
          status: "success" as const,
          endedAt: event.endedAt,
          durationMs: Math.max(0, durationMs),
          outputSummary: event.outputSummary ?? nr.outputSummary,
        }
      })
      return {
        ...state,
        nodes,
        succeededCount: nodes.filter((n) => n.status === "success").length,
      }
    }

    // ── node-failed ─────────────────────────────────────
    case "node-failed": {
      if (!state || state.id !== event.runId) return state
      const nodes = state.nodes.map((nr) => {
        if (nr.nodeId !== event.nodeId) return nr
        const startedAt = nr.startedAt ?? event.endedAt
        const durationMs =
          new Date(event.endedAt).getTime() - new Date(startedAt).getTime()
        return {
          ...nr,
          status: "failed" as const,
          endedAt: event.endedAt,
          durationMs: Math.max(0, durationMs),
          error: event.error,
        }
      })
      return {
        ...state,
        nodes,
        failedCount: nodes.filter((n) => n.status === "failed").length,
      }
    }

    // ── node-skipped ────────────────────────────────────
    case "node-skipped": {
      if (!state || state.id !== event.runId) return state
      const nodes = state.nodes.map((nr) =>
        nr.nodeId === event.nodeId
          ? { ...nr, status: "skipped" as const, error: event.reason }
          : nr,
      )
      return { ...state, nodes }
    }

    // ── run-finished ────────────────────────────────────
    case "run-finished": {
      if (!state || state.id !== event.runId) return state
      const durationMs =
        new Date(event.endedAt).getTime() - new Date(state.startedAt).getTime()
      return {
        ...state,
        status:
          event.status === "cancelled"
            ? "cancelled"
            : event.status === "failed"
              ? "failed"
              : "success",
        endedAt: event.endedAt,
        durationMs: Math.max(0, durationMs),
        error: event.error ?? state.error,
      }
    }

    default:
      return state
  }
}
