/**
 * SettingsPanel - 用户可配置 API 和模型 (P2-5B enhanced)
 * 支持服务端 .env 模式（推荐）和本地覆盖模式（仅适合自用）
 */
"use client"

import { useState, useEffect, type ChangeEvent } from "react"
import { createPortal } from "react-dom"
import { X, Save, Plus, Trash2, BarChart3, Eye, EyeOff, Wifi, Loader2, CheckCircle2, AlertCircle, Server, Monitor } from "lucide-react"
import { DESIGN_TOKENS, ICON_CONFIG } from "../../styles/designSystem"
import type { ModelOption } from "../chat/ChatInput"
import { useAIUsageStore } from "../../features/canvas/usage/useAIUsageStore"
import { formatCostUsd } from "../../features/canvas/usage/estimateCost"
import {
  saveLocalProviderOverrides,
  getLocalProviderOverrides,
  clearLocalProviderOverrides,
  hasLocalProviderOverrides,
  checkAiHealth,
} from "../../../../lib/ai/client"
import type { AiHealthResponse } from "../../../../lib/ai/client"

// ── Token Aliases ──────────────────────────────────────
const T = DESIGN_TOKENS

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  // ── Existing state ──────────────────────────────────
  const [apiBaseUrl, setApiBaseUrl] = useState("https://copse.top/v1")
  const [apiKey, setApiKey] = useState("")
  const [useMock, setUseMock] = useState(true)
  const [models, setModels] = useState<ModelOption[]>([])
  const [allowAIAutoRun, setAllowAIAutoRun] = useState(false)
  const [newModel, setNewModel] = useState<{ value: string; label: string; provider: string; desc: string; type: "text" | "image" | "video" }>({
    value: "",
    label: "",
    provider: "",
    desc: "",
    type: "text",
  })

  // ── P2-5B: Provider override state ──────────────────
  const [showApiKey, setShowApiKey] = useState(false)
  const [defaultModel, setDefaultModel] = useState("")
  const [videoModel, setVideoModel] = useState("")
  const [timeoutMs, setTimeoutMs] = useState("120000")
  const [useLocalOverride, setUseLocalOverride] = useState(false)

  // ── P2-5B: Test connection state ────────────────────
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle")
  const [testMessage, setTestMessage] = useState("")
  const [serverConfig, setServerConfig] = useState<AiHealthResponse["config"] | null>(null)

  // AI Usage stats
  const usageStats = useAIUsageStore((s) => s.getStats())
  const usageRecords = useAIUsageStore((s) => s.usageRecords)

  // ── Load from localStorage ──────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      // Existing settings
      setApiBaseUrl(localStorage.getItem("startrails_api_base_url") || "https://copse.top/v1")
      setApiKey(localStorage.getItem("startrails_api_key") || "")
      setUseMock(localStorage.getItem("startrails_use_mock") !== "false")
      setAllowAIAutoRun(localStorage.getItem("startrails_ai_auto_run") === "true")
      const stored = localStorage.getItem("startrails_models")
      if (stored) setModels(JSON.parse(stored))

      // P2-5B: Provider overrides
      const overrides = getLocalProviderOverrides()
      if (overrides) {
        setUseLocalOverride(true)
        if (overrides.defaultModel) setDefaultModel(overrides.defaultModel)
        if (overrides.videoModel) setVideoModel(overrides.videoModel)
        if (overrides.timeoutMs) setTimeoutMs(String(overrides.timeoutMs))
      }
    } catch { /* ignore */ }
  }, [isOpen])

  // ── Load server config on open ──────────────────────
  useEffect(() => {
    if (!isOpen) return
    const loadConfig = async () => {
      try {
        const res = await fetch("/api/ai/config")
        if (res.ok) {
          const data = await res.json()
          setServerConfig(data)
          // Pre-fill from server if no local override
          if (!useLocalOverride) {
            if (data.defaultModel) setDefaultModel(data.defaultModel)
            if (data.videoModel) setVideoModel(data.videoModel)
            if (data.timeoutMs) setTimeoutMs(String(data.timeoutMs))
          }
        }
      } catch { /* server unavailable */ }
    }
    loadConfig()
  }, [isOpen])

  // ── Test Connection (P2-5B fix) ────────────────────
  const handleTestConnection = async () => {
    setTestStatus("testing")
    setTestMessage("")
    try {
      // P2-5B fix: Local Override 模式下传入覆盖配置
      const overrides = useLocalOverride
        ? {
            baseUrl: apiBaseUrl || undefined,
            apiKey: apiKey || undefined,
            defaultModel: defaultModel || undefined,
            videoModel: videoModel || undefined,
            timeoutMs: timeoutMs ? Number(timeoutMs) : undefined,
          }
        : undefined
      const result = await checkAiHealth(overrides)
      setTestStatus(result.ok ? "ok" : "fail")
      setTestMessage(result.message)
    } catch (err: any) {
      setTestStatus("fail")
      setTestMessage(err.message || "Connection test failed")
    }
  }

  // ── Save ────────────────────────────────────────────
  const handleSave = () => {
    if (typeof window === "undefined") return

    // Existing settings
    localStorage.setItem("startrails_api_base_url", apiBaseUrl)
    localStorage.setItem("startrails_api_key", apiKey)
    localStorage.setItem("startrails_use_mock", String(useMock))
    localStorage.setItem("startrails_ai_auto_run", String(allowAIAutoRun))
    localStorage.setItem("startrails_models", JSON.stringify(models))

    // P2-5B: Provider overrides
    if (useLocalOverride) {
      saveLocalProviderOverrides({
        baseUrl: apiBaseUrl || undefined,
        apiKey: apiKey || undefined,
        defaultModel: defaultModel || undefined,
        videoModel: videoModel || undefined,
        timeoutMs: timeoutMs ? Number(timeoutMs) : undefined,
      })
    } else {
      clearLocalProviderOverrides()
    }

    // Notify other components
    window.dispatchEvent(new CustomEvent("startrails-models-updated"))
    window.dispatchEvent(new CustomEvent("startrails-settings-updated", { detail: { allowAIAutoRun } }))
    window.dispatchEvent(new CustomEvent("startrails-provider-updated"))

    onClose()
  }

  // ── Model management ────────────────────────────────
  const handleAddModel = () => {
    if (!newModel.value || !newModel.label) return
    setModels(prev => [...prev, { ...newModel }])
    setNewModel({ value: "", label: "", provider: "", desc: "", type: "text" })
  }

  const handleRemoveModel = (index: number) => {
    setModels(prev => prev.filter((_, i) => i !== index))
  }

  // ── Toggle local override ───────────────────────────
  const handleToggleLocalOverride = (enabled: boolean) => {
    setUseLocalOverride(enabled)
    if (!enabled) {
      // Reset to server config
      if (serverConfig) {
        setDefaultModel(serverConfig.defaultModel)
        setVideoModel(serverConfig.videoModel || "")
        setTimeoutMs(String(serverConfig.timeoutMs))
      }
      clearLocalProviderOverrides()
    }
  }

  if (!isOpen) return null
  if (typeof document === "undefined") return null

  // ── Style helpers ────────────────────────────────────
  const inputClass = "w-full rounded-lg border bg-black/40 px-3 py-1.5 text-sm text-white outline-none"
  const inputStyle = (e: any) => {
    e.target.style.borderColor = T.border
    e.target.onfocus = () => (e.target.style.borderColor = T.accent)
    e.target.onblur = () => (e.target.style.borderColor = T.border)
  }
  const labelStyle = { color: T.textMuted, fontSize: "11px", display: "block", marginBottom: "2px" } as const

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
        className="relative z-10 w-[480px] max-h-[85vh] overflow-y-auto rounded-2xl border p-6"
        style={{ backgroundColor: T.panelSolid, borderColor: T.border }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium" style={{ color: T.text }}>设置</h3>
          <button onClick={onClose} className="rounded-lg p-1 transition-colors hover:bg-white/10">
            <X size={16} strokeWidth={ICON_CONFIG.strokeWidth} style={{ color: T.textMuted }} />
          </button>
        </div>

        {/* ── P2-5B: Provider 模式 ────────────────────── */}
        <div className="mb-5">
          <h4 className="mb-2 text-xs font-medium" style={{ color: T.textSecondary }}>Provider 模式</h4>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => handleToggleLocalOverride(false)}
              className="flex-1 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors"
              style={{
                borderColor: !useLocalOverride ? T.accent : T.border,
                backgroundColor: !useLocalOverride ? T.accentSoft : "transparent",
                color: !useLocalOverride ? T.text : T.textMuted,
              }}
            >
              <Server size={14} strokeWidth={1.5} />
              <div className="text-left">
                <div className="font-medium">服务端 .env</div>
                <div className="text-[10px] opacity-60">推荐，API Key 安全</div>
              </div>
            </button>
            <button
              onClick={() => handleToggleLocalOverride(true)}
              className="flex-1 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors"
              style={{
                borderColor: useLocalOverride ? T.accent : T.border,
                backgroundColor: useLocalOverride ? T.accentSoft : "transparent",
                color: useLocalOverride ? T.text : T.textMuted,
              }}
            >
              <Monitor size={14} strokeWidth={1.5} />
              <div className="text-left">
                <div className="font-medium">本地覆盖</div>
                <div className="text-[10px] opacity-60">仅适合自用</div>
              </div>
            </button>
          </div>

          {/* Local override warning */}
          {useLocalOverride && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 mb-3">
              <div className="flex items-start gap-1.5">
                <AlertCircle size={13} strokeWidth={1.5} style={{ color: "#f59e0b", marginTop: 1, flexShrink: 0 }} />
                <p className="text-[10px] leading-relaxed" style={{ color: "#fbbf24" }}>
                  API Key 将保存在浏览器 localStorage，任何能访问此设备的用户均可查看。
                  不适合多用户环境或公共设备。本地开发/个人使用安全。
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── API 配置区 ──────────────────────────────── */}
        <div className="mb-5">
          <h4 className="mb-2 text-xs font-medium" style={{ color: T.textSecondary }}>API 配置</h4>
          <div className="space-y-2">
            {/* Base URL */}
            <div>
              <label style={labelStyle}>API Base URL</label>
              <input
                type="text"
                value={apiBaseUrl}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setApiBaseUrl(e.target.value)}
                placeholder={serverConfig?.baseUrl || "https://copse.top/v1"}
                className={inputClass}
                style={{ borderColor: T.border }}
                onFocus={(e) => (e.target.style.borderColor = T.accent)}
                onBlur={(e) => (e.target.style.borderColor = T.border)}
              />
            </div>

            {/* API Key */}
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label style={{ ...labelStyle, marginBottom: 0 }}>
                  API Key{useLocalOverride ? "" : "（.env 管理）"}
                </label>
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="rounded p-0.5 hover:bg-white/10 transition-colors"
                  title={showApiKey ? "隐藏" : "显示"}
                >
                  {showApiKey
                    ? <EyeOff size={12} strokeWidth={1.5} style={{ color: T.textMuted }} />
                    : <Eye size={12} strokeWidth={1.5} style={{ color: T.textMuted }} />
                  }
                </button>
              </div>
              <input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value)}
                placeholder={useLocalOverride ? "sk-..." : "使用 .env 中的 AI_API_KEY"}
                disabled={!useLocalOverride}
                className={inputClass}
                style={{
                  borderColor: T.border,
                  opacity: useLocalOverride ? 1 : 0.5,
                }}
                onFocus={(e) => { if (useLocalOverride) e.target.style.borderColor = T.accent }}
                onBlur={(e) => (e.target.style.borderColor = T.border)}
              />
            </div>

            {/* Default Text Model */}
            <div>
              <label style={labelStyle}>默认文本模型</label>
              <input
                type="text"
                value={defaultModel}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDefaultModel(e.target.value)}
                placeholder={serverConfig?.defaultModel || "gpt-5.5"}
                className={inputClass}
                style={{ borderColor: T.border }}
                onFocus={(e) => (e.target.style.borderColor = T.accent)}
                onBlur={(e) => (e.target.style.borderColor = T.border)}
              />
            </div>

            {/* Video Model (optional) */}
            <div>
              <label style={labelStyle}>视频分析模型（可选）</label>
              <input
                type="text"
                value={videoModel}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setVideoModel(e.target.value)}
                placeholder={serverConfig?.videoModel || "（同默认文本模型）"}
                className={inputClass}
                style={{ borderColor: T.border }}
                onFocus={(e) => (e.target.style.borderColor = T.accent)}
                onBlur={(e) => (e.target.style.borderColor = T.border)}
              />
            </div>

            {/* Timeout */}
            <div>
              <label style={labelStyle}>超时时间（毫秒）</label>
              <input
                type="number"
                value={timeoutMs}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setTimeoutMs(e.target.value)}
                placeholder="120000"
                min="5000"
                max="600000"
                step="1000"
                className={inputClass}
                style={{ borderColor: T.border }}
                onFocus={(e) => (e.target.style.borderColor = T.accent)}
                onBlur={(e) => (e.target.style.borderColor = T.border)}
              />
            </div>

            {/* Use Mock */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={useMock}
                onChange={(e) => setUseMock(e.target.checked)}
                id="use-mock"
                className="rounded"
              />
              <label htmlFor="use-mock" className="text-[11px]" style={{ color: T.textMuted }}>
                模拟模式（不调用真实 API）
              </label>
            </div>

            {/* AI 安全 */}
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={allowAIAutoRun}
                onChange={(e) => setAllowAIAutoRun(e.target.checked)}
                id="allow-ai-auto-run"
                className="mt-0.5 rounded"
              />
              <div className="flex flex-col gap-0.5">
                <label htmlFor="allow-ai-auto-run" className="text-[11px]" style={{ color: T.textMuted }}>
                  允许 AI 自动运行节点
                </label>
                <p className="text-[10px]" style={{ color: T.textMuted, opacity: 0.6 }}>
                  开启后，AI 可以直接触发模型调用，可能产生实际 API 成本
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── P2-5B: Test Connection ──────────────────── */}
        <div className="mb-5">
          <h4 className="mb-2 text-xs font-medium" style={{ color: T.textSecondary }}>连接测试</h4>
          <div className="flex items-center gap-2">
            <button
              onClick={handleTestConnection}
              disabled={testStatus === "testing"}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-white/10 disabled:opacity-50"
              style={{ borderColor: T.border, color: T.textSecondary }}
            >
              {testStatus === "testing"
                ? <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
                : <Wifi size={13} strokeWidth={1.5} />
              }
              测试连接
            </button>
            {testStatus === "ok" && (
              <span className="flex items-center gap-1 text-[11px]" style={{ color: "#10b981" }}>
                <CheckCircle2 size={12} strokeWidth={1.5} /> 已连接
              </span>
            )}
            {testStatus === "fail" && (
              <span className="flex items-center gap-1 text-[11px]" style={{ color: "#ef4444" }}>
                <AlertCircle size={12} strokeWidth={1.5} /> 连接失败
              </span>
            )}
          </div>
          {testMessage && (
            <p className="mt-1.5 text-[10px]" style={{ color: testStatus === "ok" ? "#10b981" : "#ef4444" }}>
              {testMessage}
            </p>
          )}
        </div>

        {/* ── 模型管理区 ──────────────────────────────── */}
        <div className="mb-5">
          <h4 className="mb-2 text-xs font-medium" style={{ color: T.textSecondary }}>模型管理</h4>

          {/* 当前模型列表 */}
          <div className="mb-2 max-h-36 overflow-y-auto space-y-1">
            {models.map((m, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                <span className="text-xs font-medium" style={{ color: T.accent }}>{m.label}</span>
                <span className="text-[10px]" style={{ color: T.textMuted }}>{m.value}</span>
                <span className="text-[10px] capitalize" style={{ color: T.textMuted }}>{m.type}</span>
                <button onClick={() => handleRemoveModel(i)} className="ml-auto rounded p-0.5 hover:bg-white/10">
                  <Trash2 size={12} strokeWidth={1.5} style={{ color: T.textMuted }} />
                </button>
              </div>
            ))}
            {models.length === 0 && (
              <p className="text-[11px]" style={{ color: T.textMuted }}>暂无自定义模型，请在下方添加</p>
            )}
          </div>

          {/* 添加新模型 */}
          <div className="space-y-1.5 rounded-xl border p-3" style={{ borderColor: T.border }}>
            <input
              type="text"
              value={newModel.label}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNewModel(prev => ({ ...prev, label: e.target.value }))}
              placeholder="显示名称（如：My-GPT）"
              className="w-full rounded border bg-black/40 px-2 py-1 text-xs text-white outline-none"
              style={{ borderColor: T.border }}
            />
            <input
              type="text"
              value={newModel.value}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNewModel(prev => ({ ...prev, value: e.target.value }))}
              placeholder="模型 ID（如：gpt-4o）"
              className="w-full rounded border bg-black/40 px-2 py-1 text-xs text-white outline-none"
              style={{ borderColor: T.border }}
            />
            <input
              type="text"
              value={newModel.provider}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNewModel(prev => ({ ...prev, provider: e.target.value }))}
              placeholder="提供方（如：OpenAI、智谱、Vidu）"
              className="w-full rounded border bg-black/40 px-2 py-1 text-xs text-white outline-none"
              style={{ borderColor: T.border }}
            />
            {/* 类型选择 */}
            <div className="flex gap-1">
              {(["text", "image", "video"] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setNewModel(prev => ({ ...prev, type }))}
                  className="rounded-md px-2 py-0.5 text-[10px] transition-colors"
                  style={{
                    backgroundColor: newModel.type === type ? T.accentSoft : "transparent",
                    color: newModel.type === type ? T.accent : T.textMuted,
                  }}
                >
                  {type === "text" ? "文本" : type === "image" ? "图像" : "视频"}
                </button>
              ))}
            </div>
            <button
              onClick={handleAddModel}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition-colors hover:bg-white/10"
              style={{ color: T.accent }}
            >
              <Plus size={12} strokeWidth={1.5} /> 添加模型
            </button>
          </div>
        </div>

        {/* ── AI 使用统计 ─────────────────────────────── */}
        {usageRecords.length > 0 && (
          <div className="mb-5">
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium" style={{ color: T.textSecondary }}>
              <BarChart3 size={13} strokeWidth={1.5} />
              AI 使用统计
            </h4>

            <div className="mb-3 grid grid-cols-3 gap-2">
              <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: T.border, backgroundColor: "rgba(255,255,255,0.03)" }}>
                <p className="text-[10px] opacity-50" style={{ color: T.textMuted }}>今日</p>
                <p className="text-xs font-medium" style={{ color: T.text }}>
                  {formatCostUsd(usageStats.todayCostUsd)}
                </p>
              </div>
              <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: T.border, backgroundColor: "rgba(255,255,255,0.03)" }}>
                <p className="text-[10px] opacity-50" style={{ color: T.textMuted }}>本月</p>
                <p className="text-xs font-medium" style={{ color: T.text }}>
                  {formatCostUsd(usageStats.thisMonthCostUsd)}
                </p>
              </div>
              <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: T.border, backgroundColor: "rgba(255,255,255,0.03)" }}>
                <p className="text-[10px] opacity-50" style={{ color: T.textMuted }}>累计</p>
                <p className="text-xs font-medium" style={{ color: T.text }}>
                  {formatCostUsd(usageStats.totalCostUsd)}
                </p>
              </div>
            </div>

            <div className="mb-2 flex gap-3 text-[10px]" style={{ color: T.textMuted }}>
              <span className="flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
                成功 {usageStats.successRuns}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400/80" />
                失败 {usageStats.failedRuns}
              </span>
              <span>总计 {usageStats.totalRuns} 次</span>
            </div>

            {Object.keys(usageStats.byModel).length > 0 && (
              <div className="mb-2">
                <p className="mb-1 text-[10px] opacity-50" style={{ color: T.textMuted }}>按模型</p>
                <div className="space-y-0.5">
                  {Object.entries(usageStats.byModel)
                    .sort(([, a], [, b]) => b.costUsd - a.costUsd)
                    .map(([model, stat]) => (
                      <div key={model} className="flex items-center justify-between rounded px-2 py-1 text-[10px]" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                        <span style={{ color: T.textSecondary }}>{model}</span>
                        <span style={{ color: T.accent }}>{formatCostUsd(stat.costUsd)}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {Object.keys(usageStats.byTaskType).length > 0 && (
              <div>
                <p className="mb-1 text-[10px] opacity-50" style={{ color: T.textMuted }}>按任务类型</p>
                <div className="flex gap-2">
                  {Object.entries(usageStats.byTaskType).map(([type, stat]) => (
                    <div key={type} className="rounded-full border px-2 py-0.5 text-[10px]" style={{ borderColor: T.border }}>
                      <span style={{ color: T.textMuted }}>{type}: </span>
                      <span style={{ color: T.accent }}>{formatCostUsd(stat.costUsd)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 操作按钮 ────────────────────────────────── */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs transition-colors hover:bg-white/10"
            style={{ color: T.textMuted }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white"
            style={{ backgroundColor: T.accent }}
          >
            <Save size={12} strokeWidth={1.5} /> 保存
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
