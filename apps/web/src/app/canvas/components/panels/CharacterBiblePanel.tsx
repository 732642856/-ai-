/**
 * CharacterBiblePanel — 角色圣经面板
 * 创建/编辑角色设定：姓名、外貌、服装、道具、背景故事等
 * 参考 TapNow 的 Character Bible 能力，支持参考图上传
 */
"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { X, Plus, UserRound, Trash2, Image as ImageIcon, Save, Sparkles, Loader2 } from "lucide-react"
import { DESIGN_TOKENS, ICON_CONFIG } from "../../styles/designSystem"
import { useCanvasStore } from "../../stores/canvasStore"
import type { CharacterBibleData } from "../canvas/types"
import { generateId } from "../../utils/generateId"

type TabMode = "list" | "edit"

interface CharacterBiblePanelProps {
  isOpen: boolean
  onClose: () => void
}

export function CharacterBiblePanel({ isOpen, onClose }: CharacterBiblePanelProps) {
  const {
    bibleCharacters,
    selectedBibleCharacterId,
    selectBibleCharacter,
    addBibleCharacter,
    updateBibleCharacter,
    removeBibleCharacter,
  } = useCanvasStore()

  const [tab, setTab] = useState<TabMode>("list")
  const [edit, setEdit] = useState<Partial<CharacterBibleData>>({})

  // AI 生成状态
  const [showAiInput, setShowAiInput] = useState(false)
  const [aiPrompt, setAiPrompt] = useState("")
  const [aiGenerating, setAiGenerating] = useState(false)

  const selectedCharacter = bibleCharacters.find((c) => c.id === selectedBibleCharacterId)

  useEffect(() => {
    if (selectedCharacter) {
      setEdit(selectedCharacter)
      setTab("edit")
    } else {
      setEdit({})
      setTab("list")
    }
  }, [selectedBibleCharacterId, bibleCharacters])

  const handleCreateNew = () => {
    const newChar: CharacterBibleData = { id: generateId(), name: "", createdAt: Date.now() }
    addBibleCharacter(newChar)
    selectBibleCharacter(newChar.id)
  }

  const handleSave = () => {
    if (!selectedBibleCharacterId || !edit.name?.trim()) return
    updateBibleCharacter(selectedBibleCharacterId, edit)
    setTab("list")
    selectBibleCharacter(null)
  }

  const handleDelete = (id: string) => {
    if (selectedBibleCharacterId === id) setTab("list")
    removeBibleCharacter(id)
  }

  const handleImageUpload = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => setEdit((prev) => ({ ...prev, referenceImageUrl: ev.target?.result as string }))
      reader.readAsDataURL(file)
    }
    input.click()
  }

  /** 调用 AI 生成角色设定 */
  const handleAiGenerate = async () => {
    if (!aiPrompt.trim() || aiGenerating) return
    setAiGenerating(true)
    try {
      // 读取 localStorage 中的 provider overrides
      const overrides = getLocalProviderOverrides()
      const res = await fetch("/api/ai/bible-director", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "generate-character",
          script: aiPrompt,
          _providerOverrides: overrides || undefined,
        }),
      })
      const data = await res.json()
      if (data.parsed) {
        const c = data.parsed
        setEdit((prev) => ({
          ...prev,
          name: c.name || prev.name,
          role: c.role || prev.role,
          aliases: c.aliases || prev.aliases,
          visualSignature: c.visualSignature || prev.visualSignature,
          costume: c.costume || prev.costume,
          props: c.props || prev.props,
          physicalTraits: c.physicalTraits || prev.physicalTraits,
          colorPalette: c.colorPalette || prev.colorPalette,
          backstory: c.backstory || prev.backstory,
          arcDescription: c.arcDescription || prev.arcDescription,
        }))
      }
    } catch (e) {
      console.error("AI generate character failed:", e)
    } finally {
      setAiGenerating(false)
      setShowAiInput(false)
      setAiPrompt("")
    }
  }

  /** 获取 localStorage 中的 provider overrides */
  function getLocalProviderOverrides() {
    if (typeof window === "undefined") return null
    const baseUrl = localStorage.getItem("startrails_provider_baseUrl")
    const apiKey = localStorage.getItem("startrails_provider_apiKey")
    const defaultModel = localStorage.getItem("startrails_provider_defaultModel")
    if (!baseUrl && !apiKey) return null
    return { baseUrl: baseUrl || undefined, apiKey: apiKey || undefined, defaultModel: defaultModel || undefined }
  }

  if (!isOpen) return null
  if (typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={onClose} />
      <div className="relative z-10 w-[520px] max-h-[85vh] overflow-hidden rounded-2xl border flex flex-col"
        style={{ backgroundColor: DESIGN_TOKENS.panelSolid, borderColor: DESIGN_TOKENS.border }}
      >
        <div className="flex items-center justify-between p-4 border-b shrink-0" style={{ borderColor: DESIGN_TOKENS.border }}>
          <div className="flex items-center gap-2">
            <UserRound size={18} strokeWidth={ICON_CONFIG.strokeWidth} style={{ color: DESIGN_TOKENS.accent }} />
            <h3 className="text-sm font-medium" style={{ color: DESIGN_TOKENS.text }}>{tab === "edit" ? "编辑角色" : "角色圣经"}</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 transition-colors hover:bg-white/10">
            <X size={16} strokeWidth={ICON_CONFIG.strokeWidth} style={{ color: DESIGN_TOKENS.textMuted }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === "list" ? (
            <div className="space-y-2">
              {bibleCharacters.length === 0 && (
                <p className="text-xs text-center py-8" style={{ color: DESIGN_TOKENS.textMuted }}>暂无角色，点击下方按钮创建</p>
              )}
              {bibleCharacters.map((char) => (
                <div key={char.id}
                  className="flex items-center gap-3 rounded-xl p-3 cursor-pointer transition-colors"
                  style={{ backgroundColor: selectedBibleCharacterId === char.id ? DESIGN_TOKENS.accentSoft : DESIGN_TOKENS.card, border: `1px solid ${selectedBibleCharacterId === char.id ? DESIGN_TOKENS.accent : DESIGN_TOKENS.border}` }}
                  onClick={() => selectBibleCharacter(char.id)}
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden" style={{ backgroundColor: DESIGN_TOKENS.accentSoft }}>
                    {char.referenceImageUrl ? <img src={char.referenceImageUrl} alt={char.name} className="w-full h-full object-cover" /> : <UserRound size={18} strokeWidth={1.5} style={{ color: DESIGN_TOKENS.accent }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: DESIGN_TOKENS.text }}>{char.name || "未命名角色"}</p>
                    {char.role && <p className="text-xs truncate" style={{ color: DESIGN_TOKENS.textMuted }}>{char.role}</p>}
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(char.id) }} className="rounded-lg p-1.5 transition-colors hover:bg-red-500/20"><Trash2 size={14} strokeWidth={1.5} style={{ color: DESIGN_TOKENS.textMuted }} /></button>
                </div>
              ))}
              <button onClick={handleCreateNew}
                className="flex items-center justify-center gap-2 w-full rounded-xl p-3 transition-colors"
                style={{ border: `1px dashed ${DESIGN_TOKENS.borderStrong}`, color: DESIGN_TOKENS.accent }}>
                <Plus size={16} strokeWidth={1.5} /><span className="text-sm">新建角色</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* AI 生成按钮 */}
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setShowAiInput(!showAiInput)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "rgb(52, 211, 153)" }}
                >
                  <Sparkles size={12} strokeWidth={1.5} />
                  {showAiInput ? "取消" : "AI 生成角色设定"}
                </button>
              </div>

              {/* AI 输入区域 */}
              {showAiInput && (
                <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "rgba(52, 211, 153, 0.25)", backgroundColor: "rgba(16, 185, 129, 0.06)" }}>
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="用一句话描述角色，例：一个30岁的刑警队长，沉默寡言，内心有创伤，左脸有一道疤痕，总穿着棕色皮夹克"
                    rows={3}
                    className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none resize-none"
                    style={{ borderColor: DESIGN_TOKENS.border }}
                  />
                  <button
                    onClick={handleAiGenerate}
                    disabled={aiGenerating || !aiPrompt.trim()}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity"
                    style={{ backgroundColor: "rgb(16, 185, 129)", opacity: aiGenerating || !aiPrompt.trim() ? 0.5 : 1 }}
                  >
                    {aiGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    {aiGenerating ? "生成中..." : "生成角色设定"}
                  </button>
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>参考图片</label>
                <div className="relative rounded-xl border-2 border-dashed p-4 flex items-center justify-center cursor-pointer transition-colors" style={{ borderColor: DESIGN_TOKENS.border, minHeight: 120 }} onClick={handleImageUpload}>
                  {edit.referenceImageUrl ? (
                    <div className="relative w-full">
                      <img src={edit.referenceImageUrl} alt="角色参考图" className="w-full h-32 object-contain rounded-lg" />
                      <button onClick={(e) => { e.stopPropagation(); setEdit((p) => ({ ...p, referenceImageUrl: undefined })) }} className="absolute top-1 right-1 rounded-full p-1 bg-black/60"><X size={12} strokeWidth={1.5} style={{ color: "#fff" }} /></button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <ImageIcon size={24} strokeWidth={1.5} style={{ color: DESIGN_TOKENS.textMuted }} />
                      <span className="text-xs" style={{ color: DESIGN_TOKENS.textMuted }}>点击上传角色参考图</span>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>角色姓名 <span className="text-red-400">*</span></label>
                <input type="text" value={edit.name || ""} onChange={(e) => setEdit((p) => ({ ...p, name: e.target.value }))} placeholder="例：宋明远" className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none" style={{ borderColor: DESIGN_TOKENS.border }} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>别名（逗号分隔）</label>
                <input type="text" value={(edit.aliases || []).join(", ")} onChange={(e) => setEdit((p) => ({ ...p, aliases: e.target.value.split(/[,，]/).map(s => s.trim()).filter(Boolean) }))} placeholder="例：小明, 宋总" className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none" style={{ borderColor: DESIGN_TOKENS.border }} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>角色定位</label>
                <input type="text" value={edit.role || ""} onChange={(e) => setEdit((p) => ({ ...p, role: e.target.value }))} placeholder="例：主角 / 反派 / 配角" className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none" style={{ borderColor: DESIGN_TOKENS.border }} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>外貌特征</label>
                <textarea value={edit.visualSignature || ""} onChange={(e) => setEdit((p) => ({ ...p, visualSignature: e.target.value }))} placeholder="描述角色的外貌：身高、体型、脸型、发型、眼睛颜色…" rows={3} className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none resize-none" style={{ borderColor: DESIGN_TOKENS.border }} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>服装风格</label>
                <textarea value={edit.costume || ""} onChange={(e) => setEdit((p) => ({ ...p, costume: e.target.value }))} placeholder="描述角色常穿服装：颜色、款式、材质、配饰…" rows={2} className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none resize-none" style={{ borderColor: DESIGN_TOKENS.border }} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>常用道具（逗号分隔）</label>
                <input type="text" value={(edit.props || []).join(", ")} onChange={(e) => setEdit((p) => ({ ...p, props: e.target.value.split(/[,，]/).map(s => s.trim()).filter(Boolean) }))} placeholder="例：烟斗, 怀表, 手枪" className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none" style={{ borderColor: DESIGN_TOKENS.border }} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>色彩基调（逗号分隔）</label>
                <input type="text" value={(edit.colorPalette || []).join(", ")} onChange={(e) => setEdit((p) => ({ ...p, colorPalette: e.target.value.split(/[,，]/).map(s => s.trim()).filter(Boolean) }))} placeholder="例：深蓝, 墨绿, 金色" className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none" style={{ borderColor: DESIGN_TOKENS.border }} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>背景故事</label>
                <textarea value={edit.backstory || ""} onChange={(e) => setEdit((p) => ({ ...p, backstory: e.target.value }))} placeholder="角色的背景故事、经历、动机…" rows={3} className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none resize-none" style={{ borderColor: DESIGN_TOKENS.border }} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>人物弧光（arc）</label>
                <textarea value={edit.arcDescription || ""} onChange={(e) => setEdit((p) => ({ ...p, arcDescription: e.target.value }))} placeholder="角色在故事中的成长/变化轨迹…" rows={2} className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none resize-none" style={{ borderColor: DESIGN_TOKENS.border }} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>备注</label>
                <textarea value={edit.notes || ""} onChange={(e) => setEdit((p) => ({ ...p, notes: e.target.value }))} rows={2} className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none resize-none" style={{ borderColor: DESIGN_TOKENS.border }} />
              </div>
            </div>
          )}
        </div>

        {tab === "edit" && (
          <div className="flex items-center justify-between p-4 border-t shrink-0" style={{ borderColor: DESIGN_TOKENS.border }}>
            <button onClick={() => { setTab("list"); selectBibleCharacter(null) }} className="rounded-lg px-3 py-1.5 text-xs transition-colors hover:bg-white/10" style={{ color: DESIGN_TOKENS.textMuted }}>返回列表</button>
            <button onClick={handleSave}
              className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: DESIGN_TOKENS.accent, opacity: edit.name?.trim() ? 1 : 0.5 }}
              disabled={!edit.name?.trim()}>
              <Save size={12} strokeWidth={1.5} /> 保存角色
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
