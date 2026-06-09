/**
 * VisualStyleBiblePanel — 视觉风格圣经面板
 * 整体视觉风格设定：色调、光影、画幅比例、胶片质感等
 */
"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import { X, Plus, Palette, Trash2, Save } from "lucide-react"
import { DESIGN_TOKENS, ICON_CONFIG } from "../../styles/designSystem"
import { useCanvasStore } from "../../stores/canvasStore"
import type { VisualStyleBibleData } from "../canvas/types"
import { generateId } from "../../utils/generateId"

export function VisualStyleBiblePanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { bibleStyles, addBibleStyle, updateBibleStyle, removeBibleStyle } = useCanvasStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [edit, setEdit] = useState<Partial<VisualStyleBibleData>>({})

  const selected = editingId ? bibleStyles.find((s) => s.id === editingId) : null

  const handleNew = () => {
    const newStyle: VisualStyleBibleData = {
      id: generateId(),
      name: "",
      createdAt: Date.now(),
    }
    addBibleStyle(newStyle)
    setEditingId(newStyle.id)
    setEdit(newStyle)
  }

  const handleSelect = (id: string) => {
    const style = bibleStyles.find((s) => s.id === id)
    if (!style) return
    setEditingId(id)
    setEdit(style)
  }

  const handleSave = () => {
    if (!editingId || !edit.name?.trim()) return
    updateBibleStyle(editingId, edit)
    setEditingId(null)
    setEdit({})
  }

  const handleDelete = (id: string) => {
    if (editingId === id) { setEditingId(null); setEdit({}) }
    removeBibleStyle(id)
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
            <Palette size={18} strokeWidth={ICON_CONFIG.strokeWidth} style={{ color: DESIGN_TOKENS.accent }} />
            <h3 className="text-sm font-medium" style={{ color: DESIGN_TOKENS.text }}>视觉风格圣经</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 transition-colors hover:bg-white/10">
            <X size={16} strokeWidth={ICON_CONFIG.strokeWidth} style={{ color: DESIGN_TOKENS.textMuted }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!editingId ? (
            <div className="space-y-2">
              {bibleStyles.length === 0 && (
                <p className="text-xs text-center py-8" style={{ color: DESIGN_TOKENS.textMuted }}>暂无视觉风格，点击下方按钮创建</p>
              )}
              {bibleStyles.map((style) => (
                <div key={style.id}
                  className="flex items-center gap-3 rounded-xl p-3 cursor-pointer transition-colors"
                  style={{ backgroundColor: DESIGN_TOKENS.card, border: `1px solid ${DESIGN_TOKENS.border}` }}
                  onClick={() => handleSelect(style.id)}
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: DESIGN_TOKENS.accentSoft }}>
                    <Palette size={18} strokeWidth={1.5} style={{ color: DESIGN_TOKENS.accent }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: DESIGN_TOKENS.text }}>{style.name || "未命名风格"}</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(style.id) }}
                    className="rounded-lg p-1.5 transition-colors hover:bg-red-500/20">
                    <Trash2 size={14} strokeWidth={1.5} style={{ color: DESIGN_TOKENS.textMuted }} />
                  </button>
                </div>
              ))}
              <button onClick={handleNew}
                className="flex items-center justify-center gap-2 w-full rounded-xl p-3 transition-colors"
                style={{ border: `1px dashed ${DESIGN_TOKENS.borderStrong}`, color: DESIGN_TOKENS.accent }}>
                <Plus size={16} strokeWidth={1.5} />
                <span className="text-sm">新建风格</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>风格名称 <span className="text-red-400">*</span></label>
                <input type="text" value={edit.name || ""}
                  onChange={(e) => setEdit((p) => ({ ...p, name: e.target.value }))}
                  placeholder="例：赛博朋克 / 新黑色电影"
                  className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none"
                  style={{ borderColor: DESIGN_TOKENS.border }} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>描述</label>
                <textarea value={edit.description || ""}
                  onChange={(e) => setEdit((p) => ({ ...p, description: e.target.value }))}
                  placeholder="整体视觉风格描述…" rows={3}
                  className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none resize-none"
                  style={{ borderColor: DESIGN_TOKENS.border }} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>色彩基调（逗号分隔）</label>
                <input type="text" value={(edit.colorPalette || []).join(", ")}
                  onChange={(e) => setEdit((p) => ({ ...p, colorPalette: e.target.value.split(/[,，]/).map(s => s.trim()).filter(Boolean) }))}
                  placeholder="例：青橙, 暗紫, 荧光蓝"
                  className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none"
                  style={{ borderColor: DESIGN_TOKENS.border }} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>光影风格</label>
                <input type="text" value={edit.lightingStyle || ""}
                  onChange={(e) => setEdit((p) => ({ ...p, lightingStyle: e.target.value }))}
                  placeholder="例：高反差 / 柔光 / 自然光"
                  className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none"
                  style={{ borderColor: DESIGN_TOKENS.border }} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>画幅比例</label>
                <input type="text" value={edit.aspectRatio || ""}
                  onChange={(e) => setEdit((p) => ({ ...p, aspectRatio: e.target.value }))}
                  placeholder="例：16:9 / 2.35:1 / 4:3"
                  className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none"
                  style={{ borderColor: DESIGN_TOKENS.border }} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>胶片质感</label>
                <input type="text" value={edit.filmStock || ""}
                  onChange={(e) => setEdit((p) => ({ ...p, filmStock: e.target.value }))}
                  placeholder="例：Kodak 2383 / 胶片颗粒 / Bleach Bypass"
                  className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none"
                  style={{ borderColor: DESIGN_TOKENS.border }} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>摄影机备注</label>
                <textarea value={edit.cameraNotes || ""}
                  onChange={(e) => setEdit((p) => ({ ...p, cameraNotes: e.target.value }))}
                  placeholder="摄影机运动偏好、镜头选择等…" rows={2}
                  className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none resize-none"
                  style={{ borderColor: DESIGN_TOKENS.border }} />
              </div>
            </div>
          )}
        </div>

        {editingId && (
          <div className="flex items-center justify-between p-4 border-t shrink-0" style={{ borderColor: DESIGN_TOKENS.border }}>
            <button onClick={() => { setEditingId(null); setEdit({}) }}
              className="rounded-lg px-3 py-1.5 text-xs transition-colors hover:bg-white/10"
              style={{ color: DESIGN_TOKENS.textMuted }}>返回列表</button>
            <button onClick={handleSave}
              className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: DESIGN_TOKENS.accent, opacity: edit.name?.trim() ? 1 : 0.5 }}
              disabled={!edit.name?.trim()}>
              <Save size={12} strokeWidth={1.5} /> 保存风格
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
