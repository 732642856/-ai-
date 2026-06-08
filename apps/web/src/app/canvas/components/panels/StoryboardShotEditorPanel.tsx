/**
 * StoryboardShotEditorPanel — 分镜镜头编辑面板
 * 解析 AI 生成的分镜 JSON，展示为可编辑的镜头卡片
 * 支持：改景别/机位/运镜/情绪，重新生图，保存修改
 * C 路线：Ideogram 4 深度集成 — 分镜数据→JSON 结构化提示→智能生图
 */
"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { X, Save, Sparkles, RefreshCw, ChevronDown, Loader2, Zap, Eye, Play, Square, Mic, Volume2, Video } from "lucide-react"
import { generateVideoFromImage, VideoGenInput } from "../../utils/videoGenerationService"
import { DESIGN_TOKENS, ICON_CONFIG } from "../../styles/designSystem"
import { translateShotToIdeogram } from "@/lib/ai/shot-to-ideogram-prompt"
import { generateVoice, persistTtsAudio, TtsGenerationError } from "../../utils/ttsService"

// === Types ===
export interface EditableShot {
  shotIndex: number
  shotSize: string
  cameraAngle: string
  cameraMovement: string
  emotionalState: string
  shotDescription: string
  visualPrompt: string
  durationEstimate: number
  dialogue?: string           // 台词
  voiceAudioUrl?: string      // 配音结果
  generatedImageUrl?: string  // 新增：生图结果
  videoUrl?: string           // 视频生成结果
}

const SHOT_SIZES = ["EXTREME_WIDE", "WIDE", "MEDIUM", "CLOSE_UP", "EXTREME_CLOSE_UP"]
const CAMERA_ANGLES = ["EYE_LEVEL", "LOW_ANGLE", "HIGH_ANGLE", "OVER_SHOULDER", "TOP_SHOT", "DUTCH_ANGLE"]
const CAMERA_MOVEMENTS = ["STATIC", "PUSH_IN", "PULL_OUT", "PAN", "TILT", "TRACKING", "HANDHELD", "DOLLY", "CRANE", "ZOOM"]
const EMOTIONAL_STATES = ["CALM", "TENSE", "FEAR", "ANGER", "JOY", "SADNESS", "INTIMACY", "SUSPENSE", "REVELATION", "HOPE", "DESPAIR"]

const SHOT_SIZE_LABELS: Record<string, string> = { EXTREME_WIDE: "大远景", WIDE: "全景", MEDIUM: "中景", CLOSE_UP: "特写", EXTREME_CLOSE_UP: "大特写" }
const ANGLE_LABELS: Record<string, string> = { EYE_LEVEL: "平视", LOW_ANGLE: "仰拍", HIGH_ANGLE: "俯拍", OVER_SHOULDER: "过肩", TOP_SHOT: "俯视", DUTCH_ANGLE: "斜角" }
const MOVEMENT_LABELS: Record<string, string> = { STATIC: "固定", PUSH_IN: "推", PULL_OUT: "拉", PAN: "摇", TILT: "俯仰", TRACKING: "跟拍", HANDHELD: "手持", DOLLY: "轨道", CRANE: "升降", ZOOM: "变焦" }
const EMOTION_LABELS: Record<string, string> = { CALM: "平静", TENSE: "紧张", FEAR: "恐惧", ANGER: "愤怒", JOY: "喜悦", SADNESS: "悲伤", INTIMACY: "亲密", SUSPENSE: "悬疑", REVELATION: "揭示", HOPE: "希望", DESPAIR: "绝望" }

function celsiusToLabel(label: string): string {
  return SHOT_SIZE_LABELS[label] || label
}
function angleToLabel(label: string): string {
  return ANGLE_LABELS[label] || label
}

// === Props ===
interface StoryboardShotEditorPanelProps {
  isOpen: boolean
  onClose: () => void
  /** 当前节点中的原始 AI 输出文本 */
  rawContent: string
  /** 保存修改后的内容 */
  onSave: (shots: EditableShot[]) => void
  /** 重新生成 */
  onRegenerate: (prompt: string) => void
  /** 节点的 prompt/content 用于重新生图 */
  nodePrompt: string
}

function parseShots(raw: string): EditableShot[] {
  try {
    // 尝试提取 markdown code block 中的 JSON
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonStr = jsonMatch ? jsonMatch[1] : raw
    const parsed = JSON.parse(jsonStr.trim())
    const arr = Array.isArray(parsed) ? parsed : [parsed]
    return arr.map((shot: any, i: number) => ({
      shotIndex: i + 1,
      shotSize: shot.shotSize || shot.shotType || "MEDIUM",
      cameraAngle: shot.cameraAngle || "EYE_LEVEL",
      cameraMovement: shot.cameraMovement || "STATIC",
      emotionalState: shot.emotionalState || "CALM",
      shotDescription: shot.shotDescription || shot.description || shot.content || "",
      visualPrompt: shot.visualPrompt || shot.prompt || "",
      durationEstimate: shot.durationEstimate || 3,
      dialogue: shot.dialogue || "",
      voiceAudioUrl: shot.voiceAudioUrl || "",
      generatedImageUrl: shot.generatedImageUrl || "",
    }))
  } catch {
    return []
  }
}

// === Selector Dropdown ===
function Selector({
  value, options, labels, onChange, label
}: {
  value: string
  options: string[]
  labels: Record<string, string>
  onChange: (v: string) => void
  label: string
}) {
  return (
    <div className="relative">
      <label className="mb-0.5 block text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border bg-black/40 px-2 py-1.5 text-xs text-white outline-none appearance-none cursor-pointer"
        style={{ borderColor: DESIGN_TOKENS.border }}
      >
        {options.map((opt) => (
          <option key={opt} value={opt} className="bg-[#15151b]">{labels[opt] || opt}</option>
        ))}
      </select>
      <ChevronDown size={12} className="absolute right-2 top-[22px] pointer-events-none" style={{ color: DESIGN_TOKENS.textMuted }} />
    </div>
  )
}

// === Main Component ===
export function StoryboardShotEditorPanel({
  isOpen, onClose, rawContent, onSave, onRegenerate, nodePrompt
}: StoryboardShotEditorPanelProps) {
  const [shots, setShots] = useState<EditableShot[]>([])
  const [editingPrompt, setEditingPrompt] = useState("")
  const [generatingShotIndex, setGeneratingShotIndex] = useState<number | null>(null)
  const [generatingIdeogramIndex, setGeneratingIdeogramIndex] = useState<number | null>(null)
  const [shotImages, setShotImages] = useState<Record<number, string>>({})
  const [ideogramImages, setIdeogramImages] = useState<Record<number, string>>({})
  const [showJsonPreview, setShowJsonPreview] = useState<number | null>(null)
  const [jsonPreviews, setJsonPreviews] = useState<Record<number, string>>({})

  // 批量生图状态
  const [batchGenerating, setBatchGenerating] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 })
  const abortControllerRef = useRef<AbortController | null>(null)

  // 配音状态
  const [generatingVoiceIndex, setGeneratingVoiceIndex] = useState<number | null>(null)
  const [playingVoiceIndex, setPlayingVoiceIndex] = useState<number | null>(null)
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null)

  // 视频生成状态
  const [generatingVideoIndex, setGeneratingVideoIndex] = useState<number | null>(null)
  const [videoProgress, setVideoProgress] = useState<{ percent: number; message: string } | null>(null)
  const [videoUrls, setVideoUrls] = useState<Record<number, string>>({})
  const [videoModel, setVideoModel] = useState<VideoGenInput["viduModel"]>("vidu-q3-turbo-i2v")
  const [videoResolution, setVideoResolution] = useState<VideoGenInput["viduResolution"]>("720P")
  const [videoDuration, setVideoDuration] = useState<number>(5)

  useEffect(() => {
    if (isOpen) {
      const parsed = parseShots(rawContent)
      setShots(parsed)
      setEditingPrompt(nodePrompt || "")
      // 将已有的生图结果读到 shotImages 状态中
      const images: Record<number, string> = {}
      parsed.forEach((shot) => {
        if (shot.generatedImageUrl) {
          images[shot.shotIndex] = shot.generatedImageUrl
        }
      })
      setShotImages(images)
    }
  }, [isOpen, rawContent, nodePrompt])

  const updateShot = useCallback((index: number, field: keyof EditableShot, value: any) => {
    setShots((prev) => prev.map((s) => (s.shotIndex === index ? { ...s, [field]: value } : s)))
  }, [])

  // 单镜头生图
  const handleGenerateImage = useCallback(async (shotIndex: number) => {
    const shot = shots.find((s) => s.shotIndex === shotIndex)
    if (!shot) return
    setGeneratingShotIndex(shotIndex)
    try {
      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: shot.visualPrompt }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "生图失败")
      const imageUrl = data.imageUrl
      if (!imageUrl) throw new Error("未返回图片")
      setShotImages((prev) => ({ ...prev, [shotIndex]: imageUrl }))
      // 同时写回 shot 对象，方便保存
      updateShot(shotIndex, "generatedImageUrl", imageUrl)
    } catch (err: any) {
      alert(`生图失败: ${err.message}`)
    } finally {
      setGeneratingShotIndex(null)
    }
  }, [shots, updateShot])

  // Ideogram 4 结构化生图
  const handleGenerateIdeogram = useCallback(async (shotIndex: number) => {
    const shot = shots.find((s) => s.shotIndex === shotIndex)
    if (!shot) return
    setGeneratingIdeogramIndex(shotIndex)
    try {
      // 1. 翻译分镜数据为 Ideogram JSON
      const payload = translateShotToIdeogram(shot)
      // 缓存 JSON 预览
      setJsonPreviews((prev) => ({ ...prev, [shotIndex]: payload.json_prompt }))

      // 2. 调用 Ideogram API
      const res = await fetch("/api/ai/generate-image-ideogram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonPrompt: payload.json_prompt,
          width: payload.width,
          height: payload.height,
          samplerPreset: payload.sampler_preset,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Ideogram 生图失败")
      const imageUrl = data.imageUrl
      if (!imageUrl) throw new Error("未返回图片")
      setIdeogramImages((prev) => ({ ...prev, [shotIndex]: imageUrl }))
      updateShot(shotIndex, "generatedImageUrl", imageUrl)
    } catch (err: any) {
      alert(`Ideogram 生图失败: ${err.message}`)
    } finally {
      setGeneratingIdeogramIndex(null)
    }
  }, [shots, updateShot])

  // 批量生图（所有镜头依次生成）
  const handleBatchGenerate = useCallback(async (useIdeogram: boolean = false) => {
    if (shots.length === 0) return
    setBatchGenerating(true)
    setBatchProgress({ current: 0, total: shots.length })
    abortControllerRef.current = new AbortController()

    for (let i = 0; i < shots.length; i++) {
      if (abortControllerRef.current.signal.aborted) break
      const shot = shots[i]
      setBatchProgress({ current: i + 1, total: shots.length })

      try {
        if (useIdeogram) {
          // Ideogram 批量生图
          const payload = translateShotToIdeogram(shot)
          const res = await fetch("/api/ai/generate-image-ideogram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonPrompt: payload.json_prompt,
              width: payload.width,
              height: payload.height,
            }),
            signal: abortControllerRef.current.signal,
          })
          const data = await res.json()
          if (data.imageUrl) {
            setIdeogramImages((prev) => ({ ...prev, [shot.shotIndex]: data.imageUrl }))
            updateShot(shot.shotIndex, "generatedImageUrl", data.imageUrl)
          }
        } else {
          // 普通批量生图
          const res = await fetch("/api/ai/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: shot.visualPrompt }),
            signal: abortControllerRef.current.signal,
          })
          const data = await res.json()
          if (data.imageUrl) {
            setShotImages((prev) => ({ ...prev, [shot.shotIndex]: data.imageUrl }))
            updateShot(shot.shotIndex, "generatedImageUrl", data.imageUrl)
          }
        }
      } catch (err: any) {
        if (err.name === "AbortError") break
        console.error(`批量生图失败 镜头#${shot.shotIndex}:`, err)
      }
    }

    setBatchGenerating(false)
    setBatchProgress({ current: 0, total: 0 })
    abortControllerRef.current = null
  }, [shots, updateShot])

  const handleCancelBatch = useCallback(() => {
    abortControllerRef.current?.abort()
    setBatchGenerating(false)
    setBatchProgress({ current: 0, total: 0 })
  }, [])

  // ---- 单镜头配音 ----
  const handleGenerateVoice = useCallback(async (shotIndex: number) => {
    const shot = shots.find((s) => s.shotIndex === shotIndex)
    if (!shot) return
    const text = shot.dialogue?.trim()
    if (!text) {
      alert("该镜头没有台词，请先填写台词")
      return
    }

    setGeneratingVoiceIndex(shotIndex)
    try {
      const result = await generateVoice({
        text,
        instruct: undefined,
        emotion: EMOTION_LABELS[shot.emotionalState] || undefined,
        speed: 1.0,
      })
      const persisted = await persistTtsAudio(result.audioBlob, {
        fileName: `shot-voice-${shotIndex}-${Date.now()}.wav`,
      })
      updateShot(shotIndex, "voiceAudioUrl", persisted.objectUrl)
    } catch (err: any) {
      const message = err instanceof TtsGenerationError ? err.message : `配音失败：${err?.message || "未知错误"}`
      alert(message)
    } finally {
      setGeneratingVoiceIndex(null)
    }
  }, [shots])

  // ---- 单镜头视频生成 (Vidu) ----
  const handleGenerateVideo = useCallback(async (shotIndex: number) => {
    const shot = shots.find((s) => s.shotIndex === shotIndex)
    if (!shot) return
    const imageUrl = shotImages[shotIndex] || shot.generatedImageUrl
    if (!imageUrl) {
      alert("请先生成分镜图，再生成视频")
      return
    }

    setGeneratingVideoIndex(shotIndex)
    setVideoProgress({ percent: 5, message: "正在提交视频生成任务..." })
    try {
      const result = await generateVideoFromImage(
        {
          imageUrl,
          motionPrompt: shot.visualPrompt,
          durationSeconds: videoDuration,
          backend: "vidu",
          viduModel: videoModel,
          viduResolution: videoResolution,
        },
        (progress) => {
          setVideoProgress({
            percent: progress.percent,
            message: progress.message,
          })
        }
      )
      setVideoUrls((prev) => ({ ...prev, [shotIndex]: result.videoUrl }))
      updateShot(shotIndex, "videoUrl", result.videoUrl)
      setVideoProgress(null)
    } catch (err: any) {
      const message = err?.message || "视频生成失败"
      alert(`视频生成失败: ${message}`)
      setVideoProgress(null)
    } finally {
      setGeneratingVideoIndex(null)
    }
  }, [shots, shotImages, videoModel, videoResolution, videoDuration, updateShot])

  // ---- 播放 / 停止配音 ----
  const handlePlayVoice = useCallback((shotIndex: number, url: string) => {
    if (playingVoiceIndex === shotIndex && voiceAudioRef.current) {
      voiceAudioRef.current.pause()
      voiceAudioRef.current.currentTime = 0
      voiceAudioRef.current = null
      setPlayingVoiceIndex(null)
      return
    }
    if (voiceAudioRef.current) {
      voiceAudioRef.current.pause()
      voiceAudioRef.current.currentTime = 0
    }
    const audio = new Audio(url)
    audio.onended = () => setPlayingVoiceIndex(null)
    audio.onerror = () => setPlayingVoiceIndex(null)
    audio.play().catch(() => setPlayingVoiceIndex(null))
    voiceAudioRef.current = audio
    setPlayingVoiceIndex(shotIndex)
  }, [playingVoiceIndex])

  const handleSave = () => {
    onSave(shots)
    onClose()
  }

  if (!isOpen) return null
  if (typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={onClose} />
      <div className="relative z-10 w-[680px] max-h-[85vh] overflow-hidden rounded-2xl border flex flex-col"
        style={{ backgroundColor: DESIGN_TOKENS.panelSolid, borderColor: DESIGN_TOKENS.border }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0" style={{ borderColor: DESIGN_TOKENS.border }}>
          <h3 className="text-sm font-medium" style={{ color: DESIGN_TOKENS.text }}>
            分镜镜头编辑 {shots.length > 0 && <span className="text-xs" style={{ color: DESIGN_TOKENS.textMuted }}>({shots.length} 个镜头)</span>}
          </h3>
          <div className="flex items-center gap-2">
            {/* 批量生图按钮 + 视频配置 */}
            {!batchGenerating ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleBatchGenerate(false)}
                  disabled={shots.length === 0}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-medium transition-colors disabled:opacity-40"
                  style={{ backgroundColor: "rgba(99, 102, 241, 0.12)", color: "rgb(129, 140, 248)" }}
                  title="批量生图（普通）"
                >
                  <Play size={10} strokeWidth={1.5} />
                  批量生图
                </button>
                <button
                  onClick={() => handleBatchGenerate(true)}
                  disabled={shots.length === 0}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-medium transition-colors disabled:opacity-40"
                  style={{ backgroundColor: "rgba(139, 92, 246, 0.12)", color: "rgb(167, 139, 250)" }}
                  title="批量生图（Ideogram 4）"
                >
                  <Zap size={10} strokeWidth={1.5} />
                  批量 Ideogram
                </button>
                {/* Vidu 模型配置 */}
                <select
                  value={videoModel}
                  onChange={(e) => setVideoModel(e.target.value as VideoGenInput["viduModel"])}
                  className="rounded-lg px-1.5 py-1 text-[9px] bg-black/40 border outline-none cursor-pointer"
                  style={{ borderColor: DESIGN_TOKENS.border, color: DESIGN_TOKENS.textMuted }}
                  title="视频模型"
                >
                  <option value="vidu-q3-turbo-i2v">Vidu Q3 Turbo</option>
                  <option value="vidu-q3-pro-i2v">Vidu Q3 Pro</option>
                  <option value="vidu-q2-turbo-i2v">Vidu Q2 Turbo</option>
                  <option value="vidu-q2-pro-i2v">Vidu Q2 Pro</option>
                </select>
                <select
                  value={videoResolution}
                  onChange={(e) => setVideoResolution(e.target.value as VideoGenInput["viduResolution"])}
                  className="rounded-lg px-1.5 py-1 text-[9px] bg-black/40 border outline-none cursor-pointer"
                  style={{ borderColor: DESIGN_TOKENS.border, color: DESIGN_TOKENS.textMuted }}
                  title="分辨率"
                >
                  <option value="540P">540P</option>
                  <option value="720P">720P</option>
                  <option value="1080P">1080P</option>
                </select>
                <select
                  value={videoDuration}
                  onChange={(e) => setVideoDuration(Number(e.target.value))}
                  className="rounded-lg px-1.5 py-1 text-[9px] bg-black/40 border outline-none cursor-pointer"
                  style={{ borderColor: DESIGN_TOKENS.border, color: DESIGN_TOKENS.textMuted }}
                  title="时长"
                >
                  <option value={4}>4s</option>
                  <option value={5}>5s</option>
                  <option value={8}>8s</option>
                  <option value={10}>10s</option>
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <Loader2 size={12} strokeWidth={1.5} className="animate-spin" style={{ color: DESIGN_TOKENS.accent }} />
                  <span className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>
                    {batchProgress.current} / {batchProgress.total}
                  </span>
                </div>
                {/* 进度条 */}
                <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${batchProgress.total > 0 ? (batchProgress.current / batchProgress.total) * 100 : 0}%`,
                      backgroundColor: DESIGN_TOKENS.accent,
                    }}
                  />
                </div>
                <button
                  onClick={handleCancelBatch}
                  className="flex items-center gap-0.5 rounded-lg px-1.5 py-0.5 text-[9px] font-medium transition-colors hover:bg-white/10"
                  style={{ color: "rgb(248, 113, 113)" }}
                >
                  <Square size={8} strokeWidth={1.5} />
                  取消
                </button>
              </div>
            )}
            <button onClick={onClose} className="rounded-lg p-1 transition-colors hover:bg-white/10">
              <X size={16} strokeWidth={ICON_CONFIG.strokeWidth} style={{ color: DESIGN_TOKENS.textMuted }} />
            </button>
          </div>
        </div>

        {/* Shot List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {shots.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm" style={{ color: DESIGN_TOKENS.textMuted }}>无法解析分镜数据</p>
              <p className="text-xs mt-2" style={{ color: DESIGN_TOKENS.textMuted }}>请先运行分镜节点生成分镜内容</p>
            </div>
          ) : (
            shots.map((shot) => (
              <div key={shot.shotIndex}
                className="rounded-xl border p-4 space-y-3"
                style={{ borderColor: DESIGN_TOKENS.border, backgroundColor: DESIGN_TOKENS.card }}
              >
                {/* Shot header */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: DESIGN_TOKENS.accentSoft, color: DESIGN_TOKENS.accent }}>
                    镜头 #{shot.shotIndex}
                  </span>
                  <span className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>
                    {shot.durationEstimate.toFixed(1)}s
                  </span>
                </div>

                {/* Description */}
                <textarea
                  value={shot.shotDescription}
                  onChange={(e) => updateShot(shot.shotIndex, "shotDescription", e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border bg-black/40 px-2.5 py-1.5 text-xs text-white outline-none resize-none"
                  style={{ borderColor: DESIGN_TOKENS.border }}
                />

                {/* Dialogue / 台词 */}
                <div>
                  <label className="mb-0.5 block text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>台词 / 对白</label>
                  <textarea
                    value={shot.dialogue || ""}
                    onChange={(e) => updateShot(shot.shotIndex, "dialogue", e.target.value)}
                    rows={1}
                    className="w-full rounded-lg border bg-black/40 px-2.5 py-1.5 text-xs text-white outline-none resize-none"
                    style={{ borderColor: DESIGN_TOKENS.border }}
                    placeholder="输入该镜头的台词..."
                  />
                </div>

                {/* Selectors */}
                <div className="grid grid-cols-4 gap-2">
                  <Selector label="景别" value={shot.shotSize} options={SHOT_SIZES} labels={SHOT_SIZE_LABELS}
                    onChange={(v) => updateShot(shot.shotIndex, "shotSize", v)} />
                  <Selector label="机位" value={shot.cameraAngle} options={CAMERA_ANGLES} labels={ANGLE_LABELS}
                    onChange={(v) => updateShot(shot.shotIndex, "cameraAngle", v)} />
                  <Selector label="运镜" value={shot.cameraMovement} options={CAMERA_MOVEMENTS} labels={MOVEMENT_LABELS}
                    onChange={(v) => updateShot(shot.shotIndex, "cameraMovement", v)} />
                  <Selector label="情绪" value={shot.emotionalState} options={EMOTIONAL_STATES} labels={EMOTION_LABELS}
                    onChange={(v) => updateShot(shot.shotIndex, "emotionalState", v)} />
                </div>

                {/* Visual Prompt */}
                <div>
                  <label className="mb-0.5 block text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>生图 Prompt</label>
                  <textarea
                    value={shot.visualPrompt}
                    onChange={(e) => updateShot(shot.shotIndex, "visualPrompt", e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border bg-black/40 px-2.5 py-1.5 text-xs text-white outline-none resize-none"
                    style={{ borderColor: DESIGN_TOKENS.border }}
                  />
                </div>

                {/* 生图 + 配音 + 视频按钮 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleGenerateImage(shot.shotIndex)}
                    disabled={generatingShotIndex === shot.shotIndex}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                    style={{ backgroundColor: "rgba(99, 102, 241, 0.15)", color: "rgb(129, 140, 248)" }}
                  >
                    {generatingShotIndex === shot.shotIndex ? (
                      <>
                        <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
                        生图中...
                      </>
                    ) : (
                      <>
                        <Sparkles size={12} strokeWidth={1.5} />
                        重新生图
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleGenerateVoice(shot.shotIndex)}
                    disabled={generatingVoiceIndex === shot.shotIndex || !shot.dialogue?.trim()}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                    style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "rgb(52, 211, 153)" }}
                  >
                    {generatingVoiceIndex === shot.shotIndex ? (
                      <>
                        <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
                        配音中...
                      </>
                    ) : (
                      <>
                        <Mic size={12} strokeWidth={1.5} />
                        生成配音
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleGenerateVideo(shot.shotIndex)}
                    disabled={generatingVideoIndex === shot.shotIndex || !(shotImages[shot.shotIndex] || shot.generatedImageUrl)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                    style={{ backgroundColor: "rgba(234, 88, 12, 0.15)", color: "rgb(251, 146, 60)" }}
                  >
                    {generatingVideoIndex === shot.shotIndex ? (
                      <>
                        <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
                        视频中...
                      </>
                    ) : (
                      <>
                        <Video size={12} strokeWidth={1.5} />
                        生成视频
                      </>
                    )}
                  </button>
                  {shot.voiceAudioUrl && (
                    <button
                      onClick={() => handlePlayVoice(shot.shotIndex, shot.voiceAudioUrl!)}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] transition-colors hover:bg-white/5"
                      style={{ borderColor: DESIGN_TOKENS.border, color: DESIGN_TOKENS.textSecondary }}
                    >
                      {playingVoiceIndex === shot.shotIndex ? <Square size={10} /> : <Volume2 size={10} />}
                      {playingVoiceIndex === shot.shotIndex ? "停止" : "播放"}
                    </button>
                  )}
                  {(shotImages[shot.shotIndex] || shot.generatedImageUrl) && (
                    <span className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>图片已生成</span>
                  )}
                  {(videoUrls[shot.shotIndex] || shot.videoUrl) && (
                    <span className="text-[10px]" style={{ color: "rgb(251, 146, 60)" }}>视频已生成</span>
                  )}
                </div>

                {/* 视频生成进度 */}
                {generatingVideoIndex === shot.shotIndex && videoProgress && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px]" style={{ color: "rgb(251, 146, 60)" }}>{videoProgress.message}</span>
                      <span className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>{videoProgress.percent}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${videoProgress.percent}%`,
                          backgroundColor: "rgb(251, 146, 60)",
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* 图片预览 */}
                {(shotImages[shot.shotIndex] || shot.generatedImageUrl) && (
                  <div className="rounded-lg overflow-hidden border" style={{ borderColor: DESIGN_TOKENS.border }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={shotImages[shot.shotIndex] || shot.generatedImageUrl}
                      alt={`镜头 ${shot.shotIndex} 生成结果`}
                      className="w-full h-auto max-h-48 object-cover"
                    />
                  </div>
                )}

                {/* 视频预览 */}
                {(videoUrls[shot.shotIndex] || shot.videoUrl) && (
                  <div className="rounded-lg overflow-hidden border" style={{ borderColor: "rgba(234, 88, 12, 0.4)" }}>
                    <div className="px-2 py-0.5 text-[9px] font-medium flex items-center justify-between"
                      style={{ backgroundColor: "rgba(234, 88, 12, 0.15)", color: "rgb(251, 146, 60)" }}>
                      <span>Vidu 视频生成结果</span>
                      <span className="text-[9px]" style={{ color: DESIGN_TOKENS.textMuted }}>{videoDuration}s</span>
                    </div>
                    <video
                      src={videoUrls[shot.shotIndex] || shot.videoUrl}
                      controls
                      className="w-full h-auto max-h-56"
                      preload="metadata"
                    />
                  </div>
                )}

                {/* Ideogram 4 智能生图按钮 */}
                <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: DESIGN_TOKENS.border }}>
                  <button
                    onClick={() => handleGenerateIdeogram(shot.shotIndex)}
                    disabled={generatingIdeogramIndex === shot.shotIndex}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                    style={{ backgroundColor: "rgba(139, 92, 246, 0.15)", color: "rgb(167, 139, 250)" }}
                  >
                    {generatingIdeogramIndex === shot.shotIndex ? (
                      <>
                        <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
                        智能生图中...
                      </>
                    ) : (
                      <>
                        <Zap size={12} strokeWidth={1.5} />
                        Ideogram 4 智能生图
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      if (showJsonPreview === shot.shotIndex) {
                        setShowJsonPreview(null)
                      } else {
                        const payload = translateShotToIdeogram(shot)
                        setJsonPreviews((prev) => ({ ...prev, [shot.shotIndex]: payload.json_prompt }))
                        setShowJsonPreview(shot.shotIndex)
                      }
                    }}
                    className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-colors"
                    style={{ color: DESIGN_TOKENS.textMuted }}
                  >
                    <Eye size={10} strokeWidth={1.5} />
                    {showJsonPreview === shot.shotIndex ? "隐藏 JSON" : "查看 JSON"}
                  </button>
                </div>

                {/* JSON 预览 */}
                {showJsonPreview === shot.shotIndex && jsonPreviews[shot.shotIndex] && (
                  <div className="rounded-lg border p-2 overflow-auto" style={{ borderColor: DESIGN_TOKENS.border, backgroundColor: "rgba(0,0,0,0.4)", maxHeight: "160px" }}>
                    <pre className="text-[9px] font-mono" style={{ color: DESIGN_TOKENS.textMuted, whiteSpace: "pre-wrap" }}>
                      {jsonPreviews[shot.shotIndex]}
                    </pre>
                  </div>
                )}

                {/* Ideogram 生图结果预览 */}
                {ideogramImages[shot.shotIndex] && (
                  <div className="rounded-lg overflow-hidden border" style={{ borderColor: "rgba(139, 92, 246, 0.4)" }}>
                    <div className="px-2 py-0.5 text-[9px] font-medium" style={{ backgroundColor: "rgba(139, 92, 246, 0.15)", color: "rgb(167, 139, 250)" }}>
                      Ideogram 4 生成结果
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ideogramImages[shot.shotIndex]}
                      alt={`镜头 ${shot.shotIndex} Ideogram 生成结果`}
                      className="w-full h-auto max-h-48 object-cover"
                    />
                  </div>
                )}
              </div>
            ))
          )}

          {/* Regenerate prompt */}
          {shots.length > 0 && (
            <div className="rounded-xl border p-3" style={{ borderColor: "rgba(52, 211, 153, 0.2)", backgroundColor: "rgba(16, 185, 129, 0.04)" }}>
              <label className="mb-1 block text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>重新生成提示（可选，用于重新调用 AI 生成分镜）</label>
              <textarea
                value={editingPrompt}
                onChange={(e) => setEditingPrompt(e.target.value)}
                rows={2}
                className="w-full rounded-lg border bg-black/40 px-2.5 py-1.5 text-xs text-white outline-none resize-none mb-2"
                style={{ borderColor: DESIGN_TOKENS.border }}
              />
              <button
                onClick={() => onRegenerate(editingPrompt)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "rgb(52, 211, 153)" }}
              >
                <RefreshCw size={12} strokeWidth={1.5} />
                重新生成分镜
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t shrink-0" style={{ borderColor: DESIGN_TOKENS.border }}>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs transition-colors hover:bg-white/10"
            style={{ color: DESIGN_TOKENS.textMuted }}>关闭</button>
          <button onClick={handleSave}
            className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: DESIGN_TOKENS.accent }}>
            <Save size={12} strokeWidth={1.5} /> 保存修改
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
