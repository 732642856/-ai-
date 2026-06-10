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
import type { IdentityAnchors, CharacterNegativePrompt } from "../../types/identity-anchors"
import { createDefaultIdentityAnchors, validateIdentityAnchors, compileIdentityPrompt, inferColorHex } from "../../types/identity-anchors"
import { generateId } from "../../utils/generateId"

// Tab 切换：角色列表 / 编辑表单
type TabMode = "list" | "edit"

interface CharacterBiblePanelProps {
  isOpen: boolean
  onClose: () => void
}

export function CharacterBiblePanel({ isOpen, onClose }: CharacterBiblePanelProps) {
  const bibleCharacters = useCanvasStore((s) => s.bibleCharacters)
  const selectedBibleCharacterId = useCanvasStore((s) => s.selectedBibleCharacterId)
  const selectBibleCharacter = useCanvasStore((s) => s.selectBibleCharacter)
  const addBibleCharacter = useCanvasStore((s) => s.addBibleCharacter)
  const updateBibleCharacter = useCanvasStore((s) => s.updateBibleCharacter)
  const removeBibleCharacter = useCanvasStore((s) => s.removeBibleCharacter)
  
  // 通过 selector 精确订阅选中的角色数据，避免 bibleCharacters 全量变化导致不必要重渲染
  const selectedCharacterData = useCanvasStore((s) => {
    if (!s.selectedBibleCharacterId) return null
    return s.bibleCharacters.find((c) => c.id === s.selectedBibleCharacterId) || null
  })

  const [tab, setTab] = useState<TabMode>("list")
  const [edit, setEdit] = useState<Partial<CharacterBibleData>>({})

  // AI 生成状态
  const [showAiInput, setShowAiInput] = useState(false)
  const [aiPrompt, setAiPrompt] = useState("")
  const [aiGenerating, setAiGenerating] = useState(false)

  // 紫微斗数角色设计状态
  const [showAstrologyInput, setShowAstrologyInput] = useState(false)
  const [birthDate, setBirthDate] = useState("")
  const [birthTime, setBirthTime] = useState("2")
  const [birthGender, setBirthGender] = useState<"男" | "女">("男")
  const [birthType, setBirthType] = useState<"solar" | "lunar">("solar")
  const [astrologyGenerating, setAstrologyGenerating] = useState(false)
  const [astrologyResult, setAstrologyResult] = useState<string | null>(null)

  // 选中角色时自动切换到编辑视图
  // 使用 selector 返回的 selectedCharacterData 精确订阅，避免 bibleCharacters 全量变化频繁触发
  useEffect(() => {
    if (selectedCharacterData) {
      setEdit({
        ...selectedCharacterData,
        identityAnchors: selectedCharacterData.identityAnchors || createDefaultIdentityAnchors(),
      })
      setTab("edit")
    } else {
      setEdit({})
      setTab("list")
    }
  }, [selectedCharacterData])

  const handleCreateNew = () => {
    const newChar: CharacterBibleData = {
      id: generateId(),
      name: "",
      createdAt: Date.now(),
    }
    addBibleCharacter(newChar)
    selectBibleCharacter(newChar.id)
  }

  const handleSave = () => {
    if (!selectedBibleCharacterId || !edit.name?.trim()) return
    // 验证六层锚点
    if (edit.identityAnchors) {
      const validation = validateIdentityAnchors(edit.identityAnchors)
      if (!validation.valid) {
        alert(`角色锚点不完整：\n${validation.errors.join("\n")}`)
        return
      }
    }
    updateBibleCharacter(selectedBibleCharacterId, edit)
    setTab("list")
    selectBibleCharacter(null)
  }

  const handleDelete = (id: string) => {
    if (selectedBibleCharacterId === id) {
      setTab("list")
    }
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
      reader.onload = (ev) => {
        setEdit((prev) => ({ ...prev, referenceImageUrl: ev.target?.result as string }))
      }
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
      if (!res.ok) {
        throw new Error(`Bible director API error: ${res.status} ${res.statusText}`)
      }
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

  /** 根据紫微斗数命盘生成角色设定 */
  const handleAstrologyGenerate = () => {
    if (!birthDate.trim() || astrologyGenerating) return
    setAstrologyGenerating(true)
    setAstrologyResult(null)
    try {
      // 动态导入 iztro（首次用时加载 24KB）
      import("../../utils/characterAstrologyService").then(({ generateCharacterFromBirth }) => {
        const result = generateCharacterFromBirth({
          dateStr: birthDate.trim(),
          timeIndex: parseInt(birthTime, 10),
          gender: birthGender,
          dateType: birthType,
        })
        if (result.error) {
          setAstrologyResult(`❌ ${result.error}`)
          return
        }
        if (result.profile) {
          const p = result.profile
          const summary = [
            `【四柱八字】${p.chineseDate}`,
            ``,
            `【核心性格】${p.personalitySummary}`,
            ``,
            `✨ 优势特质：${p.strength.join("、")}`,
            `⚠️ 潜在不足：${p.weakness.join("、")}`,
            `🎯 天赋特长：${p.talent.join("；")}`,
            ``,
            `💼 事业风格：${p.careerStyle}`,
            `❤️ 感情风格：${p.relationshipStyle}`,
            `💰 财富观：${p.wealthStyle}`,
            ``,
            p.lifeDomains.map((d) => `【${d.domain}】${d.description}`).join("\n"),
          ].join("\n")
          setAstrologyResult(summary)
          // 自动填充角色信息
          const astroUpdates = {
            name: (edit.name || `命盘角色_${p.chineseDate}`),
            physicalTraits: [...new Set([...(edit.physicalTraits || []), ...p.coreTraits])],
          }
          setEdit((prev) => ({ ...prev, ...astroUpdates }))
          // 写入 Zustand store（如果正在编辑现有角色）
          if (edit.id) {
            updateBibleCharacter(edit.id, astroUpdates)
          }
        }
      }).catch(() => {
        setAstrologyResult("❌ 紫微斗数引擎加载失败")
      })
    } finally {
      setAstrologyGenerating(false)
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
      {/* 遮罩 */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
        onClick={onClose}
      />

      {/* 面板主体 */}
      <div
        className="relative z-10 w-[520px] max-h-[85vh] overflow-hidden rounded-2xl border flex flex-col"
        style={{
          backgroundColor: DESIGN_TOKENS.panelSolid,
          borderColor: DESIGN_TOKENS.border,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0" style={{ borderColor: DESIGN_TOKENS.border }}>
          <div className="flex items-center gap-2">
            <UserRound size={18} strokeWidth={ICON_CONFIG.strokeWidth} style={{ color: DESIGN_TOKENS.accent }} />
            <h3 className="text-sm font-medium" style={{ color: DESIGN_TOKENS.text }}>
              {tab === "edit" ? "编辑角色" : "角色圣经"}
            </h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 transition-colors hover:bg-white/10">
            <X size={16} strokeWidth={ICON_CONFIG.strokeWidth} style={{ color: DESIGN_TOKENS.textMuted }} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === "list" ? (
            /* ========== 角色列表 ========== */
            <div className="space-y-2">
              {bibleCharacters.length === 0 && (
                <p className="text-xs text-center py-8" style={{ color: DESIGN_TOKENS.textMuted }}>
                  暂无角色，点击下方按钮创建
                </p>
              )}
              {bibleCharacters.map((char) => (
                <div
                  key={char.id}
                  className="group flex items-center gap-3 rounded-xl p-3 cursor-pointer transition-colors"
                  style={{
                    backgroundColor: selectedBibleCharacterId === char.id ? DESIGN_TOKENS.accentSoft : DESIGN_TOKENS.card,
                    border: `1px solid ${selectedBibleCharacterId === char.id ? DESIGN_TOKENS.accent : DESIGN_TOKENS.border}`,
                  }}
                  onClick={() => selectBibleCharacter(char.id)}
                >
                  {/* 头像占位 */}
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
                    style={{ backgroundColor: DESIGN_TOKENS.accentSoft }}
                  >
                    {char.referenceImageUrl ? (
                      <img src={char.referenceImageUrl} alt={char.name} className="w-full h-full object-cover" />
                    ) : (
                      <UserRound size={18} strokeWidth={1.5} style={{ color: DESIGN_TOKENS.accent }} />
                    )}
                  </div>
                  {/* 角色信息 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: DESIGN_TOKENS.text }}>
                      {char.name || "未命名角色"}
                    </p>
                    {char.role && (
                      <p className="text-xs truncate" style={{ color: DESIGN_TOKENS.textMuted }}>
                        {char.role}
                      </p>
                    )}
                  </div>
                  {/* 删除按钮 */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(char.id) }}
                    className="rounded-lg p-1.5 transition-colors hover:bg-red-500/20 opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14} strokeWidth={1.5} style={{ color: DESIGN_TOKENS.textMuted }} />
                  </button>
                </div>
              ))}

              {/* 新建角色按钮 */}
              <button
                onClick={handleCreateNew}
                className="flex items-center justify-center gap-2 w-full rounded-xl p-3 transition-colors"
                style={{
                  border: `1px dashed ${DESIGN_TOKENS.borderStrong}`,
                  color: DESIGN_TOKENS.accent,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = DESIGN_TOKENS.accentSoft)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <Plus size={16} strokeWidth={1.5} />
                <span className="text-sm">新建角色</span>
              </button>
            </div>
          ) : (
            /* ========== 角色编辑表单 ========== */
            <div className="space-y-4">
              {/* AI 生成按钮 */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <button
                  onClick={() => setShowAiInput(!showAiInput)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "rgb(52, 211, 153)" }}
                >
                  <Sparkles size={12} strokeWidth={1.5} />
                  {showAiInput ? "取消" : "AI 生成角色设定"}
                </button>
                <button
                  onClick={() => setShowAstrologyInput(!showAstrologyInput)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{ backgroundColor: "rgba(139, 92, 246, 0.15)", color: "rgb(167, 139, 250)" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" />
                  </svg>
                  {showAstrologyInput ? "取消" : "紫微斗数角色设计"}
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

              {/* 紫微斗数输入区域 */}
              {showAstrologyInput && (
                <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "rgba(139, 92, 246, 0.25)", backgroundColor: "rgba(139, 92, 246, 0.06)" }}>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] mb-1" style={{ color: DESIGN_TOKENS.textSecondary }}>出生日期</label>
                      <input
                        type="text"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        placeholder="如 2000-8-16"
                        className="w-full rounded-lg border bg-black/40 px-2 py-1.5 text-xs text-white outline-none"
                        style={{ borderColor: DESIGN_TOKENS.border }}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] mb-1" style={{ color: DESIGN_TOKENS.textSecondary }}>时辰</label>
                      <select
                        value={birthTime}
                        onChange={(e) => setBirthTime(e.target.value)}
                        className="w-full rounded-lg border bg-black/40 px-2 py-1.5 text-xs text-white outline-none"
                        style={{ borderColor: DESIGN_TOKENS.border }}
                      >
                        <option value="0">早子时 00:00-01:00</option>
                        <option value="1">丑时 01:00-03:00</option>
                        <option value="2">寅时 03:00-05:00</option>
                        <option value="3">卯时 05:00-07:00</option>
                        <option value="4">辰时 07:00-09:00</option>
                        <option value="5">巳时 09:00-11:00</option>
                        <option value="6">午时 11:00-13:00</option>
                        <option value="7">未时 13:00-15:00</option>
                        <option value="8">申时 15:00-17:00</option>
                        <option value="9">酉时 17:00-19:00</option>
                        <option value="10">戌时 19:00-21:00</option>
                        <option value="11">亥时 21:00-23:00</option>
                        <option value="12">晚子时 23:00-00:00</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] mb-1" style={{ color: DESIGN_TOKENS.textSecondary }}>性别</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setBirthGender("男")}
                          className="flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors"
                          style={{
                            backgroundColor: birthGender === "男" ? "rgba(139, 92, 246, 0.3)" : "rgba(255,255,255,0.05)",
                            color: birthGender === "男" ? "rgb(167, 139, 250)" : DESIGN_TOKENS.textMuted,
                          }}
                        >男</button>
                        <button
                          onClick={() => setBirthGender("女")}
                          className="flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors"
                          style={{
                            backgroundColor: birthGender === "女" ? "rgba(139, 92, 246, 0.3)" : "rgba(255,255,255,0.05)",
                            color: birthGender === "女" ? "rgb(167, 139, 250)" : DESIGN_TOKENS.textMuted,
                          }}
                        >女</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] mb-1" style={{ color: DESIGN_TOKENS.textSecondary }}>历法</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setBirthType("solar")}
                          className="flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors"
                          style={{
                            backgroundColor: birthType === "solar" ? "rgba(139, 92, 246, 0.3)" : "rgba(255,255,255,0.05)",
                            color: birthType === "solar" ? "rgb(167, 139, 250)" : DESIGN_TOKENS.textMuted,
                          }}
                        >阳历</button>
                        <button
                          onClick={() => setBirthType("lunar")}
                          className="flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors"
                          style={{
                            backgroundColor: birthType === "lunar" ? "rgba(139, 92, 246, 0.3)" : "rgba(255,255,255,0.05)",
                            color: birthType === "lunar" ? "rgb(167, 139, 250)" : DESIGN_TOKENS.textMuted,
                          }}
                        >农历</button>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleAstrologyGenerate}
                    disabled={astrologyGenerating || !birthDate.trim()}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity w-full justify-center"
                    style={{ backgroundColor: "rgb(139, 92, 246)", opacity: astrologyGenerating || !birthDate.trim() ? 0.5 : 1 }}
                  >
                    {astrologyGenerating ? (
                      <><Loader2 size={12} className="animate-spin" /> 排盘中...</>
                    ) : (
                      <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/></svg> 根据命盘生成角色</>
                    )}
                  </button>
                  {astrologyResult && (
                    <div className="mt-2 rounded-lg p-2 text-xs" style={{ backgroundColor: "rgba(139, 92, 246, 0.1)", color: "rgb(196, 181, 253)" }}>
                      {astrologyResult}
                    </div>
                  )}
                </div>
              )}

              {/* 参考图片 */}
              <div>
                <label className="mb-1.5 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>
                  参考图片
                </label>
                <div
                  className="relative rounded-xl border-2 border-dashed p-4 flex items-center justify-center cursor-pointer transition-colors"
                  style={{ borderColor: DESIGN_TOKENS.border, minHeight: 120 }}
                  onClick={handleImageUpload}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = DESIGN_TOKENS.accent)}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = DESIGN_TOKENS.border)}
                >
                  {edit.referenceImageUrl ? (
                    <div className="relative w-full">
                      <img
                        src={edit.referenceImageUrl}
                        alt="角色参考图"
                        className="w-full h-32 object-contain rounded-lg"
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); setEdit((prev) => ({ ...prev, referenceImageUrl: undefined })) }}
                        className="absolute top-1 right-1 rounded-full p-1 bg-black/60"
                      >
                        <X size={12} strokeWidth={1.5} style={{ color: "#fff" }} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <ImageIcon size={24} strokeWidth={1.5} style={{ color: DESIGN_TOKENS.textMuted }} />
                      <span className="text-xs" style={{ color: DESIGN_TOKENS.textMuted }}>
                        点击上传角色参考图
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 姓名 */}
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>
                  角色姓名 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={edit.name || ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="例：宋明远"
                  className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none"
                  style={{ borderColor: DESIGN_TOKENS.border }}
                  onFocus={(e) => (e.target.style.borderColor = DESIGN_TOKENS.accent)}
                  onBlur={(e) => (e.target.style.borderColor = DESIGN_TOKENS.border)}
                />
              </div>

              {/* 别名 */}
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>
                  别名（逗号分隔）
                </label>
                <input
                  type="text"
                  value={(edit.aliases || []).join(", ")}
                  onChange={(e) => setEdit((prev) => ({ ...prev, aliases: e.target.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean) }))}
                  placeholder="例：小明, 宋总"
                  className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none"
                  style={{ borderColor: DESIGN_TOKENS.border }}
                />
              </div>

              {/* 角色定位 */}
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>
                  角色定位
                </label>
                <input
                  type="text"
                  value={edit.role || ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, role: e.target.value }))}
                  placeholder="例：主角 / 反派 / 配角"
                  className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none"
                  style={{ borderColor: DESIGN_TOKENS.border }}
                />
              </div>

              {/* 外貌特征 */}
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>
                  外貌特征
                </label>
                <textarea
                  value={edit.visualSignature || ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, visualSignature: e.target.value }))}
                  placeholder="描述角色的外貌：身高、体型、脸型、发型、眼睛颜色、肤色、面部特征…"
                  rows={3}
                  className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none resize-none"
                  style={{ borderColor: DESIGN_TOKENS.border }}
                />
              </div>

              {/* ===== 六层身份锚点（对标 Moyin Creator）===== */}
              <div className="border border-dashed rounded-xl p-3 space-y-3" style={{ borderColor: "rgba(168, 85, 247, 0.3)", backgroundColor: "rgba(168, 85, 247, 0.05)" }}>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium" style={{ color: "#a855f7" }}>
                    ⚡ 六层身份锚点（高级 · 保证角色一致性）
                  </label>
                  {edit.identityAnchors && (
                    <span className="text-xs" style={{ color: DESIGN_TOKENS.accent }}>
                      {validateIdentityAnchors(edit.identityAnchors).valid ? "✓ 完整" : "⚠ 需完善第三层"}
                    </span>
                  )}
                </div>

                {/* 第一层：骨相 */}
                <details className="text-xs">
                  <summary className="cursor-pointer font-medium mb-1" style={{ color: DESIGN_TOKENS.textSecondary }}>第一层：骨相（脸型/下颌线/颧骨）</summary>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <input
                      type="text"
                      value={edit.identityAnchors?.skeletal?.faceShape || ""}
                      onChange={(e) => setEdit((prev) => ({ ...prev, identityAnchors: { ...(prev.identityAnchors ?? createDefaultIdentityAnchors()), skeletal: { ...(prev.identityAnchors ?? createDefaultIdentityAnchors()).skeletal, faceShape: e.target.value } }}))}
                      placeholder="脸型：圆脸/方脸/鹅蛋脸"
                      className="rounded-lg border bg-black/40 px-2 py-1 text-xs text-white outline-none"
                      style={{ borderColor: DESIGN_TOKENS.border }}
                    />
                    <input
                      type="text"
                      value={edit.identityAnchors?.skeletal?.jawline || ""}
                      onChange={(e) => setEdit((prev) => ({ ...prev, identityAnchors: { ...(prev.identityAnchors ?? createDefaultIdentityAnchors()), skeletal: { ...(prev.identityAnchors ?? createDefaultIdentityAnchors()).skeletal, jawline: e.target.value } }}))}
                      placeholder="下颌线：分明/圆润"
                      className="rounded-lg border bg-black/40 px-2 py-1 text-xs text-white outline-none"
                      style={{ borderColor: DESIGN_TOKENS.border }}
                    />
                    <input
                      type="text"
                      value={edit.identityAnchors?.skeletal?.cheekbones || ""}
                      onChange={(e) => setEdit((prev) => ({ ...prev, identityAnchors: { ...(prev.identityAnchors ?? createDefaultIdentityAnchors()), skeletal: { ...(prev.identityAnchors ?? createDefaultIdentityAnchors()).skeletal, cheekbones: e.target.value } }}))}
                      placeholder="颧骨：高/平/宽"
                      className="rounded-lg border bg-black/40 px-2 py-1 text-xs text-white outline-none"
                      style={{ borderColor: DESIGN_TOKENS.border }}
                    />
                  </div>
                </details>

                {/* 第二层：五官 */}
                <details className="text-xs">
                  <summary className="cursor-pointer font-medium mb-1" style={{ color: DESIGN_TOKENS.textSecondary }}>第二层：五官（眼/鼻/唇）</summary>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <input
                      type="text"
                      value={edit.identityAnchors?.features?.eyeShape || ""}
                      onChange={(e) => setEdit((prev) => ({ ...prev, identityAnchors: { ...(prev.identityAnchors ?? createDefaultIdentityAnchors()), features: { ...(prev.identityAnchors ?? createDefaultIdentityAnchors()).features, eyeShape: e.target.value } }}))}
                      placeholder="眼型：丹凤眼/杏眼/桃花眼"
                      className="rounded-lg border bg-black/40 px-2 py-1 text-xs text-white outline-none"
                      style={{ borderColor: DESIGN_TOKENS.border }}
                    />
                    <input
                      type="text"
                      value={edit.identityAnchors?.features?.eyeDetails || ""}
                      onChange={(e) => setEdit((prev) => ({ ...prev, identityAnchors: { ...(prev.identityAnchors ?? createDefaultIdentityAnchors()), features: { ...(prev.identityAnchors ?? createDefaultIdentityAnchors()).features, eyeDetails: e.target.value } }}))}
                      placeholder="眼细节：单眼皮/内双/外双"
                      className="rounded-lg border bg-black/40 px-2 py-1 text-xs text-white outline-none"
                      style={{ borderColor: DESIGN_TOKENS.border }}
                    />
                    <input
                      type="text"
                      value={edit.identityAnchors?.features?.noseShape || ""}
                      onChange={(e) => setEdit((prev) => ({ ...prev, identityAnchors: { ...(prev.identityAnchors ?? createDefaultIdentityAnchors()), features: { ...(prev.identityAnchors ?? createDefaultIdentityAnchors()).features, noseShape: e.target.value } }}))}
                      placeholder="鼻型：直鼻/翘鼻/蒜头鼻"
                      className="rounded-lg border bg-black/40 px-2 py-1 text-xs text-white outline-none"
                      style={{ borderColor: DESIGN_TOKENS.border }}
                    />
                    <input
                      type="text"
                      value={edit.identityAnchors?.features?.lipShape || ""}
                      onChange={(e) => setEdit((prev) => ({ ...prev, identityAnchors: { ...(prev.identityAnchors ?? createDefaultIdentityAnchors()), features: { ...(prev.identityAnchors ?? createDefaultIdentityAnchors()).features, lipShape: e.target.value } }}))}
                      placeholder="唇型：薄唇/厚唇/M字唇"
                      className="rounded-lg border bg-black/40 px-2 py-1 text-xs text-white outline-none"
                      style={{ borderColor: DESIGN_TOKENS.border }}
                    />
                  </div>
                </details>

                {/* 第三层：辨识标记（必填） */}
                <details className="text-xs" open>
                  <summary className="cursor-pointer font-medium mb-1 text-red-400">第三层：辨识标记（必填 · 最强一致性锚点）</summary>
                  <div className="space-y-1 mt-1">
                    <textarea
                      value={(edit.identityAnchors?.uniqueMarks?.marks || []).join("\n")}
                      onChange={(e) => setEdit((prev) => ({
                        ...prev,
                        identityAnchors: {
                          ...(prev.identityAnchors ?? createDefaultIdentityAnchors()),
                          uniqueMarks: {
                            ...(prev.identityAnchors ?? createDefaultIdentityAnchors()).uniqueMarks,
                            marks: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                          },
                        },
                      }))}
                      placeholder="每行一个辨识标记，例：\n左眼下方2cm处有一颗痣\n右眉尾有一道小疤痕"
                      rows={2}
                      className="w-full rounded-lg border bg-black/40 px-2 py-1 text-xs text-white outline-none resize-none"
                      style={{ borderColor: "#f87171" }}
                    />
                    <p className="text-xs" style={{ color: DESIGN_TOKENS.textMuted }}>
                      提示：这是防止 AI 生成时角色「漂移」的最强锚点，请务必填写
                    </p>
                  </div>
                </details>

                {/* 第四层：色彩锚点（Hex） */}
                <details className="text-xs">
                  <summary className="cursor-pointer font-medium mb-1" style={{ color: DESIGN_TOKENS.textSecondary }}>第四层：精确色值（Hex · 可直接对接 ComfyUI）</summary>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div className="flex items-center gap-1">
                      <span className="text-xs" style={{ color: DESIGN_TOKENS.textMuted }}>虹膜</span>
                      <input
                        type="text"
                        value={edit.identityAnchors?.colorAnchors?.iris || ""}
                        onChange={(e) => setEdit((prev) => ({ ...prev, identityAnchors: { ...(prev.identityAnchors ?? createDefaultIdentityAnchors()), colorAnchors: { ...(prev.identityAnchors ?? createDefaultIdentityAnchors()).colorAnchors, iris: e.target.value } }}))}
                        placeholder="#4A2C2A"
                        className="flex-1 rounded-lg border bg-black/40 px-2 py-1 text-xs text-white outline-none font-mono"
                        style={{ borderColor: DESIGN_TOKENS.border }}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs" style={{ color: DESIGN_TOKENS.textMuted }}>发色</span>
                      <input
                        type="text"
                        value={edit.identityAnchors?.colorAnchors?.hair || ""}
                        onChange={(e) => setEdit((prev) => ({ ...prev, identityAnchors: { ...(prev.identityAnchors ?? createDefaultIdentityAnchors()), colorAnchors: { ...(prev.identityAnchors ?? createDefaultIdentityAnchors()).colorAnchors, hair: e.target.value } }}))}
                        placeholder="#1A1A1A"
                        className="flex-1 rounded-lg border bg-black/40 px-2 py-1 text-xs text-white outline-none font-mono"
                        style={{ borderColor: DESIGN_TOKENS.border }}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs" style={{ color: DESIGN_TOKENS.textMuted }}>肤色</span>
                      <input
                        type="text"
                        value={edit.identityAnchors?.colorAnchors?.skin || ""}
                        onChange={(e) => setEdit((prev) => ({ ...prev, identityAnchors: { ...(prev.identityAnchors ?? createDefaultIdentityAnchors()), colorAnchors: { ...(prev.identityAnchors ?? createDefaultIdentityAnchors()).colorAnchors, skin: e.target.value } }}))}
                        placeholder="#F5D0A6"
                        className="flex-1 rounded-lg border bg-black/40 px-2 py-1 text-xs text-white outline-none font-mono"
                        style={{ borderColor: DESIGN_TOKENS.border }}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs" style={{ color: DESIGN_TOKENS.textMuted }}>唇色</span>
                      <input
                        type="text"
                        value={edit.identityAnchors?.colorAnchors?.lips || ""}
                        onChange={(e) => setEdit((prev) => ({ ...prev, identityAnchors: { ...(prev.identityAnchors ?? createDefaultIdentityAnchors()), colorAnchors: { ...(prev.identityAnchors ?? createDefaultIdentityAnchors()).colorAnchors, lips: e.target.value } }}))}
                        placeholder="#C86B6B"
                        className="flex-1 rounded-lg border bg-black/40 px-2 py-1 text-xs text-white outline-none font-mono"
                        style={{ borderColor: DESIGN_TOKENS.border }}
                      />
                    </div>
                  </div>
                </details>

                {/* 第五层：皮肤纹理 */}
                <details className="text-xs">
                  <summary className="cursor-pointer font-medium mb-1" style={{ color: DESIGN_TOKENS.textSecondary }}>第五层：皮肤纹理（微观细节）</summary>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <input
                      type="text"
                      value={edit.identityAnchors?.skinTexture?.skinTexture || ""}
                      onChange={(e) => setEdit((prev) => ({ ...prev, identityAnchors: { ...(prev.identityAnchors ?? createDefaultIdentityAnchors()), skinTexture: { ...(prev.identityAnchors ?? createDefaultIdentityAnchors()).skinTexture, skinTexture: e.target.value } }}))}
                      placeholder="皮肤纹理：细腻/有雀斑"
                      className="rounded-lg border bg-black/40 px-2 py-1 text-xs text-white outline-none"
                      style={{ borderColor: DESIGN_TOKENS.border }}
                    />
                    <input
                      type="text"
                      value={edit.identityAnchors?.skinTexture?.lightingReaction || ""}
                      onChange={(e) => setEdit((prev) => ({ ...prev, identityAnchors: { ...(prev.identityAnchors ?? createDefaultIdentityAnchors()), skinTexture: { ...(prev.identityAnchors ?? createDefaultIdentityAnchors()).skinTexture, lightingReaction: e.target.value } }}))}
                      placeholder="光线反应：反光明显/哑光"
                      className="rounded-lg border bg-black/40 px-2 py-1 text-xs text-white outline-none"
                      style={{ borderColor: DESIGN_TOKENS.border }}
                    />
                  </div>
                </details>

                {/* 第六层：发型锚点 */}
                <details className="text-xs">
                  <summary className="cursor-pointer font-medium mb-1" style={{ color: DESIGN_TOKENS.textSecondary }}>第六层：发型锚点（发际线/层次）</summary>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <input
                      type="text"
                      value={edit.identityAnchors?.hair?.hairlineType || ""}
                      onChange={(e) => setEdit((prev) => ({ ...prev, identityAnchors: { ...(prev.identityAnchors ?? createDefaultIdentityAnchors()), hair: { ...(prev.identityAnchors ?? createDefaultIdentityAnchors()).hair, hairlineType: e.target.value } }}))}
                      placeholder="发际线：M字额/平额"
                      className="rounded-lg border bg-black/40 px-2 py-1 text-xs text-white outline-none"
                      style={{ borderColor: DESIGN_TOKENS.border }}
                    />
                    <input
                      type="text"
                      value={edit.identityAnchors?.hair?.hairTexture || ""}
                      onChange={(e) => setEdit((prev) => ({ ...prev, identityAnchors: { ...(prev.identityAnchors ?? createDefaultIdentityAnchors()), hair: { ...(prev.identityAnchors ?? createDefaultIdentityAnchors()).hair, hairTexture: e.target.value } }}))}
                      placeholder="发质：直/卷/波浪"
                      className="rounded-lg border bg-black/40 px-2 py-1 text-xs text-white outline-none"
                      style={{ borderColor: DESIGN_TOKENS.border }}
                    />
                    <input
                      type="text"
                      value={edit.identityAnchors?.hair?.uniqueHairMark || ""}
                      onChange={(e) => setEdit((prev) => ({ ...prev, identityAnchors: { ...(prev.identityAnchors ?? createDefaultIdentityAnchors()), hair: { ...(prev.identityAnchors ?? createDefaultIdentityAnchors()).hair, uniqueHairMark: e.target.value } }}))}
                      placeholder="独特发部标记（选填）"
                      className="rounded-lg border bg-black/40 px-2 py-1 text-xs text-white outline-none col-span-2"
                      style={{ borderColor: DESIGN_TOKENS.border }}
                    />
                  </div>
                </details>

                {/* 编译预览 */}
                {edit.identityAnchors && validateIdentityAnchors(edit.identityAnchors).valid && (
                  <div className="rounded-lg p-2 text-xs" style={{ backgroundColor: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                    <p className="font-medium mb-1" style={{ color: "rgb(52, 211, 153)" }}>编译后的身份提示词预览：</p>
                    <p className="text-xs break-all" style={{ color: DESIGN_TOKENS.textMuted }}>
                      {compileIdentityPrompt(edit.identityAnchors)}
                    </p>
                  </div>
                )}
              </div>

              {/* 服装风格 */}
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>
                  服装风格
                </label>
                <textarea
                  value={edit.costume || ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, costume: e.target.value }))}
                  placeholder="描述角色常穿服装：颜色、款式、材质、配饰…"
                  rows={2}
                  className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none resize-none"
                  style={{ borderColor: DESIGN_TOKENS.border }}
                />
              </div>

              {/* 道具 */}
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>
                  常用道具（逗号分隔）
                </label>
                <input
                  type="text"
                  value={(edit.props || []).join(", ")}
                  onChange={(e) => setEdit((prev) => ({ ...prev, props: e.target.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean) }))}
                  placeholder="例：烟斗, 怀表, 手枪"
                  className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none"
                  style={{ borderColor: DESIGN_TOKENS.border }}
                />
              </div>

              {/* 色彩基调 */}
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>
                  色彩基调（逗号分隔）
                </label>
                <input
                  type="text"
                  value={(edit.colorPalette || []).join(", ")}
                  onChange={(e) => setEdit((prev) => ({ ...prev, colorPalette: e.target.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean) }))}
                  placeholder="例：深蓝, 墨绿, 金色"
                  className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none"
                  style={{ borderColor: DESIGN_TOKENS.border }}
                />
              </div>

              {/* 背景故事 */}
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>
                  背景故事
                </label>
                <textarea
                  value={edit.backstory || ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, backstory: e.target.value }))}
                  placeholder="角色的背景故事、经历、动机…"
                  rows={3}
                  className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none resize-none"
                  style={{ borderColor: DESIGN_TOKENS.border }}
                />
              </div>

              {/* 人物弧光 */}
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>
                  人物弧光（arc）
                </label>
                <textarea
                  value={edit.arcDescription || ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, arcDescription: e.target.value }))}
                  placeholder="角色在故事中的成长/变化轨迹…"
                  rows={2}
                  className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none resize-none"
                  style={{ borderColor: DESIGN_TOKENS.border }}
                />
              </div>

              {/* 备注 */}
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>
                  备注
                </label>
                <textarea
                  value={edit.notes || ""}
                  onChange={(e) => setEdit((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="其他备注…"
                  rows={2}
                  className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none resize-none"
                  style={{ borderColor: DESIGN_TOKENS.border }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {tab === "edit" && (
          <div className="flex items-center justify-between p-4 border-t shrink-0" style={{ borderColor: DESIGN_TOKENS.border }}>
            <button
              onClick={() => { setTab("list"); selectBibleCharacter(null) }}
              className="rounded-lg px-3 py-1.5 text-xs transition-colors hover:bg-white/10"
              style={{ color: DESIGN_TOKENS.textMuted }}
            >
              返回列表
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: DESIGN_TOKENS.accent, opacity: edit.name?.trim() ? 1 : 0.5 }}
              disabled={!edit.name?.trim()}
            >
              <Save size={12} strokeWidth={1.5} /> 保存角色
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
