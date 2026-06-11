// ============================================================================
// BatchActionPanel — 多节点批量操作面板
// ============================================================================
// PLAN.md P0: 框选多节点→显示批量操作UI
// 对标 TapNow 批量生成/总结/导出
// ============================================================================
"use client"

import { memo, useCallback } from "react"
import {
  Zap,
  FileText,
  Image as ImageIcon,
  Play,
  Trash2,
  Copy,
  Layers,
  GitMerge,
  Download,
} from "lucide-react"
import { DESIGN_TOKENS } from "../../styles/designSystem"

// ============================================================================
// Types
// ============================================================================

export type BatchAction =
  | "generate-all-images"
  | "generate-all-videos"
  | "summarize-selection"
  | "compose-selected"
  | "delete-selected"
  | "duplicate-selected"
  | "group-selected"
  | "export-selected"

interface BatchActionItem {
  id: BatchAction
  label: string
  icon: typeof Zap
  destructive?: boolean
  requiresConfirm?: boolean
}

const BATCH_ACTIONS: BatchActionItem[] = [
  { id: "generate-all-images", label: "生成全部图片", icon: ImageIcon },
  { id: "generate-all-videos", label: "生成全部视频", icon: Play },
  { id: "compose-selected", label: "合成选中分镜", icon: Layers, requiresConfirm: true },
  { id: "summarize-selection", label: "总结选中内容", icon: FileText },
  { id: "duplicate-selected", label: "复制选中", icon: Copy },
  { id: "group-selected", label: "编组", icon: GitMerge },
  { id: "export-selected", label: "导出选中", icon: Download },
  { id: "delete-selected", label: "删除选中", icon: Trash2, destructive: true, requiresConfirm: true },
]

// ============================================================================
// Component
// ============================================================================

interface BatchActionPanelProps {
  isVisible: boolean
  selectedCount: number
  selectedKinds?: string[]
  nodeIds: string[]
  onAction: (action: BatchAction) => void
  onClear: () => void
}

export const BatchActionPanel = memo(function BatchActionPanel({
  isVisible,
  selectedCount,
  selectedKinds = [],
  nodeIds,
  onAction,
  onClear,
}: BatchActionPanelProps) {
  if (!isVisible || selectedCount < 2) return null

  const handleAction = useCallback(
    (action: BatchAction) => {
      const item = BATCH_ACTIONS.find((a) => a.id === action)
      if (item?.requiresConfirm) {
        if (window.confirm(`确定要${item.label} ${selectedCount} 个节点吗？`)) {
          onAction(action)
        }
      } else {
        onAction(action)
      }
    },
    [selectedCount, onAction],
  )

  const kindText =
    selectedKinds.length > 0 ? selectedKinds.join("、") : "节点"

  return (
    <div
      className="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl"
      style={{
        backgroundColor: "rgba(18, 18, 28, 0.95)",
        borderColor: DESIGN_TOKENS.borderAccent,
      }}
    >
      <div className="flex items-center gap-4">
        {/* Info */}
        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{
              backgroundColor: "rgba(99,102,241,0.18)",
              color: DESIGN_TOKENS.accent,
            }}
          >
            {selectedCount}
          </span>
          <span className="text-xs" style={{ color: DESIGN_TOKENS.textSecondary }}>
            {kindText}已选中
          </span>
        </div>

        {/* Separator */}
        <div className="h-6 w-px" style={{ backgroundColor: DESIGN_TOKENS.border }} />

        {/* Actions */}
        <div className="flex items-center gap-1">
          {BATCH_ACTIONS.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => handleAction(action.id)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition hover:bg-white/10"
                style={{
                  color: action.destructive ? "#f87171" : DESIGN_TOKENS.textSecondary,
                }}
                title={action.label}
              >
                <Icon size={13} strokeWidth={1.7} />
                {action.label}
              </button>
            )
          })}
        </div>

        {/* Separator */}
        <div className="h-6 w-px" style={{ backgroundColor: DESIGN_TOKENS.border }} />

        {/* Clear */}
        <button
          onClick={onClear}
          className="rounded-lg px-2 py-1 text-[11px] transition hover:bg-white/10"
          style={{ color: DESIGN_TOKENS.textMuted }}
        >
          取消选择
        </button>
      </div>
    </div>
  )
})
