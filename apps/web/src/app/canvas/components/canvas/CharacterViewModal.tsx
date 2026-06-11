/**
 * CharacterViewPanel — 角色三视图生成面板
 * 支持视角锁定、风格选择、分辨率切换、调用 AI 生成三视图
 */
"use client"

import { useState, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { X, Sparkles, Loader2, ImageIcon, Lock, Unlock, Download } from "lucide-react"
import { DESIGN_TOKENS, ICON_CONFIG } from "../../styles/designSystem"
import { generateId } from "../../utils/generateId"

// ============================================================================
// 类型定义
// ============================================================================

type ViewPerspective = "front" | "side" | "back" | "all"

type ArtStyle =
  | "realistic"
  | "anime"
  | "ink-wash"
  | "oil-painting"
  | "line-art"
  | "pixel"

type Resolution = "512x512" | "768x768" | "1024x1024" | "1536x1536"

interface CharacterViewPanelProps {
  isOpen: boolean
  onClose: () => void
  /** 角色名称（可从圣经或选中节点传入） */
  characterName?: string
  /** 角色描述文本 */
  characterDescription?: string
  /** 角色参考图 URL */
  referenceImageUrl?: string
  /** 生成完成后的回调 */
  onImageGenerated?: (imageUrl: string, perspective: ViewPerspective, prompt: string) => void
}

// ============================================================================
// 配置
// ============================================================================

const STYLE_OPTIONS: { value: ArtStyle; label: string; promptKeyword: string }[] = [
  { value: "realistic", label: "写实", promptKeyword: "photorealistic, detailed, 8K, concept art" },
  { value: "anime", label: "动漫", promptKeyword: "anime style, cel shading, vibrant colors" },
  { value: "ink-wash", label: "水墨", promptKeyword: "ink wash painting style, traditional Chinese art, brush strokes" },
  { value: "oil-painting", label: "油画", promptKeyword: "oil painting style, rich textures, impasto" },
  { value: "line-art", label: "线稿", promptKeyword: "clean line art, white background, technical drawing" },
  { value: "pixel", label: "像素", promptKeyword: "pixel art style, retro game character, 8-bit" },
]

const RESOLUTION_OPTIONS: { value: Resolution; label: string }[] = [
  { value: "512x512", label: "512×512" },
  { value: "768x768", label: "768×768" },
  { value: "1024x1024", label: "1024×1024" },
  { value: "1536x1536", label: "1536×1536" },
]

const PERSPECTIVE_OPTIONS: { value: ViewPerspective; label: string; desc: string }[] = [
  { value: "front", label: "正面", desc: "Front view" },
  { value: "side", label: "侧面", desc: "Side view" },
  { value: "back", label: "背面", desc: "Back view" },
  { value: "all", label: "三视图", desc: "Front + Side + Back" },
]

// ============================================================================
// 组件
// ============================================================================

export function CharacterViewPanel({
  isOpen,
  onClose,
  characterName = "角色",
  characterDescription = "",
  referenceImageUrl,
  onImageGenerated,
}: CharacterViewPanelProps) {
  const [lockedPerspective, setLockedPerspective] = useState<ViewPerspective | null>(null)
  const [selectedStyle, setSelectedStyle] = useState<ArtStyle>("realistic")
  const [selectedResolution, setSelectedResolution] = useState<Resolution>("1024x1024")
  const [generating, setGenerating] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<
    { perspective: ViewPerspective; imageUrl: string; prompt: string }[]
  >([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [localRefImage, setLocalRefImage] = useState<string | undefined>(referenceImageUrl)

  // 构建生成 prompt
  const buildPrompt = useCallback(
    (perspective: ViewPerspective): string => {
      const style = STYLE_OPTIONS.find((s) => s.value === selectedStyle)!
      const perspectiveDesc =
        perspective === "all"
          ? "orthographic three-view character design sheet, front view + side view + back view"
          : `${perspective} view of the character`

      const parts = [
        perspectiveDesc,
        characterName ? `character: ${characterName}` : "",
        characterDescription,
        style.promptKeyword,
        "clean white background, full body, centered, professional concept art",
      ]

      return parts.filter(Boolean).join(", ")
    },
    [characterName, characterDescription, selectedStyle]
  )

  // 调用 AI 生成三视图（使用专用 character-view API）
  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    try {
      const perspectives: ViewPerspective[] = lockedPerspective
        ? [lockedPerspective]
        : ["front", "side", "back"]

      const results: { perspective: ViewPerspective; imageUrl: string; prompt: string }[] = []

      const characterDesc = buildPrompt("front").replace("front view of the character", "").trim()

      // 使用专用 API 逐视角生成
      for (const perspective of perspectives) {
        const res = await fetch("/api/ai/generate-character-view", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            characterDescription: characterDesc,
            referenceImageUrl: localRefImage || undefined,
            viewType: perspective,
          }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error?.message || `API error: ${res.status}`)
        }

        // SSE 流式解析
        const reader = res.body?.getReader()
        if (!reader) throw new Error("No response body")

        const decoder = new TextDecoder()
        let buffer = ""
        let imageUrl = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const eventRegex = /event: (\w+)\ndata: (.+?)\n\n/g
          let match

          while ((match = eventRegex.exec(buffer)) !== null) {
            const eventType = match[1]
            let data: Record<string, unknown>
            try {
              data = JSON.parse(match[2])
            } catch {
              continue
            }

            if (eventType === "result") {
              // 获取对应视角的 URL
              if (perspective === "front" && data.frontViewUrl) {
                imageUrl = data.frontViewUrl as string
              } else if (perspective === "side" && data.sideViewUrl) {
                imageUrl = data.sideViewUrl as string
              } else if (perspective === "back" && data.backViewUrl) {
                imageUrl = data.backViewUrl as string
              }
            } else if (eventType === "error") {
              throw new Error((data.message as string) || "生成失败")
            }
          }
        }

        if (!imageUrl) throw new Error("No image data returned")

        const prompt = buildPrompt(perspective)
        results.push({ perspective, imageUrl, prompt })
        onImageGenerated?.(imageUrl, perspective, prompt)
      }

      setGeneratedImages((prev) => [...results.reverse(), ...prev].slice(0, 12))
    } catch (err) {
      console.error("[CharacterViewPanel] Generation failed:", err)
    } finally {
      setGenerating(false)
    }
  }, [buildPrompt, lockedPerspective, localRefImage, onImageGenerated])

  // 视角锁定切换
  const toggleLock = (perspective: ViewPerspective) => {
    setLockedPerspective((prev) => (prev === perspective ? null : perspective))
  }

  if (!isOpen) return null
  if (typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="relative z-10 w-[520px] max-h-[90vh] overflow-hidden rounded-2xl border flex flex-col"
        style={{
          backgroundColor: DESIGN_TOKENS.panelSolid,
          borderColor: DESIGN_TOKENS.border,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 border-b shrink-0"
          style={{ borderColor: DESIGN_TOKENS.border }}
        >
          <div className="flex items-center gap-2">
            <ImageIcon size={18} strokeWidth={ICON_CONFIG.strokeWidth} style={{ color: DESIGN_TOKENS.accent }} />
            <h3 className="text-sm font-medium" style={{ color: DESIGN_TOKENS.text }}>
              角色三视图生成
            </h3>
            {characterName && (
              <span className="text-xs" style={{ color: DESIGN_TOKENS.textMuted }}>
                — {characterName}
              </span>
            )}
          </div>
          <button onClick={onClose} className="rounded-lg p-1 transition-colors hover:bg-white/10">
            <X size={16} strokeWidth={ICON_CONFIG.strokeWidth} style={{ color: DESIGN_TOKENS.textMuted }} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 参考图片 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>
              参考图片（可选）
            </label>
            <div
              className="relative rounded-xl border-2 border-dashed p-4 flex items-center justify-center cursor-pointer transition-colors"
              style={{ borderColor: DESIGN_TOKENS.border, minHeight: 100 }}
              onClick={() => fileInputRef.current?.click()}
            >
              {localRefImage ? (
                <div className="relative w-full">
                  <img
                    src={localRefImage}
                    alt="参考图"
                    className="w-full h-28 object-contain rounded-lg"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setLocalRefImage(undefined)
                    }}
                    className="absolute top-1 right-1 rounded-full p-1 bg-black/60"
                  >
                    <X size={12} strokeWidth={1.5} style={{ color: "#fff" }} />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <ImageIcon size={24} strokeWidth={1.5} style={{ color: DESIGN_TOKENS.textMuted }} />
                  <span className="text-xs" style={{ color: DESIGN_TOKENS.textMuted }}>
                    点击上传参考图
                  </span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    const reader = new FileReader()
                    reader.onload = (ev) => setLocalRefImage(ev.target?.result as string)
                    reader.readAsDataURL(file)
                  }
                }}
              />
            </div>
          </div>

          {/* 视角锁定 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>
                视角
              </label>
              {lockedPerspective && (
                <span className="flex items-center gap-1 text-[10px]" style={{ color: DESIGN_TOKENS.accent }}>
                  <Lock size={10} strokeWidth={1.5} />
                  已锁定
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {PERSPECTIVE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => toggleLock(opt.value)}
                  className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-all"
                  style={{
                    borderColor:
                      lockedPerspective === opt.value ? DESIGN_TOKENS.accent : DESIGN_TOKENS.border,
                    backgroundColor:
                      lockedPerspective === opt.value ? DESIGN_TOKENS.accentSoft : "transparent",
                    color:
                      lockedPerspective === opt.value ? DESIGN_TOKENS.accent : DESIGN_TOKENS.textSecondary,
                  }}
                  title={opt.desc}
                >
                  {lockedPerspective === opt.value ? (
                    <Lock size={12} strokeWidth={1.5} />
                  ) : (
                    <Unlock size={12} strokeWidth={1.5} />
                  )}
                  {opt.label}
                </button>
              ))}
            </div>
            {lockedPerspective && (
              <p className="mt-1 text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>
                锁定后所有生成将固定为此视角。点击已锁定的视角可解锁。
              </p>
            )}
          </div>

          {/* 风格选择 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>
              风格
            </label>
            <div className="flex flex-wrap gap-1.5">
              {STYLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedStyle(opt.value)}
                  className="rounded-lg border px-3 py-1.5 text-xs transition-all"
                  style={{
                    borderColor:
                      selectedStyle === opt.value ? DESIGN_TOKENS.accent : DESIGN_TOKENS.border,
                    backgroundColor:
                      selectedStyle === opt.value ? DESIGN_TOKENS.accentSoft : "transparent",
                    color:
                      selectedStyle === opt.value ? DESIGN_TOKENS.accent : DESIGN_TOKENS.textSecondary,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 分辨率选择 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>
              分辨率
            </label>
            <div className="flex flex-wrap gap-1.5">
              {RESOLUTION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedResolution(opt.value)}
                  className="rounded-lg border px-3 py-1.5 text-xs transition-all"
                  style={{
                    borderColor:
                      selectedResolution === opt.value ? DESIGN_TOKENS.accent : DESIGN_TOKENS.border,
                    backgroundColor:
                      selectedResolution === opt.value ? DESIGN_TOKENS.accentSoft : "transparent",
                    color:
                      selectedResolution === opt.value ? DESIGN_TOKENS.accent : DESIGN_TOKENS.textSecondary,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 生成按钮 */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center justify-center gap-2 w-full rounded-xl py-3 text-sm font-medium transition-all"
            style={{
              backgroundColor: generating ? DESIGN_TOKENS.accentSoft : DESIGN_TOKENS.accent,
              color: generating ? DESIGN_TOKENS.textMuted : "#fff",
              cursor: generating ? "not-allowed" : "pointer",
            }}
          >
            {generating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles size={16} strokeWidth={1.5} />
                {lockedPerspective
                  ? `生成${PERSPECTIVE_OPTIONS.find((p) => p.value === lockedPerspective)?.label}`
                  : "生成三视图"}
              </>
            )}
          </button>

          {/* 生成结果 */}
          {generatedImages.length > 0 && (
            <div>
              <label className="mb-2 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>
                生成结果
              </label>
              <div className="grid grid-cols-2 gap-2">
                {generatedImages.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative rounded-xl border overflow-hidden group"
                    style={{ borderColor: DESIGN_TOKENS.border }}
                  >
                    <img
                      src={img.imageUrl}
                      alt={`${img.perspective} view`}
                      className="w-full h-36 object-contain"
                      style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
                    />
                    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-2 py-1.5"
                      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
                      <span className="text-[10px]" style={{ color: DESIGN_TOKENS.textSecondary }}>
                        {PERSPECTIVE_OPTIONS.find((p) => p.value === img.perspective)?.label || img.perspective}
                      </span>
                      <button
                        onClick={() => {
                          const link = document.createElement("a")
                          link.href = img.imageUrl
                          link.download = `character-${img.perspective}-${generateId().slice(0, 6)}.png`
                          link.click()
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Download size={12} strokeWidth={1.5} style={{ color: DESIGN_TOKENS.textMuted }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
