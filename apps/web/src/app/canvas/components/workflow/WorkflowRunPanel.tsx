// ============================================================================
// WorkflowRunPanel — 工作流运行状态可视化面板 (P2-3A)
// ============================================================================
// 显示当前工作流运行的进度时间线：运行中 / 成功 / 失败的节点状态。
// ============================================================================
"use client"

import { memo, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X, Play, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { workflowRunReducer } from "../../utils/workflow-run-reducer"
import type { WorkflowRunRecord, WorkflowRunEvent } from "../../types/workflow-run"
import { formatDurationMs, elapsedMs } from "../../types/workflow-run"
import { DESIGN_TOKENS } from "../../styles/designSystem"
import { WorkflowRunNodeRow } from "./WorkflowRunNodeRow"

// ── 设计 token 别名 ────────────────────────────────────
const CLR = {
  panel: DESIGN_TOKENS.panelSolid,
  border: DESIGN_TOKENS.border,
  text: DESIGN_TOKENS.text,
  textSecondary: DESIGN_TOKENS.textSecondary,
  textMuted: DESIGN_TOKENS.textMuted,
  blue: "#60a5fa",
  green: "#10b981",
  red: "#ef4444",
  amber: "#f59e0b",
} as const

// ── Props ──────────────────────────────────────────────

interface Props {
  isOpen: boolean
  onClose: () => void
  events: WorkflowRunEvent[]
  isRunning: boolean
}

// ── Styles ─────────────────────────────────────────────

const PANEL_STYLE: React.CSSProperties = {
  position: "fixed",
  top: 0,
  right: 0,
  width: 340,
  height: "100vh",
  backgroundColor: CLR.panel,
  borderLeft: `1px solid ${CLR.border}`,
  zIndex: 100,
  display: "flex",
  flexDirection: "column",
  boxShadow: "-4px 0 24px rgba(0,0,0,0.3)",
  color: CLR.text,
            }

// ── Header Status Component ────────────────────────────

const RunHeader = memo(function RunHeader({
  record,
  onClose,
}: {
  record: WorkflowRunRecord
  onClose: () => void
}) {
  const statusColor =
    record.status === "running" ? CLR.blue :
    record.status === "success" ? "#10b981" :
    record.status === "failed" ? "#ef4444" :
    CLR.textSecondary

  const statusIcon =
    record.status === "running" ? <Loader2 size={16} className="animate-spin" /> :
    record.status === "success" ? <CheckCircle2 size={16} /> :
    record.status === "failed" ? <AlertCircle size={16} /> :
    <Play size={16} />

  const statusText: Record<string, string> = {
    running: "运行中",
    success: "成功",
    failed: "失败",
    cancelled: "已取消",
    idle: "空闲",
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        borderBottom: `1px solid ${CLR.border}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: statusColor }}>{statusIcon}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: CLR.text }}>
            Workflow Run
          </div>
          <div style={{ fontSize: 11, color: CLR.textSecondary }}>
            {statusText[record.status] ?? record.status}
            {record.durationMs != null && ` · ${formatDurationMs(record.durationMs)}`}
          </div>
        </div>
      </div>

      <button
        onClick={onClose}
        style={{
          background: "none",
          border: "none",
          color: CLR.textSecondary,
          cursor: "pointer",
          padding: 4,
          borderRadius: 4,
        }}
      >
        <X size={16} />
      </button>
    </div>
  )
})

// ── Stats Bar ──────────────────────────────────────────

const StatsBar = memo(function StatsBar({ record }: { record: WorkflowRunRecord }) {
  const { totalCount, succeededCount, failedCount, nodes } = record
  const skippedCount = nodes.filter((n) => n.status === "skipped" || n.status === "cancelled").length
  const pendingCount = nodes.filter((n) => n.status === "pending" || n.status === "running").length

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: "8px 16px",
        fontSize: 11,
        color: CLR.textSecondary,
        borderBottom: `1px solid ${CLR.border}`,
      }}
    >
      <span>
        <span style={{ color: "#10b981", fontWeight: 600 }}>{succeededCount}</span>/{totalCount} 完成
      </span>
      {failedCount > 0 && (
        <span style={{ color: "#ef4444" }}>{failedCount} 失败</span>
      )}
      {skippedCount > 0 && (
        <span style={{ color: "#f59e0b" }}>{skippedCount} 跳过</span>
      )}
      {pendingCount > 0 && (
        <span style={{ color: CLR.textSecondary }}>{pendingCount} 待执行</span>
      )}
    </div>
  )
})

// ── Error Banner ───────────────────────────────────────

const ErrorBanner = memo(function ErrorBanner({ error }: { error: string }) {
  if (!error) return null
  return (
    <div
      style={{
        margin: "8px 16px",
        padding: "8px 12px",
        fontSize: 11,
        color: "#fca5a5",
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        border: "1px solid rgba(239, 68, 68, 0.2)",
        borderRadius: 6,
        lineHeight: 1.5,
      }}
    >
      {error}
    </div>
  )
})

// ── Main Component ─────────────────────────────────────

export const WorkflowRunPanel = memo(function WorkflowRunPanel({
  isOpen,
  onClose,
  events,
  isRunning,
}: Props) {
  // 用 reducer 处理事件流 → WorkflowRunRecord
  const [record, setRecord] = useState<WorkflowRunRecord | null>(null)
  const [, setTick] = useState(0)

  // 每次 events 数组变化时 replay reducer
  useEffect(() => {
    let state: WorkflowRunRecord | null = null
    for (const event of events) {
      state = workflowRunReducer(state, event)
    }
    setRecord(state)
  }, [events])

  // running 时每秒 tick 更新 duration 显示
  useEffect(() => {
    if (!isRunning) return
    const interval = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [isRunning])

  if (!isOpen) return null

  // 无记录时显示空状态
  if (!record || record.nodes.length === 0) {
    return createPortal(
      <div style={PANEL_STYLE}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: `1px solid ${CLR.border}`,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: CLR.text }}>
            Workflow Run
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none",
              color: CLR.textSecondary, cursor: "pointer",
              padding: 4, borderRadius: 4,
            }}
          >
            <X size={16} />
          </button>
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            color: CLR.textMuted,
            fontSize: 13,
          }}
        >
          <Clock size={32} opacity={0.3} />
          <span>暂无运行记录</span>
          <span style={{ fontSize: 11 }}>运行工作流后将在此显示状态</span>
        </div>
      </div>,
      document.body,
    )
  }

  // 计算实时耗时
  const liveDurationMs = elapsedMs(record.startedAt, record.endedAt)
  const displayRecord = record.endedAt
    ? record
    : { ...record, durationMs: liveDurationMs }

  // 当前活跃节点
  const activeNodeId = isRunning
    ? record.nodes.find((n) => n.status === "running")?.nodeId ?? null
    : null

  return createPortal(
    <div style={PANEL_STYLE}>
      <RunHeader record={displayRecord} onClose={onClose} />
      <StatsBar record={displayRecord} />
      <ErrorBanner error={displayRecord.error ?? ""} />

      {/* 节点列表 */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "4px 0",
      }}>
        {displayRecord.nodes.map((node, i) => (
          <WorkflowRunNodeRow
            key={node.nodeId}
            record={node}
            index={i}
            isActive={node.nodeId === activeNodeId}
          />
        ))}
      </div>

      {/* 底部进度条 (running 时) */}
      {isRunning && (
        <div style={{ borderTop: `1px solid ${CLR.border}` }}>
          <div
            style={{
              height: 3,
              backgroundColor: CLR.blue,
              width: `${(displayRecord.succeededCount / Math.max(1, displayRecord.totalCount)) * 100}%`,
              transition: "width 0.3s ease",
            }}
          />
        </div>
      )}
    </div>,
    document.body,
  )
})
