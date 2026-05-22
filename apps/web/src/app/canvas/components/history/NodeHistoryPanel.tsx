// ============================================================================
// NodeHistoryPanel — 节点运行历史面板 (P1-6.2)
// ============================================================================
// 展示选中节点的所有历史运行记录。
// - 状态 badge（succeeded / failed / cancelled）
// - 时间 + 耗时
// - prompt 摘要
// - 输出统计（图片/视频/文本数量）
// - 错误信息
// - 展开查看 Input / Output / Error 详情
// - 恢复 prompt / 重试 / 清空历史 操作
// ============================================================================

"use client"

import { useState, useCallback } from "react"
import { createPortal } from "react-dom"
import {
  X,
  History,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  RotateCcw,
  Undo2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Image,
  Video,
  FileText,
  AlertCircle,
  Layers,
  GripHorizontal,
} from "lucide-react"
import { DESIGN_TOKENS } from "../../styles/designSystem"
import { useNodeRunHistory } from "../../hooks/useNodeRunHistory"
import type { NodeRunHistoryItem, NodeRunHistoryStatus } from "../../types/node-run-history"
import { getVideoAnalysisFromHistoryRaw } from "../../types/video-analysis"
import type { VideoAnalysisResult } from "../../types/video-analysis"
import VideoAnalysisPreview from "../panels/VideoAnalysisPreview"
import { HISTORY_DRAG_MIME } from "../../types/history-drag"
import type { HistoryDragPayload } from "../../types/history-drag"

// ============================================================================
// Props
// ============================================================================

interface NodeHistoryPanelProps {
  isOpen: boolean
  onClose: () => void
  nodeId: string | null
  nodeTitle?: string
  currentHistoryId?: string
  onRestorePrompt?: (nodeId: string, historyId: string) => void
  onRetry?: (nodeId: string, historyId: string) => void
}

// ============================================================================
// 子组件
// ============================================================================

function StatusBadge({ status }: { status: NodeRunHistoryStatus }) {
  const config: Record<NodeRunHistoryStatus, { icon: React.ReactNode; label: string; color: string; bg: string }> = {
    succeeded: { icon: <CheckCircle2 size={12} />, label: "成功", color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
    failed: { icon: <XCircle size={12} />, label: "失败", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
    cancelled: { icon: <Ban size={12} />, label: "取消", color: "#a1a1aa", bg: "rgba(161,161,170,0.12)" },
  }
  const c = config[status]
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 500,
        color: c.color,
        background: c.bg,
        border: `1px solid ${c.color}33`,
      }}
    >
      {c.icon}
      {c.label}
    </span>
  )
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    const h = String(d.getHours()).padStart(2, "0")
    const m = String(d.getMinutes()).padStart(2, "0")
    const s = String(d.getSeconds()).padStart(2, "0")
    return `${month}-${day} ${h}:${m}:${s}`
  } catch {
    return iso
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const m = Math.floor(ms / 60000)
  const s = ((ms % 60000) / 1000).toFixed(0)
  return `${m}m${s}s`
}

function OutputStats({ item }: { item: NodeRunHistoryItem }) {
  const imgs = item.output?.imageUrls?.length ?? 0
  const vids = item.output?.videoUrls?.length ?? 0
  const hasText = Boolean(item.output?.text)
  if (imgs === 0 && vids === 0 && !hasText) return null
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 4, fontSize: 11, color: DESIGN_TOKENS.textSecondary }}>
      {hasText && (
        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <FileText size={11} /> 文本
        </span>
      )}
      {imgs > 0 && (
        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <Image size={11} /> {imgs}
        </span>
      )}
      {vids > 0 && (
        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <Video size={11} /> {vids}
        </span>
      )}
    </div>
  )
}

function PromptSummary({ prompt, maxLen }: { prompt: string; maxLen: number }) {
  if (!prompt) return <span style={{ color: DESIGN_TOKENS.textMuted, fontStyle: "italic" }}>无 prompt</span>
  if (prompt.length <= maxLen) return <span>{prompt}</span>
  return <span>{prompt.slice(0, maxLen)}…</span>
}

// ============================================================================
// 输出渲染器注册表 — 根据 output 数据类型自动选择展示组件
// ============================================================================
// 未来新增图片分析、字幕分析等节点时，只需往此数组追加 renderer 即可。
// ============================================================================

// ============================================================================
// DraggableHistoryText — 支持从历史面板拖内容到画布 (P2-4)
// ============================================================================

function DraggableHistoryText({
  payload,
  children,
  style,
  className,
}: {
  payload: HistoryDragPayload
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
}) {
  const handleDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData(HISTORY_DRAG_MIME, JSON.stringify(payload))
    event.dataTransfer.effectAllowed = "copy"
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      style={{ cursor: "grab", ...style }}
      className={className}
      title="拖到画布创建节点"
    >
      <span style={{ display: "inline-block", marginRight: 4, opacity: 0.35, verticalAlign: "middle" }}>
        <GripHorizontal size={12} />
      </span>
      {children}
    </div>
  )
}

// ============================================================================
// 渲染器注册表
// ============================================================================

type HistoryOutputRenderer = {
  /** 名称（调试用） */
  name: string
  /** 优先级（数值越大越优先，多个 renderer 同时 match 时用） */
  priority?: number
  /** 匹配规则：返回 true 表示此 renderer 负责渲染该 output */
  match: (item: NodeRunHistoryItem) => boolean
  /** 渲染函数 */
  render: (item: NodeRunHistoryItem) => React.ReactNode
}

const historyOutputRenderers: HistoryOutputRenderer[] = [
  {
    name: "video-analysis",
    priority: 100,
    match: (item) => {
      const raw = item.output?.raw
      return getVideoAnalysisFromHistoryRaw(raw) !== undefined
    },
    render: (item) => {
      const result = getVideoAnalysisFromHistoryRaw(item.output!.raw)
      if (!result) return null

      const historyId = item.id ?? ""

      return (
        <div>
          {/* ── 拖放操作区 (P2-4) ── */}
          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            {/* 拖摘要 → Prompt 节点 */}
            {result.summary && (
              <DraggableHistoryText
                payload={{
                  type: "history-video-analysis-summary",
                  text: result.summary,
                  label: "视频摘要",
                  sourceHistoryId: historyId,
                  sourceNodeId: item.nodeId,
                }}
                style={{
                  fontSize: 11,
                  color: DESIGN_TOKENS.accentHover,
                  background: DESIGN_TOKENS.accentSoft,
                  borderRadius: 4,
                  padding: "2px 8px",
                  border: `1px solid ${DESIGN_TOKENS.accentSoftHover}`,
                }}
              >
                拖拽生成 Prompt
              </DraggableHistoryText>
            )}
            {/* 拖完整结果 → Markdown Prompt 节点 */}
            <DraggableHistoryText
              payload={{
                type: "history-video-analysis-result",
                label: "视频分析报告",
                result,
                sourceHistoryId: historyId,
                sourceNodeId: item.nodeId,
              }}
              style={{
                fontSize: 11,
                color: DESIGN_TOKENS.textSecondary,
                background: `${DESIGN_TOKENS.textSecondary}08`,
                borderRadius: 4,
                padding: "2px 8px",
                border: `1px solid ${DESIGN_TOKENS.border}`,
              }}
            >
              拖拽生成分析节点
            </DraggableHistoryText>
          </div>

          {/* 视频分析预览 */}
          <VideoAnalysisPreview result={result} compact />
          {/* Raw JSON 折叠（调试用） */}
          {item.output!.raw !== undefined && (
            <KV label="原始响应" collapsed>
              <pre style={{ margin: 0, fontSize: 10, color: DESIGN_TOKENS.textMuted, whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto" }}>
                {renderRaw(item.output!.raw)}
              </pre>
            </KV>
          )}
        </div>
      )
    },
  },
]

// ============================================================================
// 输出渲染体 — 按渲染器注册表匹配，降级到通用渲染
// ============================================================================

function HistoryOutputBody({ item }: { item: NodeRunHistoryItem }) {
  const output = item.output
  if (!output) return null

  // 按优先级排序匹配渲染器（priority 高的优先）
  const renderer = [...historyOutputRenderers]
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .find((r) => r.match(item))
  if (renderer) return <>{renderer.render(item)}</>

  // 降级：通用输出渲染（兼容旧历史、非视频节点）
  return <DefaultHistoryOutput item={item} />
}

/**
 * 通用历史输出渲染（兼容旧格式、未知类型）。
 * 旧历史只有 summary 文本时也能正常显示，不崩溃。
 */
function DefaultHistoryOutput({ item }: { item: NodeRunHistoryItem }) {
  const output = item.output!
  return (
    <>
      {output.text && (
        <KV label="文本">
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 12, color: DESIGN_TOKENS.text }}>
            {output.text}
          </pre>
        </KV>
      )}
      {(output.imageUrls?.length ?? 0) > 0 && (
        <KV label="图片">
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {output.imageUrls!.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`output-${i}`}
                style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6, border: `1px solid ${DESIGN_TOKENS.border}` }}
              />
            ))}
          </div>
        </KV>
      )}
      {(output.videoUrls?.length ?? 0) > 0 && (
        <KV label="视频">
          {output.videoUrls!.map((url, i) => (
            <div key={i} style={{ fontSize: 11, color: DESIGN_TOKENS.textSecondary }}>{url}</div>
          ))}
        </KV>
      )}
      {output.raw !== undefined && (
        <KV label="原始响应" collapsed>
          {typeof output.raw === "string" ? (
            <div style={{ fontSize: 12, color: DESIGN_TOKENS.text }}>{output.raw.slice(0, 1000)}</div>
          ) : (
            <pre style={{ margin: 0, fontSize: 10, color: DESIGN_TOKENS.textMuted, whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto" }}>
              {renderRaw(output.raw)}
            </pre>
          )}
        </KV>
      )}
      {/* 纯文本摘要 — 旧历史没有 raw 时的最后兜底 */}
      {!output.text && !output.imageUrls?.length && !output.videoUrls?.length && output.raw === undefined && (
        <div style={{ fontSize: 12, color: DESIGN_TOKENS.textSecondary }}>
          {item.message ?? "无输出"}
        </div>
      )}
    </>
  )
}

// ============================================================================
// 历史条目展开详情
// ============================================================================

function HistoryDetail({ item }: { item: NodeRunHistoryItem }) {
  return (
    <div style={{ padding: "10px 12px", borderTop: `1px solid ${DESIGN_TOKENS.border}`, fontSize: 12 }}>
      {/* Input */}
      <Section title="输入" icon={<Layers size={12} />} defaultOpen>
        {item.input.displayPrompt && (
          <KV label="Prompt">
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 12, color: DESIGN_TOKENS.text }}>
              {item.input.displayPrompt}
            </pre>
          </KV>
        )}
        {item.input.referenceImages.length > 0 && (
          <KV label="参考图">
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {item.input.referenceImages.map((img, i) => (
                <img
                  key={i}
                  src={img.url}
                  alt={img.name ?? `ref-${i}`}
                  style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 4, border: `1px solid ${DESIGN_TOKENS.border}` }}
                />
              ))}
            </div>
          </KV>
        )}
        {item.input.inputTexts.length > 0 && (
          <KV label="上游文本">
            {item.input.inputTexts.map((t, i) => (
              <div key={i} style={{ fontSize: 11, color: DESIGN_TOKENS.textSecondary, marginTop: 2 }}>
                [{t.title ?? t.nodeId.slice(0, 8)}] {t.text.slice(0, 80)}
                {t.text.length > 80 ? "…" : ""}
              </div>
            ))}
          </KV>
        )}
        {item.input.settingsSnapshot && Object.keys(item.input.settingsSnapshot).length > 0 && (
          <KV label="运行设置" collapsed>
            <pre style={{ margin: 0, fontSize: 11, color: DESIGN_TOKENS.textMuted, whiteSpace: "pre-wrap" }}>
              {JSON.stringify(item.input.settingsSnapshot, null, 2)}
            </pre>
          </KV>
        )}
      </Section>

      {/* Output */}
      {item.status === "succeeded" && item.output && (
        <Section title="输出" icon={<FileText size={12} />} defaultOpen>
          <HistoryOutputBody item={item} />
        </Section>
      )}

      {/* Error */}
      {item.status === "failed" && item.error && (
        <Section title="错误" icon={<AlertCircle size={12} />} defaultOpen>
          <KV label="错误信息">
            <div style={{ color: "#ef4444", fontSize: 12 }}>{item.error}</div>
          </KV>
        </Section>
      )}
    </div>
  )
}

function renderRaw(raw: unknown): string {
  if (typeof raw === "string") return raw.slice(0, 1000)
  try {
    const json = JSON.stringify(raw, null, 2)
    return json.length > 2000 ? json.slice(0, 2000) + "\n…" : json
  } catch {
    return String(raw).slice(0, 500)
  }
}

function Section({
  title,
  icon,
  defaultOpen,
  children,
}: {
  title: string
  icon: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          padding: "4px 0",
          border: "none",
          background: "none",
          color: DESIGN_TOKENS.textSecondary,
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {icon}
        <span style={{ flex: 1, textAlign: "left" }}>{title}</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && <div style={{ paddingLeft: 18 }}>{children}</div>}
    </div>
  )
}

function KV({
  label,
  collapsed,
  children,
}: {
  label: string
  collapsed?: boolean
  children: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(!collapsed)
  if (collapsed) {
    return (
      <div style={{ marginTop: 4 }}>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: 0,
            border: "none",
            background: "none",
            color: DESIGN_TOKENS.textMuted,
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          {label} {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </button>
        {expanded && <div style={{ paddingLeft: 0 }}>{children}</div>}
      </div>
    )
  }
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 10, color: DESIGN_TOKENS.textMuted, marginBottom: 2, textTransform: "uppercase" }}>
        {label}
      </div>
      {children}
    </div>
  )
}

// ============================================================================
// 历史列表项
// ============================================================================

function HistoryListItem({
  item,
  isExpanded,
  onToggle,
  onRestorePrompt,
  onRetry,
}: {
  item: NodeRunHistoryItem
  isExpanded: boolean
  onToggle: () => void
  onRestorePrompt?: () => void
  onRetry?: () => void
}) {
  return (
    <div
      style={{
        background: DESIGN_TOKENS.accentSoft,
        borderRadius: 8,
        overflow: "hidden",
        border: `1px solid ${isExpanded ? DESIGN_TOKENS.borderAccent : DESIGN_TOKENS.border}`,
        transition: "border-color 0.15s",
      }}
    >
      {/* 摘要行 */}
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          padding: "8px 12px",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <StatusBadge status={item.status} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: DESIGN_TOKENS.text, marginBottom: 2 }}>
            <PromptSummary prompt={item.input.displayPrompt} maxLen={60} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: DESIGN_TOKENS.textMuted }}>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Clock size={11} /> {formatTime(item.finishedAt)}
            </span>
            <span>{formatDuration(item.durationMs)}</span>
            {item.source && item.source !== "manual" && (
              <span style={{ color: DESIGN_TOKENS.accent }}>{item.source}</span>
            )}
          </div>
          <OutputStats item={item} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {onRestorePrompt && (
            <button
              onClick={(e) => { e.stopPropagation(); onRestorePrompt() }}
              title="恢复 prompt"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 28,
                height: 28,
                borderRadius: 6,
                border: "none",
                background: DESIGN_TOKENS.accentSoft,
                color: DESIGN_TOKENS.textSecondary,
                cursor: "pointer",
              }}
            >
              <Undo2 size={13} />
            </button>
          )}
          {onRetry && (
            <button
              onClick={(e) => { e.stopPropagation(); onRetry() }}
              title="重试"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 28,
                height: 28,
                borderRadius: 6,
                border: "none",
                background: DESIGN_TOKENS.accentSoft,
                color: DESIGN_TOKENS.textSecondary,
                cursor: "pointer",
              }}
            >
              <RotateCcw size={13} />
            </button>
          )}
          {isExpanded ? <ChevronUp size={14} color={DESIGN_TOKENS.textMuted} /> : <ChevronDown size={14} color={DESIGN_TOKENS.textMuted} />}
        </div>
      </div>

      {/* 展开详情 */}
      {isExpanded && <HistoryDetail item={item} />}
    </div>
  )
}

// ============================================================================
// 主面板
// ============================================================================

export function NodeHistoryPanel({
  isOpen,
  onClose,
  nodeId,
  nodeTitle,
  currentHistoryId,
  onRestorePrompt,
  onRetry,
}: NodeHistoryPanelProps) {
  const { histories, clearHistory } = useNodeRunHistory(nodeId, currentHistoryId)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleClear = useCallback(() => {
    if (!window.confirm(`确认清空节点「${nodeTitle ?? nodeId ?? ""}」的所有运行历史？此操作不可撤销。`)) return
    clearHistory()
  }, [clearHistory, nodeTitle, nodeId])

  if (!isOpen) return null
  if (typeof document === "undefined") return null

  // 面板定位：右侧属性面板位置
  const panelWidth = 360

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      {/* Overlay background */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)" }} />

      {/* Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: panelWidth,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0a0b0f",
          borderLeft: `1px solid ${DESIGN_TOKENS.border}`,
          boxShadow: DESIGN_TOKENS.shadowPanel,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: `1px solid ${DESIGN_TOKENS.border}`,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <History size={16} color={DESIGN_TOKENS.textSecondary} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: DESIGN_TOKENS.text }}>运行历史</div>
              <div style={{ fontSize: 11, color: DESIGN_TOKENS.textMuted, marginTop: 1 }}>
                {nodeTitle ?? nodeId ?? "未选择节点"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {histories.length > 0 && (
              <button
                onClick={handleClear}
                title="清空历史"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 30,
                  height: 30,
                  borderRadius: 6,
                  border: "none",
                  background: "transparent",
                  color: DESIGN_TOKENS.textMuted,
                  cursor: "pointer",
                }}
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 30,
                height: 30,
                borderRadius: 6,
                border: "none",
                background: "transparent",
                color: DESIGN_TOKENS.textMuted,
                cursor: "pointer",
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
          {histories.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: DESIGN_TOKENS.textMuted,
                fontSize: 13,
                gap: 8,
              }}
            >
              <History size={32} opacity={0.3} />
              <span>暂无运行历史</span>
              <span style={{ fontSize: 11 }}>运行节点后，历史记录将在此显示</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* 逆向展示（最新在前） */}
              {[...histories].reverse().map((item) => (
                <HistoryListItem
                  key={item.id}
                  item={item}
                  isExpanded={expandedIds.has(item.id)}
                  onToggle={() => toggleExpand(item.id)}
                  onRestorePrompt={onRestorePrompt ? () => onRestorePrompt(item.nodeId, item.id) : undefined}
                  onRetry={onRetry ? () => onRetry(item.nodeId, item.id) : undefined}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "8px 16px",
            borderTop: `1px solid ${DESIGN_TOKENS.border}`,
            fontSize: 11,
            color: DESIGN_TOKENS.textMuted,
            textAlign: "center",
            flexShrink: 0,
          }}
        >
          {histories.length} 条记录
        </div>
      </div>
    </div>,
    document.body,
  )
}
