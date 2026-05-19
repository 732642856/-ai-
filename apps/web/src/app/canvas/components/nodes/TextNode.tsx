// ============================================================================
// Text Node Component - Display and edit text content with floating toolbar
// ============================================================================
"use client"

import { memo, useState, useEffect, useRef, useCallback } from "react"
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link,
  Image,
  Heading1,
  Heading2,
  Heading3,
  Type,
  Check,
  X,
} from "lucide-react"
import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react"
import { DESIGN_TOKENS } from "../../styles/designSystem"
import type { CanvasNodeData } from "../canvas/types"

interface TextNodeProps extends NodeProps {
  data: CanvasNodeData & {
    title?: string
    content?: string
  }
}

type TextFormat = "bold" | "italic" | "h1" | "h2" | "h3" | "paragraph" | "ul" | "ol" | "link"

export const TextNode = memo(function TextNode({ id, data, selected }: TextNodeProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(data.title || "")
  const [editContent, setEditContent] = useState(data.content || data.prompt || "")
  const [activeFormats, setActiveFormats] = useState<Set<TextFormat>>(new Set())
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { setNodes } = useReactFlow()

  const title = data.title || "Text"
  const content = data.content || data.prompt || ""

  // Sync local state when data changes externally
  useEffect(() => {
    if (!isEditing) {
      setEditTitle(data.title || "")
      setEditContent(data.content || data.prompt || "")
    }
  }, [data.title, data.content, data.prompt, isEditing])

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
            title: editTitle,
            content: editContent,
            prompt: editContent,
          },
        }
      })
    )
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditTitle(data.title || "")
    setEditContent(data.content || data.prompt || "")
    setIsEditing(false)
  }

  // Apply format to selected text or at cursor
  const applyFormat = useCallback((format: TextFormat) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = editContent

    let prefix = ""
    let suffix = ""

    switch (format) {
      case "bold":
        prefix = "**"
        suffix = "**"
        break
      case "italic":
        prefix = "*"
        suffix = "*"
        break
      case "h1":
        prefix = "# "
        break
      case "h2":
        prefix = "## "
        break
      case "h3":
        prefix = "### "
        break
      case "paragraph":
        prefix = "\n\n"
        break
      case "ul":
        prefix = "\n- "
        break
      case "ol":
        prefix = "\n1. "
        break
      case "link":
        prefix = "["
        suffix = "](url)"
        break
    }

    if (start === end) {
      // No selection, just insert format markers
      const newText = text.slice(0, start) + prefix + suffix + text.slice(end)
      setEditContent(newText)
      setTimeout(() => {
        textarea.selectionStart = start + prefix.length
        textarea.selectionEnd = start + prefix.length
        textarea.focus()
      }, 0)
    } else {
      // Has selection, wrap it
      const selected = text.slice(start, end)
      const newText = text.slice(0, start) + prefix + selected + suffix + text.slice(end)
      setEditContent(newText)
      setTimeout(() => {
        textarea.selectionStart = start + prefix.length
        textarea.selectionEnd = start + prefix.length + selected.length
        textarea.focus()
      }, 0)
    }

    setActiveFormats((prev) => {
      const next = new Set(prev)
      if (next.has(format)) {
        next.delete(format)
      } else {
        next.add(format)
      }
      return next
    })
  }, [editContent])

  // 简单的 Markdown 渲染函数
  const renderMarkdown = (text: string): string => {
    if (!text) return ""
    return text
      .replace(/^# (.*$)/gim, '<h1 class="text-lg font-bold text-white mb-2">$1</h1>')
      .replace(/^## (.*$)/gim, '<h2 class="text-base font-bold text-white mb-1.5">$1</h2>')
      .replace(/^### (.*$)/gim, '<h3 class="text-sm font-bold text-white mb-1">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic text-white/90">$1</em>')
      .replace(/^- (.*$)/gim, '<li class="ml-4 text-white/80 list-disc">$1</li>')
      .replace(/^\d+\. (.*$)/gim, '<li class="ml-4 text-white/80 list-decimal">$1</li>')
      .replace(/\n/g, "<br/>")
  }

  const formatButtons: { icon: React.ComponentType<{ size: number; strokeWidth: number }>; format: TextFormat; label: string }[] = [
    { icon: Heading1, format: "h1", label: "H1" },
    { icon: Heading2, format: "h2", label: "H2" },
    { icon: Heading3, format: "h3", label: "H3" },
    { icon: Type, format: "paragraph", label: "正文" },
    { icon: Bold, format: "bold", label: "粗体" },
    { icon: Italic, format: "italic", label: "斜体" },
    { icon: List, format: "ul", label: "列表" },
    { icon: ListOrdered, format: "ol", label: "编号" },
    { icon: Link, format: "link", label: "链接" },
  ]

  return (
    <>
      {/* Connection Handles */}
      <Handle type="target" position={Position.Top} className="!bg-slate-400 !h-3 !w-3 !rounded-sm !border-2 !border-white/50" />
      <Handle type="target" position={Position.Left} className="!bg-slate-400 !h-3 !w-3 !rounded-sm !border-2 !border-white/50" />
      <Handle type="source" position={Position.Right} className="!bg-slate-500 !h-3 !w-3 !rounded-sm !border-2 !border-white/50" />
      <Handle type="source" position={Position.Bottom} className="!bg-slate-500 !h-3 !w-3 !rounded-sm !border-2 !border-white/50" />

      {/* Floating Formatting Toolbar - appears when selected and editing */}
      {selected && isEditing && (
        <div
          className="absolute -top-12 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full border px-2 py-1.5"
          style={{
            backgroundColor: "rgba(30,30,36,0.95)",
            borderColor: DESIGN_TOKENS.border,
            backdropFilter: "blur(20px)",
            zIndex: 100,
          }}
        >
          {formatButtons.map(({ icon: Icon, format, label }) => (
            <button
              key={format}
              onClick={() => applyFormat(format)}
              className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/10"
              style={{
                color: activeFormats.has(format) ? DESIGN_TOKENS.accent : DESIGN_TOKENS.textMuted,
              }}
              title={label}
            >
              <Icon size={14} strokeWidth={1.5} />
            </button>
          ))}
          <div className="mx-1 h-4 w-px" style={{ backgroundColor: DESIGN_TOKENS.border }} />
          <button
            onClick={handleCancel}
            className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/10"
            style={{ color: DESIGN_TOKENS.textMuted }}
            title="取消"
          >
            <X size={14} strokeWidth={1.5} />
          </button>
          <button
            onClick={handleSave}
            className="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
            style={{ color: DESIGN_TOKENS.accent }}
            title="保存"
          >
            <Check size={14} strokeWidth={2} />
          </button>
        </div>
      )}

      {/* Node Content */}
      <div
        className={`overflow-hidden rounded-2xl border transition-all ${
          selected
            ? "border-slate-400/60 shadow-lg shadow-slate-500/20"
            : "border-white/10 hover:border-white/20"
        }`}
        onDoubleClick={handleDoubleClick}
        style={{
          minHeight: 100,
          background: "linear-gradient(145deg, rgba(30,41,59,0.32) 0%, rgba(16,18,34,0.92) 100%)",
          boxShadow: selected ? DESIGN_TOKENS.shadowNode : "none",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-white/10 bg-black/20 px-4 py-2.5">
          <span
            className="truncate text-xs font-medium uppercase tracking-wider"
            style={{ color: DESIGN_TOKENS.accentHover }}
          >
            {isEditing ? "编辑文本" : title}
          </span>
        </div>

        {/* Content */}
        <div className="p-4">
          {isEditing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="标题"
                className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-1.5 text-sm text-white placeholder:text-zinc-500 focus:border-slate-400 focus:outline-none"
                autoFocus
              />
              <textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="输入文本内容..."
                className="w-full resize-none rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm leading-relaxed text-white placeholder:text-zinc-500 focus:border-slate-400 focus:outline-none"
                rows={5}
                style={{ minHeight: "80px" }}
              />
            </div>
          ) : (
            <div>
              {content ? (
                <div className="max-h-[200px] overflow-y-auto">
                  <div
                    className="text-sm leading-relaxed text-white/80"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                  />
                </div>
              ) : (
                <p className="text-sm text-white/30">双击编辑文本</p>
              )}
            </div>
          )}
        </div>

        {/* Footer hint */}
        {selected && !isEditing && (
          <div className="border-t border-white/10 bg-black/20 px-4 py-1.5">
            <p className="text-[9px] uppercase tracking-wider text-white/30">
              双击编辑 · 右键菜单
            </p>
          </div>
        )}
      </div>
    </>
  )
})

export default TextNode
