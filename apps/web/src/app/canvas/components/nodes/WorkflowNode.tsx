// ============================================================================
// Workflow Node Component - Generic TapNow-style video workflow node
// ============================================================================
"use client"

import { memo } from "react"
import {
  AudioLines,
  Captions,
  CheckCircle2,
  CircleAlert,
  Clapperboard,
  FileText,
  Film,
  ImagePlus,
  Loader2,
  PanelsTopLeft,
  Sparkles,
  Video,
} from "lucide-react"
import { Handle, Position, NodeResizer, type NodeProps } from "@xyflow/react"
import { DESIGN_TOKENS, ICON_CONFIG } from "../../styles/designSystem"
import type { CanvasNodeData, CanvasNodeKind, WorkflowNodeStatus } from "../canvas/types"
import { nodeToneStyles } from "../canvas/types"

interface WorkflowNodeProps extends NodeProps {
  data: CanvasNodeData
}

const workflowLabels: Partial<Record<CanvasNodeKind, string>> = {
  script: "脚本",
  storyboard: "分镜",
  "image-generation": "文生图",
  "image-result": "图片结果",
  "video-generation": "图生视频",
  audio: "音频",
  subtitle: "字幕",
  composition: "合成",
  "video-result": "成片",
  "uploaded-video": "视频素材",
  "uploaded-audio": "音频素材",
  "uploaded-file": "文件素材",
}

const statusLabels: Record<WorkflowNodeStatus, string> = {
  draft: "草稿",
  ready: "就绪",
  running: "生成中",
  done: "完成",
  error: "错误",
}

const statusClasses: Record<WorkflowNodeStatus, string> = {
  draft: "border-white/15 bg-white/5 text-white/50",
  ready: "border-sky-300/25 bg-sky-400/10 text-sky-100/80",
  running: "border-amber-300/30 bg-amber-400/10 text-amber-100/90",
  done: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100/90",
  error: "border-red-300/30 bg-red-400/10 text-red-100/90",
}

function getIcon(kind?: CanvasNodeKind) {
  switch (kind) {
    case "script":
      return FileText
    case "storyboard":
      return PanelsTopLeft
    case "image-generation":
    case "image-result":
      return ImagePlus
    case "video-generation":
      return Video
    case "audio":
    case "uploaded-audio":
      return AudioLines
    case "subtitle":
      return Captions
    case "composition":
      return Clapperboard
    case "video-result":
    case "uploaded-video":
      return Film
    default:
      return Sparkles
  }
}

function getStatusIcon(status: WorkflowNodeStatus) {
  if (status === "running") return Loader2
  if (status === "done") return CheckCircle2
  if (status === "error") return CircleAlert
  return null
}

export const WorkflowNode = memo(function WorkflowNode({ data, selected }: WorkflowNodeProps) {
  const kind = data.nodeKind || "script"
  const tone = nodeToneStyles[kind]
  const status = data.status || "draft"
  const Icon = getIcon(kind)
  const StatusIcon = getStatusIcon(status)
  const title = data.title || workflowLabels[kind] || "工作流节点"
  const body = data.summary || data.instruction || data.prompt || data.content || data.fileName || "等待输入或连接上游节点。"
  const metaItems = [
    data.workflowRole,
    data.model,
    data.duration,
    data.fileSize ? `${Math.round(data.fileSize / 1024)} KB` : undefined,
  ].filter(Boolean)

  return (
    <>
      {selected && (
        <NodeResizer
          minWidth={240}
          minHeight={140}
          handleStyle={{ background: DESIGN_TOKENS.nodeHandle, border: "2px solid rgba(255,255,255,0.5)", borderRadius: "4px" }}
          lineStyle={{ stroke: DESIGN_TOKENS.nodeHandle, strokeWidth: 2, strokeDasharray: "6 3" }}
        />
      )}

      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !rounded-sm !border-2 !border-white/50 !bg-slate-400" />
      <Handle type="target" position={Position.Top} className="!h-3 !w-3 !rounded-sm !border-2 !border-white/50 !bg-slate-400" />
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !rounded-sm !border-2 !border-white/50 !bg-slate-500" />
      <Handle type="source" position={Position.Bottom} className="!h-3 !w-3 !rounded-sm !border-2 !border-white/50 !bg-slate-500" />

      <div
        className={`overflow-hidden rounded-2xl border transition-all ${selected ? "shadow-lg shadow-slate-500/20" : "hover:border-white/20"}`}
        style={{
          width: 280,
          minHeight: 150,
          border: selected ? "1px solid rgba(148, 163, 184, 0.65)" : tone.border,
          background: `linear-gradient(145deg, ${tone.background} 0%, rgba(16,18,34,0.94) 100%)`,
          boxShadow: selected ? DESIGN_TOKENS.shadowNode : "none",
        }}
      >
        <div className="flex items-center gap-2 border-b border-white/10 bg-black/20 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: tone.background }}>
            <Icon size={16} strokeWidth={ICON_CONFIG.strokeWidth} className={tone.eyebrow} />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`truncate text-[10px] font-medium uppercase tracking-[0.18em] ${tone.eyebrow}`}>
              {workflowLabels[kind] || kind}
            </p>
            <p className="truncate text-sm font-medium text-white/90">{title}</p>
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] ${statusClasses[status]}`}>
            {StatusIcon && <StatusIcon size={11} className={status === "running" ? "animate-spin" : ""} />}
            {statusLabels[status]}
          </span>
        </div>

        <div className="space-y-3 p-4">
          <p className={`line-clamp-4 text-sm leading-relaxed ${tone.body}`}>{body}</p>

          {metaItems.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {metaItems.map((item) => (
                <span key={String(item)} className={`rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] ${tone.meta}`}>
                  {String(item)}
                </span>
              ))}
            </div>
          )}

          {(data.inputs?.length || data.outputs?.length) && (
            <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-3 text-[10px] text-white/45">
              <div>
                <p className="mb-1 uppercase tracking-wider">输入</p>
                <p className="truncate">{data.inputs?.map((i) => i.label).join(" / ") || "—"}</p>
              </div>
              <div>
                <p className="mb-1 uppercase tracking-wider">输出</p>
                <p className="truncate">{data.outputs?.map((o) => o.label).join(" / ") || "—"}</p>
              </div>
            </div>
          )}

          {data.errorMessage && <p className="rounded-lg border border-red-400/20 bg-red-500/10 px-2 py-1.5 text-xs text-red-100/80">{data.errorMessage}</p>}
        </div>
      </div>
    </>
  )
})

export default WorkflowNode
