/**
 * ColorGradePanel — 色彩分级面板（基于 rgb-curve）
 *
 * 提供 Master / R / G / B 四通道 RGB 曲线调整。
 * 包含 6 种电影级预设（胶片/赛博朋克/复古/日系/黑白/默认）。
 * 支持导出调整为 SD 参数注入 Prompt。
 *
 * 对标本小云雀 2.0 的"100+ 影视级画风库"的调色能力。
 */
"use client"

import React, { useCallback, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { X, Palette, Check, Copy, Undo2 } from "lucide-react"

// ── 类型 ──────────────────────────────────────────────

export interface ColorGradeProfile {
  name: string
  nameCN: string
  curves: {
    master: [number, number][]
    red: [number, number][]
    green: [number, number][]
    blue: [number, number][]
  }
  /** SD prompt 描述：对应的视觉风格英文 */
  sdPromptSuffix: string
}

export interface ColorGradePanelProps {
  isOpen: boolean
  onClose: () => void
  selectedNodeId?: string | null
  onApplyToNode?: (nodeId: string, promptSuffix: string) => void
}

// ── 预设 ──────────────────────────────────────────────

const PRESETS: ColorGradeProfile[] = [
  {
    name: "default",
    nameCN: "默认",
    curves: {
      master: [[0,0],[255,255]],
      red: [[0,0],[255,255]],
      green: [[0,0],[255,255]],
      blue: [[0,0],[255,255]],
    },
    sdPromptSuffix: "natural color grade, balanced contrast",
  },
  {
    name: "film",
    nameCN: "胶片",
    curves: {
      master: [[0,5],[64,60],[128,128],[192,196],[255,250]],
      red: [[0,10],[128,130],[255,248]],
      green: [[0,8],[64,60],[128,128],[192,196],[255,252]],
      blue: [[0,2],[64,68],[128,128],[192,188],[255,248]],
    },
    sdPromptSuffix: "cinematic film look, kodak portra color grade, lifted blacks, warm highlights",
  },
  {
    name: "cyberpunk",
    nameCN: "赛博朋克",
    curves: {
      master: [[0,0],[32,10],[128,128],[224,240],[255,255]],
      red: [[0,0],[64,48],[128,128],[192,208],[255,255]],
      green: [[0,0],[64,72],[128,128],[192,184],[255,255]],
      blue: [[0,0],[64,88],[128,128],[192,168],[255,255]],
    },
    sdPromptSuffix: "cyberpunk color grade, neon blue and magenta tones, crushed blacks, high contrast",
  },
  {
    name: "vintage",
    nameCN: "复古",
    curves: {
      master: [[0,10],[64,52],[128,128],[192,200],[255,248]],
      red: [[0,15],[128,135],[255,245]],
      green: [[0,8],[64,52],[128,130],[192,200],[255,250]],
      blue: [[0,5],[64,56],[128,128],[192,200],[255,255]],
    },
    sdPromptSuffix: "vintage 1970s color grade, faded warm tones, analog film grain, sepia undertones",
  },
  {
    name: "japanese",
    nameCN: "日系清新",
    curves: {
      master: [[0,8],[64,72],[128,135],[192,200],[255,248]],
      red: [[0,5],[128,132],[255,250]],
      green: [[0,10],[64,72],[128,138],[192,202],[255,245]],
      blue: [[0,15],[64,72],[128,135],[192,195],[255,240]],
    },
    sdPromptSuffix: "Japanese film aesthetic, soft pastel colors, overexposed highlights, fresh clean look",
  },
  {
    name: "bw",
    nameCN: "黑白电影",
    curves: {
      master: [[0,0],[32,28],[128,128],[224,226],[255,255]],
      red: [[0,0],[255,255]],
      green: [[0,0],[255,255]],
      blue: [[0,0],[255,255]],
    },
    sdPromptSuffix: "black and white cinematic, high contrast monochrome, ansel adams zone system",
  },
]

// ── 简单的 SVG 曲线渲染（不依赖 rgb-curve 的复杂 Canvas） ──

function CurvePreview({
  points,
  color,
  label,
}: {
  points: [number, number][]
  color: string
  label: string
}) {
  const pathD = points
    .map(([x, y], i) => {
      // 映射到 SVG 坐标系（x 左→右, y 上→下 反转）
      const sx = ((x / 255) * 100).toFixed(1)
      const sy = (100 - (y / 255) * 100).toFixed(1)
      return i === 0 ? `M ${sx} ${sy}` : `L ${sx} ${sy}`
    })
    .join(" ")

  return (
    <div className="flex items-center gap-2 mb-1">
      <span
        className="text-[10px] font-bold w-5 text-center rounded px-0.5"
        style={{ color, backgroundColor: `${color}20` }}
      >
        {label}
      </span>
      <svg
        viewBox="0 0 100 100"
        className="w-full h-12 rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
      >
        {/* 背景网格 */}
        <line x1="50" y1="0" x2="50" y2="100" stroke="var(--color-border)" strokeWidth="0.3" />
        <line x1="0" y1="50" x2="100" y2="50" stroke="var(--color-border)" strokeWidth="0.3" />
        <line x1="0" y1="0" x2="100" y2="100" stroke="var(--color-border)" strokeWidth="0.2" strokeDasharray="2,2" />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

// ── 组件 ──────────────────────────────────────────────

export function ColorGradePanel({
  isOpen,
  onClose,
  selectedNodeId,
  onApplyToNode,
}: ColorGradePanelProps) {
  const [activePreset, setActivePreset] = useState<string>("film")
  const [applied, setApplied] = useState(false)

  const current = useMemo(
    () => PRESETS.find((p) => p.name === activePreset) ?? PRESETS[0],
    [activePreset],
  )

  const handleApply = useCallback(() => {
    if (selectedNodeId && onApplyToNode) {
      const promptWithGrade = `Color grade: ${current.sdPromptSuffix}.`
      onApplyToNode(selectedNodeId, promptWithGrade)
      setApplied(true)
      setTimeout(() => setApplied(false), 2000)
    }
  }, [selectedNodeId, onApplyToNode, current])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(current.sdPromptSuffix)
  }, [current])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed top-16 right-4 z-[90] min-w-[320px]">
      <div className="bg-[var(--color-bg-panel)] backdrop-blur-xl rounded-xl border border-[var(--color-border)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
            <Palette size={16} />
            色彩分级
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--color-hover)] transition-colors text-[var(--color-text-secondary)]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Preset Selector */}
        <div className="p-3 border-b border-[var(--color-border)]">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2">
            预设风格
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => setActivePreset(preset.name)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  activePreset === preset.name
                    ? "bg-[var(--color-accent)] text-white"
                    : "bg-[var(--color-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                }`}
              >
                {preset.nameCN}
              </button>
            ))}
          </div>
        </div>

        {/* Curve Display */}
        <div className="p-3">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2">
            RGB 曲线
          </div>
          <CurvePreview points={current.curves.master} color="#ffffff" label="M" />
          <CurvePreview points={current.curves.red} color="#ff4444" label="R" />
          <CurvePreview points={current.curves.green} color="#44ff44" label="G" />
          <CurvePreview points={current.curves.blue} color="#4488ff" label="B" />
        </div>

        {/* Prompt Preview */}
        <div className="px-3 pb-2">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1">
            SD Prompt 后缀
          </div>
          <div className="bg-[var(--color-bg)] rounded-lg p-2.5 border border-[var(--color-border)]">
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              {current.sdPromptSuffix}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-3 py-3 border-t border-[var(--color-border)]">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
          >
            <Copy size={13} />
            复制
          </button>
          <button
            onClick={handleApply}
            disabled={!selectedNodeId}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ml-auto ${
              applied
                ? "bg-green-500/20 text-green-400"
                : "bg-[var(--color-accent)] hover:brightness-110 text-white disabled:opacity-40 disabled:cursor-not-allowed"
            }`}
          >
            {applied ? <Check size={13} /> : <Undo2 size={13} />}
            {applied ? "已应用" : "应用到节点"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default ColorGradePanel
