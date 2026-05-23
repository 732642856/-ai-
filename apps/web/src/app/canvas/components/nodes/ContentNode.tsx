// ============================================================================
// Content Node Component - TapNow-inspired Design
// Top toolbar + editing area + bottom AI input bar
// ============================================================================
"use client"

import { memo, useState, useEffect, useRef, useCallback } from "react"
import {
  Sparkles,
  Bold,
  Italic,
  List,
  ListOrdered,
  Link,
  Heading1,
  Heading2,
  Heading3,
  Type,
  Quote,
  Minus,
  Code,
  Paperclip,
  ImagePlus,
  Maximize2,
  ChevronDown,
  Mic,
  ArrowUp,
  Loader2,
  X,
  Palette,
} from "lucide-react"
import { Handle, Position, NodeResizer, type NodeProps, useReactFlow } from "@xyflow/react"
import { DESIGN_TOKENS, ICON_CONFIG } from "../../styles/designSystem"
import type { CanvasNodeData, CanvasNodeKind } from "../canvas/types"
import { NodeRunStatusIndicator } from "./NodeRunStatusIndicator"

interface ContentNodeProps extends NodeProps {
  data: CanvasNodeData
}

type TextFormat = "bold" | "italic" | "h1" | "h2" | "h3" | "paragraph" | "ul" | "ol" | "link" | "quote" | "hr" | "code"

// Simple Markdown renderer
function renderMarkdown(text: string): string {
  if (!text) return ""
  return text
    .replace(/^# (.*$)/gim, '<h1 class="text-lg font-bold text-white mb-2">$1</h1>')
    .replace(/^## (.*$)/gim, '<h2 class="text-base font-bold text-white mb-1.5">$1</h2>')
    .replace(/^### (.*$)/gim, '<h3 class="text-sm font-bold text-white mb-1">$1</h3>')
    .replace(/^> (.*$)/gim, '<blockquote class="border-l-2 border-slate-400/40 pl-3 text-white/60 italic my-2">$1</blockquote>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic text-white/90">$1</em>')
    .replace(/^- (.*$)/gim, '<li class="ml-4 text-white/80 list-disc">$1</li>')
    .replace(/^\d+\. (.*$)/gim, '<li class="ml-4 text-white/80 list-decimal">$1</li>')
    .replace(/^```([\s\S]*?)```$/gim, '<pre class="bg-black/30 rounded-lg p-2 text-xs text-white/70 font-mono my-2 overflow-x-auto"><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-black/30 rounded px-1 text-xs text-white/80 font-mono">$1</code>')
    .replace(/\n/g, "<br/>")
}

// Model options matching TapNow
const MODEL_OPTIONS = [
  { value: "gpt-5.5", label: "GPT-5.5", desc: "最强推理" },
  { value: "gpt-5.4", label: "GPT-5.4", desc: "高性能" },
  { value: "gpt-5.4-mini", label: "GPT-5.4 Mini", desc: "快速响应" },
  { value: "gpt-image-2", label: "GPT-Image-2", desc: "生图" },
]

export const ContentNode = memo(function ContentNode({ id, data, selected }: ContentNodeProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(data.content || data.prompt || "")
  const [aiInput, setAiInput] = useState("")
  const [selectedModel, setSelectedModel] = useState("gpt-5.5")
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const aiInputRef = useRef<HTMLTextAreaElement>(null)
  const { setNodes, getNodes, setEdges } = useReactFlow()

  const isPromptMode = data.nodeKind === "prompt"
  const content = data.content || data.prompt || ""

  // Sync local state when data changes externally
  useEffect(() => {
    if (!isEditing) {
      setEditContent(data.content || data.prompt || "")
    }
  }, [data.content, data.prompt, isEditing])

  // Auto-resize textarea
  const autoResize = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = "auto"
    el.style.height = el.scrollHeight + "px"
  }, [])

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditing(true)
  }

  const handleSave = () => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id !== id) return node
        return {
          ...node,
          data: {
            ...node.data,
            content: editContent,
            prompt: editContent,
          },
        }
      })
    )
    setIsEditing(false)
  }

  // Text formatting
  const applyFormat = useCallback((format: TextFormat) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = editContent

    let prefix = ""
    let suffix = ""

    switch (format) {
      case "bold": prefix = "**"; suffix = "**"; break
      case "italic": prefix = "*"; suffix = "*"; break
      case "h1": prefix = "# "; break
      case "h2": prefix = "## "; break
      case "h3": prefix = "### "; break
      case "paragraph": prefix = "\n\n"; break
      case "ul": prefix = "\n- "; break
      case "ol": prefix = "\n1. "; break
      case "link": prefix = "["; suffix = "](url)"; break
      case "quote": prefix = "\n> "; break
      case "hr": prefix = "\n---\n"; break
      case "code": prefix = "\n```\n"; suffix = "\n```\n"; break
    }

    if (start === end) {
      const newText = text.slice(0, start) + prefix + suffix + text.slice(end)
      setEditContent(newText)
      setTimeout(() => {
        textarea.selectionStart = start + prefix.length
        textarea.selectionEnd = start + prefix.length
        textarea.focus()
      }, 0)
    } else {
      const selected = text.slice(start, end)
      const newText = text.slice(0, start) + prefix + selected + suffix + text.slice(end)
      setEditContent(newText)
      setTimeout(() => {
        textarea.selectionStart = start + prefix.length
        textarea.selectionEnd = start + prefix.length + selected.length
        textarea.focus()
      }, 0)
    }
  }, [editContent])

  // AI Generate from bottom input bar
  const handleAiGenerate = useCallback(async () => {
    if (!aiInput.trim()) return

    const isImageGen = selectedModel === "gpt-image-2"
    setIsGenerating(true)
    setAiError(null)

    try {
      if (isImageGen) {
        // Image generation
        const res = await fetch("/api/ai/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: aiInput,
            model: "gpt-image-2",
          }),
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
            displayHeight: 280,
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
      } else {
        // Text generation / chat
        const res = await fetch("/api/ai/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: aiInput,
            model: selectedModel,
            context: {
              systemOverride: isPromptMode
                ? "你是一个专业的图像提示词工程师。请根据用户的描述，生成高质量的图像生成提示词（Prompt）。输出简洁、专业的英文提示词。"
                : "你是一个专业的文案助手。请根据用户的需求，生成高质量的中文文本内容。",
            },
          }),
        })

        if (!res.ok) throw new Error(`API error: ${res.status}`)

        const reader = res.body?.getReader()
        if (!reader) throw new Error("No response stream")

        const decoder = new TextDecoder()
        let generatedText = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split("\n")
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6)
              if (data === "[DONE]") continue
              try {
                const parsed = JSON.parse(data)
                const delta = parsed.content || parsed.choices?.[0]?.delta?.content || ""
                generatedText += delta
              } catch {
                // skip
              }
            }
          }
        }

        if (generatedText.trim()) {
          // Append to current node content
          const newContent = editContent
            ? `${editContent}\n\n${generatedText.trim()}`
            : generatedText.trim()
          setEditContent(newContent)
          setNodes((nds) =>
            nds.map((node) => {
              if (node.id !== id) return node
              return {
                ...node,
                data: {
                  ...node.data,
                  content: newContent,
                  prompt: newContent,
                },
              }
            })
          )
        }
      }

      setAiInput("")
    } catch (err: any) {
      setAiError(err.message || "生成失败")
    } finally {
      setIsGenerating(false)
    }
  }, [aiInput, selectedModel, id, editContent, isPromptMode, getNodes, setNodes, setEdges])

  // Handle AI input key events
  const handleAiInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleAiGenerate()
    }
  }

  // Auto-resize AI input
  useEffect(() => {
    autoResize(aiInputRef.current)
  }, [aiInput, autoResize])

  const currentModel = MODEL_OPTIONS.find(m => m.value === selectedModel) || MODEL_OPTIONS[0]

  return (
    <>
      {/* Resizer */}
      {selected && (
        <NodeResizer
          minWidth={320}
          minHeight={200}
          handleStyle={{
            background: DESIGN_TOKENS.nodeHandle,
            border: "2px solid rgba(255,255,255,0.3)",
            borderRadius: "4px",
          }}
          lineStyle={{ stroke: DESIGN_TOKENS.nodeHandle, strokeWidth: 1.5, strokeDasharray: "6 3" }}
        />
      )}

      {/* Connection Handles */}
      <Handle type="target" position={Position.Top} className="!bg-slate-400 !h-2.5 !w-2.5 !rounded-sm !border !border-white/30" />
      <Handle type="target" position={Position.Left} className="!bg-slate-400 !h-2.5 !w-2.5 !rounded-sm !border !border-white/30" />
      <Handle type="source" position={Position.Right} className="!bg-slate-500 !h-2.5 !w-2.5 !rounded-sm !border !border-white/30" />
      <Handle type="source" position={Position.Bottom} className="!bg-slate-500 !h-2.5 !w-2.5 !rounded-sm !border !border-white/30" />

      {/* Node Content */}
      <div
        className={`overflow-hidden rounded-2xl border transition-all ${
          selected ? "border-slate-400/40" : "border-white/8"
        }`}
        style={{
          width: 360,
          minHeight: 200,
          backgroundColor: DESIGN_TOKENS.panelSolid,
          boxShadow: selected ? DESIGN_TOKENS.shadowNode : "none",
        }}
      >
        {/* ===== TOP TOOLBAR ===== */}
        <div
          className="flex items-center gap-0.5 border-b px-3 py-2"
          style={{ borderColor: DESIGN_TOKENS.border, backgroundColor: "rgba(0,0,0,0.25)" }}
        >
          {/* Color picker placeholder */}
          <button className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/8" style={{ color: DESIGN_TOKENS.textMuted }} title="颜色">
            <Palette size={14} strokeWidth={1.5} />
          </button>
          <div className="mx-1 h-3.5 w-px" style={{ backgroundColor: DESIGN_TOKENS.border }} />

          {/* Headings */}
          <button onClick={() => applyFormat("h1")} className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/8" style={{ color: DESIGN_TOKENS.textSecondary }} title="H1">
            <Heading1 size={14} strokeWidth={1.5} />
          </button>
          <button onClick={() => applyFormat("h2")} className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/8" style={{ color: DESIGN_TOKENS.textSecondary }} title="H2">
            <Heading2 size={14} strokeWidth={1.5} />
          </button>
          <button onClick={() => applyFormat("h3")} className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/8" style={{ color: DESIGN_TOKENS.textSecondary }} title="H3">
            <Heading3 size={14} strokeWidth={1.5} />
          </button>
          <button onClick={() => applyFormat("quote")} className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/8" style={{ color: DESIGN_TOKENS.textSecondary }} title="引用">
            <Quote size={14} strokeWidth={1.5} />
          </button>
          <div className="mx-1 h-3.5 w-px" style={{ backgroundColor: DESIGN_TOKENS.border }} />

          {/* Formatting */}
          <button onClick={() => applyFormat("bold")} className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/8" style={{ color: DESIGN_TOKENS.textSecondary }} title="加粗">
            <Bold size={14} strokeWidth={1.5} />
          </button>
          <button onClick={() => applyFormat("italic")} className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/8" style={{ color: DESIGN_TOKENS.textSecondary }} title="斜体">
            <Italic size={14} strokeWidth={1.5} />
          </button>
          <button onClick={() => applyFormat("ul")} className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/8" style={{ color: DESIGN_TOKENS.textSecondary }} title="无序列表">
            <List size={14} strokeWidth={1.5} />
          </button>
          <button onClick={() => applyFormat("ol")} className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/8" style={{ color: DESIGN_TOKENS.textSecondary }} title="有序列表">
            <ListOrdered size={14} strokeWidth={1.5} />
          </button>
          <button onClick={() => applyFormat("hr")} className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/8" style={{ color: DESIGN_TOKENS.textSecondary }} title="分割线">
            <Minus size={14} strokeWidth={1.5} />
          </button>
          <div className="mx-1 h-3.5 w-px" style={{ backgroundColor: DESIGN_TOKENS.border }} />

          {/* Code */}
          <button onClick={() => applyFormat("code")} className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/8" style={{ color: DESIGN_TOKENS.textSecondary }} title="代码块">
            <Code size={14} strokeWidth={1.5} />
          </button>
          <div className="mx-1 h-3.5 w-px" style={{ backgroundColor: DESIGN_TOKENS.border }} />

          {/* Attachments */}
          <button className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/8" style={{ color: DESIGN_TOKENS.textSecondary }} title="附件">
            <Paperclip size={14} strokeWidth={1.5} />
          </button>
          <button className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/8" style={{ color: DESIGN_TOKENS.textSecondary }} title="图片">
            <ImagePlus size={14} strokeWidth={1.5} />
          </button>

          <div className="flex-1" />

          <NodeRunStatusIndicator data={data} variant="dot" />

          {/* Fullscreen */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/8"
            style={{ color: DESIGN_TOKENS.textMuted }}
            title="全屏"
          >
            <Maximize2 size={13} strokeWidth={1.5} />
          </button>
        </div>

        {/* ===== EDITING AREA ===== */}
        <div className="relative">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={(e) => {
                setEditContent(e.target.value)
                autoResize(e.target)
              }}
              placeholder="双击开始编辑..."
              className="w-full resize-none bg-transparent px-4 py-3 text-sm leading-relaxed text-white/80 placeholder:text-white/20 focus:outline-none"
              style={{ minHeight: "120px" }}
              autoFocus
            />
          ) : (
            <div
              className="min-h-[120px] cursor-text px-4 py-3"
              onDoubleClick={handleDoubleClick}
            >
              {content ? (
                <div
                  className="text-sm leading-relaxed text-white/75"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                />
              ) : (
                <p className="text-sm text-white/20">双击开始编辑...</p>
              )}
            </div>
          )}
        </div>

        {/* ===== AI INPUT BAR ===== */}
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
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="absolute right-2 top-2"
              style={{ color: DESIGN_TOKENS.textMuted }}
            >
              <Maximize2 size={14} strokeWidth={1.5} />
            </button>
          </div>

          {/* Bottom bar: Model + Voice + Speed + Token + Send */}
          <div className="mt-2 flex items-center justify-between">
            {/* Left: Model selector */}
            <div className="relative">
              <button
                onClick={() => setShowModelDropdown(!showModelDropdown)}
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
                  {MODEL_OPTIONS.map((model) => (
                    <button
                      key={model.value}
                      onClick={() => {
                        setSelectedModel(model.value)
                        setShowModelDropdown(false)
                      }}
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

            {/* Right: Voice + Speed + Token + Send */}
            <div className="flex items-center gap-1">
              <button className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-white/5" style={{ color: DESIGN_TOKENS.textMuted }} title="语音输入">
                <Mic size={14} strokeWidth={1.5} />
              </button>
              <div className="mx-1 h-3.5 w-px" style={{ backgroundColor: DESIGN_TOKENS.border }} />
              <span className="text-[11px]" style={{ color: DESIGN_TOKENS.textMuted }}>1x</span>
              <div className="mx-1 h-3.5 w-px" style={{ backgroundColor: DESIGN_TOKENS.border }} />
              <span className="text-[11px]" style={{ color: DESIGN_TOKENS.textMuted }}>4</span>
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

export default ContentNode
