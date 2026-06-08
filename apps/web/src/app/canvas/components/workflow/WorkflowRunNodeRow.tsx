// ============================================================================
// WorkflowRunNodeRow — 工作流运行面板中的单节点行 (P2-3A)
// ============================================================================
"use client"

import { memo } from "react"
import type { WorkflowNodeRunRecord } from "../../types/workflow-run"
import { getRunStatusIcon, getRunStatusColor, formatDurationMs } from "../../types/workflow-run"

interface Props {
  record: WorkflowNodeRunRecord
  index: number
  isActive: boolean
}

export const WorkflowRunNodeRow = memo(function WorkflowRunNodeRow({ record, index, isActive }: Props) {
  const icon = getRunStatusIcon(record.status)
  const colorClass = getRunStatusColor(record.status)
  const title = record.title || record.nodeId
  const durationText = record.durationMs != null ? formatDurationMs(record.durationMs) : undefined

  return (
    <div
      className={`
        flex items-center gap-2 px-3 py-2 text-xs border-b border-zinc-800/50 transition-colors
        ${isActive ? "bg-blue-500/10" : "hover:bg-zinc-800/30"}
      `}
    >
      {/* 序号 */}
      <span className="w-5 text-right text-zinc-600 tabular-nums shrink-0">
        {index + 1}
      </span>

      {/* 状态图标 */}
      <span className={`w-4 text-center shrink-0 ${colorClass} ${record.status === "running" ? "animate-pulse" : ""}`}>
        {icon}
      </span>

      {/* 标题 + 错误 */}
      <div className="flex-1 min-w-0">
        <span className="text-zinc-300 truncate block">{title}</span>
        {record.error && (
          <span className="text-red-400/80 text-[10px] truncate block mt-0.5">
            {record.error}
          </span>
        )}
      </div>

      {/* 耗时 */}
      <span className="text-zinc-500 tabular-nums shrink-0 text-[10px]">
        {durationText ?? ""}
      </span>
    </div>
  )
})
