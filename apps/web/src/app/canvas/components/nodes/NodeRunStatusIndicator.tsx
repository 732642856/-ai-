"use client"

import { CheckCircle2, CircleAlert, Clock3, Loader2, MinusCircle, AlertTriangle, Timer } from "lucide-react"
import type { CanvasNodeData, NodeRunStatus } from "../canvas/types"
import { getCompatibleRunMeta } from "../../utils/nodeRunMeta"

interface NodeRunStatusIndicatorProps {
  data: CanvasNodeData
  variant?: "dot" | "badge"
  showIdle?: boolean
  className?: string
}

/** TapNow 对标 7 状态: idle | ready | queued | running | succeeded | failed | stale */
const statusLabels: Record<NodeRunStatus, string> = {
  idle: "Idle",
  ready: "Ready",
  queued: "Queued",
  pending: "Pending",
  running: "Running",
  succeeded: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
  stale: "Stale",
}

const statusDotClasses: Record<NodeRunStatus, string> = {
  idle: "border-white/10 bg-white/20 shadow-white/5",
  ready: "border-emerald-300/30 bg-emerald-300/50 shadow-emerald-300/15",
  queued: "border-sky-300/30 bg-sky-300/50 shadow-sky-300/15 animate-pulse",
  pending: "border-amber-300/40 bg-amber-300/70 shadow-amber-300/20",
  running: "border-sky-300/50 bg-sky-300/80 shadow-sky-300/25",
  succeeded: "border-emerald-300/45 bg-emerald-300/80 shadow-emerald-300/25",
  failed: "border-red-300/50 bg-red-300/85 shadow-red-300/25",
  cancelled: "border-zinc-300/35 bg-zinc-300/55 shadow-zinc-300/15",
  stale: "border-orange-300/40 bg-orange-300/60 shadow-orange-300/20",
}

const statusBadgeClasses: Record<NodeRunStatus, string> = {
  idle: "border-white/10 bg-white/5 text-white/45",
  ready: "border-emerald-300/20 bg-emerald-400/8 text-emerald-200/70",
  queued: "border-sky-300/20 bg-sky-400/8 text-sky-200/70",
  pending: "border-amber-300/30 bg-amber-400/10 text-amber-200/80",
  running: "border-sky-300/30 bg-sky-400/10 text-sky-200/85",
  succeeded: "border-emerald-300/25 bg-emerald-400/10 text-emerald-200/85",
  failed: "border-red-300/30 bg-red-400/10 text-red-200/85",
  cancelled: "border-zinc-300/20 bg-zinc-400/10 text-zinc-200/65",
  stale: "border-orange-300/20 bg-orange-400/10 text-orange-200/75",
}

function StatusIcon({ status }: { status: NodeRunStatus }) {
  if (status === "running") return <Loader2 size={11} className="animate-spin" />
  if (status === "queued") return <Timer size={11} />
  if (status === "pending") return <Clock3 size={11} />
  if (status === "succeeded" || status === "ready") return <CheckCircle2 size={11} />
  if (status === "failed") return <CircleAlert size={11} />
  if (status === "stale") return <AlertTriangle size={11} />
  if (status === "cancelled") return <MinusCircle size={11} />
  return null
}

export function NodeRunStatusIndicator({
  data,
  variant = "dot",
  showIdle = true,
  className = "",
}: NodeRunStatusIndicatorProps) {
  const runMeta = getCompatibleRunMeta(data)
  const status = runMeta.runStatus

  if (!showIdle && status === "idle") return null

  const titleParts = [
    `状态: ${statusLabels[status]}`,
    runMeta.message,
    runMeta.error,
    runMeta.pendingReason,
  ].filter(Boolean)
  const title = titleParts.join("\n")

  if (variant === "badge") {
    return (
      <span
        title={title}
        className={`nodrag inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium ${statusBadgeClasses[status]} ${className}`}
      >
        <StatusIcon status={status} />
        {statusLabels[status]}
      </span>
    )
  }

  return (
    <span
      title={title}
      aria-label={statusLabels[status]}
      className={`nodrag inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/8 ${className}`}
    >
      {status === "running" ? (
        <Loader2 size={13} className="animate-spin text-sky-200/85" />
      ) : (
        <span
          className={`h-2.5 w-2.5 rounded-full border shadow-[0_0_10px] ${statusDotClasses[status]}`}
        />
      )}
    </span>
  )
}
