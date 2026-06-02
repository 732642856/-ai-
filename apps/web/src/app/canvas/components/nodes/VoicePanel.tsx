"use client"

import { memo, useCallback, useState, useRef, useEffect } from "react"
import { Mic, Play, Square, Loader2, Trash2, ChevronDown, ChevronUp, Volume2, Sparkles } from "lucide-react"
import { DESIGN_TOKENS } from "../../styles/designSystem"
import type { VoiceConfig, VoiceGenerationStatus, StoryboardShotData } from "../canvas/types"
import {
  generateTtsAudio,
  persistTtsAudio,
  TtsGenerationError,
  voiceDescriptionToInstruct,
  inferVoiceDescriptionFromShot,
  VOICE_QUICK_TAGS,
  type VoiceQuickTag,
} from "../../utils/ttsService"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface VoicePanelProps {
  nodeId: string
  shot?: StoryboardShotData
  dialogue?: string
  voiceConfig?: VoiceConfig
  voiceAudioUrl?: string
  voiceGenerationStatus?: VoiceGenerationStatus
  voiceGenerationError?: string
  onUpdateShot: (patch: Partial<StoryboardShotData>) => void
}

// ---------------------------------------------------------------------------
// Quick Tag Pill
// ---------------------------------------------------------------------------

function QuickTagPill({ tag, active, onClick }: {
  tag: VoiceQuickTag
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="nodrag nopan shrink-0 rounded-full border px-2 py-0.5 text-[10px] transition-colors"
      style={{
        borderColor: active ? DESIGN_TOKENS.accentHover : DESIGN_TOKENS.border,
        color: active ? DESIGN_TOKENS.accentHover : DESIGN_TOKENS.textMuted,
        backgroundColor: active ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.03)",
      }}
    >
      {tag.label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// VoicePanel
// ---------------------------------------------------------------------------

export const VoicePanel = memo(function VoicePanel({
  nodeId,
  shot,
  dialogue,
  voiceConfig,
  voiceAudioUrl,
  voiceGenerationStatus,
  voiceGenerationError,
  onUpdateShot,
}: VoicePanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // 核心状态：台词 + 声音描述（自然语言）
  const [ttsText, setTtsText] = useState(voiceConfig?.text || dialogue || "")
  const [voiceDesc, setVoiceDesc] = useState(() => {
    // 已有配置优先；否则用剧情上下文自动推荐
    if (voiceConfig?.instruct) return voiceConfig.instruct
    return inferVoiceDescriptionFromShot(shot).description
  })

  // 追踪已激活的 quick tags
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())

  const isGenerating = voiceGenerationStatus === "generating"
  const hasAudio = Boolean(voiceAudioUrl)
  const error = localError || voiceGenerationError

  // Voice Director 轻量规则版：从剧情/镜头/台词自动推荐表演声线
  const voiceSuggestion = inferVoiceDescriptionFromShot(shot)

  // Sync dialogue to ttsText when it changes externally
  useEffect(() => {
    if (dialogue && !ttsText) {
      setTtsText(dialogue)
    }
  }, [dialogue])

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  // ---- Quick tag click handler ----
  const handleTagClick = useCallback((tag: VoiceQuickTag) => {
    setVoiceDesc((prev) => {
      const tagValue = tag.value
      // 如果已经包含这个标签值，移除它
      if (prev.includes(tagValue)) {
        setActiveTags((s) => { const n = new Set(s); n.delete(tag.value); return n })
        return prev
          .replace(new RegExp(`\\s*${tagValue}\\s*`), " ")
          .replace(/,\s*,/g, ",")
          .replace(/^,|,$/g, "")
          .trim()
      }
      // 否则追加
      setActiveTags((s) => { const n = new Set(s); n.add(tag.value); return n })
      if (!prev.trim()) return tagValue
      return `${prev}，${tagValue}`
    })
  }, [])

  // ---- Apply suggestion ----
  const handleApplySuggestion = useCallback(() => {
    setVoiceDesc(voiceSuggestion.description)
  }, [voiceSuggestion.description])

  // ---- Generate ----
  const handleGenerate = useCallback(async () => {
    if (!ttsText.trim()) {
      setLocalError("请输入要合成的台词")
      return
    }

    setLocalError(null)

    // 从自然语言描述构建 instruct
    const instruct = voiceDescriptionToInstruct(voiceDesc)

    const newVoiceConfig: VoiceConfig = {
      mode: instruct ? "design" : "auto",
      text: ttsText.trim(),
      instruct: instruct || undefined,
      speed: 1.0,
    }

    // Update node state to generating
    onUpdateShot({
      voiceConfig: newVoiceConfig,
      voiceGenerationStatus: "generating",
      voiceGenerationError: undefined,
    })

    try {
      const result = await generateTtsAudio({
        text: ttsText.trim(),
        voiceConfig: newVoiceConfig,
      })

      // Persist to IndexedDB
      const persisted = await persistTtsAudio(result.audioBlob, {
        fileName: `voice-${nodeId}-${Date.now()}.wav`,
      })

      onUpdateShot({
        voiceConfig: newVoiceConfig,
        voiceAudioUrl: persisted.objectUrl,
        voiceAudioAssetId: persisted.assetId,
        voiceGenerationStatus: "succeeded",
        voiceGenerationError: undefined,
      })
    } catch (err: any) {
      const message = err instanceof TtsGenerationError
        ? err.message
        : `语音合成失败：${err?.message || "未知错误"}`
      onUpdateShot({
        voiceGenerationStatus: "failed",
        voiceGenerationError: message,
      })
    }
  }, [ttsText, voiceDesc, nodeId, onUpdateShot])

  // ---- Play / Stop ----
  const handlePlay = useCallback(() => {
    if (!voiceAudioUrl) return
    if (isPlaying && audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlaying(false)
      return
    }
    const audio = new Audio(voiceAudioUrl)
    audio.onended = () => setIsPlaying(false)
    audio.onerror = () => setIsPlaying(false)
    audio.play().catch(() => setIsPlaying(false))
    audioRef.current = audio
    setIsPlaying(true)
  }, [voiceAudioUrl, isPlaying])

  // ---- Delete ----
  const handleDelete = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setIsPlaying(false)
    onUpdateShot({
      voiceAudioUrl: undefined,
      voiceAudioAssetId: undefined,
      voiceGenerationStatus: undefined,
      voiceGenerationError: undefined,
      voiceConfig: undefined,
    })
  }, [onUpdateShot])

  // ---- Preview instruct (显示解析结果) ----
  const previewInstruct = voiceDesc.trim()
    ? voiceDescriptionToInstruct(voiceDesc)
    : ""

  return (
    <div className="space-y-2 rounded-xl border p-2" style={{ borderColor: DESIGN_TOKENS.border, backgroundColor: "rgba(255,255,255,0.02)" }}>
      {/* Header */}
      <button
        type="button"
        className="flex w-full items-center justify-between text-[10px] transition-colors hover:text-white/60"
        style={{ color: DESIGN_TOKENS.textMuted }}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-1.5">
          <Mic size={11} />
          <span>4. AI 配音</span>
          {hasAudio && <span style={{ color: DESIGN_TOKENS.accentHover }}>● 已配音</span>}
          {isGenerating && <span className="text-amber-300/70">● 生成中</span>}
        </div>
        {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>

      {expanded && (
        <div className="space-y-2.5">
          {/* 台词输入 */}
          <div className="space-y-0.5">
            <label className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>台词</label>
            <textarea
              value={ttsText}
              onChange={(e) => setTtsText(e.target.value)}
              className="nodrag nopan nowheel w-full resize-none rounded-lg border bg-transparent px-2 py-1.5 text-[11px] leading-relaxed text-white/70 placeholder:text-white/25 outline-none"
              style={{ borderColor: DESIGN_TOKENS.border, minHeight: 40 }}
              placeholder="输入要合成的台词文本..."
            />
          </div>

          {/* 声音描述 — 核心自然语言输入 */}
          <div className="space-y-0.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>声音描述</label>
              {voiceSuggestion.description && voiceDesc !== voiceSuggestion.description && (
                <button
                  type="button"
                  className="flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] transition-colors hover:bg-white/5"
                  style={{ borderColor: DESIGN_TOKENS.accentHover, color: DESIGN_TOKENS.accentHover }}
                  onClick={handleApplySuggestion}
                >
                  <Sparkles size={8} />
                  使用剧情推荐
                </button>
              )}
            </div>
            <div className="rounded-lg border px-2 py-1.5" style={{ borderColor: "rgba(99,102,241,0.25)", backgroundColor: "rgba(99,102,241,0.06)" }}>
              <div className="mb-1 flex items-center gap-1 text-[9px]" style={{ color: DESIGN_TOKENS.accentHover }}>
                <Sparkles size={9} />
                <span>剧情推荐：{voiceSuggestion.description}</span>
              </div>
              <div className="text-[9px] leading-3" style={{ color: DESIGN_TOKENS.textMuted }}>
                {voiceSuggestion.reason}
              </div>
            </div>
            <input
              type="text"
              value={voiceDesc}
              onChange={(e) => setVoiceDesc(e.target.value)}
              className="nodrag nopan w-full rounded-lg border bg-transparent px-2 py-1.5 text-[11px] text-white/70 placeholder:text-white/25 outline-none"
              style={{ borderColor: DESIGN_TOKENS.border }}
              placeholder="一句话微调：更疲惫一点、压低声音、像刚哭过..."
            />
            {/* 解析预览 */}
            {previewInstruct && voiceDesc.trim() && (
              <div className="text-[9px] leading-3" style={{ color: "rgba(99,102,241,0.6)" }}>
                → {previewInstruct}
              </div>
            )}
          </div>

          {/* 快捷标签 */}
          <div className="space-y-1">
            <div className="text-[9px]" style={{ color: DESIGN_TOKENS.textMuted }}>快捷选择</div>
            <div className="flex flex-wrap gap-1">
              {VOICE_QUICK_TAGS.map((tag) => (
                <QuickTagPill
                  key={tag.value}
                  tag={tag}
                  active={activeTags.has(tag.value) || voiceDesc.includes(tag.value)}
                  onClick={() => handleTagClick(tag)}
                />
              ))}
            </div>
          </div>

          {/* 合成按钮 */}
          <button
            type="button"
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors hover:bg-white/5 disabled:opacity-40"
            style={{
              borderColor: DESIGN_TOKENS.accentHover,
              color: DESIGN_TOKENS.accentHover,
              backgroundColor: "rgba(99,102,241,0.06)",
            }}
            disabled={isGenerating || !ttsText.trim()}
            onClick={handleGenerate}
          >
            {isGenerating ? (
              <>
                <Loader2 size={11} className="animate-spin" />
                <span>合成中...</span>
              </>
            ) : (
              <>
                <Volume2 size={11} />
                <span>{hasAudio ? "重新合成" : "合成配音"}</span>
              </>
            )}
          </button>

          {/* 错误提示 */}
          {error && (
            <div className="rounded-lg px-2 py-1.5 text-[10px] text-amber-200/80" style={{ backgroundColor: "rgba(245,158,11,0.1)" }}>
              {error}
            </div>
          )}

          {/* 音频播放/删除 */}
          {hasAudio && (
            <div className="flex items-center gap-2 rounded-lg border px-2 py-1.5" style={{ borderColor: DESIGN_TOKENS.border, backgroundColor: "rgba(255,255,255,0.03)" }}>
              <button
                type="button"
                className="flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] transition-colors hover:bg-white/5"
                style={{ borderColor: DESIGN_TOKENS.border, color: DESIGN_TOKENS.textSecondary }}
                onClick={handlePlay}
              >
                {isPlaying ? <Square size={10} /> : <Play size={10} />}
                <span>{isPlaying ? "停止" : "播放"}</span>
              </button>
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
        </div>
      )}
    </div>
  )
})

export default VoicePanel
