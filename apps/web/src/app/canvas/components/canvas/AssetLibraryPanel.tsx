// ============================================================================
// Asset Library Panel - Material/Library panel for saving and managing assets
// ============================================================================
"use client"

import { memo, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import { Archive, Box, Folder, Image, Music, Palette, Search, Sparkles, Star, UserRound, Video, X } from "lucide-react"
import { DESIGN_TOKENS, ICON_CONFIG } from "../../styles/designSystem"
import type { AssetItem, AssetFolder } from "../canvas/types"

const FOLDERS: AssetFolder[] = ["Character", "Scene", "Item", "Style", "Sound Effect", "Others"]

const folderIcons: Record<AssetFolder, typeof Folder> = {
  Character: UserRound,
  Scene: Image,
  Item: Box,
  Style: Palette,
  "Sound Effect": Music,
  Others: Folder,
}

const typeIcons: Partial<Record<AssetItem["type"], typeof Image>> = {
  image: Image,
  video: Video,
  audio: Music,
  prompt: Sparkles,
  style: Palette,
  character: UserRound,
  scene: Image,
  other: Archive,
}

interface AssetLibraryPanelProps {
  isOpen: boolean
  onClose: () => void
  assets: AssetItem[]
  selectedFolder?: AssetFolder
  query: string
  onQueryChange: (query: string) => void
  onFolderChange: (folder: AssetFolder | undefined) => void
  onToggleFavorite: (id: string) => void
  onDeleteAsset: (id: string) => void
  onSelectAsset: (asset: AssetItem) => void
}

export const AssetLibraryPanel = memo(function AssetLibraryPanel({
  isOpen,
  onClose,
  assets,
  selectedFolder,
  query,
  onQueryChange,
  onFolderChange,
  onToggleFavorite,
  onDeleteAsset,
  onSelectAsset,
}: AssetLibraryPanelProps) {
  const [hoveredAsset, setHoveredAsset] = useState<string | null>(null)

  // Filter assets by query and folder
  const filteredAssets = assets.filter((asset) => {
    const matchesFolder = !selectedFolder || asset.folder === selectedFolder
    const matchesQuery = !query || asset.name.toLowerCase().includes(query.toLowerCase())
    return matchesFolder && matchesQuery
  })

  const handleDragStart = useCallback((e: React.DragEvent, asset: AssetItem) => {
    e.dataTransfer.setData("application/json", JSON.stringify(asset))
    e.dataTransfer.effectAllowed = "copy"
  }, [])

  if (!isOpen) return null

  const panelContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="flex h-[80vh] w-[920px] flex-col rounded-[28px] border shadow-2xl"
        style={{
          backgroundColor: DESIGN_TOKENS.panelSolid,
          borderColor: DESIGN_TOKENS.border,
          boxShadow: DESIGN_TOKENS.shadowPanel,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: DESIGN_TOKENS.border }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: DESIGN_TOKENS.accentSoft }}>
              <Folder size={20} strokeWidth={ICON_CONFIG.strokeWidth} style={{ color: DESIGN_TOKENS.accentHover }} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: DESIGN_TOKENS.accentHover }}>
                StarTrails Library
              </p>
              <h2 className="text-lg font-medium" style={{ color: DESIGN_TOKENS.text }}>素材库</h2>
            </div>
            <span className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: DESIGN_TOKENS.card, color: DESIGN_TOKENS.textMuted }}>
              {assets.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 transition-colors hover:bg-white/10"
            style={{ color: ICON_CONFIG.color }}
            title="关闭"
          >
            <X size={18} strokeWidth={ICON_CONFIG.strokeWidth} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 border-b px-5 py-3" style={{ borderColor: DESIGN_TOKENS.border }}>
          {/* Search */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" size={16} strokeWidth={ICON_CONFIG.strokeWidth} style={{ color: DESIGN_TOKENS.textMuted }} />
            <input
              type="text"
              placeholder="搜索素材..."
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              className="w-full rounded-xl border py-2 pl-10 pr-10 text-sm outline-none transition-colors placeholder:text-white/30 focus:border-slate-400/50"
              style={{
                backgroundColor: DESIGN_TOKENS.card,
                borderColor: DESIGN_TOKENS.border,
                color: DESIGN_TOKENS.text,
              }}
            />
            {query && (
              <button
                onClick={() => onQueryChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors hover:text-white"
                style={{ color: DESIGN_TOKENS.textMuted }}
                title="清空搜索"
              >
                <X size={14} strokeWidth={ICON_CONFIG.strokeWidth} />
              </button>
            )}
          </div>

          {/* Folder Tabs */}
          <div className="flex max-w-[560px] gap-1 overflow-x-auto">
            <button
              onClick={() => onFolderChange(undefined)}
              className="rounded-lg px-3 py-1.5 text-xs transition-colors"
              style={{
                backgroundColor: !selectedFolder ? DESIGN_TOKENS.accentSoft : "transparent",
                color: !selectedFolder ? DESIGN_TOKENS.accentHover : DESIGN_TOKENS.textMuted,
              }}
            >
              全部
            </button>
            {FOLDERS.map((folder) => {
              const FolderIcon = folderIcons[folder]
              return (
                <button
                  key={folder}
                  onClick={() => onFolderChange(folder)}
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs transition-colors"
                  style={{
                    backgroundColor: selectedFolder === folder ? DESIGN_TOKENS.accentSoft : "transparent",
                    color: selectedFolder === folder ? DESIGN_TOKENS.accentHover : DESIGN_TOKENS.textMuted,
                  }}
                >
                  <FolderIcon size={14} strokeWidth={ICON_CONFIG.strokeWidth} />
                  <span>{folder}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Asset Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {filteredAssets.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Folder size={44} strokeWidth={1.5} className="mb-4 opacity-30" style={{ color: DESIGN_TOKENS.textMuted }} />
              <p style={{ color: DESIGN_TOKENS.textMuted }}>暂无素材</p>
              <p className="mt-1 text-xs text-white/25">
                右键节点 → 保存到素材库
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              {filteredAssets.map((asset) => (
                <div
                  key={asset.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, asset)}
                  onClick={() => onSelectAsset(asset)}
                  onMouseEnter={() => setHoveredAsset(asset.id)}
                  onMouseLeave={() => setHoveredAsset(null)}
                  className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-white/5 transition-all hover:border-slate-400/40"
                >
                  {asset.thumbnail || asset.src ? (
                    <img
                      src={asset.thumbnail || asset.src}
                      alt={asset.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center opacity-40">
                      {(() => {
                        const AssetIcon = typeIcons[asset.type] || Archive
                        return <AssetIcon size={40} strokeWidth={1.5} style={{ color: DESIGN_TOKENS.textMuted }} />
                      })()}
                    </div>
                  )}

                  {/* Hover Overlay */}
                  <div
                    className={`absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/20 to-transparent p-3 transition-opacity ${
                      hoveredAsset === asset.id ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <p className="truncate text-sm font-medium text-white">{asset.name}</p>
                    <p className="flex items-center gap-1 text-xs text-white/50">
                      {(() => {
                        const FolderIcon = folderIcons[asset.folder]
                        return <FolderIcon size={12} strokeWidth={ICON_CONFIG.strokeWidth} />
                      })()}
                      {asset.folder}
                    </p>
                  </div>

                  {/* Favorite Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleFavorite(asset.id)
                    }}
                    className={`absolute right-2 top-2 rounded-lg p-1.5 transition-all ${
                      asset.favorite
                        ? "bg-yellow-500/30 text-yellow-400"
                        : "bg-black/40 text-white/40 opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    <Star size={15} strokeWidth={ICON_CONFIG.strokeWidth} fill={asset.favorite ? "currentColor" : "none"} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-5 py-3" style={{ borderColor: DESIGN_TOKENS.border }}>
          <p className="text-xs" style={{ color: DESIGN_TOKENS.textMuted }}>
            拖拽素材到画布添加节点 · 右键节点可保存到素材库
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm transition-colors hover:bg-white/10"
              style={{ color: DESIGN_TOKENS.textSecondary, backgroundColor: DESIGN_TOKENS.card }}
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof document === "undefined") return null
  return createPortal(panelContent, document.body)
})

export default AssetLibraryPanel
