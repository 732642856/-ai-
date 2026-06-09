"use client"

// ── Extracted from LaichuLai/openpose-skeleton-editor (MIT License) ──
// BODY_25 keypoint definitions + pose templates + canvas drag logic
// ─────────────────────────────────────────────────────────────────────

import { memo, useRef, useState, useCallback, useEffect } from "react"
import { DESIGN_TOKENS } from "../../styles/designSystem"
import { Sparkles } from "lucide-react"

// ── BODY_25 Keypoints ─────────────────────────────────────────────────
const BODY_25_KEYPOINTS = [
  { id: 0, name: "鼻子", x: 200, y: 80, fixed: false },
  { id: 1, name: "颈部", x: 200, y: 120, fixed: false },
  { id: 2, name: "右肩", x: 240, y: 125, fixed: false },
  { id: 3, name: "右肘", x: 275, y: 160, fixed: false },
  { id: 4, name: "右腕", x: 300, y: 200, fixed: false },
  { id: 5, name: "左肩", x: 160, y: 125, fixed: false },
  { id: 6, name: "左肘", x: 125, y: 160, fixed: false },
  { id: 7, name: "左腕", x: 100, y: 200, fixed: false },
  { id: 8, name: "中臀", x: 200, y: 180, fixed: false },
  { id: 9, name: "右膝", x: 230, y: 260, fixed: false },
  { id: 10, name: "右踝", x: 240, y: 340, fixed: false },
  { id: 11, name: "左膝", x: 170, y: 260, fixed: false },
  { id: 12, name: "左踝", x: 160, y: 340, fixed: false },
  { id: 13, name: "右足尖", x: 250, y: 360, fixed: false },
  { id: 14, name: "左足尖", x: 150, y: 360, fixed: false },
  { id: 15, name: "右眼", x: 210, y: 75, fixed: false },
  { id: 16, name: "左眼", x: 190, y: 75, fixed: false },
  { id: 17, name: "右耳", x: 220, y: 80, fixed: false },
  { id: 18, name: "左耳", x: 180, y: 80, fixed: false },
]

// ── Limb connections ──────────────────────────────────────────────────
const LIMBS: [number, number][] = [
  [0, 1], [0, 15], [0, 16], [15, 17], [16, 18],
  [1, 2], [1, 5], [1, 8], [2, 3], [3, 4],
  [5, 6], [6, 7], [8, 9], [8, 11], [9, 10],
  [11, 12], [10, 13], [12, 14],
]

// ── Pose templates ────────────────────────────────────────────────────
type PosePreset = "tpose" | "walk" | "run" | "sit" | "point"

const POSE_PRESETS: Record<PosePreset, Array<{ id: number; x: number; y: number }>> = {
  tpose: [
    { id: 0, x: 200, y: 80 }, { id: 1, x: 200, y: 120 },
    { id: 2, x: 290, y: 120 }, { id: 3, x: 340, y: 140 }, { id: 4, x: 370, y: 165 },
    { id: 5, x: 110, y: 120 }, { id: 6, x: 60, y: 140 }, { id: 7, x: 30, y: 165 },
    { id: 8, x: 200, y: 180 }, { id: 9, x: 230, y: 260 }, { id: 10, x: 240, y: 340 },
    { id: 11, x: 170, y: 260 }, { id: 12, x: 160, y: 340 },
    { id: 13, x: 250, y: 360 }, { id: 14, x: 150, y: 360 },
    { id: 15, x: 210, y: 75 }, { id: 16, x: 190, y: 75 }, { id: 17, x: 220, y: 80 }, { id: 18, x: 180, y: 80 },
  ],
  walk: [
    { id: 0, x: 195, y: 70 }, { id: 1, x: 195, y: 110 },
    { id: 2, x: 230, y: 120 }, { id: 3, x: 280, y: 150 }, { id: 4, x: 310, y: 190 },
    { id: 5, x: 160, y: 115 }, { id: 6, x: 120, y: 140 }, { id: 7, x: 100, y: 170 },
    { id: 8, x: 195, y: 170 }, { id: 9, x: 220, y: 250 }, { id: 10, x: 210, y: 330 },
    { id: 11, x: 175, y: 250 }, { id: 12, x: 190, y: 330 },
    { id: 13, x: 215, y: 350 }, { id: 14, x: 185, y: 350 },
    { id: 15, x: 205, y: 68 }, { id: 16, x: 185, y: 68 }, { id: 17, x: 215, y: 72 }, { id: 18, x: 175, y: 72 },
  ],
  run: [
    { id: 0, x: 190, y: 60 }, { id: 1, x: 190, y: 100 },
    { id: 2, x: 230, y: 105 }, { id: 3, x: 290, y: 120 }, { id: 4, x: 330, y: 150 },
    { id: 5, x: 150, y: 110 }, { id: 6, x: 100, y: 150 }, { id: 7, x: 70, y: 200 },
    { id: 8, x: 190, y: 160 }, { id: 9, x: 240, y: 230 }, { id: 10, x: 280, y: 280 },
    { id: 11, x: 150, y: 240 }, { id: 12, x: 120, y: 310 },
    { id: 13, x: 290, y: 295 }, { id: 14, x: 115, y: 325 },
    { id: 15, x: 200, y: 55 }, { id: 16, x: 180, y: 55 }, { id: 17, x: 210, y: 60 }, { id: 18, x: 170, y: 60 },
  ],
  sit: [
    { id: 0, x: 200, y: 60 }, { id: 1, x: 200, y: 100 },
    { id: 2, x: 230, y: 105 }, { id: 3, x: 270, y: 140 }, { id: 4, x: 290, y: 180 },
    { id: 5, x: 170, y: 105 }, { id: 6, x: 130, y: 140 }, { id: 7, x: 110, y: 180 },
    { id: 8, x: 200, y: 160 }, { id: 9, x: 240, y: 220 }, { id: 10, x: 260, y: 230 },
    { id: 11, x: 160, y: 220 }, { id: 12, x: 140, y: 230 },
    { id: 13, x: 260, y: 240 }, { id: 14, x: 140, y: 240 },
    { id: 15, x: 210, y: 55 }, { id: 16, x: 190, y: 55 }, { id: 17, x: 220, y: 60 }, { id: 18, x: 180, y: 60 },
  ],
  point: [
    { id: 0, x: 200, y: 70 }, { id: 1, x: 200, y: 110 },
    { id: 2, x: 240, y: 115 }, { id: 3, x: 290, y: 130 }, { id: 4, x: 350, y: 100 },
    { id: 5, x: 160, y: 115 }, { id: 6, x: 120, y: 145 }, { id: 7, x: 95, y: 185 },
    { id: 8, x: 200, y: 170 }, { id: 9, x: 230, y: 250 }, { id: 10, x: 240, y: 330 },
    { id: 11, x: 170, y: 250 }, { id: 12, x: 160, y: 330 },
    { id: 13, x: 245, y: 350 }, { id: 14, x: 155, y: 350 },
    { id: 15, x: 210, y: 65 }, { id: 16, x: 190, y: 65 }, { id: 17, x: 220, y: 70 }, { id: 18, x: 180, y: 70 },
  ],
}

interface PoseReferenceEditorProps {
  onPoseData: (poseJson: Record<string, unknown>) => void
}

export const PoseReferenceEditor = memo(function PoseReferenceEditor({
  onPoseData,
}: PoseReferenceEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [keypoints, setKeypoints] = useState<Array<{ id: number; name: string; x: number; y: number }>>(BODY_25_KEYPOINTS)
  const [draggedId, setDraggedId] = useState<number | null>(null)
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const W = 400, H = 450

  // ── Draw ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, W, H)

    // Background
    ctx.fillStyle = "#1a1a2e"
    ctx.fillRect(0, 0, W, H)

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.05)"
    ctx.lineWidth = 0.5
    for (let x = 0; x <= W; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
    }
    for (let y = 0; y <= H; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
    }

    // Limbs
    LIMBS.forEach(([startId, endId]) => {
      const start = keypoints.find(p => p.id === startId)
      const end = keypoints.find(p => p.id === endId)
      if (!start || !end) return
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(end.x, end.y)
      ctx.strokeStyle = "#6366f1"
      ctx.lineWidth = 2.5
      ctx.stroke()
    })

    // Keypoints
    keypoints.forEach((point) => {
      const isHovered = point.id === hoveredId
      const isDragged = point.id === draggedId
      ctx.beginPath()
      ctx.arc(point.x, point.y, isDragged ? 7 : isHovered ? 6 : 5, 0, Math.PI * 2)
      ctx.fillStyle = isDragged || isHovered ? "#f59e0b" : "#ef4444"
      ctx.fill()
      ctx.strokeStyle = "#fff"
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Label on hover
      if (isHovered || isDragged) {
        ctx.fillStyle = "#fff"
        ctx.font = "10px sans-serif"
        ctx.fillText(point.name, point.x + 10, point.y - 5)
      }
    })
  }, [keypoints, hoveredId, draggedId])

  // ── Mouse handlers ──────────────────────────────────────────────
  const getCanvasPos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e)
    const found = keypoints.find(p => Math.hypot(p.x - pos.x, p.y - pos.y) < 15)
    if (found) setDraggedId(found.id)
  }, [keypoints, getCanvasPos])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e)
    const found = keypoints.find(p => Math.hypot(p.x - pos.x, p.y - pos.y) < 15)
    setHoveredId(found?.id ?? null)

    if (draggedId !== null) {
      setKeypoints(prev => prev.map(p => p.id === draggedId ? { ...p, x: Math.max(0, Math.min(W, pos.x)), y: Math.max(0, Math.min(H, pos.y)) } : p))
    }
  }, [keypoints, draggedId, getCanvasPos])

  const handleMouseUp = useCallback(() => {
    if (draggedId !== null) {
      // Emit ControlNet-compatible JSON
      const poseData = {
        version: 1.0,
        people: [{
          pose_keypoints_2d: keypoints.flatMap(p => [p.x / W, p.y / H, 0.9]),
          face_keypoints_2d: [],
          hand_left_keypoints_2d: [],
          hand_right_keypoints_2d: [],
        }],
      }
      onPoseData(poseData)
    }
    setDraggedId(null)
  }, [draggedId, keypoints, onPoseData])

  // ── Preset selector ────────────────────────────────────────────
  const applyPreset = useCallback((name: PosePreset) => {
    const preset = POSE_PRESETS[name]
    if (!preset) return
    setKeypoints(prev => prev.map(p => {
      const found = preset.find(pp => pp.id === p.id)
      return found ? { ...p, x: found.x, y: found.y } : p
    }))
  }, [])

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-1 text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>
        <Sparkles size={11} />
        <span>姿势参考 — 拖拽红色关键点调整姿态</span>
      </div>

      {/* Presets */}
      <div className="flex gap-1 flex-wrap">
        {(["tpose", "walk", "run", "sit", "point"] as PosePreset[]).map((name) => (
          <button
            key={name}
            onClick={() => applyPreset(name)}
            className="nodrag rounded-full border px-2 py-0.5 text-[10px] transition-colors hover:bg-white/10"
            style={{ borderColor: DESIGN_TOKENS.border, color: DESIGN_TOKENS.textMuted }}
          >
            {name === "tpose" ? "T  pose" : name === "walk" ? "走路" : name === "run" ? "跑步" : name === "sit" ? "坐姿" : "指物"}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="nodrag rounded-lg w-full cursor-crosshair"
        style={{ maxHeight: 260 }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      <div className="text-[9px] text-center" style={{ color: DESIGN_TOKENS.textMuted }}>
        拖拽红色关节点调整姿势 · 松手后自动输出 ControlNet 格式 JSON
      </div>
    </div>
  )
})

export default PoseReferenceEditor
