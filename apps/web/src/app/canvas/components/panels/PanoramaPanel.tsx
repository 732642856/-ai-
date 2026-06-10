/**
 * PanoramaPanel — 720/360 全景场景预𪾢面板
 *
 * 基于 react-pannellum (MIT) 实现 equirectangular 全景图交互式预𪾢。
 * 支持：
 *   - 从图片节点 / 场景节点打开全景预𪾢
 *   - 自动旋转 / 手动拖拽 / 缩放
 *   - 全景提示词生成并写回节点
 *   - 示例全景图快速测试
 *
 * 对标小云雀 2.0 的 360/720 全景场景图能力。
 */
"use client"

import React, { useCallback, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { X, RotateCw, Image, Sparkles, Check, Globe, Upload, RefreshCw } from "lucide-react"
import ReactPannellum from "react-pannellum"
import { DESIGN_TOKENS } from "../../styles/designSystem"

// ── 类型 ──────────────────────────────────────────────

export interface PanoramaConfig {
  /** equirectangular 全景图 URL */
  imageUrl?: string
  /** 全景场景标题 */
  title?: string
  /** 全景场景描述 */
  description?: string
  /** 全景提示词 (用于生成) */
  panoramaPrompt?: string
  /** 自动旋转速度 (度/秒, 0=关闭) */
  autoRotateSpeed: number
  /** 初始视野 (度) */
  hfov: number
  /** 初始俯仰 (度) */
  pitch: number
  /** 初始偏航 (度) */
  yaw: number
}

export interface PanoramaPanelProps {
  isOpen: boolean
  onClose: () => void
  /** 当前选中的全景图 URL (从选中节点自动传入) */
  initialImageUrl?: string
  /** 选中的节点 ID (用于写回全景提示词) */
  selectedNodeId?: string | null
  /** 应用到选中节点 */
  onApplyToNode?: (nodeId: string, panoramaPrompt: string) => void
}

// ── 默认配置 ──────────────────────────────────────────

const DEFAULT_CONFIG: PanoramaConfig = {
  autoRotateSpeed: -2,
  hfov: 100,
  pitch: 0,
  yaw: 0,
}

/** 示例全景图 (CC0 公共领域) */
const DEMO_PANORAMAS = [
  {
    label: "室内大厅",
    url: "https://pannellum.org/images/alma.jpg",
    autoRotateSpeed: -2,
  },
  {
    label: "山脉远景",
    url: "https://pannellum.org/images/cerro-torre.jpg",
    autoRotateSpeed: -1.5,
  },
]

/** 全景提示词预设 */
const PANORAMA_PROMPT_PRESETS = [
  {
    label: "360° 全景场景",
    prompt: "360-degree equirectangular panoramic view, seamless 360x180 immersive environment",
  },
  {
    label: "室内全景",
    prompt: "360-degree equirectangular indoor panorama, room-scale immersive environment, photorealistic interior",
  },
  {
    label: "户外全景",
    prompt: "360-degree equirectangular outdoor panorama, natural landscape, 360x180 seamless immersive environment",
  },
  {
    label: "科幻全景",
    prompt: "360-degree equirectangular sci-fi panorama, futuristic environment, 360x180 immersive scene",
  },
]

// ── 工具函数 ──────────────────────────────────────────

function generatePanoramaPrompt(config: PanoramaConfig): string {
  const parts: string[] = []
  parts.push("360-degree equirectangular panoramic view")
  parts.push("seamless 360x180 immersive environment")

  if (config.description) {
    parts.push(config.description)
  }

  return parts.join(", ")
}

// ── 组件 ──────────────────────────────────────────────

export function PanoramaPanel({
  isOpen,
  onClose,
  initialImageUrl,
  selectedNodeId,
  onApplyToNode,
}: PanoramaPanelProps) {
  const [imageUrl, setImageUrl] = useState<string | undefined>(initialImageUrl)
  const [title, setTitle] = useState("全景场景")
  const [description, setDescription] = useState("")
  const [autoRotate, setAutoRotate] = useState(true)
  const [autoRotateSpeed, setAutoRotateSpeed] = useState(-2)
  const [isLoading, setIsLoading] = useState(false)
  const [panoramaPrompt, setPanoramaPrompt] = useState("")
  const [activeTab, setActiveTab] = useState<"viewer" | "prompt" | "presets">("viewer")
  const inputFileRef = useRef<HTMLInputElement>(null)

  // 重置状态
  const reset = useCallback(() => {
    setImageUrl(initialImageUrl)
    setTitle("全景场景")
    setDescription("")
    setAutoRotate(true)
    setAutoRotateSpeed(-2)
    setPanoramaPrompt("")
    setActiveTab("viewer")
  }, [initialImageUrl])

  // 选择预设全景图
  const selectDemo = useCallback((url: string, speed: number) => {
    setImageUrl(url)
    setAutoRotateSpeed(speed)
    setAutoRotate(true)
    setActiveTab("viewer")
  }, [])

  // 应用预设提示词
  const applyPresetPrompt = useCallback((prompt: string) => {
    const config: PanoramaConfig = {
      imageUrl,
      title,
      description,
      autoRotateSpeed,
      hfov: DEFAULT_CONFIG.hfov,
      pitch: DEFAULT_CONFIG.pitch,
      yaw: DEFAULT_CONFIG.yaw,
    }
    const basePrompt = generatePanoramaPrompt(config)
    setPanoramaPrompt(`${basePrompt}, ${prompt}`)
    setActiveTab("prompt")
  }, [imageUrl, title, description, autoRotateSpeed])

  // 写回节点
  const handleApply = useCallback(() => {
    if (!selectedNodeId || !onApplyToNode) return
    const config: PanoramaConfig = {
      imageUrl,
      title,
      description,
      autoRotateSpeed,
      hfov: DEFAULT_CONFIG.hfov,
      pitch: DEFAULT_CONFIG.pitch,
      yaw: DEFAULT_CONFIG.yaw,
    }
    const prompt = panoramaPrompt || generatePanoramaPrompt(config)
    onApplyToNode(selectedNodeId, prompt)
  }, [selectedNodeId, onApplyToNode, imageUrl, title, description, autoRotateSpeed, panoramaPrompt])

  // 上传本地图片
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsLoading(true)
    const reader = new FileReader()
    reader.onload = (ev) => {
      setImageUrl(ev.target?.result as string)
      setIsLoading(false)
      setActiveTab("viewer")
    }
    reader.onerror = () => setIsLoading(false)
    reader.readAsDataURL(file)
  }, [])

  // 全景配置 (memoized)
  const pannellumConfig = useMemo(() => {
    const cfg: Record<string, unknown> = {
      autoLoad: true,
      showControls: true,
      showZoomCtrl: true,
      showFullscreenCtrl: true,
      keyboardZoom: true,
      mouseZoom: true,
      draggable: true,
      friction: 0.15,
    }
    if (autoRotate) {
      cfg.autoRotate = autoRotateSpeed
    }
    if (title) {
      cfg.title = title
    }
    if (description) {
      cfg.description = description
    }
    return cfg
  }, [autoRotate, autoRotateSpeed, title, description])

  // 场景唯一 ID (用时间戳防止 React key 冲突)
  const sceneId = useMemo(() => `panorama-${Date.now()}`, [isOpen, imageUrl])

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
    >
      {/* 主面板 */}
      <div
        className="relative flex h-[90vh] w-[90vw] max-w-[1400px] flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          backgroundColor: DESIGN_TOKENS.panel,
          borderColor: DESIGN_TOKENS.border,
          backdropFilter: "blur(20px)",
        }}
      >
        {/* ── 标题栏 ── */}
        <div
          className="flex items-center justify-between border-b px-5 py-3"
          style={{ borderColor: DESIGN_TOKENS.border }}
        >
          <div className="flex items-center gap-3">
            <Globe size={20} style={{ color: DESIGN_TOKENS.accent }} />
            <span
              className="text-sm font-semibold"
              style={{ color: DESIGN_TOKENS.text }}
            >
              720/360 全景场景预览
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* 上传按钮 */}
            <button
              onClick={() => inputFileRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all hover:bg-white/10"
              style={{ color: DESIGN_TOKENS.textSecondary }}
              title="上传全景图"
            >
              <Upload size={14} />
              上传
            </button>
            <input
              ref={inputFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            {/* 自动旋转开关 */}
            <button
              onClick={() => setAutoRotate(!autoRotate)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all"
              style={{
                color: autoRotate ? DESIGN_TOKENS.accentHover : DESIGN_TOKENS.textMuted,
                backgroundColor: autoRotate ? DESIGN_TOKENS.accentSoft : "transparent",
              }}
              title={autoRotate ? "关闭自动旋转" : "开启自动旋转"}
            >
              <RotateCw size={14} />
              旋转
            </button>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-all hover:bg-white/10"
              style={{ color: DESIGN_TOKENS.textMuted }}
              title="关闭"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── 主体内容 ── */}
        <div className="flex flex-1 overflow-hidden">
          {/* 左侧：全景预𪾢器 */}
          <div className="relative flex flex-1 flex-col">
            {/* 标签栏 */}
            <div
              className="flex gap-1 border-b px-4 py-1.5"
              style={{ borderColor: DESIGN_TOKENS.border }}
            >
              {([
                { key: "viewer", label: "预𪾢" },
                { key: "prompt", label: "提示词" },
                { key: "presets", label: "预设" },
              ] as const).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="rounded-lg px-3 py-1 text-xs transition-all"
                  style={{
                    color:
                      activeTab === tab.key
                        ? DESIGN_TOKENS.accentHover
                        : DESIGN_TOKENS.textMuted,
                    backgroundColor:
                      activeTab === tab.key
                        ? DESIGN_TOKENS.accentSoft
                        : "transparent",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 预𪾢模式 */}
            {activeTab === "viewer" && (
              <div className="relative flex-1">
                {imageUrl ? (
                  <div className="h-full w-full">
                    {typeof document !== "undefined" && (
                      <ReactPannellum
                        id="panorama-viewer"
                        sceneId={sceneId}
                        imageSource={imageUrl}
                        config={pannellumConfig}
                        style={{ width: "100%", height: "100%" }}
                      />
                    )}
                  </div>
                ) : (
                  <div
                    className="flex h-full flex-col items-center justify-center gap-4"
                    style={{ color: DESIGN_TOKENS.textMuted }}
                  >
                    <Globe size={64} strokeWidth={1} />
                    <p className="text-sm">请选择或上传全景图</p>
                    <p className="text-xs">
                      支持 equirectangular (等距柱状投影) 全景图片
                    </p>
                    <div className="mt-4 flex gap-3">
                      {DEMO_PANORAMAS.map((demo) => (
                        <button
                          key={demo.url}
                          onClick={() => selectDemo(demo.url, demo.autoRotateSpeed)}
                          className="rounded-lg px-4 py-2 text-xs transition-all hover:bg-white/10"
                          style={{
                            backgroundColor: DESIGN_TOKENS.accentSoft,
                            color: DESIGN_TOKENS.textSecondary,
                          }}
                        >
                          {demo.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 提示词模式 */}
            {activeTab === "prompt" && (
              <div
                className="flex-1 overflow-y-auto p-4"
                style={{ backgroundColor: DESIGN_TOKENS.panelSolid }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span
                    className="text-xs font-medium"
                    style={{ color: DESIGN_TOKENS.textSecondary }}
                  >
                    全景生成提示词
                  </span>
                  <button
                    onClick={handleApply}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all"
                    style={{
                      backgroundColor: DESIGN_TOKENS.accent,
                      color: "#fff",
                    }}
                    disabled={!selectedNodeId}
                  >
                    <Check size={14} />
                    应用
                  </button>
                </div>
                <textarea
                  className="w-full resize-none rounded-xl border p-3 text-xs leading-relaxed outline-none"
                  rows={10}
                  style={{
                    backgroundColor: "rgba(255,255,255,0.04)",
                    borderColor: DESIGN_TOKENS.border,
                    color: DESIGN_TOKENS.text,
                  }}
                  value={panoramaPrompt}
                  onChange={(e) => setPanoramaPrompt(e.target.value)}
                  placeholder="输入或从预设生成全景提示词..."
                />
                <p
                  className="mt-2 text-xs"
                  style={{ color: DESIGN_TOKENS.textMuted }}
                >
                  将此提示词应用到当前选中的节点，用于生成全景场景图。
                </p>
              </div>
            )}

            {/* 预设模式 */}
            {activeTab === "presets" && (
              <div
                className="flex-1 overflow-y-auto p-4"
                style={{ backgroundColor: DESIGN_TOKENS.panelSolid }}
              >
                <div className="mb-3">
                  <span
                    className="text-xs font-medium"
                    style={{ color: DESIGN_TOKENS.textSecondary }}
                  >
                    提示词预设
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {PANORAMA_PROMPT_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => applyPresetPrompt(preset.prompt)}
                      className="flex flex-col gap-1 rounded-xl border p-3 text-left transition-all hover:bg-white/5"
                      style={{ borderColor: DESIGN_TOKENS.border }}
                    >
                      <span
                        className="text-xs font-medium"
                        style={{ color: DESIGN_TOKENS.text }}
                      >
                        {preset.label}
                      </span>
                      <span
                        className="text-[11px] leading-relaxed line-clamp-2"
                        style={{ color: DESIGN_TOKENS.textMuted }}
                      >
                        {preset.prompt}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 右侧：配置面板 */}
          <div
            className="flex w-72 flex-col border-l p-4"
            style={{ borderColor: DESIGN_TOKENS.border }}
          >
            <span
              className="mb-4 text-xs font-medium"
              style={{ color: DESIGN_TOKENS.textSecondary }}
            >
              场景配置
            </span>

            {/* 标题 */}
            <div className="mb-3">
              <label
                className="mb-1 block text-[11px]"
                style={{ color: DESIGN_TOKENS.textMuted }}
              >
                标题
              </label>
              <input
                className="w-full rounded-lg border px-3 py-1.5 text-xs outline-none"
                style={{
                  backgroundColor: "rgba(255,255,255,0.04)",
                  borderColor: DESIGN_TOKENS.border,
                  color: DESIGN_TOKENS.text,
                }}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="全景场景标题"
              />
            </div>

            {/* 描述 */}
            <div className="mb-3">
              <label
                className="mb-1 block text-[11px]"
                style={{ color: DESIGN_TOKENS.textMuted }}
              >
                描述
              </label>
              <textarea
                className="w-full resize-none rounded-lg border px-3 py-1.5 text-xs outline-none"
                rows={3}
                style={{
                  backgroundColor: "rgba(255,255,255,0.04)",
                  borderColor: DESIGN_TOKENS.border,
                  color: DESIGN_TOKENS.text,
                }}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="场景氛围描述..."
              />
            </div>

            {/* 自动旋转速度 */}
            <div className="mb-3">
              <label
                className="mb-1 block text-[11px]"
                style={{ color: DESIGN_TOKENS.textMuted }}
              >
                自动旋转速度
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="-10"
                  max="10"
                  step="0.5"
                  className="flex-1 accent-slate-400"
                  value={-autoRotateSpeed}
                  onChange={(e) => setAutoRotateSpeed(-Number(e.target.value))}
                />
                <span
                  className="w-10 text-right text-xs"
                  style={{ color: DESIGN_TOKENS.textMuted }}
                >
                  {Math.abs(autoRotateSpeed)}°/s
                </span>
              </div>
            </div>

            {/* 示例图快速选择 */}
            <div className="mb-4">
              <label
                className="mb-2 block text-[11px]"
                style={{ color: DESIGN_TOKENS.textMuted }}
              >
                示例全景图
              </label>
              <div className="flex flex-col gap-1.5">
                {DEMO_PANORAMAS.map((demo) => (
                  <button
                    key={demo.url}
                    onClick={() => selectDemo(demo.url, demo.autoRotateSpeed)}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-all hover:bg-white/5"
                    style={{
                      borderColor:
                        imageUrl === demo.url
                          ? DESIGN_TOKENS.accent
                          : DESIGN_TOKENS.border,
                    }}
                  >
                    <Image size={14} style={{ color: DESIGN_TOKENS.textMuted }} />
                    <span style={{ color: DESIGN_TOKENS.textSecondary }}>
                      {demo.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 分隔线 */}
            <div
              className="mb-4 h-px w-full"
              style={{ backgroundColor: DESIGN_TOKENS.border }}
            />

            {/* 操作按钮 */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  if (!panoramaPrompt) {
                    const config: PanoramaConfig = {
                      imageUrl,
                      title,
                      description,
                      autoRotateSpeed,
                      hfov: DEFAULT_CONFIG.hfov,
                      pitch: DEFAULT_CONFIG.pitch,
                      yaw: DEFAULT_CONFIG.yaw,
                    }
                    setPanoramaPrompt(generatePanoramaPrompt(config))
                  }
                  setActiveTab("prompt")
                }}
                className="flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs transition-all"
                style={{
                  backgroundColor: DESIGN_TOKENS.accentSoft,
                  color: DESIGN_TOKENS.accentHover,
                }}
              >
                <Sparkles size={14} />
                生成提示词
              </button>

              <button
                onClick={handleApply}
                className="flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs transition-all"
                style={{
                  backgroundColor: DESIGN_TOKENS.accent,
                  color: "#fff",
                }}
                disabled={!selectedNodeId}
              >
                <Check size={14} />
                应用到节点
              </button>

              <button
                onClick={reset}
                className="flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs transition-all hover:bg-white/10"
                style={{ color: DESIGN_TOKENS.textMuted }}
              >
                <RefreshCw size={14} />
                重置
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
