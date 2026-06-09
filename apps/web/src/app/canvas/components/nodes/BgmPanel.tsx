"use client"

import { memo, useCallback, useState, useRef, useEffect } from "react"
import {
  Music,
  Play,
  Square,
  Loader2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Volume2,
  Sliders,
} from "lucide-react"
import { DESIGN_TOKENS } from "../../styles/designSystem"
import {
  generateBgm,
  playBgmBlob,
  getMoodLabel,
  getStyleLabel,
  type BgmMood,
  type BgmStyle,
} from "../../utils/bgmGenerator"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BgmPanelProps {
  /** 保存 BGM 到外部 */
  onSaveBgm?: (blob: Blob) => void
  /** 外部传入的 BGM URL (用于播放) */
  bgmUrl?: string
  /** 是否正在生成 */
  isGenerating?: boolean
  /** 生成错误 */
  generationError?: string
}

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

const MOODS: BgmMood[] = ["happy", "sad", "suspense", "epic", "warm", "horror", "calm"]
const STYLES: BgmStyle[] = ["classical", "electronic", "ambient", "cinematic"]

// ---------------------------------------------------------------------------
// 情绪按钮
// ---------------------------------------------------------------------------

function MoodButton({ mood, active, onClick }: {
  mood: BgmMood
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="nodrag nopan shrink-0 rounded-full border px-2.5 py-1 text-[10px] transition-colors"
      style={{
        borderColor: active ? DESIGN_TOKENS.accentHover : DESIGN_TOKENS.border,
        color: active ? DESIGN_TOKENS.accentHover : DESIGN_TOKENS.textMuted,
        backgroundColor: active ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.03)",
      }}
    >
      {getMoodLabel(mood)}
    </button>
  )
}

const MoodButtonMemo = memo(MoodButton)

// ---------------------------------------------------------------------------
// BgmPanel
// ---------------------------------------------------------------------------

export const BgmPanel = memo(function BgmPanel({
  onSaveBgm,
  bgmUrl: externalBgmUrl,
  isGenerating: externalIsGenerating,
  generationError: externalGenerationError,
}: BgmPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [selectedMood, setSelectedMood] = useState<BgmMood>("calm")
  const [selectedStyle, setSelectedStyle] = useState<BgmStyle>("ambient")
  const [duration, setDuration] = useState(30) // 秒
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null)
  const [bgmUrl, setBgmUrl] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const currentBlobUrlRef = useRef<string | null>(null)

  // 使用外部状态（如果有）
  const effectiveIsGenerating = externalIsGenerating ?? isGenerating
  const effectiveError = externalGenerationError ?? localError

  // 清理
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (currentBlobUrlRef.current) {
        URL.revokeObjectURL(currentBlobUrlRef.current)
      }
    }
  }, [])

  // 外部 URL 变化
  useEffect(() => {
    if (externalBgmUrl && externalBgmUrl !== bgmUrl) {
      setBgmUrl(externalBgmUrl)
    }
  }, [externalBgmUrl])

  // ---- 生成 BGM ----
  const handleGenerate = useCallback(async () => {
    setLocalError(null)
    setIsGenerating(true)

    try {
      const blob = await generateBgm({
        mood: selectedMood,
        style: selectedStyle,
        duration,
      })

      // 释放旧 URL
      if (currentBlobUrlRef.current) {
        URL.revokeObjectURL(currentBlobUrlRef.current)
      }

      const url = URL.createObjectURL(blob)
      currentBlobUrlRef.current = url

      setGeneratedBlob(blob)
      setBgmUrl(url)

      // 自动保存到外部
      onSaveBgm?.(blob)
    } catch (err: any) {
      setLocalError(`BGM 生成失败：${err?.message || "未知错误"}`)
    } finally {
      setIsGenerating(false)
    }
  }, [selectedMood, selectedStyle, duration, onSaveBgm])

  // ---- 播放 / 停止 ----
  const handlePlay = useCallback(() => {
    if (!bgmUrl) return

    if (isPlaying && audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlaying(false)
      return
    }

    const audio = new Audio(bgmUrl)
    audio.onended = () => setIsPlaying(false)
    audio.onerror = () => setIsPlaying(false)
    audio.play().catch(() => setIsPlaying(false))
    audioRef.current = audio
    setIsPlaying(true)
  }, [bgmUrl, isPlaying])

  // ---- 删除 ----
  const handleDelete = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setIsPlaying(false)
    setGeneratedBlob(null)
    if (currentBlobUrlRef.current) {
      URL.revokeObjectURL(currentBlobUrlRef.current)
      currentBlobUrlRef.current = null
    }
    setBgmUrl(null)
  }, [])

  // ---- 时长格式化 ----
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}秒`
    const min = Math.floor(seconds / 60)
    const sec = seconds % 60
    return sec > 0 ? `${min}分${sec}秒` : `${min}分钟`
  }

  const hasAudio = Boolean(bgmUrl)

  return (
    <div
      className="space-y-2 rounded-xl border p-2"
      style={{ borderColor: DESIGN_TOKENS.border, backgroundColor: "rgba(255,255,255,0.02)" }}
    >
      {/* Header */}
      <button
        type="button"
        className="flex w-full items-center justify-between text-[10px] transition-colors hover:text-white/60"
        style={{ color: DESIGN_TOKENS.textMuted }}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-1.5">
          <Music size={11} />
          <span>BGM 背景音乐</span>
          {hasAudio && <span style={{ color: DESIGN_TOKENS.accentHover }}>● 已生成</span>}
          {effectiveIsGenerating && <span className="text-amber-300/70">● 生成中</span>}
        </div>
        {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>

      {expanded && (
        <div className="space-y-2.5">
          {/* 情绪选择 */}
          <div className="space-y-0.5">
            <label className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>
              情绪 / Mood
            </label>
            <div className="flex flex-wrap gap-1.5">
              {MOODS.map((mood) => (
                <MoodButtonMemo
                  key={mood}
                  mood={mood}
                  active={selectedMood === mood}
                  onClick={() => setSelectedMood(mood)}
                />
              ))}
            </div>
          </div>

          {/* 风格选择 */}
          <div className="space-y-0.5">
            <label className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>
              风格 / Style
            </label>
            <div className="flex gap-1">
              {STYLES.map((style) => (
                <button
                  key={style}
                  type="button"
                  className="nodrag nopan flex-1 rounded-md border px-2 py-1.5 text-[10px] transition-colors"
                  style={{
                    borderColor:
                      selectedStyle === style ? DESIGN_TOKENS.accentHover : DESIGN_TOKENS.border,
                    color:
                      selectedStyle === style
                        ? DESIGN_TOKENS.accentHover
                        : DESIGN_TOKENS.textMuted,
                    backgroundColor:
                      selectedStyle === style ? "rgba(99,102,241,0.1)" : "transparent",
                  }}
                  onClick={() => setSelectedStyle(style)}
                >
                  {getStyleLabel(style)}
                </button>
              ))}
            </div>
          </div>

          {/* 时长滑条 */}
          <div className="space-y-0.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>
                <Sliders size={9} className="inline mr-1" />
                时长 / Duration
              </label>
              <span className="text-[10px]" style={{ color: DESIGN_TOKENS.textSecondary }}>
                {formatDuration(duration)}
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={120}
              step={1}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="nodrag nopan w-full cursor-pointer accent-slate-400"
              style={{
                height: 4,
                borderRadius: 2,
                backgroundColor: DESIGN_TOKENS.border,
              }}
            />
            <div className="flex justify-between text-[8px]" style={{ color: DESIGN_TOKENS.textMuted }}>
              <span>5秒</span>
              <span>120秒</span>
            </div>
          </div>

          {/* 生成按钮 */}
          <button
            type="button"
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors hover:bg-white/5 disabled:opacity-40"
            style={{
              borderColor: DESIGN_TOKENS.accentHover,
              color: DESIGN_TOKENS.accentHover,
              backgroundColor: "rgba(99,102,241,0.06)",
            }}
            disabled={effectiveIsGenerating}
            onClick={handleGenerate}
          >
            {effectiveIsGenerating ? (
              <>
                <Loader2 size={11} className="animate-spin" />
                <span>生成中...</span>
              </>
            ) : (
              <>
                <Music size={11} />
                <span>{hasAudio ? "重新生成" : "生成 BGM"}</span>
              </>
            )}
          </button>

          {/* 错误提示 */}
          {effectiveError && (
            <div
              className="rounded-lg px-2 py-1.5 text-[10px] text-amber-200/80"
              style={{ backgroundColor: "rgba(245,158,11,0.1)" }}
            >
              {effectiveError}
            </div>
          )}

          {/* 音频控制 */}
          {hasAudio && (
            <div
              className="flex items-center gap-2 rounded-lg border px-2 py-1.5"
              style={{
                borderColor: DESIGN_TOKENS.border,
                backgroundColor: "rgba(255,255,255,0.03)",
              }}
            >
              <button
                type="button"
                className="flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] transition-colors hover:bg-white/5"
                style={{ borderColor: DESIGN_TOKENS.border, color: DESIGN_TOKENS.textSecondary }}
                onClick={handlePlay}
              >
                {isPlaying ? <Square size={10} /> : <Play size={10} />}
                <span>{isPlaying ? "停止" : "播放"}</span>
              </button>
              <span className="flex-1 text-[9px]" style={{ color: DESIGN_TOKENS.textMuted }}>
                {getMoodLabel(selectedMood)} · {getStyleLabel(selectedStyle)} · {formatDuration(duration)}
              </span>
              <button
                type="button"
                className="flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] text-red-300/70 transition-colors hover:bg-red-500/10"
                style={{ borderColor: "rgba(239,68,68,0.2)" }}
                onClick={handleDelete}
              >
                <Trash2 size={10} />
                <span>删除</span>
              </button>
            </div>
          )}

          {/* 信息提示 */}
          <div
            className="rounded-lg px-2 py-1 text-[9px] leading-relaxed"
            style={{ color: DESIGN_TOKENS.textMuted, backgroundColor: "rgba(255,255,255,0.02)" }}
          >
            BGM 在浏览器本地生成，无需网络连接，无需 API Key。支持 WAV 格式导出。
          </div>
        </div>
      )}
    </div>
  )
})

export default BgmPanel
