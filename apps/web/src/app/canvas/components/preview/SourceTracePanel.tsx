// ============================================================================
// SourceTracePanel - Node run record detail panel (Phase 1-d)
// ============================================================================
// Shows what actually happened when a node was executed:
// model info, timing, final prompt, upstream inputs, output, errors.
//
// Complements PromptPreviewPanel (Phase 1-c):
//   PromptPreviewPanel = "what will happen" (before execution)
//   SourceTracePanel    = "what happened"     (after execution)
//
// Uses createPortal for overlay, matching PromptPreviewPanel pattern.
// Data source: useRunHistoryStore + useNodeRunHistory hook.
// ============================================================================

"use client"

import { useMemo, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import {
  X,
  Cpu,
  Clock,
  Sparkles,
  Layers,
  FileText,
  Image,
  Video,
  AlertTriangle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  FileX,
  ExternalLink,
} from "lucide-react"
import { DESIGN_TOKENS } from "../../styles/designSystem"
import { useRunHistoryStore } from "../../stores/useRunHistoryStore"
import { useNodeRunHistory } from "../../hooks/useNodeRunHistory"
import type { NodeRunHistoryItem, NodeRunHistoryStatus } from "../../types/node-run-history"

// ============================================================================
// Props
// ============================================================================

interface SourceTracePanelProps {
  isOpen: boolean
  onClose: () => void
  /** History record ID to display */
  historyId: string
  /** Node ID (used to fetch all history for prev/next navigation) */
  nodeId: string
  /** Optional node title for header display */
  nodeTitle?: string
  /** Called when user navigates to a different record */
  onNavigate?: (newHistoryId: string) => void
}

// ============================================================================
// Sub-components (inline, matching project convention)
// ============================================================================

/** Collapsible section with title and chevron */
function Section({
  title,
  icon,
  defaultOpen = true,
  children,
}: {
  title: string
  icon: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: `1px solid ${DESIGN_TOKENS.border}` }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "8px 16px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: DESIGN_TOKENS.textSecondary,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {icon}
          {title}
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && <div style={{ padding: "0 16px 12px" }}>{children}</div>}
    </div>
  )
}

/** Key-value row */
function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12,
        padding: "3px 0",
      }}
    >
      <span style={{ fontSize: 11, color: DESIGN_TOKENS.textMuted, flexShrink: 0, minWidth: 80 }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 12,
          color: DESIGN_TOKENS.text,
          fontFamily: mono ? "ui-monospace, SFMono-Regular, monospace" : "inherit",
          textAlign: "right",
          wordBreak: "break-all",
        }}
      >
        {value}
      </span>
    </div>
  )
}

/** Copy-to-clipboard button */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={handleCopy}
      title="Copy"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 8px",
        borderRadius: 4,
        background: copied ? "rgba(34,197,94,0.15)" : DESIGN_TOKENS.card,
        border: `1px solid ${copied ? "#22c55e" : DESIGN_TOKENS.border}`,
        color: copied ? "#22c55e" : DESIGN_TOKENS.textSecondary,
        fontSize: 11,
        cursor: "pointer",
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy"}
    </button>
  )
}

/** Status badge (succeeded/failed/cancelled) */
function StatusBadge({ status }: { status: NodeRunHistoryStatus }) {
  const config: Record<
    NodeRunHistoryStatus,
    { icon: React.ReactNode; label: string; color: string; bg: string }
  > = {
    succeeded: {
      icon: <Check size={12} />,
      label: "成功",
      color: "#22c55e",
      bg: "rgba(34,197,94,0.12)",
    },
    failed: {
      icon: <X size={12} />,
      label: "失败",
      color: "#ef4444",
      bg: "rgba(239,68,68,0.12)",
    },
    cancelled: {
      icon: <AlertTriangle size={12} />,
      label: "取消",
      color: "#a1a1aa",
      bg: "rgba(161,161,170,0.12)",
    },
  }
  const c = config[status] ?? config.cancelled
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
      }}
    >
      {c.icon}
      {c.label}
    </span>
  )
}

// ============================================================================
// Utility functions
// ============================================================================

/** Format ISO timestamp to locale string */
function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  } catch {
    return iso
  }
}

/** Format milliseconds to human-readable duration */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const min = Math.floor(ms / 60_000)
  const sec = ((ms % 60_000) / 1000).toFixed(0)
  return `${min}m ${sec}s`
}

/** Format source type to display label */
function formatSource(source?: string): string {
  const map: Record<string, string> = {
    manual: "手动",
    ai: "AI",
    workflow: "工作流",
    retry: "重试",
    system: "系统",
  }
  return map[source ?? ""] ?? source ?? "手动"
}

// ============================================================================
// Main Panel
// ============================================================================

export function SourceTracePanel({
  isOpen,
  onClose,
  historyId,
  nodeId,
  nodeTitle,
  onNavigate,
}: SourceTracePanelProps) {
  // ── Data ──
  const findById = useRunHistoryStore((s) => s.findById)
  const item: NodeRunHistoryItem | undefined = useMemo(
    () => findById(historyId),
    [historyId, findById],
  )

  // Navigation support
  const { histories } = useNodeRunHistory(nodeId)
  const currentIndex = useMemo(
    () => histories.findIndex((h) => h.id === historyId),
    [histories, historyId],
  )
  const canGoPrev = currentIndex > 0
  const canGoNext = currentIndex < histories.length - 1

  const goToPrev = useCallback(() => {
    if (canGoPrev) onNavigate?.(histories[currentIndex - 1].id)
  }, [canGoPrev, currentIndex, histories, onNavigate])

  const goToNext = useCallback(() => {
    if (canGoNext) onNavigate?.(histories[currentIndex + 1].id)
  }, [canGoNext, currentIndex, histories, onNavigate])

  // ── Guards ──
  if (!isOpen) return null
  if (typeof document === "undefined") return null

  const panelWidth = 480

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
      {/* Overlay */}
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
        {/* ===== Header ===== */}
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
            <Clock size={16} color={DESIGN_TOKENS.textSecondary} />
            <span style={{ fontSize: 13, fontWeight: 600, color: DESIGN_TOKENS.text }}>
              Run Trace
            </span>
            {nodeTitle && (
              <span style={{ fontSize: 11, color: DESIGN_TOKENS.textMuted }}>
                · {nodeTitle}
              </span>
            )}
            {item && <StatusBadge status={item.status} />}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {/* Prev / Next navigation */}
            <NavButton onClick={goToPrev} disabled={!canGoPrev} title="上一条记录">
              <ChevronLeft size={16} />
            </NavButton>
            <span
              style={{
                fontSize: 11,
                color: DESIGN_TOKENS.textMuted,
                minWidth: 36,
                textAlign: "center",
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
              }}
            >
              {histories.length > 0 ? `${currentIndex + 1}/${histories.length}` : "—"}
            </span>
            <NavButton onClick={goToNext} disabled={!canGoNext} title="下一条记录">
              <ChevronRight size={16} />
            </NavButton>

            {/* Divider */}
            <div
              style={{
                width: 1,
                height: 16,
                background: DESIGN_TOKENS.border,
                margin: "0 4px",
              }}
            />

            {/* Close */}
            <NavButton onClick={onClose} title="关闭">
              <X size={16} />
            </NavButton>
          </div>
        </div>

        {/* ===== Body ===== */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          {!item ? (
            /* ── Empty: record not found ── */
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "64px 24px",
                gap: 12,
              }}
            >
              <FileX size={36} color={DESIGN_TOKENS.textMuted} />
              <p style={{ fontSize: 13, color: DESIGN_TOKENS.textSecondary, textAlign: "center" }}>
                Record not found
              </p>
              <p style={{ fontSize: 11, color: DESIGN_TOKENS.textMuted, textAlign: "center" }}>
                该记录可能已被清除
              </p>
            </div>
          ) : (
            <>
              {/* ── 1. Model Info ── */}
              <Section title="模型信息" icon={<Cpu size={14} />} defaultOpen>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <InfoRow
                    label="Model"
                    value={(item.input.settingsSnapshot?.model as string) ?? "N/A"}
                    mono
                  />
                  <InfoRow
                    label="Provider"
                    value={(item.input.settingsSnapshot?.provider as string) ?? "N/A"}
                  />
                  <InfoRow
                    label="Node Kind"
                    value={(item.input.settingsSnapshot?.nodeKind as string) ?? "N/A"}
                  />
                  <InfoRow label="Source" value={formatSource(item.source)} />
                </div>
              </Section>

              {/* ── 2. Timing ── */}
              <Section title="时间线" icon={<Clock size={14} />} defaultOpen>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <InfoRow label="Started" value={formatTime(item.startedAt)} />
                  <InfoRow label="Finished" value={formatTime(item.finishedAt)} />
                  <InfoRow
                    label="Duration"
                    value={formatDuration(item.durationMs)}
                    mono
                  />
                  <InfoRow label="Run ID" value={item.runId.slice(0, 16)} mono />
                </div>
              </Section>

              {/* ── 3. Final Prompt ── */}
              <Section
                title={`最终 Prompt (${(item.input.displayPrompt ?? "").length} chars)`}
                icon={<Sparkles size={14} />}
                defaultOpen
              >
                <div
                  style={{
                    position: "relative",
                    padding: 10,
                    borderRadius: 6,
                    background: DESIGN_TOKENS.card,
                    border: `1px solid ${DESIGN_TOKENS.border}`,
                    fontSize: 12,
                    lineHeight: 1.6,
                    color: DESIGN_TOKENS.text,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    maxHeight: 400,
                    overflowY: "auto",
                  }}
                >
                  {item.input.displayPrompt ? (
                    item.input.displayPrompt
                  ) : (
                    <span style={{ color: DESIGN_TOKENS.textMuted, fontStyle: "italic" }}>
                      无 Prompt 内容
                    </span>
                  )}
                </div>
                {item.input.displayPrompt && (
                  <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                    <CopyButton text={item.input.displayPrompt} />
                  </div>
                )}
              </Section>

              {/* ── 4. Upstream Inputs ── */}
              {item.input.inputTexts.length > 0 && (
                <Section
                  title={`上游输入 (${item.input.inputTexts.length})`}
                  icon={<Layers size={14} />}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {item.input.inputTexts.map((input, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 6,
                          background: DESIGN_TOKENS.card,
                          border: `1px solid ${DESIGN_TOKENS.border}`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            color: DESIGN_TOKENS.textMuted,
                            marginBottom: 4,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span style={{ fontFamily: "monospace" }}>
                            {input.nodeType}
                          </span>
                          {input.title && <span>· {input.title}</span>}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: DESIGN_TOKENS.text,
                            whiteSpace: "pre-wrap",
                            maxHeight: 120,
                            overflowY: "auto",
                          }}
                        >
                          {input.text}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* ── 5. Output ── */}
              {item.status === "succeeded" && item.output && (
                <Section title="输出结果" icon={<FileText size={14} />} defaultOpen>
                  {/* Text output */}
                  {item.output.text && (
                    <div style={{ marginBottom: 8 }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: DESIGN_TOKENS.text,
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.6,
                          maxHeight: 300,
                          overflowY: "auto",
                          padding: 10,
                          borderRadius: 6,
                          background: DESIGN_TOKENS.card,
                          border: `1px solid ${DESIGN_TOKENS.border}`,
                        }}
                      >
                        {item.output.text}
                      </div>
                      <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                        <CopyButton text={item.output.text} />
                      </div>
                    </div>
                  )}

                  {/* Image output */}
                  {item.output.imageUrls && item.output.imageUrls.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div
                        style={{
                          fontSize: 10,
                          color: DESIGN_TOKENS.textMuted,
                          marginBottom: 6,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        Images ({item.output.imageUrls.length})
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {item.output.imageUrls.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ textDecoration: "none" }}
                          >
                            <img
                              src={url}
                              alt={`output-${i}`}
                              style={{
                                width: 80,
                                height: 80,
                                objectFit: "cover",
                                borderRadius: 6,
                                border: `1px solid ${DESIGN_TOKENS.border}`,
                              }}
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Video output */}
                  {item.output.videoUrls && item.output.videoUrls.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div
                        style={{
                          fontSize: 10,
                          color: DESIGN_TOKENS.textMuted,
                          marginBottom: 6,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        Videos ({item.output.videoUrls.length})
                      </div>
                      {item.output.videoUrls.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 0",
                            fontSize: 11,
                            color: DESIGN_TOKENS.accent,
                            textDecoration: "none",
                          }}
                        >
                          <ExternalLink size={12} />
                          {url.length > 60 ? url.slice(0, 60) + "..." : url}
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Raw output (collapsible) */}
                  {item.output.raw !== undefined && item.output.raw !== null && (
                    <details style={{ marginTop: 4 }}>
                      <summary
                        style={{
                          fontSize: 11,
                          color: DESIGN_TOKENS.textMuted,
                          cursor: "pointer",
                          outline: "none",
                        }}
                      >
                        Raw Output
                      </summary>
                      <pre
                        style={{
                          margin: "8px 0 0",
                          padding: 8,
                          borderRadius: 6,
                          background: DESIGN_TOKENS.card,
                          border: `1px solid ${DESIGN_TOKENS.border}`,
                          fontSize: 10,
                          color: DESIGN_TOKENS.textMuted,
                          whiteSpace: "pre-wrap",
                          maxHeight: 200,
                          overflow: "auto",
                          fontFamily: "ui-monospace, SFMono-Regular, monospace",
                        }}
                      >
                        {typeof item.output.raw === "string"
                          ? item.output.raw.slice(0, 2000)
                          : JSON.stringify(item.output.raw, null, 2).slice(0, 2000)}
                      </pre>
                    </details>
                  )}

                  {/* No output content */}
                  {!item.output.text &&
                    !item.output.imageUrls?.length &&
                    !item.output.videoUrls?.length &&
                    item.output.raw === undefined && (
                      <p style={{ fontSize: 12, color: DESIGN_TOKENS.textMuted, fontStyle: "italic" }}>
                        无输出内容
                      </p>
                    )}
                </Section>
              )}

              {/* ── 6. Error (only for failed) ── */}
              {item.status === "failed" && (
                <Section title="错误信息" icon={<AlertTriangle size={14} />} defaultOpen>
                  {item.error ? (
                    <div
                      style={{
                        padding: 10,
                        borderRadius: 6,
                        background: "rgba(239,68,68,0.08)",
                        border: "1px solid rgba(239,68,68,0.2)",
                        color: "#ef4444",
                        fontSize: 12,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {item.error}
                    </div>
                  ) : (
                    <p style={{ fontSize: 12, color: DESIGN_TOKENS.textMuted }}>
                      无错误详情
                    </p>
                  )}
                  {item.message && (
                    <p
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        color: DESIGN_TOKENS.textMuted,
                      }}
                    >
                      {item.message}
                    </p>
                  )}
                </Section>
              )}

              {/* ── 7. Metadata ── */}
              <Section title="元数据" icon={<FileText size={14} />} defaultOpen={false}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <InfoRow label="Record ID" value={item.id} mono />
                  <InfoRow label="Node ID" value={item.nodeId} mono />
                  {item.nodeType && <InfoRow label="Node Type" value={item.nodeType} />}
                  <InfoRow label="Created" value={formatTime(item.createdAt)} />
                </div>
              </Section>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ============================================================================
// Navigation button helper
// ============================================================================

function NavButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 26,
        height: 26,
        borderRadius: 6,
        border: "none",
        background: disabled ? "transparent" : DESIGN_TOKENS.card,
        color: disabled ? DESIGN_TOKENS.textMuted : DESIGN_TOKENS.textSecondary,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  )
}
