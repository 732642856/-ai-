// ============================================================================
// Node Context Menu - Right-click menu for nodes
// ============================================================================
"use client"

import { memo, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import {
  Pencil,
  Copy,
  Scissors,
  Clipboard,
  Eye,
  Crop,
  FolderHeart,
  Trash2,
  Image,
  FileText,
  History,
  Play,
  RotateCcw,
  ArrowRight,
  Square,
} from "lucide-react"
import type { ContextMenuState, CanvasNodeKind } from "../canvas/types"
import { DESIGN_TOKENS, ICON_CONFIG } from "../../styles/designSystem"

interface NodeContextMenuProps {
  state: ContextMenuState
  onClose: () => void
  onDelete: () => void
  onDuplicate: () => void
  onCopy: () => void
  onCut: () => void
  onPreviewImage: () => void
  onCropImage: () => void
  onSaveToAssetLibrary: () => void
  onEdit: () => void
  onViewHistory?: () => void
  onRunCurrentNode?: () => void
  onRunUpstreamAndCurrent?: () => void
  onRunDownstreamChain?: () => void
  onStopWorkflow?: () => void
  isWorkflowRunning?: boolean
  nodeKind?: CanvasNodeKind
}

interface MenuItemProps {
  icon: React.ReactNode
  label: string
  shortcut?: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  separator?: boolean
}

const MenuItem = memo(function MenuItem({
  icon,
  label,
  shortcut,
  onClick,
  disabled,
  danger,
  separator,
}: MenuItemProps) {
  if (separator) {
    return (
      <div
        className="my-1 border-t"
        style={{ borderColor: DESIGN_TOKENS.border }}
      />
    )
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors
        ${disabled ? "cursor-not-allowed opacity-40" : "hover:bg-white/10"}
        ${danger ? "text-red-400 hover:bg-red-500/20" : "text-white/80"}
      `}
    >
      <span
        className="flex h-5 w-5 items-center justify-center"
        style={{ color: danger ? "#ef4444" : ICON_CONFIG.color }}
      >
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {shortcut && <span className="text-xs text-white/30">{shortcut}</span>}
    </button>
  )
})

export const NodeContextMenu = memo(function NodeContextMenu({
  state,
  onClose,
  onDelete,
  onDuplicate,
  onCopy,
  onCut,
  onPreviewImage,
  onCropImage,
  onSaveToAssetLibrary,
  onEdit,
  onViewHistory,
  onRunCurrentNode,
  onRunUpstreamAndCurrent,
  onRunDownstreamChain,
  onStopWorkflow,
  isWorkflowRunning,
  nodeKind,
}: NodeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    if (state) {
      document.addEventListener("mousedown", handleClickOutside)
      document.addEventListener("keydown", handleEscape)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [state, onClose])

  if (!state || state.type !== "node") return null

  const isImageNode = nodeKind?.includes("image") || nodeKind === "image"
  const position = { x: state.screenX, y: state.screenY }

  // Adjust position to prevent menu from going off-screen
  const adjustedPosition = { ...position }
  if (typeof window !== "undefined") {
    const menuWidth = 200
    const menuHeight = isImageNode ? 480 : 420
    if (adjustedPosition.x + menuWidth > window.innerWidth) {
      adjustedPosition.x = window.innerWidth - menuWidth - 10
    }
    if (adjustedPosition.y + menuHeight > window.innerHeight) {
      adjustedPosition.y = window.innerHeight - menuHeight - 10
    }
  }

  const menuContent = (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[200px] overflow-hidden rounded-xl border backdrop-blur-xl"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        backgroundColor: DESIGN_TOKENS.panelSolid,
        borderColor: DESIGN_TOKENS.border,
        boxShadow: DESIGN_TOKENS.shadowMenu,
      }}
    >
      {/* Edit Section */}
      <div
        className="border-b px-3 py-2"
        style={{ borderColor: DESIGN_TOKENS.border }}
      >
        <p
          className="text-[10px] uppercase tracking-wider"
          style={{ color: DESIGN_TOKENS.textMuted }}
        >
          编辑
        </p>
      </div>
      <div className="py-1">
        <MenuItem
          icon={<Pencil size={ICON_CONFIG.size} strokeWidth={ICON_CONFIG.strokeWidth} />}
          label="编辑节点"
          shortcut="⏎"
          onClick={() => {
            onEdit()
            onClose()
          }}
        />
        {onViewHistory && (
          <MenuItem
            icon={<History size={ICON_CONFIG.size} strokeWidth={ICON_CONFIG.strokeWidth} />}
            label="查看历史"
            onClick={() => {
              onViewHistory()
              onClose()
            }}
          />
        )}
      </div>

      {/* Run Section (P2-2) */}
      <div
        className="border-b px-3 py-2"
        style={{ borderColor: DESIGN_TOKENS.border }}
      >
        <p
          className="text-[10px] uppercase tracking-wider"
          style={{ color: DESIGN_TOKENS.textMuted }}
        >
          运行
        </p>
      </div>
      <div className="py-1">
        <MenuItem
          icon={<Play size={ICON_CONFIG.size} strokeWidth={ICON_CONFIG.strokeWidth} />}
          label="运行当前节点"
          shortcut="⌘R"
          onClick={() => {
            onRunCurrentNode?.()
            onClose()
          }}
        />
        <MenuItem
          icon={<RotateCcw size={ICON_CONFIG.size} strokeWidth={ICON_CONFIG.strokeWidth} />}
          label="运行上游+当前"
          onClick={() => {
            onRunUpstreamAndCurrent?.()
            onClose()
          }}
        />
        <MenuItem
          icon={<ArrowRight size={ICON_CONFIG.size} strokeWidth={ICON_CONFIG.strokeWidth} />}
          label="运行下游链路"
          onClick={() => {
            onRunDownstreamChain?.()
            onClose()
          }}
        />
        {onStopWorkflow && (
          <MenuItem
            icon={<Square size={ICON_CONFIG.size} strokeWidth={ICON_CONFIG.strokeWidth} />}
            label="停止当前工作流"
            disabled={!isWorkflowRunning}
            onClick={() => {
              if (!isWorkflowRunning) return
              onStopWorkflow()
              onClose()
            }}
          />
        )}
      </div>

      {/* Clipboard Section */}
      <div
        className="border-b px-3 py-2"
        style={{ borderColor: DESIGN_TOKENS.border }}
      >
        <p
          className="text-[10px] uppercase tracking-wider"
          style={{ color: DESIGN_TOKENS.textMuted }}
        >
          剪贴板
        </p>
      </div>
      <div className="py-1">
        <MenuItem
          icon={<Copy size={ICON_CONFIG.size} strokeWidth={ICON_CONFIG.strokeWidth} />}
          label="复制"
          shortcut="⌘C"
          onClick={() => {
            onCopy()
            onClose()
          }}
        />
        <MenuItem
          icon={<Scissors size={ICON_CONFIG.size} strokeWidth={ICON_CONFIG.strokeWidth} />}
          label="剪切"
          shortcut="⌘X"
          onClick={() => {
            onCut()
            onClose()
          }}
        />
        <MenuItem
          icon={<Clipboard size={ICON_CONFIG.size} strokeWidth={ICON_CONFIG.strokeWidth} />}
          label="复制并粘贴"
          shortcut="⌘D"
          onClick={() => {
            onDuplicate()
            onClose()
          }}
        />
      </div>

      {/* Image-specific Section */}
      {isImageNode && (
        <>
          <div
            className="border-b px-3 py-2"
            style={{ borderColor: DESIGN_TOKENS.border }}
          >
            <p
              className="text-[10px] uppercase tracking-wider"
              style={{ color: DESIGN_TOKENS.textMuted }}
            >
              图片
            </p>
          </div>
          <div className="py-1">
            <MenuItem
              icon={<Eye size={ICON_CONFIG.size} strokeWidth={ICON_CONFIG.strokeWidth} />}
              label="预览大图"
              onClick={() => {
                onPreviewImage()
                onClose()
              }}
            />
            <MenuItem
              icon={<Crop size={ICON_CONFIG.size} strokeWidth={ICON_CONFIG.strokeWidth} />}
              label="裁剪"
              onClick={() => {
                onCropImage()
                onClose()
              }}
            />
            <MenuItem
              icon={<FolderHeart size={ICON_CONFIG.size} strokeWidth={ICON_CONFIG.strokeWidth} />}
              label="保存到素材库"
              onClick={() => {
                onSaveToAssetLibrary()
                onClose()
              }}
            />
          </div>
        </>
      )}

      {/* Danger Zone */}
      <div
        className="border-t px-3 py-2"
        style={{ borderColor: DESIGN_TOKENS.border }}
      >
        <p
          className="text-[10px] uppercase tracking-wider"
          style={{ color: DESIGN_TOKENS.textMuted }}
        >
          危险操作
        </p>
      </div>
      <div className="py-1">
        <MenuItem
          icon={<Trash2 size={ICON_CONFIG.size} strokeWidth={ICON_CONFIG.strokeWidth} />}
          label="删除节点"
          shortcut="⌫"
          onClick={() => {
            onDelete()
            onClose()
          }}
          danger
        />
      </div>
    </div>
  )

  if (typeof document === "undefined") return null
  return createPortal(menuContent, document.body)
})

export default NodeContextMenu
