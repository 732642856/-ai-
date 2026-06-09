// ============================================================================
// ContinuityReportNode — 六维连续性检查报告节点
// 对标 ArcReel 的 Stage Gate 质量校验展示
// ============================================================================
"use client"

import { memo, useState } from "react"
import { AlertTriangle, CheckCircle, Info, X, ChevronDown, ChevronUp } from "lucide-react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { DESIGN_TOKENS, ICON_CONFIG } from "../../styles/designSystem"
import type { CanvasNodeData, CanvasNodeKind } from "../canvas/types"

interface ContinuityReportNodeProps extends NodeProps {
  data: CanvasNodeData & {
    nodeKind?: CanvasNodeKind
    runMeta?: {
      continuityChecked?: boolean
      continuityIssues?: Array<{
        dimension: string
        severity: "error" | "warning" | "info"
        message: string
        shotId?: string
        sceneId?: string
      }>
      continuityReport?: string
    }
  }
}

const SEVERITY_CONFIG = {
  error:   { icon: AlertTriangle, color: "#f87171", bg: "rgba(248, 113, 113, 0.1)", label: "错误" },
  warning: { icon: AlertTriangle, color: "#fbbf24", bg: "rgba(251, 191, 36, 0.1)",  label: "警告" },
  info:    { icon: Info,          color: "#60a5fa", bg: "rgba(96, 165, 250, 0.1)", label: "提示" },
} as const

const DIMENSION_LABELS: Record<string, string> = {
  character: "角色连续性",
  scene:     "场景连续性",
  action:    "动作连续性",
  style:     "风格连续性",
  time:      "时间连续性",
  prop:      "道具连续性",
}

export const ContinuityReportNode = memo(function ContinuityReportNode({ id, data, selected }: ContinuityReportNodeProps) {
  const [expanded, setExpanded] = useState(true)
  const [showRawReport, setShowRawReport] = useState(false)

  const runMeta = data.runMeta
  const issues   = runMeta?.continuityIssues ?? []
  const report  = runMeta?.continuityReport ?? ""
  const checked  = runMeta?.continuityChecked ?? false

  if (!checked) {
    return (
      <div
        className="w-[320px] rounded-2xl border p-4 flex flex-col gap-2"
        style={{
          backgroundColor: DESIGN_TOKENS.panelSolid,
          borderColor: selected ? DESIGN_TOKENS.accent : DESIGN_TOKENS.border,
        }}
      >
        <Handle type="target" position={Position.Left} />
        <div className="flex items-center gap-2">
          <Info size={16} strokeWidth={ICON_CONFIG.strokeWidth} style={{ color: "#60a5fa" }} />
          <span className="text-xs font-medium" style={{ color: DESIGN_TOKENS.text }}>
            连续性检查（未运行）
          </span>
        </div>
        <p className="text-[11px]" style={{ color: DESIGN_TOKENS.textMuted }}>
          请先运行 storyboard 节点以触发六维连续性检查
        </p>
        <Handle type="source" position={Position.Right} />
      </div>
    )
  }

  const errorCount   = issues.filter(i => i.severity === "error").length
  const warningCount = issues.filter(i => i.severity === "warning").length
  const infoCount    = issues.filter(i => i.severity === "info").length

  return (
    <div
      className="w-[360px] rounded-2xl border flex flex-col overflow-hidden"
      style={{
        backgroundColor: DESIGN_TOKENS.panelSolid,
        borderColor: selected ? DESIGN_TOKENS.accent : "rgba(20, 184, 166, 0.3)",
        boxShadow: selected ? `0 0 0 2px rgba(20, 184, 166, 0.25)` : "none",
      }}
    >
      <Handle type="target" position={Position.Left} />

      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer"
        style={{ borderBottom: `1px solid ${DESIGN_TOKENS.border}` }}
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2">
          {issues.length === 0 ? (
            <CheckCircle size={16} strokeWidth={ICON_CONFIG.strokeWidth} style={{ color: "#34d399" }} />
          ) : (
            <AlertTriangle size={16} strokeWidth={ICON_CONFIG.strokeWidth} style={{ color: errorCount > 0 ? "#f87171" : "#fbbf24" }} />
          )}
          <span className="text-xs font-medium" style={{ color: DESIGN_TOKENS.text }}>
            六维连续性检查
          </span>
          {issues.length > 0 && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: errorCount > 0 ? "rgba(248, 113, 113, 0.15)" : "rgba(251, 191, 36, 0.15)",
                color: errorCount > 0 ? "#f87171" : "#fbbf24",
              }}
            >
              {issues.length} 项
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp size={14} strokeWidth={ICON_CONFIG.strokeWidth} style={{ color: DESIGN_TOKENS.textMuted }} />
        ) : (
          <ChevronDown size={14} strokeWidth={ICON_CONFIG.strokeWidth} style={{ color: DESIGN_TOKENS.textMuted }} />
        )}
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-3 py-2 flex flex-col gap-2 overflow-y-auto max-h-[400px]">
          {/* 统计摘要 */}
          <div className="flex items-center gap-3 text-[11px]">
            {errorCount > 0 && (
              <span style={{ color: "#f87171" }}>● {errorCount} 错误</span>
            )}
            {warningCount > 0 && (
              <span style={{ color: "#fbbf24" }}>▲ {warningCount} 警告</span>
            )}
            {infoCount > 0 && (
              <span style={{ color: "#60a5fa" }}>◆ {infoCount} 提示</span>
            )}
            {issues.length === 0 && (
              <span style={{ color: "#34d399" }}>✓ 所有维度检查通过</span>
            )}
          </div>

          {/* 问题列表 */}
          {issues.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {issues.map((issue, idx) => {
                const config = SEVERITY_CONFIG[issue.severity] ?? SEVERITY_CONFIG.info
                const Icon  = config.icon
                const label = DIMENSION_LABELS[issue.dimension] ?? issue.dimension
                return (
                  <div
                    key={idx}
                    className="rounded-lg p-2 flex flex-col gap-0.5"
                    style={{ backgroundColor: config.bg, border: `1px solid ${config.color}33` }}
                  >
                    <div className="flex items-center gap-1">
                      <Icon size={12} strokeWidth={2} style={{ color: config.color }} />
                      <span className="text-[10px] font-medium" style={{ color: config.color }}>
                        {label}
                      </span>
                      {issue.shotId && (
                        <span className="text-[10px] ml-auto" style={{ color: DESIGN_TOKENS.textMuted }}>
                          {issue.shotId}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] leading-4" style={{ color: DESIGN_TOKENS.text }}>
                      {issue.message}
                    </p>
                  </div>
                )
              })}
            </div>
          )}

          {/* 原始报告（可折叠）*/}
          {report && (
            <div>
              <button
                onClick={(e) => { e.stopPropagation(); setShowRawReport(v => !v) }}
                className="text-[10px] underline"
                style={{ color: "rgb(20, 184, 166)" }}
              >
                {showRawReport ? "隐藏" : "查看"}完整报告
              </button>
              {showRawReport && (
                <pre
                  className="mt-1 whitespace-pre-wrap text-[10px] leading-4 rounded-lg p-2 overflow-x-auto"
                  style={{ backgroundColor: "rgba(0,0,0,0.2)", color: DESIGN_TOKENS.textMuted }}
                >
                  {report}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div
        className="px-3 py-1.5 flex items-center justify-between"
        style={{ borderTop: `1px solid ${DESIGN_TOKENS.border}`, backgroundColor: "rgba(20, 184, 166, 0.05)" }}
      >
        <span className="text-[10px]" style={{ color: "rgb(20, 184, 166)" }}>
          ⚡ 对标 ArcReel Stage Gate 质量校验
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            // dispatch custom event so workflow runner can create/focus this node
            window.dispatchEvent(new CustomEvent("starcanvas:dismiss-continuity", { detail: { nodeId: id } }))
          }}
          className="p-0.5 rounded hover:bg-white/10"
        >
          <X size={12} strokeWidth={ICON_CONFIG.strokeWidth} style={{ color: DESIGN_TOKENS.textMuted }} />
        </button>
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  )
})
