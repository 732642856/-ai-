/**
 * ExportPreflightPanel — 导出预检面𤋈
 *
 * 在对标小云雀 2.0 / TapNow 的导出流程中补全以下缺失：
 * 1. 导出前素材预检查（缺失视频/音频/字幕提示）
 * 2. 导出进度（含耗时预估）
 * 3. 错误说明
 * 4. 导出结果路径 / 下载入口
 * 5. 接入 TimelinePanel 中的 clips 顺序
 *
 * 参考 ComfyUI (GPL v3) Queue UI 的进度显示 + 任务管理设计
 */
"use client"

import React, { useCallback, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  X,
  Film,
  Music,
  Subtitles,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Download,
  FileArchive,
  Play,
  List,
} from "lucide-react"
import { DESIGN_TOKENS } from "../../styles/designSystem"

// ── 类型 ──────────────────────────────────────────────

export interface ExportAssetCheck {
  type: "video" | "audio" | "subtitle"
  label: string
  nodeId: string
  title: string
  hasContent: boolean
  missingReason?: string
}

export interface ExportPreflightPanelProps {
  isOpen: boolean
  onClose: () => void
  /** 画布中所有节点，用于预检 */
  nodes?: Array<{ id: string; type?: string; data?: Record<string, unknown> }>
  /** 从 TimelinePanel 提取的 clips 顺序 */
  timelineOrder?: string[]
  /** 实际的导出函数引用 */
  onPerformExport?: (type: "json" | "zip") => Promise<ExportResult>
}

export interface ExportResult {
  success: boolean
  filePath?: string
  downloadUrl?: string
  message?: string
  files?: Array<{ path: string; size: number }>
}

// ── 预检逻辑 ──────────────────────────────────────────

function runPreflightCheck(
  nodes: Array<{ id: string; type?: string; data?: Record<string, unknown> }>,
  timelineOrder?: string[],
): ExportAssetCheck[] {
  const checks: ExportAssetCheck[] = []
  const processed = new Set<string>()

  // 按 timeline 顺序优先
  const orderedNodes = timelineOrder
    ?.map((id) => nodes.find((n) => n.id === id))
    .filter(Boolean) as typeof nodes | undefined

  const scanNodes = (orderedNodes || nodes) as Array<{ id: string; type?: string; data?: Record<string, unknown> }>

  for (const node of scanNodes) {
    const data = node.data || {}
    const nodeKind = (data.nodeKind as string) || node.type || ""

    // 视频节点
    if (
      nodeKind.includes("video") &&
      !processed.has(`video:${node.id}`)
    ) {
      processed.add(`video:${node.id}`)
      const hasVideo = !!(data.resultUrl || data.assetUrl || data.imageUrl)
      checks.push({
        type: "video",
        label: "视频",
        nodeId: node.id,
        title: (data.title as string) || node.id.slice(0, 8),
        hasContent: hasVideo,
        missingReason: hasVideo ? undefined : "视频文件缺失，请先生成视频",
      })
    }

    // 音频 / TTS 节点
    if (
      (nodeKind.includes("audio") || nodeKind.includes("tts") || nodeKind === "bgm") &&
      !processed.has(`audio:${node.id}`)
    ) {
      processed.add(`audio:${node.id}`)
      const hasAudio = !!(data.resultUrl || data.assetUrl || data.audioUrl)
      checks.push({
        type: "audio",
        label: nodeKind === "bgm" ? "背景音乐" : "配音",
        nodeId: node.id,
        title: (data.title as string) || node.id.slice(0, 8),
        hasContent: hasAudio,
        missingReason: hasAudio ? undefined : "音频文件缺失",
      })
    }

    // 字幕节点
    if (
      (nodeKind.includes("subtitle") || data.srtContent) &&
      !processed.has(`subtitle:${node.id}`)
    ) {
      processed.add(`subtitle:${node.id}`)
      const hasSubtitle = !!(data.srtContent || data.content)
      checks.push({
        type: "subtitle",
        label: "字幕",
        nodeId: node.id,
        title: (data.title as string) || node.id.slice(0, 8),
        hasContent: hasSubtitle,
        missingReason: hasSubtitle ? undefined : "字幕内容为空",
      })
    }
  }

  return checks
}

// ── 组件 ──────────────────────────────────────────────

export function ExportPreflightPanel({
  isOpen,
  onClose,
  nodes = [],
  timelineOrder,
  onPerformExport,
}: ExportPreflightPanelProps) {
  const [exportType, setExportType] = useState<"json" | "zip">("json")
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportResult, setExportResult] = useState<ExportResult | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const checks = useCallback(() => runPreflightCheck(nodes, timelineOrder), [nodes, timelineOrder])

  const assetChecks = checks()
  const totalAssets = assetChecks.length
  const missingAssets = assetChecks.filter((c) => !c.hasContent).length
  const readyAssets = totalAssets - missingAssets

  const handleExport = useCallback(async () => {
    if (!onPerformExport) return
    setIsExporting(true)
    setExportProgress(0)
    setExportResult(null)
    setExportError(null)

    // 模拟进度条
    progressTimerRef.current = setInterval(() => {
      setExportProgress((prev) => Math.min(prev + 8, 90))
    }, 500)

    try {
      const result = await onPerformExport(exportType)
      clearInterval(progressTimerRef.current!)
      setExportProgress(100)
      setExportResult(result)
    } catch (err) {
      clearInterval(progressTimerRef.current!)
      setExportError(err instanceof Error ? err.message : "导出失败")
    } finally {
      setIsExporting(false)
    }
  }, [onPerformExport, exportType])

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
    >
      <div
        className="relative w-[480px] max-h-[80vh] overflow-hidden rounded-2xl border shadow-2xl flex flex-col"
        style={{
          backgroundColor: DESIGN_TOKENS.panel,
          borderColor: DESIGN_TOKENS.border,
          backdropFilter: "blur(20px)",
        }}
      >
        {/* ── 标题栏 ── */}
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: DESIGN_TOKENS.border }}
        >
          <div className="flex items-center gap-2">
            <Film size={18} style={{ color: DESIGN_TOKENS.accent }} />
            <span className="text-sm font-semibold" style={{ color: DESIGN_TOKENS.text }}>
              导出预检
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-all hover:bg-white/10"
            style={{ color: DESIGN_TOKENS.textMuted }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* ── 概览 ── */}
          <div className="mb-4 flex gap-3">
            <div
              className="flex-1 rounded-xl border p-3 text-center"
              style={{ borderColor: DESIGN_TOKENS.border }}
            >
              <span className="text-2xl font-bold" style={{ color: DESIGN_TOKENS.accentHover }}>
                {totalAssets}
              </span>
              <p className="text-[10px] mt-1" style={{ color: DESIGN_TOKENS.textMuted }}>
                总素材
              </p>
            </div>
            <div
              className="flex-1 rounded-xl border p-3 text-center"
              style={{ borderColor: readyAssets === totalAssets ? "rgba(34,197,94,0.3)" : DESIGN_TOKENS.border }}
            >
              <span
                className="text-2xl font-bold"
                style={{
                  color: readyAssets === totalAssets ? "#22c55e" : DESIGN_TOKENS.textMuted,
                }}
              >
                {readyAssets}
              </span>
              <p className="text-[10px] mt-1" style={{ color: DESIGN_TOKENS.textMuted }}>
                就绪
              </p>
            </div>
            <div
              className="flex-1 rounded-xl border p-3 text-center"
              style={{ borderColor: missingAssets > 0 ? "rgba(239,68,68,0.3)" : DESIGN_TOKENS.border }}
            >
              <span
                className="text-2xl font-bold"
                style={{ color: missingAssets > 0 ? "#ef4444" : DESIGN_TOKENS.textMuted }}
              >
                {missingAssets}
              </span>
              <p className="text-[10px] mt-1" style={{ color: DESIGN_TOKENS.textMuted }}>
                缺失
              </p>
            </div>
          </div>

          {/* ── 素材清单 ── */}
          <div className="mb-4">
            <div className="mb-2 flex items-center gap-2">
              <List size={14} style={{ color: DESIGN_TOKENS.textMuted }} />
              <span className="text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>
                素材清单
              </span>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {assetChecks.map((check) => (
                <div
                  key={`${check.type}:${check.nodeId}`}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2"
                  style={{
                    borderColor: check.hasContent
                      ? "rgba(34,197,94,0.2)"
                      : "rgba(239,68,68,0.2)",
                    backgroundColor: check.hasContent
                      ? "rgba(34,197,94,0.05)"
                      : "rgba(239,68,68,0.05)",
                  }}
                >
                  {check.type === "video" && <Film size={14} style={{ color: check.hasContent ? "#22c55e" : "#ef4444" }} />}
                  {check.type === "audio" && <Music size={14} style={{ color: check.hasContent ? "#22c55e" : "#ef4444" }} />}
                  {check.type === "subtitle" && <Subtitles size={14} style={{ color: check.hasContent ? "#22c55e" : "#ef4444" }} />}
                  <div className="flex-1 min-w-0">
                    <span className="text-xs truncate block" style={{ color: DESIGN_TOKENS.text }}>
                      {check.title}
                    </span>
                    <span className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>
                      {check.label}
                    </span>
                  </div>
                  {check.hasContent ? (
                    <CheckCircle2 size={14} style={{ color: "#22c55e", flexShrink: 0 }} />
                  ) : (
                    <span className="text-[10px] flex items-center gap-1" style={{ color: "#ef4444", flexShrink: 0 }}>
                      <AlertTriangle size={12} />
                      缺失
                    </span>
                  )}
                  {check.missingReason && (
                    <span
                      className="text-[10px] hidden group-hover:block"
                      style={{ color: DESIGN_TOKENS.textMuted }}
                    >
                      {check.missingReason}
                    </span>
                  )}
                </div>
              ))}
              {assetChecks.length === 0 && (
                <p className="text-xs text-center py-8" style={{ color: DESIGN_TOKENS.textMuted }}>
                  无可导出的素材节点
                </p>
              )}
            </div>
          </div>

          {/* ── 导出类型选择 ── */}
          <div className="mb-4">
            <div className="flex gap-2">
              <button
                onClick={() => setExportType("json")}
                className="flex-1 rounded-lg border px-3 py-2 text-xs transition-all"
                style={{
                  borderColor: exportType === "json" ? DESIGN_TOKENS.accent : DESIGN_TOKENS.border,
                  backgroundColor: exportType === "json" ? DESIGN_TOKENS.accentSoft : "transparent",
                  color: exportType === "json" ? DESIGN_TOKENS.accentHover : DESIGN_TOKENS.textMuted,
                }}
              >
                <FileArchive size={14} className="mx-auto mb-1" />
                JSON 草稿
              </button>
              <button
                onClick={() => setExportType("zip")}
                className="flex-1 rounded-lg border px-3 py-2 text-xs transition-all"
                style={{
                  borderColor: exportType === "zip" ? DESIGN_TOKENS.accent : DESIGN_TOKENS.border,
                  backgroundColor: exportType === "zip" ? DESIGN_TOKENS.accentSoft : "transparent",
                  color: exportType === "zip" ? DESIGN_TOKENS.accentHover : DESIGN_TOKENS.textMuted,
                }}
              >
                <FileArchive size={14} className="mx-auto mb-1" />
                兼容包 ZIP
              </button>
            </div>
          </div>

          {/* ── 进度条 ── */}
          {isExporting && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <Loader2 size={14} className="animate-spin" style={{ color: DESIGN_TOKENS.accent }} />
                <span className="text-xs" style={{ color: DESIGN_TOKENS.textSecondary }}>
                  导出中 {exportProgress}%
                </span>
              </div>
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${exportProgress}%`,
                    backgroundColor: DESIGN_TOKENS.accent,
                  }}
                />
              </div>
            </div>
          )}

          {/* ── 导出结果 ── */}
          {exportResult?.success && (
            <div
              className="mb-4 rounded-xl border p-4"
              style={{
                backgroundColor: "rgba(34,197,94,0.08)",
                borderColor: "rgba(34,197,94,0.2)",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={16} style={{ color: "#22c55e" }} />
                <span className="text-xs font-medium" style={{ color: "#22c55e" }}>
                  导出成功
                </span>
              </div>
              {exportResult.files && (
                <div className="space-y-1">
                  {exportResult.files.map((f) => (
                    <div
                      key={f.path}
                      className="flex items-center justify-between rounded-lg px-3 py-1.5 text-[11px]"
                      style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
                    >
                      <span style={{ color: DESIGN_TOKENS.textSecondary }}>{f.path.split("/").pop()}</span>
                      <span style={{ color: DESIGN_TOKENS.textMuted }}>
                        {(f.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {exportResult.message && (
                <p className="text-[11px] mt-2" style={{ color: DESIGN_TOKENS.textSecondary }}>
                  {exportResult.message}
                </p>
              )}
            </div>
          )}

          {/* ── 错误提示 ── */}
          {exportError && (
            <div
              className="mb-4 rounded-xl border p-3"
              style={{
                backgroundColor: "rgba(239,68,68,0.08)",
                borderColor: "rgba(239,68,68,0.2)",
              }}
            >
              <div className="flex items-center gap-2">
                <AlertCircle size={14} style={{ color: "#ef4444" }} />
                <span className="text-xs" style={{ color: "#ef4444" }}>
                  {exportError}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── 操作按钮 ── */}
        <div
          className="border-t px-4 py-3"
          style={{ borderColor: DESIGN_TOKENS.border }}
        >
          <button
            onClick={handleExport}
            disabled={isExporting || totalAssets === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-medium transition-all"
            style={{
              backgroundColor:
                missingAssets > 0
                  ? DESIGN_TOKENS.accentSoft
                  : DESIGN_TOKENS.accent,
              color: isExporting || totalAssets === 0
                ? DESIGN_TOKENS.textMuted
                : "#fff",
            }}
          >
            {isExporting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                导出中...
              </>
            ) : (
              <>
                <Play size={14} />
                {missingAssets > 0
                  ? `仍导出 (${missingAssets} 个素材缺失)`
                  : `导出 ${exportType === "json" ? "JSON 草稿" : "ZIP 兼容包"}`}
              </>
            )}
          </button>
          {missingAssets > 0 && (
            <p className="mt-1.5 text-[10px] text-center" style={{ color: DESIGN_TOKENS.textMuted }}>
              {missingAssets} 个素材缺失，导出结果可能不完整
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
