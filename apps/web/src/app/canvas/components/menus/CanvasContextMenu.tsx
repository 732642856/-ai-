// ============================================================================
// Canvas Context Menu - Right-click menu for empty canvas areas
// ============================================================================
"use client"

import { memo, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import {
  FileText,
  FilePen,
  Image,
  Clipboard,
  Maximize,
  ZoomIn,
  Upload,
} from "lucide-react"
import type { ContextMenuState } from "../canvas/types"
import { DESIGN_TOKENS, ICON_CONFIG } from "../../styles/designSystem"

interface CanvasContextMenuProps {
  state: ContextMenuState
  onClose: () => void
  onAddNode: (type: "prompt" | "text" | "image", position: { x: number; y: number }) => void
  onUploadImage: (position: { x: number; y: number }) => void
  onPaste: () => void
  hasClipboard: boolean
}

interface MenuItemProps {
  icon: React.ReactNode
  label: string
  shortcut?: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}

const MenuItem = memo(function MenuItem({
  icon,
  label,
  shortcut,
  onClick,
  disabled,
  danger,
}: MenuItemProps) {
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

export const CanvasContextMenu = memo(function CanvasContextMenu({
  state,
  onClose,
  onAddNode,
  onUploadImage,
  onPaste,
  hasClipboard,
}: CanvasContextMenuProps) {
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

  if (!state || state.type !== "canvas") return null

  const position = { x: state.screenX, y: state.screenY }
  const canvasPosition = { x: state.canvasX, y: state.canvasY }

  // Adjust position to prevent menu from going off-screen
  const adjustedPosition = { ...position }
  if (typeof window !== "undefined") {
    const menuWidth = 220
    const menuHeight = 280
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
      className="fixed z-50 min-w-[220px] overflow-hidden rounded-xl border backdrop-blur-xl"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        backgroundColor: DESIGN_TOKENS.panelSolid,
        borderColor: DESIGN_TOKENS.border,
        boxShadow: DESIGN_TOKENS.shadowMenu,
      }}
    >
      {/* Add Section */}
      <div
        className="border-b px-3 py-2"
        style={{ borderColor: DESIGN_TOKENS.border }}
      >
        <p
          className="text-[10px] uppercase tracking-wider"
          style={{ color: DESIGN_TOKENS.textMuted }}
        >
          添加节点
        </p>
      </div>
      <div className="py-1">
        <MenuItem
          icon={<FileText size={ICON_CONFIG.size} strokeWidth={ICON_CONFIG.strokeWidth} />}
          label="添加 Prompt 节点"
          onClick={() => {
            onAddNode("prompt", canvasPosition)
            onClose()
          }}
        />
        <MenuItem
          icon={<FilePen size={ICON_CONFIG.size} strokeWidth={ICON_CONFIG.strokeWidth} />}
          label="添加文本节点"
          onClick={() => {
            onAddNode("text", canvasPosition)
            onClose()
          }}
        />
        <MenuItem
          icon={<Upload size={ICON_CONFIG.size} strokeWidth={ICON_CONFIG.strokeWidth} />}
          label="上传图片"
          onClick={() => {
            onUploadImage(canvasPosition)
            onClose()
          }}
        />
      </div>

      {/* Clipboard Section */}
      {hasClipboard && (
        <>
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
              icon={<Clipboard size={ICON_CONFIG.size} strokeWidth={ICON_CONFIG.strokeWidth} />}
              label="粘贴节点"
              shortcut="⌘V"
              onClick={() => {
                onPaste()
                onClose()
              }}
            />
          </div>
        </>
      )}
    </div>
  )

  if (typeof document === "undefined") return null
  return createPortal(menuContent, document.body)
})

export default CanvasContextMenu
