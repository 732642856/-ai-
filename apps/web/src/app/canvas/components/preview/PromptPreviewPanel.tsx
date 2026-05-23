// ============================================================================
// PromptPreviewPanel - AI prompt preview side panel (Phase 1-c Step 2)
// ============================================================================
// Shows a structured preview of what the AI will receive for the selected
// node: model config, upstream context, assembled prompt, and warnings.
//
// Uses createPortal for overlay, matching NodeHistoryPanel pattern.
// ============================================================================

"use client"

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { useNodes, useEdges } from "@xyflow/react"
import {
  X,
  Eye,
  Cpu,
  Image,
  Video,
  AlertTriangle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
  XCircle,
} from "lucide-react"
import { DESIGN_TOKENS } from "../../styles/designSystem"
import { useAiConfig } from "../../hooks/useAiConfig"
import { buildNodeExecutionContext } from "../../utils/build-node-execution-context"
import type { NodeExecutionContext } from "../../types/execution-context"

// ============================================================================
// Props
// ============================================================================

interface PromptPreviewPanelProps {
  isOpen: boolean
  onClose: () => void
  nodeId: string | null
}

// ============================================================================
// Sub-components
// ============================================================================

/** Source type color mapping */
function sourceColor(source: string): string {
  switch (source) {
    case "ai-generate": return "#a78bfa"    // purple
    case "image-upload": return "#34d399"   // green
    case "video": return "#f472b6"          // pink
    case "text-input": return "#60a5fa"     // blue
    default: return DESIGN_TOKENS.textSecondary
  }
}

/** Format node type for display */
function formatNodeType(type: string): string {
  const map: Record<string, string> = {
    "ai-generate": "AI Generate",
    "image-upload": "Image Upload",
    "video": "Video",
    "text-input": "Text Input",
  }
  return map[type] ?? type
}

/** Compact label badge */
function Badge({ color, label }: { color: string; label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "1px 6px",
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 500,
        color,
        background: `${color}18`,
        border: `1px solid ${color}30`,
      }}
    >
      {label}
    </span>
  )
}

/** Collapsible section */
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
      {open && (
        <div style={{ padding: "0 16px 12px" }}>
          {children}
        </div>
      )}
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
      title="Copy prompt"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 8px",
        borderRadius: 4,
        background: copied ? "rgba(34,197,94,0.15)" : DESIGN_TOKENS.bgSecondary,
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

// ============================================================================
// Main Panel
// ============================================================================

export function PromptPreviewPanel({ isOpen, onClose, nodeId }: PromptPreviewPanelProps) {
  const nodes = useNodes()
  const edges = useEdges()
  const { config, isLoading, error, refetch } = useAiConfig()

  // Build context when nodeId changes
  const context: NodeExecutionContext | null = useMemo(() => {
    if (!nodeId || !isOpen) return null
    try {
      return buildNodeExecutionContext(nodeId, nodes, edges)
    } catch {
      return null
    }
  }, [nodeId, nodes, edges, isOpen])

  // Refetch config when panel opens
  useEffect(() => {
    if (isOpen) refetch()
  }, [isOpen, refetch])

  // Derived values
  const displayPrompt = context?.displayPrompt ?? context?.prompt ?? ""
  const hasWarnings = (context?.warnings?.length ?? 0) > 0
  const hasErrors = (context?.errors?.length ?? 0) > 0
  const promptLength = displayPrompt.length
  const isLongPrompt = promptLength > 2000

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
            <Eye size={16} color={DESIGN_TOKENS.textSecondary} />
            <span style={{ fontSize: 13, fontWeight: 600, color: DESIGN_TOKENS.textPrimary }}>
              Prompt Preview
            </span>
            <Badge
              color={context ? "#22c55e" : "#ef4444"}
              label={context ? "Ready" : "Error"}
            />
          </div>
          <button
            onClick={onClose}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: 6,
              border: "none",
              background: "transparent",
              color: DESIGN_TOKENS.textSecondary,
              cursor: "pointer",
            }}
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* ===== Scrollable Content ===== */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          {/* --- 1. Model Info --- */}
          <Section title="Model Config" icon={<Cpu size={14} />}>
            {isLoading ? (
              <div style={{ color: DESIGN_TOKENS.textTertiary, fontSize: 12 }}>Loading config...</div>
            ) : error ? (
              <div style={{ color: "#ef4444", fontSize: 12 }}>Config error: {error}</div>
            ) : config ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <InfoRow label="Text Model" value={config.defaultModel ?? "N/A"} />
                <InfoRow label="Image Model" value={config.defaultImageModel ?? "N/A"} />
                {config.videoModel && (
                  <InfoRow label="Video Model" value={config.videoModel} />
                )}
                {config.provider && (
                  <InfoRow label="Provider" value={config.provider} />
                )}
              </div>
            ) : (
              <div style={{ color: DESIGN_TOKENS.textTertiary, fontSize: 12 }}>No config available</div>
            )}
          </Section>

          {/* --- 2. Upstream Content --- */}
          <Section title={`Upstream (${context?.upstreamNodes?.length ?? 0})`} icon={<Layers size={14} />}>
            {!context || context.upstreamNodes.length === 0 ? (
              <div style={{ color: DESIGN_TOKENS.textTertiary, fontSize: 12 }}>No upstream nodes</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {context.upstreamNodes.map((upstream, idx) => (
                  <div
                    key={upstream.nodeId ?? idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 8px",
                      borderRadius: 6,
                      background: DESIGN_TOKENS.bgSecondary,
                      border: `1px solid ${DESIGN_TOKENS.border}`,
                    }}
                  >
                    <Badge
                      color={sourceColor(upstream.source ?? "")}
                      label={formatNodeType(upstream.source ?? "unknown")}
                    />
                    <span style={{ fontSize: 12, color: DESIGN_TOKENS.textPrimary, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {upstream.title ?? upstream.nodeId}
                    </span>
                    {upstream.role && (
                      <span style={{ fontSize: 10, color: DESIGN_TOKENS.textTertiary }}>
                        role: {upstream.role}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* --- 3. References (images/videos) --- */}
          {(context?.referenceImages?.length ?? 0) > 0 || (context?.referenceVideos?.length ?? 0) > 0 ? (
            <Section title="References" icon={<Image size={14} />} defaultOpen={false}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {context?.referenceImages?.map((img, idx) => (
                  <div key={`img-${idx}`} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <Image size={12} color="#34d399" />
                    <span style={{ color: DESIGN_TOKENS.textPrimary }}>{img.label ?? `Image ${idx + 1}`}</span>
                    {img.role && <Badge color="#34d399" label={img.role} />}
                  </div>
                ))}
                {context?.referenceVideos?.map((vid, idx) => (
                  <div key={`vid-${idx}`} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <Video size={12} color="#f472b6" />
                    <span style={{ color: DESIGN_TOKENS.textPrimary }}>{vid.label ?? `Video ${idx + 1}`}</span>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* --- 4. Final Prompt --- */}
          <Section
            title={`Final Prompt (${promptLength} chars)`}
            icon={<Sparkles size={14} />}
          >
            <div
              style={{
                position: "relative",
                padding: 10,
                borderRadius: 6,
                background: DESIGN_TOKENS.bgSecondary,
                border: `1px solid ${DESIGN_TOKENS.border}`,
                fontSize: 12,
                lineHeight: 1.6,
                color: DESIGN_TOKENS.textPrimary,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                maxHeight: 400,
                overflowY: "auto",
              }}
            >
              {displayPrompt || <span style={{ color: DESIGN_TOKENS.textTertiary, fontStyle: "italic" }}>No prompt content</span>}
            </div>
            <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
              <CopyButton text={displayPrompt} />
            </div>
          </Section>

          {/* --- 5. Warnings & Errors --- */}
          {(hasWarnings || hasErrors || isLongPrompt) && (
            <Section
              title="Warnings"
              icon={<AlertTriangle size={14} />}
              defaultOpen={true}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {hasErrors && context.errors.map((err, idx) => (
                  <div
                    key={`err-${idx}`}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 6,
                      padding: "6px 8px",
                      borderRadius: 6,
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.2)",
                      fontSize: 12,
                      color: "#fca5a5",
                    }}
                  >
                    <XCircle size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                    {err}
                  </div>
                ))}
                {hasWarnings && context.warnings.map((warn, idx) => (
                  <div
                    key={`warn-${idx}`}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 6,
                      padding: "6px 8px",
                      borderRadius: 6,
                      background: "rgba(251,191,36,0.08)",
                      border: "1px solid rgba(251,191,36,0.2)",
                      fontSize: 12,
                      color: "#fcd34d",
                    }}
                  >
                    <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                    {warn}
                  </div>
                ))}
                {isLongPrompt && !context?.warnings?.some(w => w.includes("2000")) && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 6,
                      padding: "6px 8px",
                      borderRadius: 6,
                      background: "rgba(251,191,36,0.08)",
                      border: "1px solid rgba(251,191,36,0.2)",
                      fontSize: 12,
                      color: "#fcd34d",
                    }}
                  >
                    <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                    Prompt exceeds {promptLength} characters. Some models may truncate long prompts.
                  </div>
                )}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ============================================================================
// Utility components
// ============================================================================

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 12, color: DESIGN_TOKENS.textSecondary }}>{label}</span>
      <span style={{ fontSize: 12, color: DESIGN_TOKENS.textPrimary, fontFamily: "monospace" }}>{value}</span>
    </div>
  )
}

