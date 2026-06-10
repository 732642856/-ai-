"use client"

import type { Edge, Node } from "@xyflow/react"
import { Activity, AlertTriangle, CheckCircle2, FileText, Gauge, X } from "lucide-react"
import type { CanvasNodeData, NodeRunStatus } from "./types"
import { DESIGN_TOKENS } from "../../styles/designSystem"

type CanvasDiagnosticsPanelProps = {
  isOpen: boolean
  onClose: () => void
  nodes: Node<CanvasNodeData>[]
  edges: Edge[]
  isCanvasRestored: boolean
  scriptImportOpen: boolean
  showRunPanel: boolean
  runEventCount: number
}

type Severity = "ok" | "warn" | "error"

type DiagnosticItem = {
  id: string
  label: string
  value: string
  severity: Severity
  detail: string
}

const STATUS_LABELS: Record<NodeRunStatus, string> = {
  idle: "空闲",
  ready: "就绪",
  pending: "等待确认",
  queued: "排队中",
  running: "运行中",
  succeeded: "成功",
  failed: "失败",
  stale: "已过期",
  cancelled: "已取消",
}

function severityColor(severity: Severity) {
  if (severity === "error") return "#fb7185"
  if (severity === "warn") return "#f59e0b"
  return "#34d399"
}

function countByRunStatus(nodes: Node<CanvasNodeData>[]) {
  const counts: Partial<Record<NodeRunStatus, number>> = {}
  for (const node of nodes) {
    const status = node.data?.runMeta?.runStatus
    if (!status) continue
    counts[status] = (counts[status] || 0) + 1
  }
  return counts
}

function buildDiagnostics(args: Omit<CanvasDiagnosticsPanelProps, "isOpen" | "onClose">): DiagnosticItem[] {
  const { nodes, edges, isCanvasRestored, scriptImportOpen, showRunPanel, runEventCount } = args
  const failedNodes = nodes.filter((node) => node.data?.runMeta?.runStatus === "failed")
  const runningNodes = nodes.filter((node) => node.data?.runMeta?.runStatus === "running")
  const pendingNodes = nodes.filter((node) => node.data?.runMeta?.runStatus === "pending")
  const orphanEdges = edges.filter((edge) => !nodes.some((node) => node.id === edge.source) || !nodes.some((node) => node.id === edge.target))

  return [
    {
      id: "restore",
      label: "画布恢复",
      value: isCanvasRestored ? "已完成" : "等待中",
      severity: isCanvasRestored ? "ok" : "warn",
      detail: isCanvasRestored ? "本地画布状态已经恢复或确认为空。" : "如果一直等待，优先检查浏览器 localStorage / IndexedDB。",
    },
    {
      id: "empty-start",
      label: "启动页入口",
      value: nodes.length === 0 ? "空画布引导" : `${nodes.length} 个节点`,
      severity: nodes.length === 0 ? "ok" : "ok",
      detail: nodes.length === 0 ? "新用户应看到“导入剧本 / AI 分析剧本”和“创建 AI 影视流程”。" : `当前画布有 ${nodes.length} 个节点、${edges.length} 条连线。`,
    },
    {
      id: "run-status",
      label: "运行状态",
      value: failedNodes.length > 0 ? `${failedNodes.length} 个失败` : runningNodes.length > 0 ? `${runningNodes.length} 个运行中` : "无失败",
      severity: failedNodes.length > 0 ? "error" : runningNodes.length > 0 || pendingNodes.length > 0 ? "warn" : "ok",
      detail: failedNodes.length > 0 ? "请从节点历史或工作流运行面板查看失败原因，避免重复消耗 AI 额度。" : "当前没有节点失败记录。",
    },
    {
      id: "edges",
      label: "连线完整性",
      value: orphanEdges.length > 0 ? `${orphanEdges.length} 条异常` : "正常",
      severity: orphanEdges.length > 0 ? "error" : "ok",
      detail: orphanEdges.length > 0 ? "存在 source/target 不存在的连线，建议清理后再执行工作流。" : "没有发现悬空连线。",
    },
    {
      id: "panels",
      label: "关键面板",
      value: scriptImportOpen ? "剧本导入中" : showRunPanel ? "运行面板开启" : "待命",
      severity: "ok",
      detail: `工作流事件数：${runEventCount}。`,
    },
  ]
}

export function CanvasDiagnosticsPanel(props: CanvasDiagnosticsPanelProps) {
  if (!props.isOpen) return null

  const diagnostics = buildDiagnostics({
    nodes: props.nodes,
    edges: props.edges,
    isCanvasRestored: props.isCanvasRestored,
    scriptImportOpen: props.scriptImportOpen,
    showRunPanel: props.showRunPanel,
    runEventCount: props.runEventCount,
  })
  const statusCounts = countByRunStatus(props.nodes)
  const failedNodes = props.nodes.filter((node) => node.data?.runMeta?.runStatus === "failed")

  return (
    <aside
      className="fixed right-5 top-5 z-[70] w-[380px] overflow-hidden rounded-3xl border shadow-2xl backdrop-blur-2xl"
      style={{ backgroundColor: "rgba(15, 15, 20, 0.94)", borderColor: DESIGN_TOKENS.border }}
      data-testid="canvas-diagnostics-panel"
    >
      <div className="flex items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: DESIGN_TOKENS.border }}>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ backgroundColor: "rgba(100,116,139,0.18)" }}>
            <Gauge size={18} style={{ color: DESIGN_TOKENS.accentHover }} />
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: DESIGN_TOKENS.text }}>启动与运行诊断</div>
            <div className="mt-1 text-xs leading-relaxed" style={{ color: DESIGN_TOKENS.textMuted }}>
              快速定位启动页、节点运行、连线和面板状态问题。
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={props.onClose}
          className="rounded-full p-1.5 transition hover:bg-white/10"
          style={{ color: DESIGN_TOKENS.textMuted }}
          data-testid="canvas-diagnostics-close"
          aria-label="关闭诊断面板"
        >
          <X size={16} />
        </button>
      </div>

      <div className="space-y-3 px-5 py-4">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-2xl px-3 py-2" style={{ backgroundColor: DESIGN_TOKENS.card }}>
            <div style={{ color: DESIGN_TOKENS.textMuted }}>节点</div>
            <div className="mt-1 text-base font-semibold" style={{ color: DESIGN_TOKENS.text }}>{props.nodes.length}</div>
          </div>
          <div className="rounded-2xl px-3 py-2" style={{ backgroundColor: DESIGN_TOKENS.card }}>
            <div style={{ color: DESIGN_TOKENS.textMuted }}>连线</div>
            <div className="mt-1 text-base font-semibold" style={{ color: DESIGN_TOKENS.text }}>{props.edges.length}</div>
          </div>
          <div className="rounded-2xl px-3 py-2" style={{ backgroundColor: DESIGN_TOKENS.card }}>
            <div style={{ color: DESIGN_TOKENS.textMuted }}>事件</div>
            <div className="mt-1 text-base font-semibold" style={{ color: DESIGN_TOKENS.text }}>{props.runEventCount}</div>
          </div>
        </div>

        <div className="space-y-2">
          {diagnostics.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border px-3 py-3"
              style={{ borderColor: DESIGN_TOKENS.border, backgroundColor: DESIGN_TOKENS.card }}
              data-testid="canvas-diagnostics-item"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {item.severity === "ok" ? <CheckCircle2 size={14} color={severityColor(item.severity)} /> : <AlertTriangle size={14} color={severityColor(item.severity)} />}
                  <span className="text-xs font-medium" style={{ color: DESIGN_TOKENS.text }}>{item.label}</span>
                </div>
                <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ color: severityColor(item.severity), backgroundColor: `${severityColor(item.severity)}1f` }}>
                  {item.value}
                </span>
              </div>
              <div className="mt-2 text-[11px] leading-relaxed" style={{ color: DESIGN_TOKENS.textMuted }}>{item.detail}</div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border px-3 py-3" style={{ borderColor: DESIGN_TOKENS.border, backgroundColor: "rgba(255,255,255,0.03)" }}>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium" style={{ color: DESIGN_TOKENS.text }}>
            <Activity size={14} /> 节点运行分布
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(STATUS_LABELS) as NodeRunStatus[]).map((status) => (
              <span key={status} className="rounded-full px-2 py-1 text-[11px]" style={{ backgroundColor: DESIGN_TOKENS.card, color: DESIGN_TOKENS.textSecondary }}>
                {STATUS_LABELS[status]} {statusCounts[status] || 0}
              </span>
            ))}
          </div>
        </div>

        {failedNodes.length > 0 ? (
          <div className="rounded-2xl border px-3 py-3" style={{ borderColor: "rgba(251,113,133,0.28)", backgroundColor: "rgba(251,113,133,0.08)" }}>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium" style={{ color: "#fecdd3" }}>
              <FileText size={14} /> 最近失败节点
            </div>
            <div className="space-y-1.5">
              {failedNodes.slice(0, 4).map((node) => (
                <div key={node.id} className="text-[11px] leading-relaxed" style={{ color: "rgba(255,228,230,0.82)" }}>
                  <span className="font-medium">{node.data?.title || node.id}</span>
                  {node.data?.runMeta?.error ? `：${node.data.runMeta.error}` : "：无错误详情"}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  )
}
