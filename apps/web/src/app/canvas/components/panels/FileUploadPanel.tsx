/**
 * FileUploadPanel — 文件上传面板
 *
 * 对标 TapNow 的创作输入层。支持拖拽上传 + 点击上传。
 * 格式：DOCX / PDF / TXT / Markdown
 * 上传后自动解析文本 → 在画布上创建文档节点
 *
 * 依赖库：react-dropzone, mammoth, pdfjs-dist（在 fileParser.ts 中使用）
 */
"use client"

import React, { useCallback, useState } from "react"
import { createPortal } from "react-dom"
import { X, Upload, FileText, FileType, Film, Loader2, Check, AlertCircle } from "lucide-react"
import { DESIGN_TOKENS } from "../../styles/designSystem"
import { parseDocument, type ParseResult } from "../../utils/fileParser"

interface FileUploadPanelProps {
  isOpen: boolean
  onClose: () => void
  onDocumentParsed: (result: ParseResult, position: { x: number; y: number }) => void
}

const SUPPORTED_FORMATS = ".docx,.pdf,.txt,.md,.markdown"
const SUPPORTED_MIME = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
]
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export function FileUploadPanel({ isOpen, onClose, onDocumentParsed }: FileUploadPanelProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [parseProgress, setParseProgress] = useState<string>("")

  const handleFile = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      setError("文件过大，限制 50MB")
      return
    }

    setIsParsing(true)
    setError(null)
    setParseResult(null)
    setParseProgress("正在解析文件...")

    try {
      const result = await parseDocument(file)
      setParseResult(result)
      setParseProgress("解析完成")
      onDocumentParsed(result, {
        x: 200 + Math.random() * 300,
        y: 200 + Math.random() * 200,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "解析失败")
      setParseProgress("")
    } finally {
      setIsParsing(false)
    }
  }, [onDocumentParsed])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => setIsDragging(false), [])

  const handleClick = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = SUPPORTED_FORMATS
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) handleFile(file)
    }
    input.click()
  }, [handleFile])

  if (!isOpen) return null

  const formatDisplay: Record<string, string> = {
    pdf: "PDF",
    docx: "DOCX",
    txt: "TXT",
    unknown: "文件",
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
      <div
        className="relative w-[440px] rounded-2xl border shadow-2xl overflow-hidden"
        style={{
          backgroundColor: DESIGN_TOKENS.panel,
          borderColor: DESIGN_TOKENS.border,
          backdropFilter: "blur(20px)",
        }}
      >
        {/* ── 标题栏 ── */}
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: DESIGN_TOKENS.border }}>
          <div className="flex items-center gap-2">
            <Upload size={18} style={{ color: DESIGN_TOKENS.accent }} />
            <span className="text-sm font-semibold" style={{ color: DESIGN_TOKENS.text }}>文件上传</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-all hover:bg-white/10"
            style={{ color: DESIGN_TOKENS.textMuted }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── 拖拽区 ── */}
        <div className="p-4">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={handleClick}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-12 transition-all"
            style={{
              borderColor: isDragging ? DESIGN_TOKENS.accent : DESIGN_TOKENS.border,
              backgroundColor: isDragging ? DESIGN_TOKENS.accentSoft : "rgba(255,255,255,0.02)",
            }}
          >
            {isParsing ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={40} className="animate-spin" style={{ color: DESIGN_TOKENS.accent }} />
                <span className="text-sm" style={{ color: DESIGN_TOKENS.textSecondary }}>{parseProgress}</span>
              </div>
            ) : parseResult ? (
              <div className="flex flex-col items-center gap-2">
                <Check size={40} style={{ color: "#22c55e" }} />
                <span className="text-sm" style={{ color: DESIGN_TOKENS.textSecondary }}>
                  {parseResult.fileName}
                </span>
                <span className="text-xs" style={{ color: DESIGN_TOKENS.textMuted }}>
                  {formatDisplay[parseResult.type]} · {parseResult.wordCount} 词
                  {parseResult.pageCount && ` · ${parseResult.pageCount} 页`}
                </span>
                <button
                  onClick={handleClick}
                  className="mt-2 rounded-lg px-3 py-1.5 text-xs transition-all hover:bg-white/10"
                  style={{ color: DESIGN_TOKENS.accentHover }}
                >
                  再次上传
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Upload size={40} style={{ color: DESIGN_TOKENS.textMuted, opacity: 0.5 }} />
                <span className="text-sm" style={{ color: DESIGN_TOKENS.textSecondary }}>拖拽文件到此处</span>
                <span className="text-xs" style={{ color: DESIGN_TOKENS.textMuted }}>
                  或点击选择文件
                </span>
              </div>
            )}
          </div>

          {/* ── 错误提示 ── */}
          {error && (
            <div
              className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2"
              style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#ef4444" }}
            >
              <AlertCircle size={14} />
              <span className="text-xs">{error}</span>
            </div>
          )}

          {/* ── 支持的格式 ── */}
          <div className="mt-4 rounded-xl border p-3" style={{ borderColor: DESIGN_TOKENS.border }}>
            <span className="text-[10px] font-medium" style={{ color: DESIGN_TOKENS.textMuted }}>
              支持的格式
            </span>
            <div className="mt-2 flex gap-2">
              {[
                { label: "DOCX", ext: ".docx", desc: "Word 文档" },
                { label: "PDF", ext: ".pdf", desc: "PDF 文档" },
                { label: "TXT", ext: ".txt", desc: "纯文本" },
                { label: "MD", ext: ".md", desc: "Markdown" },
              ].map((fmt) => (
                <div
                  key={fmt.ext}
                  className="flex flex-1 flex-col items-center rounded-lg border p-2 text-center"
                  style={{ borderColor: DESIGN_TOKENS.border }}
                >
                  <FileType size={16} style={{ color: DESIGN_TOKENS.textMuted }} />
                  <span className="mt-1 text-[10px] font-medium" style={{ color: DESIGN_TOKENS.text }}>
                    {fmt.label}
                  </span>
                  <span className="text-[9px]" style={{ color: DESIGN_TOKENS.textMuted }}>{fmt.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── 说明 ── */}
          <p className="mt-3 text-center text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>
            上传后自动解析文本并在画布上创建文档节点 · 最大 50MB
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
