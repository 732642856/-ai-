/**
 * ChatInput - Chat 输入框组件，TapNow 风格
 * 支持附件上传、真实 AI 模型选择、语音输入
 */

import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react"
import { Paperclip, ArrowUp, Square, Mic, ChevronDown, Settings, Sparkles } from "lucide-react"
import { DESIGN_TOKENS, ICON_CONFIG } from "../../styles/designSystem"
import { ChatAttachmentPreview } from "./ChatAttachmentPreview"
import type { ChatAttachment } from "../../hooks/useChatAttachments"
import type { SlashCommand } from "../../types/slash-commands"

// copse.top 实际支持的 AI 模型列表
export type AiModel =
  | "gpt-5.4"
  | "gpt-5.4-mini"
  | "gpt-5.5"
  | "gpt-image-2"

export interface ModelOption {
  value: string
  label: string
  provider: string
  desc: string
  type: "text" | "image" | "video"
}

const MODEL_OPTIONS: ModelOption[] = [
  { value: "gpt-5.5", label: "GPT-5.5", provider: "copse.top", desc: "最强推理+创作", type: "text" },
  { value: "gpt-5.4", label: "GPT-5.4", provider: "copse.top", desc: "高性能多模态", type: "text" },
  { value: "gpt-5.4-mini", label: "GPT-5.4 Mini", provider: "copse.top", desc: "快速响应", type: "text" },
  { value: "gpt-image-2", label: "GPT-Image-2", provider: "copse.top", desc: "高质量图像生成", type: "image" },
]

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend: (model: string, mode?: string) => void
  onStop?: () => void
  isGenerating?: boolean
  selectedModel: string
  onModelChange: (model: string) => void
  attachments: ChatAttachment[]
  onAttachmentsChange: {
    handleFileSelect: (e: ChangeEvent<HTMLInputElement>) => void
    removeAttachment: (id: string) => void
    clearAttachments: () => void
    handleDragOver: (e: React.DragEvent) => void
    handleDrop: (e: React.DragEvent) => void
  }
  onAddAttachmentToCanvas?: (attachment: ChatAttachment) => void
  placeholder?: string
  disabled?: boolean
  canvasNodes?: any[] // 画布节点列表，用于 @ 引用
}

// 读取用户配置的模型列表（from localStorage or default）
function getConfiguredModels(): ModelOption[] {
  if (typeof window === "undefined") return MODEL_OPTIONS
  try {
    const stored = localStorage.getItem("startrails_models")
    if (stored) {
      const storedModels = JSON.parse(stored) as ModelOption[]
      const merged = [...storedModels]

      for (const defaultModel of MODEL_OPTIONS) {
        if (!merged.some((model) => model.value === defaultModel.value)) {
          merged.push(defaultModel)
        }
      }

      return merged
    }
  } catch {}
  return MODEL_OPTIONS
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  isGenerating = false,
  selectedModel,
  onModelChange,
  attachments,
  onAttachmentsChange,
  onAddAttachmentToCanvas,
  placeholder = "描述想法，或框选节点添加上下文...",
  disabled = false,
  canvasNodes = [],
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [activeTypeFilter, setActiveTypeFilter] = useState<"text" | "image" | "video" | null>(null)
  const [showNodeMention, setShowNodeMention] = useState(false)
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashQuery, setSlashQuery] = useState("")
  const [slashPosition, setSlashPosition] = useState({ top: 0, left: 0 })
  const [mentionQuery, setMentionQuery] = useState("")
  const [mentionIndex, setMentionIndex] = useState(0)

  const currentModel = getConfiguredModels().find((m) => m.value === selectedModel)
  const filteredModels = activeTypeFilter
    ? getConfiguredModels().filter((m) => m.type === activeTypeFilter)
    : getConfiguredModels()

  // @ 引用节点过滤
  const mentionableNodes = canvasNodes.filter((n) => n.data?.title || n.data?.text || n.data?.fileName)
  const filteredMentionNodes = mentionQuery
    ? mentionableNodes.filter((n) => {
        const title = n.data?.title || n.data?.fileName || n.data?.text || ""
        return String(title).toLowerCase().includes(mentionQuery.toLowerCase())
      })
    : mentionableNodes

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // @ 引用下拉菜单导航
    if (showNodeMention) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setMentionIndex((prev) => (prev + 1) % filteredMentionNodes.length)
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setMentionIndex((prev) => (prev - 1 + filteredMentionNodes.length) % filteredMentionNodes.length)
        return
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault()
        const node = filteredMentionNodes[mentionIndex]
        if (node) {
          insertNodeMention(node)
        }
        return
      }
      if (e.key === "Escape") {
        setShowNodeMention(false)
        return
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (!isGenerating && (value.trim() || attachments.length > 0)) {
        onSend(selectedModel)
      }
    }
  }

  const insertNodeMention = (node: any) => {
    const title = node.data?.title || node.data?.fileName || node.data?.text?.slice(0, 20) || "节点"
    // 找到最后一个 @ 的位置，替换 @query 为 @nodeId
    const lastAtIndex = value.lastIndexOf("@")
    if (lastAtIndex >= 0) {
      const before = value.slice(0, lastAtIndex)
      const after = value.slice(lastAtIndex + 1 + mentionQuery.length)
      onChange(before + `@${title} ` + after)
    }
    setShowNodeMention(false)
    setMentionQuery("")
    setMentionIndex(0)
    textareaRef.current?.focus()
  }

  const handleInputChange = (newValue: string) => {
    onChange(newValue)
    // Slash command detection
    const lastSlashIndex = newValue.lastIndexOf("/")
    if (lastSlashIndex >= 0) {
      const afterSlash = newValue.slice(lastSlashIndex + 1)
      // Only trigger if "/" is at start or after whitespace, and query is alphanumeric/Chinese
      const beforeSlash = lastSlashIndex > 0 ? newValue[lastSlashIndex - 1] : " "
      if (/\s/.test(beforeSlash) || lastSlashIndex === 0) {
        if (/^[\w一-鿿]*$/.test(afterSlash) && !afterSlash.includes(" ")) {
          setSlashQuery(afterSlash)
          setShowSlashMenu(true)
          // Calculate position near textarea
          if (textareaRef.current) {
            const rect = textareaRef.current.getBoundingClientRect()
            setSlashPosition({ top: rect.top - 10, left: rect.left + 12 })
          }
        } else {
          setShowSlashMenu(false)
        }
      } else {
        setShowSlashMenu(false)
      }
    } else {
      setShowSlashMenu(false)
    }
    // 检测 @ 触发引用
    const lastAtIndex = newValue.lastIndexOf("@")
    if (lastAtIndex >= 0) {
      const afterAt = newValue.slice(lastAtIndex + 1)
      // 检查 @ 后面是否只有字母数字中文（没有空格）
      if (/^[\w\u4e00-\u9fa5]*$/.test(afterAt) && !afterAt.includes(" ")) {
        setShowNodeMention(true)
        setMentionQuery(afterAt)
        setMentionIndex(0)
      } else {
        setShowNodeMention(false)
      }
    } else {
      setShowNodeMention(false)
    }
  }

  const handlePaperclipClick = () => {
    fileInputRef.current?.click()
  }


  // Slash command handler
  const handleSlashSelect = (command: SlashCommand) => {
    setShowSlashMenu(false)
    setSlashQuery("")
    // Replace the "/" and query with the command id
    const newValue = value.replace(/\/[^\s]*$/, command.id)
    onChange(newValue + " ")
    textareaRef.current?.focus()
  }

  const handleSlashClose = () => {
    setShowSlashMenu(false)
    setSlashQuery("")
  }
  return (
    <div
      className="flex flex-col rounded-2xl border"
      style={{
        backgroundColor: "rgba(25,25,32,0.95)",
        borderColor: DESIGN_TOKENS.border,
      }}
      onDragOver={onAttachmentsChange.handleDragOver}
      onDrop={onAttachmentsChange.handleDrop}
    >
      {/* 附件预览 */}
      <ChatAttachmentPreview
        attachments={attachments}
        onRemove={onAttachmentsChange.removeAttachment}
        onAddToCanvas={onAddAttachmentToCanvas}
        showAddToCanvas={true}
      />

      {/* 文本输入框 */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isGenerating}
          rows={1}
          className="w-full resize-none border-0 bg-transparent px-4 py-3 text-sm outline-none"
          style={{
            color: DESIGN_TOKENS.text,
            maxHeight: "160px",
            minHeight: "44px",
          }}
        />

        {/* @ 引用节点下拉菜单 */}
        {showNodeMention && filteredMentionNodes.length > 0 && (
          <div
            className="absolute bottom-full left-4 mb-2 max-h-[200px] w-[280px] overflow-y-auto rounded-xl border py-2 shadow-xl"
            style={{
              backgroundColor: "rgba(30,30,38,0.98)",
              borderColor: DESIGN_TOKENS.border,
            }}
          >
            <div className="px-3 py-1 text-xs" style={{ color: DESIGN_TOKENS.textMuted }}>
              引用画布节点
            </div>
            {filteredMentionNodes.map((node, idx) => {
              const title = node.data?.title || node.data?.fileName || node.data?.text?.slice(0, 20) || "未命名节点"
              const typeLabel = node.type === "image" ? "图片" : node.type === "text" ? "文本" : "提示词"
            
              return (
                <button
                  key={node.id}
                  onClick={() => insertNodeMention(node)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-white/5 ${
                    idx === mentionIndex ? "bg-white/10" : ""
                  }`}
                  style={{ color: idx === mentionIndex ? DESIGN_TOKENS.accent : DESIGN_TOKENS.text }}
                >
                  <span className="text-xs rounded px-1.5 py-0.5" style={{ backgroundColor: "rgba(100,116,139,0.2)", color: DESIGN_TOKENS.textMuted }}>
                    {typeLabel}
                  </span>
                  <span className="truncate">{title}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 底部工具栏 */}
      <div className="flex items-center justify-between px-3 pb-3 pt-1">
        {/* 左侧工具 */}
        <div className="flex items-center gap-1">
          {/* 附件按钮 */}
          <button
            onClick={handlePaperclipClick}
            disabled={disabled || isGenerating}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/5"
            style={{ color: DESIGN_TOKENS.textMuted }}
            title="添加附件"
          >
            <Paperclip size={16} strokeWidth={1.5} />
          </button>

          {/* 隐藏的文件输入 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*,.txt,.md,.pdf,.doc,.docx,.srt,.vtt,.json"
            multiple
            onChange={onAttachmentsChange.handleFileSelect}
            className="hidden"
          />

          {/* 模型选择器 */}
          <div className="relative">
            <button
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors hover:bg-white/5"
              style={{ color: DESIGN_TOKENS.textSecondary }}
            >
              <Sparkles size={12} strokeWidth={1.5} style={{ color: DESIGN_TOKENS.accent }} />
              <span>{currentModel?.label ?? "选择模型"}</span>
              <ChevronDown size={12} strokeWidth={1.5} />
            </button>
            {showModelDropdown && (
              <div
                className="absolute bottom-full left-0 mb-1 w-56 rounded-xl border py-1"
                style={{
                  backgroundColor: DESIGN_TOKENS.panelSolid,
                  borderColor: DESIGN_TOKENS.border,
                }}
              >
                {/* 类型筛选 */}
                <div className="flex gap-1 border-b px-2 pb-1" style={{ borderColor: DESIGN_TOKENS.border }}>
                  {(["text", "image", "video"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setActiveTypeFilter(activeTypeFilter === type ? null : type)}
                      className="rounded-md px-2 py-0.5 text-[10px] transition-colors"
                      style={{
                        backgroundColor: activeTypeFilter === type ? DESIGN_TOKENS.accentSoft : "transparent",
                        color: activeTypeFilter === type ? DESIGN_TOKENS.accent : DESIGN_TOKENS.textMuted,
                      }}
                    >
                      {type === "text" ? "文本" : type === "image" ? "图像" : "视频"}
                    </button>
                  ))}
                </div>
                {/* 模型列表 */}
                {filteredModels.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      onModelChange(opt.value)
                      setShowModelDropdown(false)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-white/5"
                    style={{
                      color: selectedModel === opt.value ? DESIGN_TOKENS.accent : DESIGN_TOKENS.textSecondary,
                    }}
                  >
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>{opt.provider}</span>
                    <span className="ml-auto text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>{opt.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右侧工具 */}
        <div className="flex items-center gap-1">
          {/* 麦克风 - 使用 Web Speech API */}
          <button
            onClick={() => {
              if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
                const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
                const recognition = new SpeechRecognition()
                recognition.lang = "zh-CN"
                recognition.onresult = (event: any) => {
                  const transcript = event.results[0][0].transcript
                  onChange(value + transcript)
                }
                recognition.start()
              } else {
                alert("您的浏览器不支持语音识别，请使用 Chrome 浏览器")
              }
            }}
            disabled={disabled || isGenerating}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/5"
            style={{ color: DESIGN_TOKENS.textMuted }}
            title="语音输入"
          >
            <Mic size={16} strokeWidth={1.5} />
          </button>

          {/* 设置 - 打开设置面板 */}
          <button
            onClick={() => {
              // 触发打开设置面板（通过 CustomEvent）
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("startrails-open-settings"))
              }
            }}
            disabled={disabled || isGenerating}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/5"
            style={{ color: DESIGN_TOKENS.textMuted }}
            title="设置"
          >
            <Settings size={16} strokeWidth={1.5} />
          </button>

          {/* 发送/停止按钮 */}
          {isGenerating ? (
            <button
              onClick={onStop}
              className="flex h-9 w-9 items-center justify-center rounded-full transition-colors"
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.2)",
                color: "#ef4444",
              }}
              title="停止生成"
            >
              <Square size={16} strokeWidth={2} />
            </button>
          ) : (
            <button
              onClick={() => onSend(selectedModel)}
              disabled={disabled || (!value.trim() && attachments.length === 0)}
              className="flex h-9 w-9 items-center justify-center rounded-full transition-all"
              style={{
                backgroundColor:
                  value.trim() || attachments.length > 0
                    ? DESIGN_TOKENS.accent
                    : DESIGN_TOKENS.accentSoft,
                color: value.trim() || attachments.length > 0 ? "#fff" : DESIGN_TOKENS.textMuted,
              }}
              title="发送"
            >
              <ArrowUp size={18} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
