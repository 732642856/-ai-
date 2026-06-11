// ============================================================================
// VersionComparePanel — 版本并排对比面板（对标 ArcReel 版本管理）
// ============================================================================
"use client"

import { memo, useCallback, useMemo, useState } from "react"
import { ArrowLeft, ArrowRight, RotateCcw, Eye, EyeOff, GitCompare, Check, X } from "lucide-react"
import { DESIGN_TOKENS } from "../../styles/designSystem"
import type { CanvasSnapshot } from "../../types/canvas-snapshot"

// ============================================================================
// Types
// ============================================================================

interface VersionComparePanelProps {
  isOpen: boolean
  onClose: () => void
  snapshots: CanvasSnapshot[]
  currentSnapshotId?: string
  onRestore: (snapshotId: string) => void
}

interface ComparePair {
  left: CanvasSnapshot
  right: CanvasSnapshot
}

// ============================================================================
// Component
// ============================================================================

export const VersionComparePanel = memo(function VersionComparePanel({
  isOpen,
  onClose,
  snapshots,
  currentSnapshotId,
  onRestore,
}: VersionComparePanelProps) {
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null)
  const [selectedRight, setSelectedRight] = useState<string | null>(null)
  const [showDiff, setShowDiff] = useState(true)

  const sortedSnapshots = useMemo(
    () =>
      [...snapshots]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 20), // 最多显示20个版本
    [snapshots],
  )

  const comparePair: ComparePair | null = useMemo(() => {
    if (!selectedLeft || !selectedRight) return null
    const left = snapshots.find((s) => s.id === selectedLeft)
    const right = snapshots.find((s) => s.id === selectedRight)
    if (!left || !right) return null
    return { left, right }
  }, [selectedLeft, selectedRight, snapshots])

  const handleRestore = useCallback(
    (snapshotId: string) => {
      onRestore(snapshotId)
      onClose()
    },
    [onRestore, onClose],
  )

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[8vh]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="flex max-h-[80vh] w-[900px] flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          backgroundColor: "rgba(18, 18, 28, 0.98)",
          borderColor: DESIGN_TOKENS.border,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${DESIGN_TOKENS.border}` }}>
          <div className="flex items-center gap-2">
            <GitCompare size={18} strokeWidth={1.5} style={{ color: DESIGN_TOKENS.accent }} />
            <span className="text-sm font-semibold" style={{ color: DESIGN_TOKENS.text }}>版本对比</span>
            <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: "rgba(255,255,255,0.06)", color: DESIGN_TOKENS.textMuted }}>
              {snapshots.length} 个快照
            </span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 transition hover:bg-white/10" style={{ color: DESIGN_TOKENS.textMuted }}>
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Snapshot List - Left */}
          <div className="w-1/3 overflow-auto border-r" style={{ borderColor: DESIGN_TOKENS.border }}>
            <div className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider" style={{ color: DESIGN_TOKENS.textMuted }}>
              选择版本 A（旧）
            </div>
            {sortedSnapshots.map((snap) => (
              <SnapshotItem
                key={snap.id}
                snapshot={snap}
                isSelected={selectedLeft === snap.id}
                isCurrent={snap.id === currentSnapshotId}
                onSelect={() => setSelectedLeft(selectedLeft === snap.id ? null : snap.id)}
              />
            ))}
          </div>

          {/* Snapshot List - Right */}
          <div className="w-1/3 overflow-auto border-r" style={{ borderColor: DESIGN_TOKENS.border }}>
            <div className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider" style={{ color: DESIGN_TOKENS.textMuted }}>
              选择版本 B（新）
            </div>
            {sortedSnapshots.map((snap) => (
              <SnapshotItem
                key={snap.id}
                snapshot={snap}
                isSelected={selectedRight === snap.id}
                isCurrent={snap.id === currentSnapshotId}
                onSelect={() => setSelectedRight(selectedRight === snap.id ? null : snap.id)}
              />
            ))}
          </div>

          {/* Comparison Result */}
          <div className="flex w-1/3 flex-col p-3">
            <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: DESIGN_TOKENS.textMuted }}>
              对比结果
            </div>

            {!comparePair ? (
              <div className="flex flex-1 items-center justify-center" style={{ color: DESIGN_TOKENS.textMuted }}>
                <span className="text-xs">选择左右两侧版本进行对比</span>
              </div>
            ) : (
              <div className="mt-2 flex-1 space-y-3 overflow-auto">
                {/* Stats */}
                <CompareStat
                  label="节点数"
                  left={comparePair.left.nodeCount ?? 0}
                  right={comparePair.right.nodeCount ?? 0}
                />
                <CompareStat
                  label="连线数"
                  left={comparePair.left.edgeCount ?? 0}
                  right={comparePair.right.edgeCount ?? 0}
                />
                <CompareStat
                  label="Shot数"
                  left={comparePair.left.nodes?.filter((n) => n.type === "shot").length ?? 0}
                  right={comparePair.right.nodes?.filter((n) => n.type === "shot").length ?? 0}
                />
                <CompareStat
                  label="图片数"
                  left={comparePair.left.nodes?.filter((n) => n.type === "image" || n.type === "image-generation").length ?? 0}
                  right={comparePair.right.nodes?.filter((n) => n.type === "image" || n.type === "image-generation").length ?? 0}
                />

                {/* Time info */}
                <div className="rounded-lg border p-2" style={{ borderColor: DESIGN_TOKENS.border }}>
                  <div className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>
                    版本 A: {formatTime(comparePair.left.createdAt)}
                  </div>
                  <div className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>
                    版本 B: {formatTime(comparePair.right.createdAt)}
                  </div>
                </div>

                {/* Restore buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRestore(comparePair.left.id)}
                    className="flex-1 rounded-lg px-2 py-1.5 text-[10px] font-medium transition"
                    style={{ backgroundColor: "rgba(255,255,255,0.06)", color: DESIGN_TOKENS.textSecondary }}
                  >
                    恢复版本 A
                  </button>
                  <button
                    onClick={() => handleRestore(comparePair.right.id)}
                    className="flex-1 rounded-lg px-2 py-1.5 text-[10px] font-medium transition"
                    style={{ backgroundColor: "rgba(255,255,255,0.06)", color: DESIGN_TOKENS.textSecondary }}
                  >
                    恢复版本 B
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

// ============================================================================
// Sub-components
// ============================================================================

function SnapshotItem({
  snapshot,
  isSelected,
  isCurrent,
  onSelect,
}: {
  snapshot: CanvasSnapshot
  isSelected: boolean
  isCurrent: boolean
  onSelect: () => void
}) {
  const time = formatTime(snapshot.createdAt)
  const nodeCount = snapshot.nodeCount
  const edgeCount = snapshot.edgeCount

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-white/5"
      style={{
        backgroundColor: isSelected ? "rgba(99,102,241,0.1)" : undefined,
        borderLeft: isSelected ? `2px solid ${DESIGN_TOKENS.accent}` : "2px solid transparent",
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[11px] font-medium" style={{ color: DESIGN_TOKENS.text }}>{snapshot.title || "快照"}</span>
          {isCurrent && (
            <span className="rounded-full px-1 py-0.5 text-[8px]" style={{ backgroundColor: "rgba(34,197,94,0.15)", color: "#22c55e" }}>当前</span>
          )}
        </div>
        <div className="mt-0.5 text-[9px]" style={{ color: DESIGN_TOKENS.textMuted }}>
          {time} · {nodeCount} 节点 · {edgeCount} 连线
        </div>
      </div>
      {isSelected && <Check size={12} style={{ color: DESIGN_TOKENS.accent }} />}
    </button>
  )
}

function CompareStat({
  label,
  left,
  right,
}: {
  label: string
  left: number
  right: number
}) {
  const diff = right - left
  const isChanged = diff !== 0

  return (
    <div className="flex items-center justify-between rounded-lg px-2 py-1.5" style={{ backgroundColor: "rgba(255,255,255,0.02)" }}>
      <span className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-mono" style={{ color: DESIGN_TOKENS.textSecondary }}>{left}</span>
        {isChanged && (
          <>
            <ArrowRight size={10} style={{ color: DESIGN_TOKENS.textMuted }} />
            <span
              className="text-[11px] font-mono"
              style={{ color: diff > 0 ? "#22c55e" : "#ef4444" }}
            >
              {right}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Helpers
// ============================================================================

function formatTime(ts?: string): string {
  if (!ts) return "—"
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}
