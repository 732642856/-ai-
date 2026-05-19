/**
 * SettingsPanel - 用户可配置 API 和模型
 * 支持自定义 API Base URL、API Key、模型列表管理
 * 任何人都可以接入自己的模型（包括中转站）
 */
"use client"

import { useState, useEffect, type ChangeEvent } from "react"
import { createPortal } from "react-dom"
import { X, Save, Plus, Trash2 } from "lucide-react"
import { DESIGN_TOKENS, ICON_CONFIG } from "../../styles/designSystem"
import type { ModelOption } from "../chat/ChatInput"

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [apiBaseUrl, setApiBaseUrl] = useState("https://copse.top/v1")
  const [apiKey, setApiKey] = useState("")
  const [useMock, setUseMock] = useState(true)
  const [models, setModels] = useState<ModelOption[]>([])
  const [newModel, setNewModel] = useState<{ value: string; label: string; provider: string; desc: string; type: "text" | "image" | "video" }>({
    value: "",
    label: "",
    provider: "",
    desc: "",
    type: "text",
  })

  // 从 localStorage 读取配置
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      setApiBaseUrl(localStorage.getItem("startrails_api_base_url") || "https://copse.top/v1")
      setApiKey(localStorage.getItem("startrails_api_key") || "")
      setUseMock(localStorage.getItem("startrails_use_mock") !== "false")
      const stored = localStorage.getItem("startrails_models")
      if (stored) setModels(JSON.parse(stored))
    } catch {}
  }, [isOpen])

  const handleSave = () => {
    if (typeof window === "undefined") return
    localStorage.setItem("startrails_api_base_url", apiBaseUrl)
    localStorage.setItem("startrails_api_key", apiKey)
    localStorage.setItem("startrails_use_mock", String(useMock))
    localStorage.setItem("startrails_models", JSON.stringify(models))
    // 通知 ChatInput 更新模型列表
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("startrails-models-updated"))
    }
    onClose()
  }

  const handleAddModel = () => {
    if (!newModel.value || !newModel.label) return
    setModels(prev => [...prev, { ...newModel }])
    setNewModel({ value: "", label: "", provider: "", desc: "", type: "text" })
  }

  const handleRemoveModel = (index: number) => {
    setModels(prev => prev.filter((_, i) => i !== index))
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
        className="relative z-10 w-[420px] max-h-[85vh] overflow-y-auto rounded-2xl border p-6"
        style={{
          backgroundColor: DESIGN_TOKENS.panelSolid,
          borderColor: DESIGN_TOKENS.border,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium" style={{ color: DESIGN_TOKENS.text }}>设置</h3>
          <button onClick={onClose} className="rounded-lg p-1 transition-colors hover:bg-white/10">
            <X size={16} strokeWidth={ICON_CONFIG.strokeWidth} style={{ color: DESIGN_TOKENS.textMuted }} />
          </button>
        </div>

        {/* API 配置区 */}
        <div className="mb-5">
          <h4 className="mb-2 text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>API 配置</h4>
          <div className="space-y-2">
            {/* Base URL */}
            <div>
              <label className="mb-0.5 block text-[11px]" style={{ color: DESIGN_TOKENS.textMuted }}>API Base URL（中转站地址）</label>
              <input
                type="text"
                value={apiBaseUrl}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setApiBaseUrl(e.target.value)}
                placeholder="https://copse.top/v1"
                className="w-full rounded-lg border bg-black/40 px-3 py-1.5 text-sm text-white outline-none"
                style={{ borderColor: DESIGN_TOKENS.border }}
                onFocus={(e) => (e.target.style.borderColor = DESIGN_TOKENS.accent)}
                onBlur={(e) => (e.target.style.borderColor = DESIGN_TOKENS.border)}
              />
            </div>
            {/* API Key */}
            <div>
              <label className="mb-0.5 block text-[11px]" style={{ color: DESIGN_TOKENS.textMuted }}>API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full rounded-lg border bg-black/40 px-3 py-1.5 text-sm text-white outline-none"
                style={{ borderColor: DESIGN_TOKENS.border }}
                onFocus={(e) => (e.target.style.borderColor = DESIGN_TOKENS.accent)}
                onBlur={(e) => (e.target.style.borderColor = DESIGN_TOKENS.border)}
              />
            </div>
            {/* Use Mock 开关 */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={useMock}
                onChange={(e) => setUseMock(e.target.checked)}
                id="use-mock"
                className="rounded"
              />
              <label htmlFor="use-mock" className="text-[11px]" style={{ color: DESIGN_TOKENS.textMuted }}>
                模拟模式（不调用真实 API）
              </label>
            </div>
          </div>
        </div>

        {/* 模型管理区 */}
        <div className="mb-5">
          <h4 className="mb-2 text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>模型管理</h4>

          {/* 当前模型列表 */}
          <div className="mb-2 max-h-36 overflow-y-auto space-y-1">
            {models.map((m, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                <span className="text-xs font-medium" style={{ color: DESIGN_TOKENS.accent }}>{m.label}</span>
                <span className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>{m.value}</span>
                <span className="text-[10px] capitalize" style={{ color: DESIGN_TOKENS.textMuted }}>{m.type}</span>
                <button onClick={() => handleRemoveModel(i)} className="ml-auto rounded p-0.5 hover:bg-white/10">
                  <Trash2 size={12} strokeWidth={1.5} style={{ color: DESIGN_TOKENS.textMuted }} />
                </button>
              </div>
            ))}
            {models.length === 0 && (
              <p className="text-[11px]" style={{ color: DESIGN_TOKENS.textMuted }}>暂无自定义模型，请在下方添加</p>
            )}
          </div>

          {/* 添加新模型 */}
          <div className="space-y-1.5 rounded-xl border p-3" style={{ borderColor: DESIGN_TOKENS.border }}>
            <input
              type="text"
              value={newModel.label}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNewModel(prev => ({ ...prev, label: e.target.value }))}
              placeholder="显示名称（如：My-GPT）"
              className="w-full rounded border bg-black/40 px-2 py-1 text-xs text-white outline-none"
              style={{ borderColor: DESIGN_TOKENS.border }}
            />
            <input
              type="text"
              value={newModel.value}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNewModel(prev => ({ ...prev, value: e.target.value }))}
              placeholder="模型 ID（如：gpt-4o）"
              className="w-full rounded border bg-black/40 px-2 py-1 text-xs text-white outline-none"
              style={{ borderColor: DESIGN_TOKENS.border }}
            />
            <input
              type="text"
              value={newModel.provider}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNewModel(prev => ({ ...prev, provider: e.target.value }))}
              placeholder="提供方（如：OpenAI、智谱、Vidu）"
              className="w-full rounded border bg-black/40 px-2 py-1 text-xs text-white outline-none"
              style={{ borderColor: DESIGN_TOKENS.border }}
            />
            {/* 类型选择 */}
            <div className="flex gap-1">
              {(["text", "image", "video"] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setNewModel(prev => ({ ...prev, type }))}
                  className="rounded-md px-2 py-0.5 text-[10px] transition-colors"
                  style={{
                    backgroundColor: newModel.type === type ? DESIGN_TOKENS.accentSoft : "transparent",
                    color: newModel.type === type ? DESIGN_TOKENS.accent : DESIGN_TOKENS.textMuted,
                  }}
                >
                  {type === "text" ? "文本" : type === "image" ? "图像" : "视频"}
                </button>
              ))}
            </div>
            <button
              onClick={handleAddModel}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition-colors hover:bg-white/10"
              style={{ color: DESIGN_TOKENS.accent }}
            >
              <Plus size={12} strokeWidth={1.5} /> 添加模型
            </button>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs transition-colors hover:bg-white/10"
            style={{ color: DESIGN_TOKENS.textMuted }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white"
            style={{ backgroundColor: DESIGN_TOKENS.accent }}
          >
            <Save size={12} strokeWidth={1.5} /> 保存
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
