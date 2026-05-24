// ============================================================================
// Image Node Component - TapNow-inspired Design
// Upload button + image preview + bottom AI generation input bar
// ============================================================================
"use client"

import { memo, useState, useEffect, useCallback, useRef } from "react"
import {
  AlertTriangle,
  Upload,
  Image as ImageIcon,
  ChevronDown,
  ArrowUp,
  Loader2,
  X,
  Sparkles,
  Maximize2,
} from "lucide-react"
import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react"
import { DESIGN_TOKENS } from "../../styles/designSystem"
import type { CanvasNodeData, CanvasNodeKind } from "../canvas/types"
import { NodeRunStatusIndicator } from "./NodeRunStatusIndicator"

// Global registry for hover events
const imageHoverRegistry: Record<string, {
  onMouseEnter: (nodeId: string, event: MouseEvent) => void
  onMouseLeave: () => void
}> = {}

export function registerImageHoverHandlers(nodeId: string, handlers: {
  onMouseEnter: (nodeId: string, event: MouseEvent) => void
  onMouseLeave: () => void
}) {
  imageHoverRegistry[nodeId] = handlers
}

export function unregisterImageHoverHandlers(nodeId: string) {
  delete imageHoverRegistry[nodeId]
}

interface ImageNodeProps extends NodeProps {
  data: CanvasNodeData & {
    imageUrl?: string
    assetUrl?: string
    fileName?: string
    fileSize?: number
    title?: string
  }
}

// Model options for image generation
const IMAGE_MODELS = [
  { value: "gpt-image-2", label: "GPT-Image-2", desc: "高质量图像生成" },
]

// Aspect ratio options
const ASPECT_RATIOS = [
  { value: "1:1", label: "1:1", size: "1024x1024", displaySize: "1024" },
  { value: "16:9", label: "16:9", size: "1024x576", displaySize: "1024×576" },
  { value: "9:16", label: "9:16", size: "576x1024", displaySize: "576×1024" },
  { value: "4:3", label: "4:3", size: "1024x768", displaySize: "1024×768" },
  { value: "3:4", label: "3:4", size: "768x1024", displaySize: "768×1024" },
]

export const ImageNode = memo(function ImageNode({ id, data, selected }: ImageNodeProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [aiInput, setAiInput] = useState("")
  const [selectedModel, setSelectedModel] = useState("gpt-image-2")
  const [selectedRatio, setSelectedRatio] = useState("1:1")
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [showRatioDropdown, setShowRatioDropdown] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const aiInputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { setNodes, getNodes, setEdges } = useReactFlow()

  const imageUrl = data.imageUrl || data.assetUrl || ""
  const fileName = data.fileName || data.title || "图片"
  const displayWidth = data.displayWidth ?? 280
  const displayHeight = data.displayHeight ?? 200

  // Cleanup registry on unmount
  useEffect(() => {
    return () => { unregisterImageHoverHandlers(id) }
  }, [id])

  const handleImageLoad = () => setIsLoading(false)
  const handleImageError = () => { setIsLoading(false); setHasError(true) }

  const hoverHandlers = imageHoverRegistry[id]
  const handleMouseEnter = useCallback((event: React.MouseEvent) => {
    if (hoverHandlers) hoverHandlers.onMouseEnter(id, event.nativeEvent)
  }, [hoverHandlers, id])
  const handleMouseLeave = useCallback((event: React.MouseEvent) => {
    if (hoverHandlers) hoverHandlers.onMouseLeave()
  }, [hoverHandlers])

  // Auto-resize textarea
  const autoResize = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = "auto"
    el.style.height = el.scrollHeight + "px"
  }, [])

  useEffect(() => {
    autoResize(aiInputRef.current)
  }, [aiInput, autoResize])

  // Handle file upload
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const url = event.target?.result as string
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id !== id) return node
          return {
            ...node,
            data: {
              ...node.data,
              imageUrl: url,
              assetUrl: url,
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type,
            },
          }
        })
      )
      setIsLoading(true)
      setHasError(false)
    }
    reader.readAsDataURL(file)
  }, [id, setNodes])

  // AI Generate Image
  const handleAiGenerate = useCallback(async () => {
    if (!aiInput.trim()) return

    setIsGenerating(true)
    setAiError(null)

    try {
      const ratio = ASPECT_RATIOS.find(r => r.value === selectedRatio)
      const size = ratio?.size || "1024x1024"

      // Build request body — support image-to-image when imageUrl exists
      const bodyObj: Record<string, any> = {
        prompt: aiInput,
        model: "gpt-image-2",
        size,
      }
      if (imageUrl) {
        bodyObj.sourceImage = imageUrl
      }

      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyObj),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `API error: ${res.status}`)
      }

      const result = await res.json()
      if (!result.imageUrl) throw new Error("No image data returned")

      const currentNode = getNodes().find((n) => n.id === id)
      if (!currentNode) throw new Error("Node not found")

      const newNode = {
        id: `node-${Date.now()}`,
        type: "image" as const,
        position: { x: currentNode.position.x + 380, y: currentNode.position.y },
        data: {
          title: `生成: ${aiInput.slice(0, 20)}...`,
          imageUrl: result.imageUrl,
          nodeKind: "ai-generated-image" as CanvasNodeKind,
          sourcePromptId: id,
          displayWidth: 280,
          displayHeight: ratio?.value === "16:9" ? 158 : ratio?.value === "9:16" ? 498 : 280,
          createdAt: Date.now(),
        },
      }

      setNodes((nds) => [...nds, newNode])
      setEdges((eds) => [...eds, {
        id: `edge-${id}-${newNode.id}`,
        source: id,
        target: newNode.id,
        type: "creative",
        animated: true,
        style: { stroke: DESIGN_TOKENS.nodeEdge, strokeWidth: 1.5 },
      }])

      // NOTE: intentionally NOT clearing aiInput so user can tweak & retry

    } catch (err: any) {
      setAiError(err.message || "生成失败")
    } finally {
      setIsGenerating(false)
    }
  }, [aiInput, selectedRatio, id, getNodes, setNodes, setEdges, imageUrl])
  const handleAiInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleAiGenerate()
    }
  }

  const currentModel = IMAGE_MODELS[0]
  const currentRatio = ASPECT_RATIOS.find(r => r.value === selectedRatio) || ASPECT_RATIOS[0]

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Connection Handles */}
      <Handle type="target" position={Position.Top} className="!bg-slate-400 !h-2.5 !w-2.5 !rounded-sm !border !border-white/30" />
      <Handle type="target" position={Position.Left} className="!bg-slate-400 !h-2.5 !w-2.5 !rounded-sm !border !border-white/30" />
      <Handle type="source" position={Position.Right} className="!bg-slate-500 !h-2.5 !w-2.5 !rounded-sm !border !border-white/30" />
      <Handle type="source" position={Position.Bottom} className="!bg-slate-500 !h-2.5 !w-2.5 !rounded-sm !border !border-white/30" />

      {/* Node Content */}
      <div
        className="relative rounded-2xl border transition-all"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          width: 340,
          backgroundColor: DESIGN_TOKENS.panelSolid,
          borderColor: selected ? "rgba(148, 163, 184, 0.4)" : "rgba(255, 255, 255, 0.08)",
          boxShadow: selected ? DESIGN_TOKENS.shadowNode : "none",
        }}
      >
        {/* ===== UPLOAD BUTTON ===== */}
        <div
          className="flex items-center justify-between border-b px-3 py-2"
          style={{ borderColor: DESIGN_TOKENS.border }}
        >
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-all hover:bg-white/5"
            style={{ borderColor: DESIGN_TOKENS.border, color: DESIGN_TOKENS.textSecondary }}
          >
            <Upload size={13} strokeWidth={1.5} />
            <span>上传</span>
          </button>
          <div className="flex items-center gap-2">
            <NodeRunStatusIndicator data={data} variant="dot" />
            <div className="flex items-center gap-1" style={{ color: DESIGN_TOKENS.textMuted }}>
              <ImageIcon size={13} strokeWidth={1.5} />
              <span className="text-[11px]">Image</span>
            </div>
          </div>
        </div>

        {/* ===== IMAGE PREVIEW ===== */}
        <div className="p-3">
          <div
            className="relative flex items-center justify-center overflow-hidden rounded-xl bg-black/20"
            style={{ width: "100%", height: 220 }}
          >
            {isLoading && imageUrl && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
              </div>
            )}

            {hasError ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/40">
                <AlertTriangle size={28} strokeWidth={1.5} />
                <span className="text-xs">图片加载失败</span>
              </div>
            ) : imageUrl ? (
              <img
                src={imageUrl}
                alt={fileName}
                className={`h-full w-full object-contain transition-opacity ${isLoading ? "opacity-0" : "opacity-100"}`}
                draggable={false}
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-white/25">
                <ImageIcon size={32} strokeWidth={1} />
                <span className="text-xs">点击上传或输入描述生成</span>
              </div>
            )}
          </div>
        </div>

        {/* ===== AI GENERATION INPUT BAR ===== */}
        <div
          className="border-t px-3 py-2.5"
          style={{ borderColor: DESIGN_TOKENS.border }}
        >
          {/* Input area */}
          <div className="relative">
            <textarea
              ref={aiInputRef}
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={handleAiInputKeyDown}
              placeholder="描述任何你想要生成的内容"
              className="w-full resize-none rounded-xl border bg-transparent px-3 py-2.5 pr-10 text-sm text-white/80 placeholder:text-white/25 focus:outline-none"
              style={{
                borderColor: DESIGN_TOKENS.border,
                minHeight: "44px",
                maxHeight: "120px",
              }}
              rows={1}
            />
            <button
              className="absolute right-2 top-2"
              style={{ color: DESIGN_TOKENS.textMuted }}
            >
              <Maximize2 size={14} strokeWidth={1.5} />
            </button>
          </div>

          {/* Bottom bar: Model + Ratio + Send */}
          <div className="mt-2 flex items-center justify-between">
            {/* Left: Model + Ratio */}
            <div className="flex items-center gap-2">
              {/* Model selector */}
              <div className="relative">
                <button
                  onClick={() => { setShowModelDropdown(!showModelDropdown); setShowRatioDropdown(false) }}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors hover:bg-white/5"
                  style={{ color: DESIGN_TOKENS.textSecondary }}
                >
                  <Sparkles size={12} strokeWidth={1.5} />
                  <span>{currentModel.label}</span>
                  <ChevronDown size={12} strokeWidth={1.5} />
                </button>
                {showModelDropdown && (
                  <div
                    className="absolute bottom-full left-0 mb-1 w-44 rounded-xl border py-1"
                    style={{
                      backgroundColor: DESIGN_TOKENS.panelSolid,
                      borderColor: DESIGN_TOKENS.border,
                      boxShadow: DESIGN_TOKENS.shadowMenu,
                    }}
                  >
                    {IMAGE_MODELS.map((model) => (
                      <button
                        key={model.value}
                        onClick={() => { setSelectedModel(model.value); setShowModelDropdown(false) }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-white/5"
                        style={{ color: selectedModel === model.value ? DESIGN_TOKENS.accentHover : DESIGN_TOKENS.textSecondary }}
                      >
                        <Sparkles size={12} strokeWidth={1.5} />
                        <div>
                          <div className="font-medium">{model.label}</div>
                          <div className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>{model.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Ratio selector */}
              <div className="relative">
                <button
                  onClick={() => { setShowRatioDropdown(!showRatioDropdown); setShowModelDropdown(false) }}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors hover:bg-white/5"
                  style={{ color: DESIGN_TOKENS.textSecondary }}
                >
                  <span className="text-[10px]">{currentRatio.label}</span>
                  <span className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>· {currentRatio.displaySize}</span>
                  <ChevronDown size={12} strokeWidth={1.5} />
                </button>
                {showRatioDropdown && (
                  <div
                    className="absolute bottom-full left-0 mb-1 rounded-xl border py-1"
                    style={{
                      backgroundColor: DESIGN_TOKENS.panelSolid,
                      borderColor: DESIGN_TOKENS.border,
                      boxShadow: DESIGN_TOKENS.shadowMenu,
                    }}
                  >
                    {ASPECT_RATIOS.map((ratio) => (
                      <button
                        key={ratio.value}
                        onClick={() => { setSelectedRatio(ratio.value); setShowRatioDropdown(false) }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-white/5"
                        style={{ color: selectedRatio === ratio.value ? DESIGN_TOKENS.accentHover : DESIGN_TOKENS.textSecondary }}
                      >
                        <span className="font-medium">{ratio.label}</span>
                        <span className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>{ratio.displaySize}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Send */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleAiGenerate}
                disabled={isGenerating || !aiInput.trim()}
                className="ml-1 flex h-7 w-7 items-center justify-center rounded-full transition-all disabled:opacity-30"
                style={{
                  backgroundColor: aiInput.trim() ? DESIGN_TOKENS.accent : "rgba(255,255,255,0.1)",
                }}
              >
                {isGenerating ? (
                  <Loader2 size={14} className="animate-spin text-white/70" />
                ) : (
                  <ArrowUp size={14} strokeWidth={2} className="text-white/80" />
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {aiError && (
            <div className="mt-2 flex items-center justify-between rounded-lg px-2 py-1.5" style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
              <span className="text-[11px] text-red-300/70">{aiError}</span>
              <button onClick={() => setAiError(null)} className="text-[11px] text-white/40 hover:text-white/60">
                <X size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
})

export default ImageNode
