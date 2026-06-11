// ============================================================================
// DraggableAngleControl — 拖拽式角色角度控制器
// ============================================================================
// 对标 TapNow "拖拽方块调整角色朝向，像是在指挥演员走位"
// 纯 React + CSS transform，零外部依赖
// ============================================================================
"use client"

import { memo, useCallback, useRef, useState, useEffect } from "react"
import { RotateCcw } from "lucide-react"
import { DESIGN_TOKENS } from "../../styles/designSystem"

// ============================================================================
// Types
// ============================================================================

interface DraggableAngleControlProps {
  width?: number
  height?: number
  angle?: number
  characterImageUrl?: string
  onChange?: (angle: number) => void
  onChangeComplete?: (angle: number) => void
  snapPoints?: number[] // 吸附角度（如 [0, 45, 90, 135, 180, 225, 270, 315]）
  className?: string
}

// ============================================================================
// Component
// ============================================================================

export const DraggableAngleControl = memo(function DraggableAngleControl({
  width = 200,
  height = 240,
  angle: externalAngle = 0,
  characterImageUrl,
  onChange,
  onChangeComplete,
  snapPoints = [0, 45, 90, 135, 180, 225, 270, 315],
  className,
}: DraggableAngleControlProps) {
  const [angle, setAngle] = useState(externalAngle)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const startAngleRef = useRef(0)
  const startPointerRef = useRef({ x: 0, y: 0 })
  const internalAngleRef = useRef(externalAngle)

  // Sync external angle changes
  useEffect(() => {
    if (!isDragging) {
      setAngle(externalAngle)
      internalAngleRef.current = externalAngle
    }
  }, [externalAngle, isDragging])

  const getAngleFromPointer = useCallback(
    (clientX: number, clientY: number): number => {
      const el = containerRef.current
      if (!el) return 0
      const rect = el.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      return Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI) + 90
    },
    [],
  )

  const snapAngle = useCallback(
    (raw: number): number => {
      // Normalize to [0, 360)
      let normalized = ((raw % 360) + 360) % 360
      if (!snapPoints || snapPoints.length === 0) return normalized

      // Find nearest snap point within 8 degrees
      const threshold = 8
      for (const snap of snapPoints) {
        if (Math.abs(normalized - snap) < threshold) return snap
        // Also check wrap-around
        if (Math.abs(normalized - snap - 360) < threshold) return snap
      }
      return Math.round(normalized)
    },
    [snapPoints],
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      setIsDragging(true)
      startAngleRef.current = internalAngleRef.current
      startPointerRef.current = { x: e.clientX, y: e.clientY }
    },
    [],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return
      const deltaAngle = getAngleFromPointer(e.clientX, e.clientY)
      let newAngle = startAngleRef.current + (deltaAngle - getAngleFromPointer(
        startPointerRef.current.x,
        startPointerRef.current.y,
      ))
      newAngle = ((newAngle % 360) + 360) % 360
      const snapped = snapAngle(newAngle)
      internalAngleRef.current = snapped
      setAngle(snapped)
      onChange?.(snapped)
    },
    [isDragging, getAngleFromPointer, snapAngle, onChange],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return
      setIsDragging(false)
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      onChangeComplete?.(internalAngleRef.current)
    },
    [isDragging, onChangeComplete],
  )

  const resetAngle = useCallback(() => {
    setAngle(0)
    internalAngleRef.current = 0
    onChange?.(0)
    onChangeComplete?.(0)
  }, [onChange, onChangeComplete])

  const characterStyle: React.CSSProperties = {
    width,
    height,
    transform: `rotate(${angle}deg)`,
    transformOrigin: "center center",
    transition: isDragging ? "none" : "transform 0.15s ease",
    cursor: isDragging ? "grabbing" : "grab",
    userSelect: "none",
    WebkitUserSelect: "none",
  }

  return (
    <div className={className}>
      {/* Angle indicator */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: DESIGN_TOKENS.text }}>
          角色角度
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm" style={{ color: DESIGN_TOKENS.accent }}>
            {Math.round(angle)}°
          </span>
          <button
            onClick={resetAngle}
            className="rounded p-1 transition hover:bg-white/10"
            style={{ color: DESIGN_TOKENS.textMuted }}
            title="重置角度"
          >
            <RotateCcw size={12} />
          </button>
        </div>
      </div>

      {/* Circular track */}
      <div
        className="relative mx-auto rounded-full border-2"
        style={{
          width: width + 60,
          height: width + 60,
          borderColor: "rgba(255,255,255,0.08)",
          backgroundColor: "rgba(255,255,255,0.02)",
        }}
      >
        {/* Snap markers */}
        {snapPoints.map((pt) => {
          const rad = ((pt - 90) * Math.PI) / 180
          const r = (width + 60) / 2 - 8
          const cx = (width + 60) / 2
          const cy = (width + 60) / 2
          const x = cx + r * Math.cos(rad)
          const y = cy + r * Math.sin(rad)

          const isMajor = pt % 90 === 0
          return (
            <div
              key={pt}
              className="absolute rounded-full"
              style={{
                width: isMajor ? 6 : 3,
                height: isMajor ? 6 : 3,
                left: x - (isMajor ? 3 : 1.5),
                top: y - (isMajor ? 3 : 1.5),
                backgroundColor: isMajor ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)",
              }}
            />
          )
        })}

        {/* Draggable character container */}
        <div
          ref={containerRef}
          className="absolute left-1/2 top-1/2"
          style={{
            marginLeft: -width / 2,
            marginTop: -height / 2,
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div
            style={characterStyle}
            className="relative overflow-hidden rounded-lg border"
          >
            {characterImageUrl ? (
              <img
                src={characterImageUrl}
                alt="角色"
                className="h-full w-full object-cover"
                draggable={false}
              />
            ) : (
              <div
                className="flex h-full w-full flex-col items-center justify-center gap-1"
                style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
              >
                <span className="text-4xl">🧍</span>
                <span className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>
                  拖拽旋转
                </span>
              </div>
            )}

            {/* Drag hint arrow */}
            <div
              className="absolute left-1/2 top-2"
              style={{
                marginLeft: -8,
                width: 16,
                height: 16,
                borderLeft: "2px solid rgba(255,255,255,0.4)",
                borderTop: "2px solid rgba(255,255,255,0.4)",
                transform: "rotate(45deg)",
              }}
            />
          </div>
        </div>

        {/* Instruction overlay */}
        {!isDragging && !characterImageUrl && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ color: DESIGN_TOKENS.textMuted, fontSize: 11 }}
          >
            {/* Center dot */}
            <div
              className="rounded-full"
              style={{
                width: 8,
                height: 8,
                backgroundColor: DESIGN_TOKENS.accent,
                opacity: 0.5,
              }}
            />
          </div>
        )}
      </div>

      {/* Preset quick angles */}
      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((preset) => (
          <button
            key={preset}
            onClick={() => {
              setAngle(preset)
              internalAngleRef.current = preset
              onChange?.(preset)
              onChangeComplete?.(preset)
            }}
            className="rounded-lg border px-2 py-1 text-[10px] transition hover:bg-white/10"
            style={{
              borderColor: Math.abs(angle - preset) < 5 ? DESIGN_TOKENS.accent : DESIGN_TOKENS.border,
              color: Math.abs(angle - preset) < 5 ? DESIGN_TOKENS.accent : DESIGN_TOKENS.textMuted,
              backgroundColor: Math.abs(angle - preset) < 5 ? "rgba(99,102,241,0.1)" : "transparent",
            }}
          >
            {preset}°
          </button>
        ))}
      </div>
    </div>
  )
})
