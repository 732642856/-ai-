/**
 * SceneBiblePanel — 场景圣经面板
 */
"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import { X, Plus, MapPin, Trash2, Save } from "lucide-react"
import { DESIGN_TOKENS, ICON_CONFIG } from "../../styles/designSystem"
import { useCanvasStore } from "../../stores/canvasStore"
import type { SceneBibleData } from "../canvas/types"
import { generateId } from "../../utils/generateId"

export function SceneBiblePanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { bibleScenes, addBibleScene, updateBibleScene, removeBibleScene } = useCanvasStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [edit, setEdit] = useState<Partial<SceneBibleData>>({})

  const handleNew = () => {
    const s: SceneBibleData = { id: generateId(), sceneNumber: bibleScenes.length + 1, location: "", createdAt: Date.now() }
    addBibleScene(s); setEditingId(s.id); setEdit(s)
  }
  const handleSelect = (id: string) => {
    const s = bibleScenes.find((x) => x.id === id); if (!s) return; setEditingId(id); setEdit(s)
  }
  const handleSave = () => {
    if (!editingId || !edit.location?.trim()) return; updateBibleScene(editingId, edit); setEditingId(null); setEdit({})
  }
  const handleDelete = (id: string) => { if (editingId === id) { setEditingId(null); setEdit({}) }; removeBibleScene(id) }

  if (!isOpen) return null
  if (typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={onClose} />
      <div className="relative z-10 w-[520px] max-h-[85vh] overflow-hidden rounded-2xl border flex flex-col"
        style={{ backgroundColor: DESIGN_TOKENS.panelSolid, borderColor: DESIGN_TOKENS.border }}>
        <div className="flex items-center justify-between p-4 border-b shrink-0" style={{ borderColor: DESIGN_TOKENS.border }}>
          <div className="flex items-center gap-2"><MapPin size={18} strokeWidth={ICON_CONFIG.strokeWidth} style={{ color: DESIGN_TOKENS.accent }} /><h3 className="text-sm font-medium" style={{ color: DESIGN_TOKENS.text }}>场景圣经</h3></div>
          <button onClick={onClose} className="rounded-lg p-1 transition-colors hover:bg-white/10"><X size={16} strokeWidth={ICON_CONFIG.strokeWidth} style={{ color: DESIGN_TOKENS.textMuted }} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {!editingId ? (
            <div className="space-y-2">
              {bibleScenes.length === 0 && <p className="text-xs text-center py-8" style={{ color: DESIGN_TOKENS.textMuted }}>暂无场景</p>}
              {bibleScenes.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-xl p-3 cursor-pointer transition-colors" style={{ backgroundColor: DESIGN_TOKENS.card, border: `1px solid ${DESIGN_TOKENS.border}` }} onClick={() => handleSelect(s.id)}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: DESIGN_TOKENS.accentSoft }}><span className="text-xs font-bold" style={{ color: DESIGN_TOKENS.accent }}>S{s.sceneNumber}</span></div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate" style={{ color: DESIGN_TOKENS.text }}>{s.location || "未命名场景"}</p>{s.timeOfDay && <p className="text-xs" style={{ color: DESIGN_TOKENS.textMuted }}>{s.timeOfDay}</p>}</div>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(s.id) }} className="rounded-lg p-1.5 transition-colors hover:bg-red-500/20"><Trash2 size={14} strokeWidth={1.5} style={{ color: DESIGN_TOKENS.textMuted }} /></button>
                </div>
              ))}
              <button onClick={handleNew} className="flex items-center justify-center gap-2 w-full rounded-xl p-3 transition-colors" style={{ border: `1px dashed ${DESIGN_TOKENS.borderStrong}`, color: DESIGN_TOKENS.accent }}><Plus size={16} strokeWidth={1.5} /><span className="text-sm">新建场景</span></button>
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { label: "场景编号", key: "sceneNumber", type: "number" as const },
                { label: "地点 *", key: "location", type: "text" as const, placeholder: "例：废弃工厂内部" },
                { label: "时间段", key: "timeOfDay", placeholder: "例：黄昏 / 深夜" },
                { label: "天气", key: "weather", placeholder: "例：暴雨 / 晴" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>{f.label}</label>
                  {f.type === "number" ? (
                    <input type="number" value={(edit as any)[f.key] || 1} onChange={(e) => setEdit((p) => ({ ...p, [f.key]: parseInt(e.target.value) || 1 }))} className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none" style={{ borderColor: DESIGN_TOKENS.border }} />
                  ) : (
                    <input type="text" value={(edit as any)[f.key] || ""} onChange={(e) => setEdit((p) => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none" style={{ borderColor: DESIGN_TOKENS.border }} />
                  )}
                </div>
              ))}
              {[
                { label: "氛围", key: "atmosphere" },
                { label: "色彩基调（逗号分隔）", key: "colorPalette", isArray: true },
              ].map((f) => (
                <div key={f.key}>
                  <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>{f.label}</label>
                  <input type="text" value={f.isArray ? ((edit as any)[f.key] || []).join(", ") : ((edit as any)[f.key] || "")} onChange={(e) => setEdit((p) => ({ ...p, [f.key]: f.isArray ? e.target.value.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean) : e.target.value }))}
                    className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none" style={{ borderColor: DESIGN_TOKENS.border }} />
                </div>
              ))}
            </div>
          )}
        </div>
        {editingId && (
          <div className="flex items-center justify-between p-4 border-t shrink-0" style={{ borderColor: DESIGN_TOKENS.border }}>
            <button onClick={() => { setEditingId(null); setEdit({}) }} className="rounded-lg px-3 py-1.5 text-xs transition-colors hover:bg-white/10" style={{ color: DESIGN_TOKENS.textMuted }}>返回列表</button>
            <button onClick={handleSave} className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-medium text-white" style={{ backgroundColor: DESIGN_TOKENS.accent }} disabled={!edit.location?.trim()}>
              <Save size={12} strokeWidth={1.5} /> 保存场景
            </button>
          </div>
        )}
      </div>
    </div>, document.body
  )
}
