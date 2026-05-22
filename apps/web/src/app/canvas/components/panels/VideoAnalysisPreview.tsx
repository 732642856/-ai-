// ============================================================================
// VideoAnalysisPreview — 视频分析结果最小预览组件（V1-5.5）
// ============================================================================
// 展示：摘要 + 关键帧网格 + caption 列表 + events 列表
// ============================================================================
"use client"

import { useState } from "react"
import type { VideoAnalysisResult, VideoKeyframeRef } from "../../types/video-analysis"
import { Clock, FileText, LayoutGrid, MessageSquare, AlertTriangle, Maximize2, Minimize2 } from "lucide-react"

interface VideoAnalysisPreviewProps {
  result: VideoAnalysisResult
  /** 节点标题（可选，用于卡片头部） */
  nodeTitle?: string
  /** 紧凑模式（用于嵌入 HistoryPanel），默认 maxHeight=540 可滚动 */
  compact?: boolean
}

/**
 * 格式化毫秒为时间戳字符串 "mm:ss.ms"
 */
function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const millis = ms % 1000
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${Math.floor(millis / 10).toString().padStart(2, "0")}`
}

/**
 * 关键帧缩略图（单张）
 */
function KeyframeThumbnail({ frame }: { frame: VideoKeyframeRef }) {
  return (
    <div className="group relative aspect-video overflow-hidden rounded-md border border-white/10 bg-black/40">
      {frame.imageUrl ? (
        <img
          src={frame.imageUrl}
          alt={`Frame at ${formatTimestamp(frame.timestampMs)}`}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-white/20">
          <LayoutGrid size={24} />
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
        <span className="text-[10px] font-mono text-white/80">
          {formatTimestamp(frame.timestampMs)}
        </span>
        {frame.description && (
          <span className="ml-2 text-[10px] text-white/50 truncate">
            {frame.description}
          </span>
        )}
      </div>
      <span className="absolute top-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-mono text-white/50">
        #{frame.frameIndex + 1}
      </span>
    </div>
  )
}

/**
 * 视频分析结果预览组件
 */
export default function VideoAnalysisPreview({
  result,
  nodeTitle,
  compact = false,
}: VideoAnalysisPreviewProps) {
  const [expanded, setExpanded] = useState(false)

  const hasKeyframes = result.keyframes && result.keyframes.length > 0
  const hasCaptions = result.captions && result.captions.length > 0
  const hasEvents = result.events && result.events.length > 0
  const hasObjects = result.objects && result.objects.length > 0

  const isMock = result.raw != null && typeof result.raw === "object" && (result.raw as Record<string, unknown>).mode === "mock"

  // compact 模式下的高度限制：展开后解除
  const compactStyle = compact && !expanded
    ? { maxHeight: 540, overflow: "auto" as const }
    : {}

  // 无内容空态
  if (!result.summary && !hasKeyframes && !hasCaptions && !hasEvents) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-4 text-white/30">
        <AlertTriangle size={20} />
        <span className="text-xs">无分析结果</span>
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-3 ${compact ? "" : "rounded-lg border border-white/10 bg-white/[0.03] p-4"}`}>
      <div style={compactStyle} className="flex flex-col gap-3">
      {/* 头部：标题 + Mock 标记 */}
      {(nodeTitle || isMock) && (
        <div className="flex items-center gap-2">
          {nodeTitle && (
            <h3 className="text-sm font-semibold text-white/80">{nodeTitle}</h3>
          )}
          {isMock && (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-400/80">
              Mock 预览
            </span>
          )}
        </div>
      )}

      {/* 摘要 */}
      {result.summary && (
        <div className="flex gap-2">
          <FileText size={14} className="mt-0.5 shrink-0 text-white/40" />
          <p className={`text-white/70 ${compact ? "text-xs leading-relaxed" : "text-sm leading-relaxed"}`}>
            {result.summary}
          </p>
        </div>
      )}

      {/* 关键帧网格 */}
      {hasKeyframes && (
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <LayoutGrid size={12} className="text-white/40" />
            <span className="text-[11px] font-medium text-white/50">
              关键帧 ({result.keyframes.length})
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {result.keyframes.map((frame) => (
              <KeyframeThumbnail key={`${frame.sourceVideoId}-${frame.frameIndex}`} frame={frame} />
            ))}
          </div>
        </div>
      )}

      {/* Captions 列表 */}
      {hasCaptions && (
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <MessageSquare size={12} className="text-white/40" />
            <span className="text-[11px] font-medium text-white/50">
              字幕 ({result.captions!.length})
            </span>
          </div>
          <div className="space-y-1.5">
            {result.captions!.map((cap, idx) => (
              <div key={idx} className="flex items-start gap-2 rounded bg-white/[0.03] px-2.5 py-1.5">
                <span className="mt-0.5 shrink-0 text-[10px] font-mono text-cyan-400/60">
                  {formatTimestamp(cap.startMs)}
                </span>
                <span className="text-xs text-white/60 leading-relaxed">
                  {cap.speaker && (
                    <span className="mr-1 font-medium text-white/50">{cap.speaker}:</span>
                  )}
                  {cap.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Events 列表 */}
      {hasEvents && (
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <Clock size={12} className="text-white/40" />
            <span className="text-[11px] font-medium text-white/50">
              事件 ({result.events!.length})
            </span>
          </div>
          <div className="space-y-1.5">
            {result.events!.map((evt, idx) => (
              <div key={idx} className="flex items-start gap-2 rounded bg-white/[0.03] px-2.5 py-1.5">
                <span className="mt-0.5 shrink-0 text-[10px] font-mono text-green-400/60">
                  {formatTimestamp(evt.startMs)}
                </span>
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-white/70">{evt.label}</span>
                  {evt.description && (
                    <span className="text-[11px] text-white/40">{evt.description}</span>
                  )}
                </div>
                {evt.confidence !== undefined && (
                  <span className="ml-auto shrink-0 text-[10px] font-mono text-white/30">
                    {(evt.confidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Objects 检测结果（精简展示） */}
      {hasObjects && (
        <div className="flex flex-wrap gap-1.5">
          {result.objects!.map((obj, idx) => (
            <span
              key={idx}
              className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-400/80"
            >
              {obj.label}
              {obj.confidence !== undefined && (
                <span className="ml-1 text-violet-400/40">
                  {(obj.confidence * 100).toFixed(0)}%
                </span>
              )}
            </span>
          ))}
        </div>
      )}
      </div>

      {/* compact 模式：展开/收起按钮 */}
      {compact && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 self-center rounded border border-white/10 px-3 py-1.5 text-[11px] text-white/40 transition-colors hover:border-white/20 hover:text-white/60"
        >
          {expanded ? (
            <><Minimize2 size={12} />收起完整分析</>
          ) : (
            <><Maximize2 size={12} />查看完整分析</>
          )}
        </button>
      )}
    </div>
  )
}
