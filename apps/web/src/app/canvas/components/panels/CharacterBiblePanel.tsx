/**
 * CharacterBiblePanel — 角色圣经面板
 *
 * 对标小云雀 2.0 的角色一致性系统 + character-anchor-skill (MIT) 的多层锚点概念。
 * 管理角色的 6 层身份锚点（骨相、五官、辨识标记、色值、皮肤纹理、发型），
 * 生成角色参考图，维护角色黄金参考图库。
 *
 * 功能：
 *   - 角色列表 + 新增/编辑/删除
 *   - 6 层身份锚点详情编辑
 *   - 调用 bible-director API 增强角色
 *   - 角色三视图生成入口
 */
"use client"

import React, { useCallback, useState } from "react"
import { createPortal } from "react-dom"
import {
  X,
  Plus,
  User,
  Trash2,
  Save,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Eye,
  Camera,
  Palette,
  Ruler,
  type LucideIcon,
} from "lucide-react"
import { DESIGN_TOKENS } from "../../styles/designSystem"

// ── 类型 ──────────────────────────────────────────────

interface CharacterAnchor {
  /** 骨相 - facial bone structure */
  boneStructure: string
  /** 五官 - facial features */
  facialFeatures: string
  /** 辨识标记 - identifying marks */
  identifiers: string
  /** 色值 - color palette */
  colorPalette: string
  /** 皮肤纹理 - skin texture */
  skinTexture: string
  /** 发型 - hairstyle */
  hairstyle: string
}

interface CharacterBibleEntry {
  id: string
  name: string
  age?: string
  gender?: string
  role?: string
  description: string
  anchors: CharacterAnchor
  referenceImageUrl?: string
  sideViewUrl?: string
  backViewUrl?: string
  goldenGallery?: string[]
  createdAt: number
  updatedAt: number
}

const DEFAULT_ANCHORS: CharacterAnchor = {
  boneStructure: "",
  facialFeatures: "",
  identifiers: "",
  colorPalette: "",
  skinTexture: "",
  hairstyle: "",
}

const ANCHOR_FIELDS: { key: keyof CharacterAnchor; label: string; icon: LucideIcon; hint: string }[] = [
  { key: "boneStructure", label: "骨相", icon: Ruler, hint: "脸型、颧骨、下颌线、眉弓等面部骨骼特征" },
  { key: "facialFeatures", label: "五官", icon: Eye, hint: "眼距、鼻型、嘴宽、耳朵等五官具体描述" },
  { key: "identifiers", label: "辨识标记", icon: User, hint: "痣、疤痕、雀斑、纹身等独特身份标记" },
  { key: "colorPalette", label: "色值", icon: Palette, hint: "肤色、发色、瞳孔色、唇色" },
  { key: "skinTexture", label: "皮肤纹理", icon: Camera, hint: "皮肤质感、毛孔大小、光泽度" },
  { key: "hairstyle", label: "发型", icon: User, hint: "发型风格、发质、长度、发际线" },
]

interface CharacterBiblePanelProps {
  isOpen: boolean
  onClose: () => void
  /** 现有角色列表 (从父组件传入) */
  characters?: CharacterBibleEntry[]
  /** 新增/更新角色后的回调 */
  onCharactersChange?: (characters: CharacterBibleEntry[]) => void
}

// ── 组件 ──────────────────────────────────────────────

export function CharacterBiblePanel({
  isOpen,
  onClose,
  characters: initialCharacters = [],
  onCharactersChange,
}: CharacterBiblePanelProps) {
  const [characters, setCharacters] = useState<CharacterBibleEntry[]>(initialCharacters)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingAnchor, setEditingAnchor] = useState<keyof CharacterAnchor | null>(null)
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [enhanceError, setEnhanceError] = useState<string | null>(null)

  const selected = characters.find((c) => c.id === selectedId)

  // 新增角色
  const handleAdd = useCallback(() => {
    const newChar: CharacterBibleEntry = {
      id: `char-${Date.now()}`,
      name: `新角色 ${characters.length + 1}`,
      role: "主角",
      description: "",
      anchors: { ...DEFAULT_ANCHORS },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const updated = [...characters, newChar]
    setCharacters(updated)
    setSelectedId(newChar.id)
    onCharactersChange?.(updated)
  }, [characters, onCharactersChange])

  // 删除角色
  const handleDelete = useCallback((id: string) => {
    const updated = characters.filter((c) => c.id !== id)
    setCharacters(updated)
    if (selectedId === id) setSelectedId(null)
    onCharactersChange?.(updated)
  }, [characters, selectedId, onCharactersChange])

  // 更新角色字段
  const updateCharacter = useCallback((id: string, field: string, value: string) => {
    setCharacters((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, [field]: value, updatedAt: Date.now() } : c,
      ),
    )
  }, [])

  // 更新锚点
  const updateAnchor = useCallback((id: string, anchorKey: keyof CharacterAnchor, value: string) => {
    setCharacters((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, anchors: { ...c.anchors, [anchorKey]: value }, updatedAt: Date.now() }
          : c,
      ),
    )
  }, [])

  // AI 增强角色描述
  const handleEnhance = useCallback(async () => {
    if (!selected) return
    setIsEnhancing(true)
    setEnhanceError(null)

    try {
      const res = await fetch("/api/ai/bible-director", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "enhance_character",
          characters: [{ name: selected.name, description: selected.description, role: selected.role }],
        }),
      })

      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const data = await res.json()

      if (data.content) {
        updateCharacter(selected.id, "description", data.content)
      }
    } catch (err) {
      setEnhanceError(err instanceof Error ? err.message : "增强失败")
    } finally {
      setIsEnhancing(false)
    }
  }, [selected, updateCharacter])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
      <div
        className="relative flex h-[85vh] w-[96vw] max-w-[1100px] overflow-hidden rounded-2xl border shadow-2xl"
        style={{ backgroundColor: DESIGN_TOKENS.panel, borderColor: DESIGN_TOKENS.border }}
      >
        {/* ── 左侧角色列表 ── */}
        <div className="flex w-56 flex-col border-r" style={{ borderColor: DESIGN_TOKENS.border }}>
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: DESIGN_TOKENS.border }}>
            <span className="text-xs font-semibold" style={{ color: DESIGN_TOKENS.text }}>角色列表</span>
            <button
              onClick={handleAdd}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-all hover:bg-white/10"
              style={{ color: DESIGN_TOKENS.accentHover }}
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {characters.map((char) => (
              <button
                key={char.id}
                onClick={() => setSelectedId(char.id)}
                className="flex w-full items-center gap-2 border-b px-4 py-3 text-left text-xs transition-all hover:bg-white/5"
                style={{
                  borderColor: DESIGN_TOKENS.border,
                  backgroundColor: selectedId === char.id ? DESIGN_TOKENS.accentSoft : "transparent",
                  color: selectedId === char.id ? DESIGN_TOKENS.accentHover : DESIGN_TOKENS.textSecondary,
                }}
              >
                <User size={14} />
                <span className="truncate">{char.name}</span>
                {char.role && (
                  <span className="text-[10px] ml-auto" style={{ color: DESIGN_TOKENS.textMuted }}>
                    {char.role}
                  </span>
                )}
              </button>
            ))}
            {characters.length === 0 && (
              <div className="p-4 text-center text-xs" style={{ color: DESIGN_TOKENS.textMuted }}>
                点击 + 添加角色
              </div>
            )}
          </div>
        </div>

        {/* ── 右侧详情 ── */}
        <div className="flex flex-1 flex-col">
          {selected ? (
            <>
              {/* 基本信息 */}
              <div className="border-b p-4" style={{ borderColor: DESIGN_TOKENS.border }}>
                <div className="flex items-start justify-between mb-3">
                  <input
                    className="text-sm font-semibold bg-transparent outline-none border-b border-transparent focus:border-current w-48"
                    style={{ color: DESIGN_TOKENS.text }}
                    value={selected.name}
                    onChange={(e) => {
                      updateCharacter(selected.id, "name", e.target.value)
                      onCharactersChange?.(characters)
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleEnhance}
                      disabled={isEnhancing}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] transition-all"
                      style={{ backgroundColor: DESIGN_TOKENS.accentSoft, color: DESIGN_TOKENS.accentHover }}
                    >
                      <Sparkles size={12} />
                      {isEnhancing ? "增强中..." : "AI增强"}
                    </button>
                    <button
                      onClick={() => handleDelete(selected.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg transition-all hover:bg-white/10"
                      style={{ color: "#ef4444" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* 基本信息行 */}
                <div className="flex gap-3 mb-3">
                  {[
                    { label: "年龄", field: "age" },
                    { label: "性别", field: "gender" },
                    { label: "角色定位", field: "role" },
                  ].map(({ label, field }) => (
                    <div key={field} className="flex-1">
                      <label className="block text-[10px] mb-1" style={{ color: DESIGN_TOKENS.textMuted }}>{label}</label>
                      <input
                        className="w-full rounded-lg border px-2 py-1 text-xs bg-transparent outline-none"
                        style={{ borderColor: DESIGN_TOKENS.border, color: DESIGN_TOKENS.text }}
                        value={((selected as any)[field] as string) || ""}
                        onChange={(e) => updateCharacter(selected.id, field, e.target.value)}
                      />
                    </div>
                  ))}
                </div>

                {/* 描述 */}
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: DESIGN_TOKENS.textMuted }}>角色描述</label>
                  <textarea
                    className="w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none"
                    rows={3}
                    style={{ borderColor: DESIGN_TOKENS.border, color: DESIGN_TOKENS.text, backgroundColor: "rgba(255,255,255,0.03)" }}
                    value={selected.description}
                    onChange={(e) => updateCharacter(selected.id, "description", e.target.value)}
                  />
                </div>

                {enhanceError && (
                  <div className="mt-2 text-[10px]" style={{ color: "#ef4444" }}>{enhanceError}</div>
                )}
              </div>

              {/* 6 层锚点 */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Ruler size={14} style={{ color: DESIGN_TOKENS.textMuted }} />
                  <span className="text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>
                    6 层身份锚点（对标小云雀 2.0）
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {ANCHOR_FIELDS.map(({ key, label, icon: Icon, hint }) => (
                    <div
                      key={key}
                      className="rounded-xl border p-3"
                      style={{ borderColor: editingAnchor === key ? DESIGN_TOKENS.accent : DESIGN_TOKENS.border }}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Icon size={14} style={{ color: DESIGN_TOKENS.accentHover }} />
                        <span className="text-xs font-medium" style={{ color: DESIGN_TOKENS.text }}>{label}</span>
                      </div>
                      <textarea
                        className="w-full resize-none rounded-lg border px-2 py-1.5 text-[11px] outline-none"
                        rows={2}
                        style={{
                          borderColor: DESIGN_TOKENS.border,
                          color: DESIGN_TOKENS.text,
                          backgroundColor: "rgba(255,255,255,0.03)",
                        }}
                        value={selected.anchors[key] || ""}
                        onChange={(e) => updateAnchor(selected.id, key, e.target.value)}
                        onFocus={() => setEditingAnchor(key)}
                        onBlur={() => setEditingAnchor(null)}
                        placeholder={hint}
                      />
                      <p className="mt-1 text-[9px]" style={{ color: DESIGN_TOKENS.textMuted }}>
                        {hint}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center" style={{ color: DESIGN_TOKENS.textMuted }}>
              <div className="text-center">
                <User size={48} strokeWidth={1} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">选择一个角色或新建</p>
                <p className="text-xs mt-1">6 层身份锚点确保 AI 生成的角色一致性</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
