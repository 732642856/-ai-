/**
 * AssetPreviewPopover — @node_xxx / @asset_xxx hover 预览卡片
 *
 * 当用户将鼠标悬停在聊天消息中的 @引用上时，显示预览卡片：
 * - 节点/资产缩略图（如有）
 * - 标题
 * - 类型标签
 * - 引用失效提示
 */
"use client"

import React, { useCallback, useRef, useState } from "react"
import { ImageIcon, FileText, AlertTriangle, Film, Music } from "lucide-react"
import { DESIGN_TOKENS } from "../../styles/designSystem"

// ── 类型 ──────────────────────────────────────────────

export interface ReferenceInfo {
  type: "node" | "asset"
  id: string
  title?: string
  imageUrl?: string
  isValid: boolean
  kind?: string
}

export interface AssetPreviewPopoverProps {
  /** @引用匹配到的节点/资产信息 */
  reference: ReferenceInfo
  /** 子元素（包裹的文本） */
  children: React.ReactNode
}

// ── 类型图标映射 ──────────────────────────────────────

function getTypeIcon(kind?: string) {
  if (!kind) return <FileText size={14} />
  if (kind.includes("image") || kind.includes("shot") || kind.includes("storyboard")) return <ImageIcon size={14} />
  if (kind.includes("video")) return <Film size={14} />
  if (kind.includes("audio") || kind.includes("tts") || kind === "bgm") return <Music size={14} />
  return <FileText size={14} />
}

function getTypeLabel(kind?: string): string {
  if (!kind) return "节点"
  if (kind.includes("image") || kind.includes("shot")) return "图片"
  if (kind.includes("video")) return "视频"
  if (kind.includes("audio") || kind.includes("tts") || kind === "bgm") return "音频"
  if (kind.includes("subtitle")) return "字幕"
  if (kind.includes("script")) return "剧本"
  if (kind.includes("storyboard")) return "分镜"
  if (kind === "agent") return "Agent"
  return kind
}

// ── 组件 ──────────────────────────────────────────────

export function AssetPreviewPopover({
  reference,
  children,
}: AssetPreviewPopoverProps) {
  const [isHovered, setIsHovered] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setIsHovered(true), 300)
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setIsHovered(false)
  }, [])

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 引用标记 */}
      <span
        className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-xs font-medium cursor-pointer transition-colors"
        style={{
          color: reference.isValid ? DESIGN_TOKENS.accentHover : "#ef4444",
          backgroundColor: reference.isValid ? DESIGN_TOKENS.accentSoft : "rgba(239,68,68,0.1)",
        }}
      >
        {reference.type === "asset" ? "📎" : "🔗"}
        {children}
      </span>

      {/* 悬停预览卡片 */}
      {isHovered && (
        <div
          className="absolute bottom-full left-0 mb-2 z-50 min-w-[200px] max-w-[280px] rounded-xl border shadow-xl"
          style={{
            backgroundColor: DESIGN_TOKENS.panelSolid,
            borderColor: DESIGN_TOKENS.border,
          }}
          onMouseEnter={() => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            setIsHovered(true)
          }}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* 缩略图 */}
          {reference.imageUrl ? (
            <div className="h-24 overflow-hidden rounded-t-xl">
              <img
                src={reference.imageUrl}
                alt={reference.title || "preview"}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none"
                }}
              />
            </div>
          ) : (
            <div
              className="flex h-16 items-center justify-center rounded-t-xl"
              style={{ backgroundColor: DESIGN_TOKENS.accentSoft }}
            >
              {getTypeIcon(reference.kind)}
            </div>
          )}

          {/* 信息区 */}
          <div className="p-3">
            {/* 失效警告 */}
            {!reference.isValid && (
              <div
                className="mb-2 flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px]"
                style={{
                  backgroundColor: "rgba(239,68,68,0.1)",
                  color: "#ef4444",
                }}
              >
                <AlertTriangle size={12} />
                <span>引用已失效</span>
              </div>
            )}

            {/* 标题 */}
            <p
              className="text-xs font-medium leading-tight truncate"
              style={{ color: DESIGN_TOKENS.text }}
            >
              {reference.title || `未命名${getTypeLabel(reference.kind)}`}
            </p>

            {/* 类型标签 */}
            <div className="mt-1.5 flex items-center gap-1.5">
              <span style={{ color: DESIGN_TOKENS.textMuted }}>
                {getTypeIcon(reference.kind)}
              </span>
              <span className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>
                {reference.type === "node" ? "画布节点" : "素材库资产"}
                {reference.kind && ` · ${getTypeLabel(reference.kind)}`}
              </span>
            </div>

            {/* ID */}
            <p
              className="mt-1 text-[9px] font-mono"
              style={{ color: DESIGN_TOKENS.textMuted }}
            >
              {reference.id.length > 20
                ? `${reference.id.slice(0, 20)}...`
                : reference.id}
            </p>
          </div>
        </div>
      )}
    </span>
  )
}
