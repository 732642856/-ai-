// ============================================================================
// Edge Context Menu - Right-click menu for canvas edges
// ============================================================================
"use client"

import { memo, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { Trash2 } from "lucide-react"
import type { ContextMenuState } from "../canvas/types"
import { DESIGN_TOKENS, ICON_CONFIG } from "../../styles/designSystem"

interface EdgeContextMenuProps {
  state: ContextMenuState
  onClose: () => void
  onDelete: () => void
}

interface MenuItemProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}

const MenuItem = memo(function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors
        ${danger ? "text-red-400 hover:bg-red-500/20" : "text-white/80 hover:bg-white/10"}
      `}
    >
      <span
        className="flex h-5 w-5 items-center justify-center"
        style={{ color: danger ? "#ef4444" : ICON_CONFIG.color }}
      >
        {icon}
      </span>
      <span className="flex-1">{label}</span>
    </button>
  )
})

export const EdgeContextMenu = memo(function EdgeContextMenu({
  state,
  onClose,
  onDelete,
}: EdgeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

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

  if (!state || state.type !== "edge") return null

  const adjustedPosition = { x: state.screenX, y: state.screenY }
  if (typeof window !== "undefined") {
    const menuWidth = 180
    const menuHeight = 56
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
      className="fixed z-50 min-w-[180px] overflow-hidden rounded-xl border backdrop-blur-xl"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        backgroundColor: DESIGN_TOKENS.panelSolid,
        borderColor: DESIGN_TOKENS.border,
        boxShadow: DESIGN_TOKENS.shadowMenu,
      }}
    >
      <div className="py-1">
        <MenuItem
          icon={<Trash2 size={ICON_CONFIG.size} strokeWidth={ICON_CONFIG.strokeWidth} />}
          label="删除连线"
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

export default EdgeContextMenu
