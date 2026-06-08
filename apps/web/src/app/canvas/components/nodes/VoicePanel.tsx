"use client"

import { memo, useCallback, useState, useRef, useEffect } from "react"
import { Mic, Play, Square, Loader2, Trash2, ChevronDown, ChevronUp, Volume2, Sparkles, Upload, Copy, User, Wand2 } from "lucide-react"
import { DESIGN_TOKENS } from "../../styles/designSystem"
import type { VoiceConfig, VoiceGenerationStatus, StoryboardShotData, VoiceProfile } from "../canvas/types"
import {
  generateTtsAudio,
  generateVoice,
  persistTtsAudio,
  TtsGenerationError,
  voiceDescriptionToInstruct,
  inferVoiceDescriptionFromShot,
  lookupCharacterVoiceProfile,
  registerVoiceClone,
  listVoiceProfiles,
  invalidateProfileCache,
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 模式切换：design（Voice Design）= 自然语言描述，clone（Voice Clone）= 上传参考音频
  // P1-3: 如果角色的声线档案已经 ready，自动切换到 clone 模式
  const characterProfile = lookupCharacterVoiceProfile(shot?.characterIdentities)
  const autoCloneReady = characterProfile !== null

  const [mode, setMode] = useState<"design" | "clone">(
    voiceConfig?.mode === "clone" || autoCloneReady ? "clone" : "design"
  )

  // 核心状态：台词 + 声音描述（自然语言）
  const [ttsText, setTtsText] = useState(voiceConfig?.text || dialogue || "")
  const [voiceDesc, setVoiceDesc] = useState(() => {
    if (voiceConfig?.instruct) return voiceConfig.instruct
    return inferVoiceDescriptionFromShot(shot).description
  })

  // Clone-specific state
  const [refAudioFile, setRefAudioFile] = useState<File | null>(null)
  const [refText, setRefText] = useState(voiceConfig?.refText || "")
  // P1-3: 自动从角色档案获取已注册的 profile ID
  const [registeredProfileId, setRegisteredProfileId] = useState<string | null>(
    voiceConfig?.refAudioId || characterProfile?.profileId || null
  )
  const [isRegistering, setIsRegistering] = useState(false)
  const [cloneStatus, setCloneStatus] = useState<"idle" | "uploading" | "registering" | "ready" | "failed">(
    voiceConfig?.refAudioId || characterProfile?.profileId ? "ready" : "idle"
  )

  // 追踪已激活的 quick tags
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())

  // 情感 / 语气选择
  const [emotion, setEmotion] = useState<string>("")

  // 已注册声线档案列表（用于手动选择）
  const [allProfiles, setAllProfiles] = useState<VoiceProfile[]>([])
  const [profilesLoading, setProfilesLoading] = useState(false)

  // 加载所有已注册 profile
  useEffect(() => {
    if (mode === "clone") {
      setProfilesLoading(true)
      listVoiceProfiles()
        .then((profiles) => setAllProfiles(profiles))
        .catch(() => setAllProfiles([]))
        .finally(() => setProfilesLoading(false))
    }
  }, [mode, cloneStatus])

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
      if (prev.includes(tagValue)) {
        setActiveTags((s) => { const n = new Set(s); n.delete(tag.value); return n })
        return prev
          .replace(new RegExp(`\\s*${tagValue}\\s*`), " ")
          .replace(/,\s*,/g, ",")
          .replace(/^,|,$/g, "")
          .trim()
      }
      setActiveTags((s) => { const n = new Set(s); n.add(tag.value); return n })
      if (!prev.trim()) return tagValue
      return `${prev}，${tagValue}`
    })
  }, [])

  // ---- Apply suggestion ----
  const handleApplySuggestion = useCallback(() => {
    setVoiceDesc(voiceSuggestion.description)
  }, [voiceSuggestion.description])

  // ---- File upload handler ----
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith("audio/")) {
        setLocalError("请选择音频文件（WAV、MP3 等）")
        return
      }
      if (file.size > 20 * 1024 * 1024) {
        setLocalError("音频文件不能超过 20MB")
        return
      }
      setLocalError(null)
      setRefAudioFile(file)
      setCloneStatus("uploading")
    }
  }, [])

  // ---- Register clone voice ----
  const handleRegisterClone = useCallback(async () => {
    if (!refAudioFile) {
      setLocalError("请先选择参考音频")
      return
    }

    setLocalError(null)
    setIsRegistering(true)
    setCloneStatus("registering")

    try {
      // Derive character info from shot context
      const characterId = shot?.characterIdentities?.[0]?.id || `char-${nodeId}`
      const characterName = shot?.characterIdentities?.[0]?.name || "未命名角色"

      const result = await registerVoiceClone({
        audioFile: refAudioFile,
        characterId,
        characterName,
        refText: refText || undefined,
        tags: shot?.characterIdentities?.[0]?.physicalTraits,
      })

      setRegisteredProfileId(result.profileId)
      setCloneStatus("ready")
      invalidateProfileCache()

      // Update voiceConfig with clone info
      onUpdateShot({
        voiceConfig: {
          mode: "clone",
          text: ttsText.trim(),
          refAudioId: result.profileId,
          refText: refText || undefined,
          speed: 1.0,
        },
        // P1-3: Sync voice profile ID to the character identity so it auto-reuses
        characterIdentities: shot?.characterIdentities?.map((char) =>
          char.id === characterId
            ? {
                ...char,
                voiceProfileId: result.profileId,
                voiceProfileStatus: "ready" as const,
              }
            : char,
        ),
      })
    } catch (err: any) {
      const message = err instanceof TtsGenerationError
        ? err.message
        : `声线注册失败：${err?.message || "未知错误"}`
      setLocalError(message)
      setCloneStatus("failed")
    } finally {
      setIsRegistering(false)
    }
  }, [refAudioFile, refText, shot, nodeId, ttsText, onUpdateShot])

  // ---- Generate ----
  const handleGenerate = useCallback(async () => {
    if (!ttsText.trim()) {
      setLocalError("请输入要合成的台词")
      return
    }

    setLocalError(null)

    onUpdateShot({
      voiceGenerationStatus: "generating",
      voiceGenerationError: undefined,
    })

    try {
      const result = await generateVoice({
        text: ttsText.trim(),
        profileId: mode === "clone" ? registeredProfileId : null,
        instruct: mode === "design" ? voiceDescriptionToInstruct(voiceDesc) : undefined,
        emotion: emotion || undefined,
        speed: 1.0,
      })

      const persisted = await persistTtsAudio(result.audioBlob, {
        fileName: `voice-${nodeId}-${Date.now()}.wav`,
      })

      const newVoiceConfig: VoiceConfig = {
        mode: mode === "clone" ? "clone" : (voiceDesc ? "design" : "auto"),
        text: ttsText.trim(),
        instruct: mode === "design" ? voiceDescriptionToInstruct(voiceDesc) || undefined : undefined,
        refAudioId: mode === "clone" ? registeredProfileId || undefined : undefined,
        refText: mode === "clone" ? refText || undefined : undefined,
        speed: 1.0,
      }

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
  }, [mode, ttsText, voiceDesc, emotion, nodeId, onUpdateShot, registeredProfileId, refText])

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

  // ---- Preview instruct ----
  const previewInstruct = voiceDesc.trim()
    ? voiceDescriptionToInstruct(voiceDesc)
    : ""

  const canGenerate = !isGenerating && ttsText.trim() && (mode === "design" || (mode === "clone" && cloneStatus === "ready"))
  const generateLabel = hasAudio ? "重新合成" : "合成配音"

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
          {/* 模式选择 */}
          <div className="flex gap-1">
            <button
              type="button"
              className="nodrag flex-1 rounded-md border px-2 py-1 text-[10px] transition-colors"
              style={{
                borderColor: mode === "design" ? DESIGN_TOKENS.accentHover : DESIGN_TOKENS.border,
                color: mode === "design" ? DESIGN_TOKENS.accentHover : DESIGN_TOKENS.textMuted,
                backgroundColor: mode === "design" ? "rgba(99,102,241,0.1)" : "transparent",
              }}
              onClick={() => setMode("design")}
            >
              <Sparkles size={10} className="inline mr-1" />
              Voice Design
            </button>
            <button
              type="button"
              className="nodrag flex-1 rounded-md border px-2 py-1 text-[10px] transition-colors"
              style={{
                borderColor: mode === "clone" ? DESIGN_TOKENS.accentHover : DESIGN_TOKENS.border,
                color: mode === "clone" ? DESIGN_TOKENS.accentHover : DESIGN_TOKENS.textMuted,
                backgroundColor: mode === "clone" ? "rgba(99,102,241,0.1)" : "transparent",
              }}
              onClick={() => setMode("clone")}
            >
              <Copy size={10} className="inline mr-1" />
              Voice Clone
            </button>
          </div>

          {/* 台词输入（共用） */}
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

          {/* 情感 / 语气选择（共用） */}
          <div className="space-y-0.5">
            <label className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>情感 / 语气</label>
            <select
              value={emotion}
              onChange={(e) => setEmotion(e.target.value)}
              className="nodrag nopan w-full rounded-lg border bg-transparent px-2 py-1.5 text-[11px] text-white/70 outline-none"
              style={{ borderColor: DESIGN_TOKENS.border }}
            >
              <option value="" className="bg-[#15151b]">自动（由声音描述推断）</option>
              <option value="温柔" className="bg-[#15151b]">温柔</option>
              <option value="激动" className="bg-[#15151b]">激动</option>
              <option value="惊恐" className="bg-[#15151b]">惊恐</option>
              <option value="愤怒" className="bg-[#15151b]">愤怒</option>
              <option value="悲伤" className="bg-[#15151b]">悲伤</option>
              <option value="开心" className="bg-[#15151b]">开心</option>
              <option value="紧张" className="bg-[#15151b]">紧张</option>
              <option value="冷静" className="bg-[#15151b]">冷静</option>
              <option value="严肃" className="bg-[#15151b]">严肃</option>
              <option value="调皮" className="bg-[#15151b]">调皮</option>
              <option value="可爱" className="bg-[#15151b]">可爱</option>
              <option value="慵懒" className="bg-[#15151b]">慵懒</option>
              <option value="疲惫" className="bg-[#15151b]">疲惫</option>
              <option value="坚定" className="bg-[#15151b]">坚定</option>
              <option value="自信" className="bg-[#15151b]">自信</option>
              <option value="嘲讽" className="bg-[#15151b]">嘲讽</option>
              <option value="耳语" className="bg-[#15151b]">耳语</option>
              <option value="哭腔" className="bg-[#15151b]">哭腔</option>
              <option value="颤抖" className="bg-[#15151b]">颤抖</option>
            </select>
          </div>

          {/* === DESIGN 模式：自然语言声音描述 === */}
          {mode === "design" && (
            <>
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
            </>
          )}

          {/* === CLONE 模式：上传参考音频 === */}
          {mode === "clone" && (
            <div className="space-y-2">
              {/* 已注册声线档案选择 */}
              <div className="space-y-0.5">
                <label className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>选择角色声线</label>
                <select
                  value={registeredProfileId || ""}
                  onChange={(e) => {
                    const pid = e.target.value
                    setRegisteredProfileId(pid || null)
                    setCloneStatus(pid ? "ready" : "idle")
                  }}
                  className="nodrag nopan w-full rounded-lg border bg-transparent px-2 py-1.5 text-[11px] text-white/70 outline-none"
                  style={{ borderColor: DESIGN_TOKENS.border }}
                >
                  <option value="" className="bg-[#15151b]">
                    {profilesLoading ? "加载中..." : "-- 选择已注册声线 --"}
                  </option>
                  {allProfiles.map((profile) => (
                    <option key={profile.profileId} value={profile.profileId} className="bg-[#15151b]">
                      {profile.characterName} ({profile.profileId.slice(0, 8)}...)
                      {profile.status === "ready" ? " ✓" : " ⦿"}
                    </option>
                  ))}
                </select>
                {allProfiles.length === 0 && !profilesLoading && (
                  <div className="text-[9px]" style={{ color: DESIGN_TOKENS.textMuted }}>
                    暂无已注册声线，请上传参考音频注册新声线
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="h-px flex-1" style={{ backgroundColor: DESIGN_TOKENS.border }} />
                <span className="text-[9px]" style={{ color: DESIGN_TOKENS.textMuted }}>或上传新声线</span>
                <div className="h-px flex-1" style={{ backgroundColor: DESIGN_TOKENS.border }} />
              </div>

              {/* 参考音频上传 */}
              <div className="space-y-0.5">
                <label className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>参考音频</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {refAudioFile ? (
                  <div className="flex items-center gap-2 rounded-lg border px-2 py-1.5" style={{ borderColor: DESIGN_TOKENS.border, backgroundColor: "rgba(255,255,255,0.03)" }}>
                    <User size={11} style={{ color: DESIGN_TOKENS.accentHover }} />
                    <span className="flex-1 truncate text-[10px] text-white/60">{refAudioFile.name}</span>
                    <span className="text-[9px]" style={{ color: DESIGN_TOKENS.textMuted }}>
                      {(refAudioFile.size / 1024).toFixed(0)} KB
                    </span>
                    <button
                      type="button"
                      className="text-[9px] text-red-300/70 hover:text-red-300"
                      onClick={() => { setRefAudioFile(null); setCloneStatus("idle") }}
                    >
                      移除
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="nodrag flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-[10px] transition-colors hover:bg-white/5"
                    style={{ borderColor: DESIGN_TOKENS.border, color: DESIGN_TOKENS.textMuted }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={11} />
                    上传角色参考音频（WAV/MP3，≤20MB）
                  </button>
                )}
              </div>

              {/* 参考转写文本 */}
              <div className="space-y-0.5">
                <label className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>
                  参考文本（可选，提升克隆质量）
                </label>
                <input
                  type="text"
                  value={refText}
                  onChange={(e) => setRefText(e.target.value)}
                  className="nodrag nopan w-full rounded-lg border bg-transparent px-2 py-1.5 text-[11px] text-white/70 placeholder:text-white/25 outline-none"
                  style={{ borderColor: DESIGN_TOKENS.border }}
                  placeholder="参考音频里说的话..."
                />
              </div>

              {/* 注册按钮 + 状态 */}
              <div className="space-y-1">
                {cloneStatus === "ready" ? (
                  <div className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px]" style={{ backgroundColor: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
                    <Sparkles size={10} />
                    声线已注册（{registeredProfileId?.slice(0, 8)}...），可直接合成
                  </div>
                ) : cloneStatus === "idle" || cloneStatus === "uploading" ? (
                  <button
                    type="button"
                    className="nodrag flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] transition-colors hover:bg-white/5 disabled:opacity-40"
                    style={{
                      borderColor: DESIGN_TOKENS.accentHover,
                      color: DESIGN_TOKENS.accentHover,
                      backgroundColor: "rgba(99,102,241,0.06)",
                    }}
                    disabled={!refAudioFile || isRegistering}
                    onClick={handleRegisterClone}
                  >
                    {isRegistering ? (
                      <>
                        <Loader2 size={10} className="animate-spin" />
                        注册中...
                      </>
                    ) : (
                      <>
                        <Copy size={10} />
                        注册角色声线
                      </>
                    )}
                  </button>
                ) : cloneStatus === "registering" ? (
                  <div className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px]" style={{ backgroundColor: "rgba(59,130,246,0.1)", color: "#3b82f6" }}>
                    <Loader2 size={10} className="animate-spin" />
                    正在注册声线（可能需要 1-2 分钟）...
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px]" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                    <Square size={10} />
                    注册失败，请重试
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 合成按钮（共用） */}
          <button
            type="button"
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors hover:bg-white/5 disabled:opacity-40"
            style={{
              borderColor: DESIGN_TOKENS.accentHover,
              color: DESIGN_TOKENS.accentHover,
              backgroundColor: "rgba(99,102,241,0.06)",
            }}
            disabled={!canGenerate}
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
                <span>{generateLabel}</span>
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
