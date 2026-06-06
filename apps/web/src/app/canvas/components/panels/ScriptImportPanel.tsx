/**
 * ScriptImportPanel — 剧本/文档导入面板
 * 拖拽或选择 PDF/DOCX/TXT → 自动解析 → 预览文本 → 导入到画布 / 发送到Chat
 */
"use client"

import { useState, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { X, FileText, Upload, Sparkles, Download, Send, Loader2 } from "lucide-react"
import { DESIGN_TOKENS } from "../../styles/designSystem"

interface ScriptImportPanelProps {
  isOpen: boolean
  onClose: () => void
  onImportToCanvas: (text: string, fileName: string) => void
  onSendToChat: (text: string, fileName: string) => void
}

interface FilePreview {
  text: string
  fileName: string
  fileSize: number
  type: string
  pageCount?: number
  wordCount: number
  truncated: boolean
}

export function ScriptImportPanel({ isOpen, onClose, onImportToCanvas, onSendToChat }: ScriptImportPanelProps) {
  const [dragOver, setDragOver] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [preview, setPreview] = useState<FilePreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const parseFile = useCallback(async (file: File) => {
    setParsing(true)
    setError(null)
    setPreview(null)

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || ""
      if (!["pdf", "docx", "txt"].includes(ext)) {
        throw new Error("仅支持 PDF、DOCX、TXT 格式")
      }
      if (file.size > 50 * 1024 * 1024) {
        throw new Error("文件大小超过 50MB 限制")
      }

      const { parseDocument } = await import("../../utils/fileParser")
      const result = await parseDocument(file)

      // 预览截断（超过8000字只显示前8000）
      const maxPreview = 8000
      const truncated = result.text.length > maxPreview
      const previewText = truncated ? result.text.slice(0, maxPreview) + "\n\n...(已截断，全量文本将用于导入)" : result.text

      setPreview({
        text: previewText,
        fileName: result.fileName,
        fileSize: result.fileSize,
        type: result.type,
        pageCount: result.pageCount,
        wordCount: result.wordCount,
        truncated,
      })
    } catch (err: any) {
      setError(err.message || "解析失败")
    } finally {
      setParsing(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragOver(false)

      const files = Array.from(e.dataTransfer.files)
      const file = files.find((f) => /\.(pdf|docx|txt)$/i.test(f.name))
      if (file) parseFile(file)
      else setError("请拖入 PDF、DOCX 或 TXT 文件")
    },
    [parseFile]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) parseFile(file)
    },
    [parseFile]
  )

  const handleImportToCanvas = useCallback(() => {
    if (!preview) return
    // 传递完整文本（不是截断预览）
    const fullText = preview.truncated ? preview.text.replace("\n\n...(已截断，全量文本将用于导入)", "") : preview.text
    onImportToCanvas(fullText, preview.fileName)
    onClose()
  }, [preview, onImportToCanvas, onClose])

  const handleSendToChat = useCallback(() => {
    if (!preview) return
    const fullText = preview.truncated ? preview.text.replace("\n\n...(已截断，全量文本将用于导入)", "") : preview.text
    onSendToChat(fullText, preview.fileName)
    onClose()
  }, [preview, onSendToChat, onClose])

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  const reset = useCallback(() => {
    setPreview(null)
    setError(null)
    setParsing(false)
  }, [])

  if (!isOpen) return null
  if (typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={onClose} />

      <div
        className="relative z-10 w-[600px] max-h-[85vh] overflow-hidden rounded-2xl border flex flex-col"
        style={{ backgroundColor: DESIGN_TOKENS.panelSolid, borderColor: DESIGN_TOKENS.border }}
      >
        {/* 头部 */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b shrink-0"
          style={{ borderColor: DESIGN_TOKENS.border }}
        >
          <div className="flex items-center gap-2">
            <Upload size={16} style={{ color: DESIGN_TOKENS.accent }} />
            <span className="text-sm font-medium" style={{ color: DESIGN_TOKENS.textPrimary }}>
              导入剧本
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70 transition-opacity">
            <X size={16} style={{ color: DESIGN_TOKENS.textMuted }} />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* 如果有解析结果，显示预览 */}
          {preview ? (
            <div className="space-y-3">
              {/* 文件信息 */}
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: "rgba(99, 102, 241, 0.08)", border: `1px solid rgba(99, 102, 241, 0.2)` }}>
                <FileText size={24} style={{ color: DESIGN_TOKENS.accent }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: DESIGN_TOKENS.textPrimary }}>
                    {preview.fileName}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: DESIGN_TOKENS.textMuted }}>
                    {formatFileSize(preview.fileSize)}
                    {preview.type === "pdf" && preview.pageCount ? ` · ${preview.pageCount}页` : ""}
                    {` · ${preview.wordCount}字`}
                  </div>
                </div>
                <button
                  onClick={reset}
                  className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                  style={{ color: DESIGN_TOKENS.textMuted, backgroundColor: "rgba(255,255,255,0.05)" }}
                >
                  重新选择
                </button>
              </div>

              {/* 文本预览 */}
              <div
                className="rounded-xl border p-3 max-h-64 overflow-y-auto"
                style={{ borderColor: DESIGN_TOKENS.border, backgroundColor: "rgba(0,0,0,0.2)" }}
              >
                <pre className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: DESIGN_TOKENS.textSecondary }}>
                  {preview.text}
                </pre>
              </div>
              {preview.truncated && (
                <p className="text-xs" style={{ color: DESIGN_TOKENS.textMuted }}>
                  预览已截断，导入时将使用完整文本
                </p>
              )}

              {/* 操作按钮 */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleImportToCanvas}
                  className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-colors flex-1 justify-center"
                  style={{ backgroundColor: DESIGN_TOKENS.accent, color: "#fff" }}
                >
                  <Download size={14} />
                  导入到画布
                </button>
                <button
                  onClick={handleSendToChat}
                  className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-colors flex-1 justify-center"
                  style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "rgb(52, 211, 153)" }}
                >
                  <Send size={14} />
                  发送到 Chat
                </button>
              </div>
            </div>
          ) : (
            /* 拖拽上传区域 */
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-all min-h-[250px]"
              style={{
                borderColor: dragOver ? DESIGN_TOKENS.accent : DESIGN_TOKENS.border,
                backgroundColor: dragOver ? "rgba(99, 102, 241, 0.06)" : "transparent",
              }}
            >
              {parsing ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={32} className="animate-spin" style={{ color: DESIGN_TOKENS.accent }} />
                  <span className="text-sm" style={{ color: DESIGN_TOKENS.textSecondary }}>
                    正在解析文件...
                  </span>
                </div>
              ) : (
                <>
                  <Upload size={40} strokeWidth={1.2} style={{ color: DESIGN_TOKENS.textMuted }} />
                  <p className="mt-3 text-sm font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>
                    拖拽剧本文件到此处
                  </p>
                  <p className="mt-1 text-xs" style={{ color: DESIGN_TOKENS.textMuted }}>
                    或点击选择文件 · 支持 PDF / DOCX / TXT · 最大 50MB
                  </p>
                </>
              )}
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div
              className="rounded-xl border p-3 text-sm"
              style={{ borderColor: "rgba(239, 68, 68, 0.3)", backgroundColor: "rgba(239, 68, 68, 0.08)", color: "rgb(248, 113, 113)" }}
            >
              {error}
            </div>
          )}
        </div>

        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
    </div>,
    document.body
  )
}
