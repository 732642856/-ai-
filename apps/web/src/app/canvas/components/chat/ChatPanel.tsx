/**
 * ChatPanel - 右侧 Chat 面板，TapNow-inspired 风格
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import { createPortal } from "react-dom"
import {
  Library,
  PanelRightClose,
  Plus,
  MessageSquarePlus,
  Copy,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
} from "lucide-react"
import { DESIGN_TOKENS, ICON_CONFIG } from "../../styles/designSystem"
import { useChatAttachments, type ChatAttachment } from "../../hooks/useChatAttachments"
import { ChatInput } from "./ChatInput"
import type { AiModel } from "./ChatInput"
import { useChatSSE } from "../../hooks/useChatSSE"
import { generateId } from "../../utils/generateId"
import type { Node } from "@xyflow/react"

const isDebugEnabled = (key: string) =>
  typeof window !== "undefined" && window.localStorage.getItem(key) === "1"

const DEBUG_CHAT = isDebugEnabled("DEBUG_CHAT_ATTACHMENTS")
const DEBUG_AI = isDebugEnabled("DEBUG_AI_PAYLOAD")

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  attachments?: ChatAttachment[]
  thinkingTime?: number // 思考时间（秒）
}

interface ChatPanelProps {
  isOpen: boolean
  onClose: () => void
  selectedNodeId?: string | null
  selectedNode?: Node | null
  canvasNodes?: Node[] // 画布上所有节点，用于AI感知
  onAddImageToCanvas: (attachment: ChatAttachment) => void
  showHistoryFromOutside?: boolean
  onHistoryPanelClosed?: () => void
}

export function ChatPanel({
  isOpen,
  onClose,
  selectedNodeId,
  selectedNode,
  canvasNodes = [],
  onAddImageToCanvas,
  showHistoryFromOutside,
  onHistoryPanelClosed,
}: ChatPanelProps) {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationTitle, setConversationTitle] = useState("Greeting")
  const [selectedModel, setSelectedModel] = useState<string>("gpt-4o")
  const [showHistory, setShowHistory] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const thinkingStartRef = useRef<number | null>(null)

  // 生成画布节点摘要（用于 AI Greeting）
  const nodeSummary = useMemo(() => {
    if (!canvasNodes || canvasNodes.length === 0) return null
    const imageNodes = canvasNodes.filter((n) => n.type === "image")
    const textNodes = canvasNodes.filter((n) => n.type === "text")
    const promptNodes = canvasNodes.filter((n) => n.type === "prompt")
    const parts: string[] = []
    imageNodes.forEach((n) => {
      const title = n.data?.title || n.data?.fileName || "图片"
      parts.push(`[图片] ${title}`)
    })
    textNodes.forEach((n) => {
      const data = n.data as Record<string, any> | undefined
      const content = data?.text || ""
      const preview = content.length > 30 ? content.slice(0, 30) + "..." : content
      parts.push(`[文本] ${preview || "文本内容"}`)
    })
    promptNodes.forEach((n) => {
      const data = n.data as Record<string, any> | undefined
      parts.push(`[提示词] ${data?.prompt || ""}`)
    })
    return parts
  }, [canvasNodes])

  // 同步外部传入的 showHistory 状态
  useEffect(() => {
    if (showHistoryFromOutside !== undefined) {
      setShowHistory(showHistoryFromOutside)
    }
  }, [showHistoryFromOutside])

  // 会话历史（模拟）
  const [conversations, setConversations] = useState([
    { id: "1", title: "Greeting", timestamp: Date.now() - 1000 * 60 * 5 },
    { id: "2", title: "角色设计讨论", timestamp: Date.now() - 1000 * 60 * 60 * 2 },
    { id: "3", title: "分镜规划", timestamp: Date.now() - 1000 * 60 * 60 * 24 },
  ])

  // Chat 附件 hook
  const attachmentsState = useChatAttachments()

  // SSE Chat hook
  const { sendMessage, isStreaming, abort } = useChatSSE({
    onMessage: (content) => {
      setMessages((prev) => {
        const lastIdx = prev.length - 1
        if (lastIdx >= 0 && prev[lastIdx].role === "assistant") {
          const updated = [...prev]
          updated[lastIdx] = {
            ...updated[lastIdx],
            content: updated[lastIdx].content + content,
          }
          return updated
        }
        return prev
      })
    },
    onComplete: () => {
      if (thinkingStartRef.current) {
        const elapsed = Math.round((Date.now() - thinkingStartRef.current) / 1000)
        setMessages((prev) => {
          const lastIdx = prev.length - 1
          if (lastIdx >= 0 && prev[lastIdx].role === "assistant") {
            const updated = [...prev]
            updated[lastIdx] = {
              ...updated[lastIdx],
              thinkingTime: elapsed,
            }
            return updated
          }
          return prev
        })
        thinkingStartRef.current = null
      }
      if (DEBUG_AI) {
        console.log("[DEBUG_AI] Response complete")
      }
    },
    onError: (error) => {
      console.error("[Chat SSE Error]", error)
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "assistant",
          content: `抱歉，发生了错误: ${error.message}`,
        },
      ])
    },
  })

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isStreaming, scrollToBottom])

  // 发送消息
  const handleSend = useCallback(async (model: string, mode?: string) => {
    if (!input.trim() && attachmentsState.attachments.length === 0) return

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: input.trim(),
      attachments: [...attachmentsState.attachments],
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    attachmentsState.clearAttachments()

    // 添加空的助手消息
    setMessages((prev) => [
      ...prev,
      {
        id: generateId(),
        role: "assistant",
        content: "",
      },
    ])

    thinkingStartRef.current = Date.now()

    try {
        await sendMessage(userMessage.content, {
          mode,
          selectedNodeId,
          selectedNode: selectedNode
            ? {
                id: selectedNode.id,
                type: selectedNode.type,
                title: selectedNode.data?.title,
              }
            : undefined,
          attachments: userMessage.attachments?.map((a) => ({
            id: a.id,
            name: a.name,
            mimeType: a.mimeType,
          })),
          model,
        })
    } catch (error) {
      console.error("[Chat] Send error:", error)
    }
  }, [
    input,
    attachmentsState,
    selectedNodeId,
    selectedNode,
    sendMessage,
  ])

  // 停止生成
  const handleStop = useCallback(() => {
    abort()
  }, [abort])

  // 复制消息
  const handleCopyMessage = useCallback((content: string) => {
    navigator.clipboard.writeText(content)
  }, [])

  // 将附件添加到画布
  const handleAddToCanvas = useCallback(
    (attachment: ChatAttachment) => {
      onAddImageToCanvas(attachment)
      attachmentsState.removeAttachment(attachment.id)
    },
    [onAddImageToCanvas, attachmentsState]
  )

  if (!isOpen) return null
  if (typeof document === "undefined") return null

  return createPortal(
    <div
      className="fixed bottom-0 right-0 top-0 flex flex-col border-l"
      style={{
        width: "400px",
        backgroundColor: DESIGN_TOKENS.panelSolid,
        borderColor: DESIGN_TOKENS.border,
        zIndex: DESIGN_TOKENS.zIndex.panel,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-5 py-3"
        style={{ borderColor: DESIGN_TOKENS.border, height: "52px" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: DESIGN_TOKENS.text }}>
            {conversationTitle}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              // 保存当前会话
              if (messages.length > 0) {
                setConversations((prev) => [
                  { id: generateId(), title: conversationTitle, timestamp: Date.now() },
                  ...prev,
                ])
              }
              // 开始新会话
              setMessages([])
              setConversationTitle("新会话")
              setInput("")
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/5"
            style={{ color: ICON_CONFIG.color }}
            title="新会话"
          >
            <Plus size={ICON_CONFIG.size} strokeWidth={ICON_CONFIG.strokeWidth} />
          </button>
          <button
            onClick={() => {
              const next = !showHistory
              setShowHistory(next)
              if (!next) onHistoryPanelClosed?.()
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/5"
            style={{
              color: showHistory ? DESIGN_TOKENS.accent : ICON_CONFIG.color,
              backgroundColor: showHistory ? "rgba(100,116,139,0.1)" : "transparent",
            }}
            title="历史记录"
          >
            <MessageSquarePlus size={ICON_CONFIG.size} strokeWidth={ICON_CONFIG.strokeWidth} />
          </button>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/5"
            style={{ color: ICON_CONFIG.color }}
            title="关闭"
          >
            <PanelRightClose size={ICON_CONFIG.size} strokeWidth={ICON_CONFIG.strokeWidth} />
          </button>
        </div>
      </div>

      {/* 历史记录面板 */}
      {showHistory && (
        <div
          className="border-b"
          style={{ borderColor: DESIGN_TOKENS.border, maxHeight: "200px", overflowY: "auto" }}
        >
          <div className="px-5 py-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider" style={{ color: DESIGN_TOKENS.textMuted }}>
              历史会话
            </p>
            <div className="flex flex-col gap-1">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => {
                    setConversationTitle(conv.title)
                    setShowHistory(false)
                    onHistoryPanelClosed?.()
                  }}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-white/5"
                  style={{ color: DESIGN_TOKENS.textSecondary }}
                >
                  <span className="truncate">{conv.title}</span>
                  <span className="text-[10px] flex-shrink-0" style={{ color: DESIGN_TOKENS.textMuted }}>
                    {new Date(conv.timestamp).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
                  </span>
                </button>
              ))}
              {conversations.length === 0 && (
                <p className="px-3 py-2 text-xs" style={{ color: DESIGN_TOKENS.textMuted }}>
                  暂无历史会话
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Selected Node Context */}
      {selectedNode && (
        <div
          className="mx-5 mt-4 flex items-center gap-3 rounded-xl px-4 py-3"
          style={{
            backgroundColor: DESIGN_TOKENS.accentSoft,
            border: `1px solid ${DESIGN_TOKENS.borderAccent}`,
          }}
        >
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: DESIGN_TOKENS.accent }}
          >
            <div className="h-2 w-2 rounded-full bg-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: DESIGN_TOKENS.text }}>
              已选中节点
            </p>
            <p className="text-xs" style={{ color: DESIGN_TOKENS.textMuted }}>
              {String(selectedNode.data?.title || selectedNode.type || "未命名节点")}
            </p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col justify-end pb-4">
            {/* TapNow 风格欢迎语 - AI 感知画布节点 */}
            <div className="flex flex-col gap-3">
              <h3 className="text-xl font-medium" style={{ color: DESIGN_TOKENS.text }}>
                Greeting
              </h3>

              {/* 节点读取状态 */}
              {nodeSummary && nodeSummary.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 text-xs" style={{ color: DESIGN_TOKENS.textMuted }}>
                    <span>已读取节点</span>
                    <ChevronDown size={12} />
                  </div>
                  <div className="flex flex-col gap-1.5 rounded-lg border p-3" style={{ borderColor: DESIGN_TOKENS.border }}>
                    <p className="text-sm" style={{ color: DESIGN_TOKENS.textSecondary }}>
                      看到了！画布上有{canvasNodes?.length}个节点：
                    </p>
                    {nodeSummary.map((summary, idx) => (
                      <div key={idx} className="text-sm" style={{ color: DESIGN_TOKENS.text }}>
                        {summary}
                      </div>
                    ))}
                    <p className="mt-1 text-sm" style={{ color: DESIGN_TOKENS.textSecondary }}>
                      你想用它们做什么？比如：
                    </p>
                    <ul className="flex flex-col gap-1 text-sm" style={{ color: DESIGN_TOKENS.textMuted }}>
                      <li>为其中某个节点生成更多内容？</li>
                      <li>制作角色参考视频？</li>
                      <li>还是有其他创作方向？</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* 空画布时的默认欢迎 */}
              {(!nodeSummary || nodeSummary.length === 0) && (
                <>
                  <p className="text-sm" style={{ color: DESIGN_TOKENS.textSecondary }}>
                    你好！我是星轨Ai，你的创作助手。
                  </p>
                  <p className="text-sm" style={{ color: DESIGN_TOKENS.textSecondary }}>
                    有什么我可以帮你的吗？比如：
                  </p>
                  <ul className="flex flex-col gap-1.5 text-sm" style={{ color: DESIGN_TOKENS.textSecondary }}>
                    <li>构思故事或剧本</li>
                    <li>设计角色</li>
                    <li>生成图片或视频</li>
                    <li>规划分镜</li>
                    <li>其他创意项目</li>
                  </ul>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className="flex max-w-[90%] flex-col gap-1.5">
                  {/* 思考时间指示器 */}
                  {msg.role === "assistant" && msg.thinkingTime !== undefined && msg.thinkingTime > 0 && (
                    <div className="flex items-center gap-1.5 px-1">
                      <div
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: DESIGN_TOKENS.accent }}
                      />
                      <span className="text-[11px]" style={{ color: DESIGN_TOKENS.textMuted }}>
                        思考了 {msg.thinkingTime} 秒
                      </span>
                      <ChevronDown size={12} strokeWidth={1.5} style={{ color: DESIGN_TOKENS.textMuted }} />
                    </div>
                  )}

                  {/* 消息气泡 */}
                  <div
                    className="rounded-2xl px-4 py-3"
                    style={{
                      backgroundColor:
                        msg.role === "user"
                          ? DESIGN_TOKENS.accent
                          : DESIGN_TOKENS.card,
                      color: msg.role === "user" ? "#fff" : DESIGN_TOKENS.text,
                    }}
                  >
                    {msg.content && (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                    )}
                    {msg.content === "" && isStreaming && (
                      <div className="flex items-center gap-2 py-1">
                        <div
                          className="h-2 w-2 animate-pulse rounded-full"
                          style={{ backgroundColor: DESIGN_TOKENS.accent }}
                        />
                        <span className="text-xs" style={{ color: DESIGN_TOKENS.textMuted }}>
                          思考中...
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 消息操作按钮 */}
                  {msg.role === "assistant" && msg.content && (
                    <div className="flex items-center gap-1 px-1">
                      <button
                        onClick={() => handleCopyMessage(msg.content)}
                        className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-white/5"
                        style={{ color: DESIGN_TOKENS.textMuted }}
                        title="复制"
                      >
                        <Copy size={12} strokeWidth={1.5} />
                      </button>
                      <button
                        className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-white/5"
                        style={{ color: DESIGN_TOKENS.textMuted }}
                        title="赞"
                      >
                        <ThumbsUp size={12} strokeWidth={1.5} />
                      </button>
                      <button
                        className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-white/5"
                        style={{ color: DESIGN_TOKENS.textMuted }}
                        title="踩"
                      >
                        <ThumbsDown size={12} strokeWidth={1.5} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-5" style={{ borderColor: DESIGN_TOKENS.border }}>
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          onStop={handleStop}
          isGenerating={isStreaming}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          attachments={attachmentsState.attachments}
          onAttachmentsChange={attachmentsState}
          onAddAttachmentToCanvas={handleAddToCanvas}
          placeholder={selectedNodeId ? "根据选中节点提问..." : "描述想法，或框选节点添加上下文..."}
          canvasNodes={canvasNodes}
        />
      </div>
    </div>,
    document.body
  )
}
