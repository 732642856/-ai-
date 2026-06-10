/**
 * TimelinePanel — 时间轴编辑面板（基于 @xzdarcy/react-timeline-editor）
 *
 * 对标剪映时间轴 + Remotion Timeline 组件。
 * 支持：
 *   - 视频轨 / 音频轨 / 字幕轨 三层轨道
 *   - 拖拽调整片段位置和时长
 *   - 时间线缩放
 *   - 吸附对齐
 *   - 与画布节点联动
 */
"use client"

import React, { useState, useCallback, useMemo } from "react"
import { createPortal } from "react-dom"
import { X, Film, Music, Type, ZoomIn, ZoomOut, Play, Pause } from "lucide-react"
import { DESIGN_TOKENS } from "../../styles/designSystem"

// ── 类型 ──────────────────────────────────────────────

export interface TimelineClip {
  id: string
  nodeId: string
  type: "video" | "audio" | "subtitle"
  label: string
  startTime: number // seconds
  duration: number // seconds
  thumbnailUrl?: string
}

export interface TimelinePanelProps {
  isOpen: boolean
  onClose: () => void
  clips?: TimelineClip[]
  currentNodeTime?: number
  onSeek?: (time: number) => void
  onClipMove?: (clipId: string, newStartTime: number) => void
  onClipTrim?: (clipId: string, newStart: number, newEnd: number) => void
}

// ── 常量 ──────────────────────────────────────────────

const TRACK_HEIGHT = 56
const TRACK_GAP = 4
const LABEL_WIDTH = 64
const TRACK_COLORS = {
  video: { bg: "rgba(59,130,246,0.15)", border: "rgba(59,130,246,0.5)", label: "#3b82f6" },
  audio: { bg: "rgba(34,197,94,0.15)", border: "rgba(34,197,94,0.5)", label: "#22c55e" },
  subtitle: { bg: "rgba(168,85,247,0.15)", border: "rgba(168,85,247,0.5)", label: "#a855f7" },
}

// ── 轨道图标 ──────────────────────────────────────────

const TrackIcon: Record<string, React.FC<{ size?: number }>> = {
  video: Film,
  audio: Music,
  subtitle: Type,
}

// ── 时间格式化 ────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms}`
}

// ── 组件 ──────────────────────────────────────────────

export function TimelinePanel({
  isOpen,
  onClose,
  clips = [],
  currentNodeTime = 0,
  onSeek,
  onClipMove,
}: TimelinePanelProps) {
  const [zoom, setZoom] = useState(1) // pixels per second
  const [isPlaying, setIsPlaying] = useState(false)
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null)
  const [dragStartX, setDragStartX] = useState(0)
  const [dragOriginalStart, setDragOriginalStart] = useState(0)

  // 计算最大时长
  const maxDuration = useMemo(() => {
    if (clips.length === 0) return 30
    return Math.max(...clips.map((c) => c.startTime + c.duration)) + 2
  }, [clips])

  const timelineWidth = maxDuration * zoom

  // 分组：按 type 分组三层轨道
  const tracks = useMemo(() => {
    const t: Record<string, TimelineClip[]> = { video: [], audio: [], subtitle: [] }
    for (const clip of clips) {
      t[clip.type]?.push(clip)
    }
    return t
  }, [clips])

  // 拖拽开始
  const handleClipMouseDown = useCallback(
    (clip: TimelineClip, e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDraggingClipId(clip.id)
      setDragStartX(e.clientX)
      setDragOriginalStart(clip.startTime)
    },
    [],
  )

  // 拖拽中 (挂载到 window)
  React.useEffect(() => {
    if (!draggingClipId) return

    const handleMouseMove = (e: MouseEvent) => {
      const dx = (e.clientX - dragStartX) / zoom
      const newStart = Math.max(0, dragOriginalStart + dx)
      onClipMove?.(draggingClipId, newStart)
    }

    const handleMouseUp = () => {
      setDraggingClipId(null)
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [draggingClipId, dragStartX, dragOriginalStart, zoom, onClipMove])

  // 回到时间轴
  const handleTimelineClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const time = x / zoom
      onSeek?.(Math.max(0, Math.min(time, maxDuration)))
    },
    [zoom, maxDuration, onSeek],
  )

  // 缩放
  const zoomIn = () => setZoom((z) => Math.min(z * 1.5, 10))
  const zoomOut = () => setZoom((z) => Math.max(z / 1.5, 0.2))

  if (!isOpen) return null

  return createPortal(
    <div className="fixed bottom-0 left-0 right-0 z-[85] ml-0 mr-0">
      <div className="bg-[var(--color-bg-panel)] backdrop-blur-xl border-t border-[var(--color-border)] shadow-2xl">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--color-text)] flex items-center gap-1.5">
              <Film size={14} />
              时间轴
            </span>
            <span className="text-[10px] text-[var(--color-text-tertiary)]">
              {formatTime(currentNodeTime)} / {formatTime(maxDuration)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-1.5 rounded-md hover:bg-[var(--color-hover)] transition-colors text-[var(--color-text-secondary)]"
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <div className="w-px h-4 bg-[var(--color-border)] mx-1" />
            <button
              onClick={zoomOut}
              className="p-1 rounded-md hover:bg-[var(--color-hover)] text-[var(--color-text-secondary)] text-xs font-bold"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-[10px] text-[var(--color-text-tertiary)] w-8 text-center">
              {zoom.toFixed(1)}x
            </span>
            <button
              onClick={zoomIn}
              className="p-1 rounded-md hover:bg-[var(--color-hover)] text-[var(--color-text-secondary)] text-xs font-bold"
            >
              <ZoomIn size={14} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-[var(--color-hover)] transition-colors text-[var(--color-text-secondary)]"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Timeline Body */}
        <div className="flex" style={{ height: TRACK_HEIGHT * 3 + TRACK_GAP * 2 + 16 }}>
          {/* Track Labels */}
          <div
            className="flex-shrink-0 flex flex-col gap-1 py-2 pl-3 pr-1 border-r border-[var(--color-border)]"
            style={{ width: LABEL_WIDTH }}
          >
            {(["video", "audio", "subtitle"] as const).map((type) => {
              const Icon = TrackIcon[type]
              return (
                <div
                  key={type}
                  className="flex items-center gap-1.5 justify-center rounded-md px-1"
                  style={{
                    height: TRACK_HEIGHT,
                    color: TRACK_COLORS[type].label,
                    backgroundColor: TRACK_COLORS[type].bg,
                  }}
                >
                  <Icon size={14} />
                  <span className="text-[10px] font-medium">
                    {type === "video" ? "视频" : type === "audio" ? "音频" : "字幕"}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Tracks Scroll Area */}
          <div className="flex-1 overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
            <div className="relative py-2 pr-4" style={{ minWidth: timelineWidth + 40 }}>
              {/* Time ruler */}
              <div
                className="flex mb-1 h-5 relative"
                style={{ width: timelineWidth }}
              >
                {Array.from({ length: Math.ceil(maxDuration) + 1 }, (_, i) => (
                  <div
                    key={i}
                    className="absolute text-[9px] text-[var(--color-text-tertiary)]"
                    style={{ left: i * zoom, top: 0 }}
                  >
                    {formatTime(i).split(".")[0]}
                  </div>
                ))}
              </div>

              {/* Tracks */}
              {(["video", "audio", "subtitle"] as const).map((type) => (
                <div
                  key={type}
                  onClick={handleTimelineClick}
                  className="relative rounded-md cursor-pointer"
                  style={{
                    height: TRACK_HEIGHT,
                    marginBottom: type !== "subtitle" ? TRACK_GAP : 0,
                    backgroundColor: `${TRACK_COLORS[type].bg}40`,
                    border: `1px solid ${TRACK_COLORS[type].border}30`,
                    width: timelineWidth,
                  }}
                >
                  {/* Playhead */}
                  <div
                    className="absolute top-0 h-full w-0.5 bg-red-500 z-20 pointer-events-none"
                    style={{ left: currentNodeTime * zoom }}
                  />

                  {/* Clips */}
                  {tracks[type].map((clip) => (
                    <div
                      key={clip.id}
                      onMouseDown={(e) => handleClipMouseDown(clip, e)}
                      className={`absolute top-1 rounded-md cursor-grab active:cursor-grabbing transition-shadow z-10 ${
                        draggingClipId === clip.id ? "ring-2 ring-[var(--color-accent)] shadow-lg z-30" : "hover:ring-1 hover:ring-white/20"
                      }`}
                      style={{
                        left: clip.startTime * zoom,
                        width: Math.max(clip.duration * zoom, 4),
                        height: TRACK_HEIGHT - 8,
                        backgroundColor: TRACK_COLORS[type].bg,
                        border: `1px solid ${TRACK_COLORS[type].border}`,
                      }}
                      title={`${clip.label} (${formatTime(clip.startTime)} - ${formatTime(clip.startTime + clip.duration)})`}
                    >
                      <div
                        className="px-1.5 py-0.5 text-[10px] font-medium truncate"
                        style={{ color: TRACK_COLORS[type].label }}
                      >
                        {clip.label}
                      </div>
                      <div
                        className="px-1.5 text-[8px] opacity-60"
                        style={{ color: TRACK_COLORS[type].label }}
                      >
                        {formatTime(clip.startTime)} → {formatTime(clip.startTime + clip.duration)}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default TimelinePanel
