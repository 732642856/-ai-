// ============================================================================
// Image Hover Toolbar - Floating toolbar when hovering over image nodes
// ============================================================================
"use client"

import { memo, useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { Eye, Crop, FolderHeart, Trash2, Wand2, Loader2 } from "lucide-react"
import type { FloatingToolbarState } from "../canvas/types"
import { DESIGN_TOKENS, ICON_CONFIG } from "../../styles/designSystem"

interface ImageHoverToolbarProps {
  state: FloatingToolbarState
  onClose: () => void
  onPreview: () => void
  onCrop: () => void
  onSaveToLibrary: () => void
  onReplaceImage: () => void
  onDelete: () => void
  onAIVariant?: () => void
}

interface ToolbarButtonProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
  accent?: boolean
}

const ToolbarButton = memo(function ToolbarButton({
  icon,
  label,
  onClick,
  danger,
  disabled,
  accent,
}: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-center transition-colors hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none"
      title={label}
    >
      <span
        className="flex h-5 w-5 items-center justify-center"
        style={{ color: danger ? "#ef4444" : accent ? DESIGN_TOKENS.accent : ICON_CONFIG.color }}
      >
        {icon}
      </span>
      <span
        className="text-[10px]"
        style={{ color: danger ? "#ef4444" : accent ? DESIGN_TOKENS.accent : DESIGN_TOKENS.textMuted }}
      >
        {label}
      </span>
    </button>
  )
})

export const ImageHoverToolbar = memo(function ImageHoverToolbar({
  state,
  onClose,
  onPreview,
  onCrop,
  onSaveToLibrary,
  onReplaceImage,
  onDelete,
  onAIVariant,
}: ImageHoverToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
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

  const handleAIVariant = async () => {
    if (isGenerating || !onAIVariant) return
    setIsGenerating(true)
    try {
      await onAIVariant()
    } finally {
      setIsGenerating(false)
    }
  }

  if (!state || state.type !== "image-hover") return null

  const { position } = state
  const adjustedPosition = { ...position }
  if (typeof window !== "undefined") {
    const toolbarWidth = 330
    const toolbarHeight = 60
    if (adjustedPosition.x + toolbarWidth > window.innerWidth) {
      adjustedPosition.x = window.innerWidth - toolbarWidth - 10
    }
    if (adjustedPosition.y + toolbarHeight > window.innerHeight) {
      adjustedPosition.y = window.innerHeight - toolbarHeight - 10
    }
  }

  const toolbarContent = (
    <div
      ref={toolbarRef}
      className="fixed z-50 flex items-center gap-1 rounded-xl border px-2 py-1.5 backdrop-blur-xl"
      style={{
        left: adjustedPosition.x,
        top: position.above ? adjustedPosition.y - 60 : adjustedPosition.y + 10,
        minWidth: 300,
        backgroundColor: DESIGN_TOKENS.panelSolid,
        borderColor: DESIGN_TOKENS.border,
        boxShadow: DESIGN_TOKENS.shadowMenu,
      }}
    >
      <ToolbarButton
        icon={<Eye size={ICON_CONFIG.size} strokeWidth={ICON_CONFIG.strokeWidth} />}
        label={"预览"}
        onClick={onPreview}
      />
      <ToolbarButton
        icon={<Crop size={ICON_CONFIG.size} strokeWidth={ICON_CONFIG.strokeWidth} />}
        label={"裁剪"}
        onClick={onCrop}
      />
      <ToolbarButton
        icon={isGenerating ? <Loader2 size={ICON_CONFIG.size} strokeWidth={ICON_CONFIG.strokeWidth} className="animate-spin" /> : <Wand2 size={ICON_CONFIG.size} strokeWidth={ICON_CONFIG.strokeWidth} />}
        label={isGenerating ? "生成中..." : "AI变体"}
        onClick={handleAIVariant}
        accent
        disabled={isGenerating}
      />
      <ToolbarButton
        icon={<FolderHeart size={ICON_CONFIG.size} strokeWidth={ICON_CONFIG.strokeWidth} />}
        label={"素材库"}
        onClick={onSaveToLibrary}
      />
      <div className="mx-1 h-6 w-px" style={{ backgroundColor: DESIGN_TOKENS.border }} />
      <ToolbarButton
        icon={<Trash2 size={ICON_CONFIG.size} strokeWidth={ICON_CONFIG.strokeWidth} />}
        label={"删除"}
        onClick={onDelete}
        danger
      />
    </div>
  )

  if (typeof document === "undefined") return null
  return createPortal(toolbarContent, document.body)
})

export default ImageHoverToolbar
