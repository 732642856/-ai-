/**
 * SceneBiblePanel — 场景圣经面板
 * 创建/编辑场景设定：地点、时间、氛围、光影、参考图等
 */
"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import { X, Plus, MapPin, Trash2, Image as ImageIcon, Save } from "lucide-react"
import { DESIGN_TOKENS, ICON_CONFIG } from "../../styles/designSystem"
import { useCanvasStore } from "../../stores/canvasStore"
import type { SceneBibleData } from "../canvas/types"
import { generateId } from "../../utils/generateId"

export function SceneBiblePanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const {
    bibleScenes,
    addBibleScene,
    updateBibleScene,
    removeBibleScene,
  } = useCanvasStore()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [edit, setEdit] = useState<Partial<SceneBibleData>>({})

  const selected = editingId ? bibleScenes.find((s) => s.id === editingId) : null

  const handleNew = () => {
    const newScene: SceneBibleData = {
      id: generateId(),
      sceneNumber: bibleScenes.length + 1,
      location: "",
      createdAt: Date.now(),
    }
    addBibleScene(newScene)
    setEditingId(newScene.id)
    setEdit(newScene)
  }

  const handleSelect = (id: string) => {
    const scene = bibleScenes.find((s) => s.id === id)
    if (!scene) return
    setEditingId(id)
    setEdit(scene)
  }

  const handleSave = () => {
    if (!editingId || !edit.location?.trim()) return
    updateBibleScene(editingId, edit)
    setEditingId(null)
    setEdit({})
  }

  const handleDelete = (id: string) => {
    if (editingId === id) { setEditingId(null); setEdit({}) }
    removeBibleScene(id)
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
            <MapPin size={18} strokeWidth={ICON_CONFIG.strokeWidth} style={{ color: DESIGN_TOKENS.accent }} />
            <h3 className="text-sm font-medium" style={{ color: DESIGN_TOKENS.text }}>场景圣经</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 transition-colors hover:bg-white/10">
            <X size={16} strokeWidth={ICON_CONFIG.strokeWidth} style={{ color: DESIGN_TOKENS.textMuted }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!editingId ? (
            /* 场景列表 */
            <div className="space-y-2">
              {bibleScenes.length === 0 && (
                <p className="text-xs text-center py-8" style={{ color: DESIGN_TOKENS.textMuted }}>暂无场景，点击下方按钮创建</p>
              )}
              {bibleScenes.map((scene) => (
                <div key={scene.id}
                  className="flex items-center gap-3 rounded-xl p-3 cursor-pointer transition-colors"
                  style={{ backgroundColor: DESIGN_TOKENS.card, border: `1px solid ${DESIGN_TOKENS.border}` }}
                  onClick={() => handleSelect(scene.id)}
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: DESIGN_TOKENS.accentSoft }}>
                    <span className="text-xs font-bold" style={{ color: DESIGN_TOKENS.accent }}>S{scene.sceneNumber}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: DESIGN_TOKENS.text }}>{scene.location || "未命名场景"}</p>
                    {scene.timeOfDay && <p className="text-xs" style={{ color: DESIGN_TOKENS.textMuted }}>{scene.timeOfDay}</p>}
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(scene.id) }}
                    className="rounded-lg p-1.5 transition-colors hover:bg-red-500/20">
                    <Trash2 size={14} strokeWidth={1.5} style={{ color: DESIGN_TOKENS.textMuted }} />
                  </button>
                </div>
              ))}
              <button onClick={handleNew}
                className="flex items-center justify-center gap-2 w-full rounded-xl p-3 transition-colors"
                style={{ border: `1px dashed ${DESIGN_TOKENS.borderStrong}`, color: DESIGN_TOKENS.accent }}>
                <Plus size={16} strokeWidth={1.5} />
                <span className="text-sm">新建场景</span>
              </button>
            </div>
          ) : (
            /* 场景编辑表单 */
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>场景编号</label>
                <input type="number" value={edit.sceneNumber || 1}
                  onChange={(e) => setEdit((p) => ({ ...p, sceneNumber: parseInt(e.target.value) || 1 }))}
                  className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none"
                  style={{ borderColor: DESIGN_TOKENS.border }} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>地点 <span className="text-red-400">*</span></label>
                <input type="text" value={edit.location || ""}
                  onChange={(e) => setEdit((p) => ({ ...p, location: e.target.value }))}
                  placeholder="例：废弃工厂内部"
                  className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none"
                  style={{ borderColor: DESIGN_TOKENS.border }} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>时间段</label>
                <input type="text" value={edit.timeOfDay || ""}
                  onChange={(e) => setEdit((p) => ({ ...p, timeOfDay: e.target.value }))}
                  placeholder="例：黄昏 / 深夜 / 清晨"
                  className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none"
                  style={{ borderColor: DESIGN_TOKENS.border }} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>天气</label>
                <input type="text" value={edit.weather || ""}
                  onChange={(e) => setEdit((p) => ({ ...p, weather: e.target.value }))}
                  placeholder="例：暴雨 / 晴 / 阴天"
                  className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none"
                  style={{ borderColor: DESIGN_TOKENS.border }} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>氛围</label>
                <textarea value={edit.atmosphere || ""}
                  onChange={(e) => setEdit((p) => ({ ...p, atmosphere: e.target.value }))}
                  placeholder="场景的氛围描述…" rows={2}
                  className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none resize-none"
                  style={{ borderColor: DESIGN_TOKENS.border }} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>光影风格</label>
                <input type="text" value={edit.lightingStyle || ""}
                  onChange={(e) => setEdit((p) => ({ ...p, lightingStyle: e.target.value }))}
                  placeholder="例：伦勃朗光 / 顶光 / 逆光"
                  className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none"
                  style={{ borderColor: DESIGN_TOKENS.border }} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>色彩基调</label>
                <input type="text" value={(edit.colorPalette || []).join(", ")}
                  onChange={(e) => setEdit((p) => ({ ...p, colorPalette: e.target.value.split(/[,，]/).map(s => s.trim()).filter(Boolean) }))}
                  placeholder="例：冷灰, 铁锈红, 暗绿"
                  className="w-full rounded-lg border bg-black/40 px-3 py-2 text-sm text-white outline-none"
                  style={{ borderColor: DESIGN_TOKENS.border }} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>描述</label>
                <textarea value={edit.description || ""}
                  onChange={(e) => setEdit((p) => ({ ...p, description: e.target.value }))}
                  placeholder="场景的详细描述…" rows={3}
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
              style={{ backgroundColor: DESIGN_TOKENS.accent, opacity: edit.location?.trim() ? 1 : 0.5 }}
              disabled={!edit.location?.trim()}>
              <Save size={12} strokeWidth={1.5} /> 保存场景
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
