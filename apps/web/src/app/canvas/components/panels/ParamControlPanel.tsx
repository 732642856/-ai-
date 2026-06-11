/**
 * ParamControlPanel — 独立参数化控制面板
 *
 * 对标小云雀 2.0 的核心差异化能力：将 Prompt 描述拆解为独立参数面板。
 *
 * 光影控制：
 *   - 方位：左/顶/右/前/底/后
 *   - 亮度：0-100%
 *   - 质感：硬光→柔光
 *   - 色温：暖光→冷光
 *
 * 镜头控制：
 *   - 水平角度：-180° → +180°
 *   - 垂直角度：-90° → +90°
 *   - 景别：极远景→极特写
 *   - 运镜：静态/推/拉/摇/移/跟/升/降/手持
 *
 * 生成结构化 prompt 发送给图像/视频生成 API
 */
"use client"

import React, { useCallback, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { X, Sun, Camera, Wand2, Copy, Check } from "lucide-react"
import { DESIGN_TOKENS } from "../../styles/designSystem"

// ── 类型 ─────────────────────────────────────────────

interface LightingParams {
  direction: "left" | "top" | "right" | "front" | "bottom" | "back"
  intensity: number // 0-100
  softness: number // 0-100 (0=hard, 100=soft)
  colorTemp: number // 0-100 (0=warm, 100=cool)
}

interface CameraParams {
  horizontalAngle: number // -180 to 180
  verticalAngle: number // -90 to 90
  shotSize: "extreme-long" | "long" | "full" | "medium" | "medium-close" | "close-up" | "extreme-close-up"
  movement: "static" | "push-in" | "pull-out" | "pan-left" | "pan-right" | "tilt-up" | "tilt-down" | "tracking" | "dolly" | "crane" | "handheld"
}

const SHOT_SIZE_LABELS: Record<string, string> = {
  "extreme-long": "极远景",
  "long": "远景",
  "full": "全景",
  "medium": "中景",
  "medium-close": "近景",
  "close-up": "特写",
  "extreme-close-up": "大特写",
}

const MOVEMENT_LABELS: Record<string, string> = {
  "static": "固定",
  "push-in": "推",
  "pull-out": "拉",
  "pan-left": "左摇",
  "pan-right": "右摇",
  "tilt-up": "上摇",
  "tilt-down": "下摇",
  "tracking": "跟拍",
  "dolly": "横移",
  "crane": "升降",
  "handheld": "手持",
}

const DIRECTION_LABELS: Record<string, string> = {
  "left": "左侧", "top": "顶部", "right": "右侧",
  "front": "前方", "bottom": "底部", "back": "后方",
}

interface ParamControlPanelProps {
  isOpen: boolean
  onClose: () => void
  onApplyPrompt?: (prompt: string, params: { lighting: LightingParams; camera: CameraParams }) => void
}

// ── 组件 ─────────────────────────────────────────────

export function ParamControlPanel({ isOpen, onClose, onApplyPrompt }: ParamControlPanelProps) {
  const [lighting, setLighting] = useState<LightingParams>({
    direction: "front", intensity: 60, softness: 50, colorTemp: 50,
  })
  const [camera, setCamera] = useState<CameraParams>({
    horizontalAngle: 0, verticalAngle: 0, shotSize: "medium", movement: "static",
  })
  const [copied, setCopied] = useState(false)

  // 生成结构化 prompt
  const generatePrompt = useCallback((): string => {
    const parts: string[] = []

    // 光影
    parts.push(`${DIRECTION_LABELS[lighting.direction]}光`)
    if (lighting.intensity < 30) parts.push("低亮度")
    else if (lighting.intensity > 70) parts.push("高亮度")
    if (lighting.softness > 70) parts.push("柔光")
    else if (lighting.softness < 30) parts.push("硬光")
    if (lighting.colorTemp < 30) parts.push("暖色调")
    else if (lighting.colorTemp > 70) parts.push("冷色调")

    // 镜头
    parts.push(SHOT_SIZE_LABELS[camera.shotSize])
    if (camera.horizontalAngle !== 0) {
      parts.push(camera.horizontalAngle > 0 ? "右侧视角" : "左侧视角")
    }
    if (camera.verticalAngle > 20) parts.push("俯拍")
    else if (camera.verticalAngle < -20) parts.push("仰拍")
    if (camera.movement !== "static") {
      parts.push(MOVEMENT_LABELS[camera.movement])
    }

    return parts.filter(Boolean).join(", ")
  }, [lighting, camera])

  const prompt = useMemo(() => generatePrompt(), [generatePrompt])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [prompt])

  const handleApply = useCallback(() => {
    onApplyPrompt?.(prompt, { lighting, camera })
  }, [prompt, lighting, camera, onApplyPrompt])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
      <div
        className="relative w-[520px] max-h-[85vh] overflow-y-auto rounded-2xl border shadow-2xl"
        style={{ backgroundColor: DESIGN_TOKENS.panel, borderColor: DESIGN_TOKENS.border }}
      >
        {/* ── Header ── */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: DESIGN_TOKENS.border, backgroundColor: DESIGN_TOKENS.panel }}>
          <div className="flex items-center gap-2">
            <Camera size={18} style={{ color: DESIGN_TOKENS.accent }} />
            <span className="text-sm font-semibold" style={{ color: DESIGN_TOKENS.text }}>
              参数化控制面板
            </span>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/10"
            style={{ color: DESIGN_TOKENS.textMuted }}>
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* ── 光照控制 ── */}
          <div className="rounded-xl border p-4" style={{ borderColor: DESIGN_TOKENS.border }}>
            <div className="flex items-center gap-2 mb-3">
              <Sun size={16} style={{ color: "#f59e0b" }} />
              <span className="text-xs font-medium" style={{ color: DESIGN_TOKENS.text }}>光照控制</span>
            </div>

            {/* 方向 */}
            <div className="mb-3">
              <label className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>光源方向</label>
              <div className="grid grid-cols-3 gap-1 mt-1">
                {Object.entries(DIRECTION_LABELS).map(([key, label]) => (
                  <button key={key} onClick={() => setLighting((l) => ({ ...l, direction: key as LightingParams["direction"] }))}
                    className="rounded-lg px-2 py-1.5 text-[10px] transition-all"
                    style={{
                      backgroundColor: lighting.direction === key ? DESIGN_TOKENS.accentSoft : "rgba(255,255,255,0.04)",
                      color: lighting.direction === key ? DESIGN_TOKENS.accentHover : DESIGN_TOKENS.textMuted,
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 亮度 */}
            <SliderRow label="亮度" value={lighting.intensity} min={0} max={100}
              onChange={(v) => setLighting((l) => ({ ...l, intensity: v }))}
              leftLabel="暗" rightLabel="亮" />

            {/* 质感 */}
            <SliderRow label="质感" value={lighting.softness} min={0} max={100}
              onChange={(v) => setLighting((l) => ({ ...l, softness: v }))}
              leftLabel="硬光" rightLabel="柔光" />

            {/* 色温 */}
            <SliderRow label="色温" value={lighting.colorTemp} min={0} max={100}
              onChange={(v) => setLighting((l) => ({ ...l, colorTemp: v }))}
              leftLabel="🟠 暖光" rightLabel="🔵 冷光" />
          </div>

          {/* ── 镜头控制 ── */}
          <div className="rounded-xl border p-4" style={{ borderColor: DESIGN_TOKENS.border }}>
            <div className="flex items-center gap-2 mb-3">
              <Camera size={16} style={{ color: DESIGN_TOKENS.accentHover }} />
              <span className="text-xs font-medium" style={{ color: DESIGN_TOKENS.text }}>镜头控制</span>
            </div>

            {/* 水平角度 */}
            <SliderRow label="水平角度" value={camera.horizontalAngle} min={-180} max={180}
              onChange={(v) => setCamera((c) => ({ ...c, horizontalAngle: v }))}
              leftLabel="-180°" centerLabel={`${camera.horizontalAngle}°`} rightLabel="+180°" />

            {/* 垂直角度 */}
            <SliderRow label="垂直角度" value={camera.verticalAngle} min={-90} max={90}
              onChange={(v) => setCamera((c) => ({ ...c, verticalAngle: v }))}
              leftLabel="-90°" centerLabel={`${camera.verticalAngle}°`} rightLabel="+90°" />

            {/* 景别 */}
            <div className="mb-3">
              <label className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>景别</label>
              <div className="grid grid-cols-4 gap-1 mt-1">
                {Object.entries(SHOT_SIZE_LABELS).slice(0, 8).map(([key, label]) => (
                  <button key={key} onClick={() => setCamera((c) => ({ ...c, shotSize: key as CameraParams["shotSize"] }))}
                    className="rounded-lg px-2 py-1.5 text-[10px] transition-all truncate"
                    style={{
                      backgroundColor: camera.shotSize === key ? DESIGN_TOKENS.accentSoft : "rgba(255,255,255,0.04)",
                      color: camera.shotSize === key ? DESIGN_TOKENS.accentHover : DESIGN_TOKENS.textMuted,
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 运镜 */}
            <div>
              <label className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>运镜方式</label>
              <div className="grid grid-cols-5 gap-1 mt-1">
                {Object.entries(MOVEMENT_LABELS).map(([key, label]) => (
                  <button key={key} onClick={() => setCamera((c) => ({ ...c, movement: key as CameraParams["movement"] }))}
                    className="rounded-lg px-1.5 py-1.5 text-[10px] transition-all"
                    style={{
                      backgroundColor: camera.movement === key ? DESIGN_TOKENS.accentSoft : "rgba(255,255,255,0.04)",
                      color: camera.movement === key ? DESIGN_TOKENS.accentHover : DESIGN_TOKENS.textMuted,
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── 生成的 prompt ── */}
          <div className="rounded-xl border p-4" style={{ borderColor: DESIGN_TOKENS.border }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>生成 Prompt</span>
              <button onClick={handleCopy}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] transition-all hover:bg-white/10"
                style={{ color: copied ? "#22c55e" : DESIGN_TOKENS.textMuted }}>
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "已复制" : "复制"}
              </button>
            </div>
            <div className="rounded-lg p-3" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
              <p className="text-xs leading-relaxed" style={{ color: DESIGN_TOKENS.text }}>{prompt || "调整参数以生成 prompt"}</p>
            </div>
          </div>

          {/* ── 操作按钮 ── */}
          <button onClick={handleApply}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all"
            style={{ backgroundColor: DESIGN_TOKENS.accent, color: "#fff" }}>
            <Wand2 size={16} />
            应用参数并生成
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── SliderRow 子组件 ─────────────────────────────

function SliderRow({ label, value, min, max, onChange, leftLabel, centerLabel, rightLabel }: {
  label: string; value: number; min: number; max: number;
  onChange: (v: number) => void; leftLabel?: string; centerLabel?: string; rightLabel?: string;
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <label className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>{label}</label>
        <span className="text-[10px] font-mono" style={{ color: DESIGN_TOKENS.textSecondary }}>
          {centerLabel ?? value}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {leftLabel && <span className="text-[9px]" style={{ color: DESIGN_TOKENS.textMuted, width: 40, textAlign: "right" }}>{leftLabel}</span>}
        <input type="range" min={min} max={max} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-purple-500 h-1" />
        {rightLabel && <span className="text-[9px]" style={{ color: DESIGN_TOKENS.textMuted, width: 40 }}>{rightLabel}</span>}
      </div>
    </div>
  )
}
