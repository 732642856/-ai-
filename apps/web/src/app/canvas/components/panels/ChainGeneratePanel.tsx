/**
 * ChainGeneratePanel — 链式视频生成进度面板
 *
 * 对标 AI Video Storyboard Platform (MIT) 的链式生成模式：
 *   - 按时间线顺序逐个镜头生成视频
 *   - 每个镜头的尾帧自动成为下一个镜头的首帧
 *   - 显示生成进度、成功/失败状态
 */
"use client"

import React from "react"
import { createPortal } from "react-dom"
import { X, Film, Play, Square, CheckCircle2, AlertCircle, Loader2, Clock, ArrowRight } from "lucide-react"
import { DESIGN_TOKENS } from "../../styles/designSystem"

export interface ChainShotStatus {
  nodeId: string
  title: string
  status: "idle" | "generating" | "done" | "error"
  percent: number
  videoUrl?: string
  error?: string
}

interface ChainGeneratePanelProps {
  isOpen: boolean
  onClose: () => void
  shots: ChainShotStatus[]
  isRunning: boolean
  onStart: () => void
  onCancel: () => void
}

export function ChainGeneratePanel({
  isOpen, onClose, shots, isRunning, onStart, onCancel,
}: ChainGeneratePanelProps) {
  if (!isOpen) return null

  const doneCount = shots.filter((s) => s.status === "done").length
  const errorCount = shots.filter((s) => s.status === "error").length

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={isRunning ? undefined : onClose} />

      {/* Panel */}
      <div
        className="relative z-10 w-[500px] max-h-[80vh] overflow-hidden rounded-2xl border flex flex-col shadow-2xl"
        style={{ backgroundColor: DESIGN_TOKENS.panel, borderColor: DESIGN_TOKENS.border }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: DESIGN_TOKENS.border }}>
          <div className="flex items-center gap-2">
            <Film size={18} style={{ color: DESIGN_TOKENS.accent }} />
            <span className="text-sm font-semibold" style={{ color: DESIGN_TOKENS.text }}>
              链式视频生成
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isRunning ? (
              <button
                onClick={onCancel}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
                style={{ backgroundColor: "rgba(239,68,68,0.15)", color: "#ef4444" }}
              >
                <Square size={14} /> 取消
              </button>
            ) : (
              <button
                onClick={onStart}
                disabled={shots.length === 0}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
                style={{ backgroundColor: DESIGN_TOKENS.accent, color: "#fff", opacity: shots.length === 0 ? 0.4 : 1 }}
              >
                <Play size={14} /> 一键生成
              </button>
            )}
            <button
              onClick={onClose}
              disabled={isRunning}
              className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/10"
              style={{ color: DESIGN_TOKENS.textMuted, opacity: isRunning ? 0.3 : 1 }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Progress Summary ── */}
        <div className="flex gap-3 border-b px-4 py-3" style={{ borderColor: DESIGN_TOKENS.border }}>
          <div className="flex-1 text-center">
            <span className="text-lg font-bold" style={{ color: DESIGN_TOKENS.text }}>{shots.length}</span>
            <p className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>总镜头</p>
          </div>
          <div className="flex-1 text-center">
            <span className="text-lg font-bold" style={{ color: "#22c55e" }}>{doneCount}</span>
            <p className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>已完成</p>
          </div>
          <div className="flex-1 text-center">
            <span className="text-lg font-bold" style={{ color: errorCount > 0 ? "#ef4444" : DESIGN_TOKENS.textMuted }}>{errorCount}</span>
            <p className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>失败</p>
          </div>
        </div>

        {/* ── Shot List ── */}
        <div className="flex-1 overflow-y-auto">
          {shots.map((shot, i) => (
            <div
              key={shot.nodeId}
              className="flex items-center gap-3 border-b px-4 py-2.5"
              style={{ borderColor: DESIGN_TOKENS.border }}
            >
              {/* Step indicator */}
              <span className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-mono"
                style={{
                  backgroundColor: shot.status === "done" ? "rgba(34,197,94,0.15)" :
                    shot.status === "error" ? "rgba(239,68,68,0.15)" :
                    shot.status === "generating" ? DESIGN_TOKENS.accentSoft :
                    "rgba(255,255,255,0.05)",
                  color: shot.status === "done" ? "#22c55e" :
                    shot.status === "error" ? "#ef4444" :
                    shot.status === "generating" ? DESIGN_TOKENS.accentHover :
                    DESIGN_TOKENS.textMuted,
                }}
              >
                {i + 1}
              </span>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium truncate" style={{ color: DESIGN_TOKENS.text }}>
                    {shot.title || `镜头 ${i + 1}`}
                  </span>
                  {shot.status === "generating" && (
                    <Loader2 size={12} className="animate-spin" style={{ color: DESIGN_TOKENS.accent }} />
                  )}
                  {shot.status === "done" && (
                    <CheckCircle2 size={12} style={{ color: "#22c55e" }} />
                  )}
                  {shot.status === "error" && (
                    <AlertCircle size={12} style={{ color: "#ef4444" }} />
                  )}
                  {shot.status === "idle" && (
                    <Clock size={12} style={{ color: DESIGN_TOKENS.textMuted }} />
                  )}
                </div>

                {/* Progress bar for generating */}
                {shot.status === "generating" && (
                  <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${shot.percent}%`, backgroundColor: DESIGN_TOKENS.accent }}
                    />
                  </div>
                )}

                {/* Error message */}
                {shot.status === "error" && shot.error && (
                  <p className="text-[10px] mt-0.5 truncate" style={{ color: "#ef4444" }}>{shot.error}</p>
                )}
              </div>

              {/* Chain arrow */}
              {i < shots.length - 1 && (
                <ArrowRight size={12} style={{ color: DESIGN_TOKENS.textMuted, flexShrink: 0 }} />
              )}
            </div>
          ))}

          {shots.length === 0 && (
            <div className="p-8 text-center text-xs" style={{ color: DESIGN_TOKENS.textMuted }}>
              画布上没有镜头节点可以生成视频
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
