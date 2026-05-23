// ============================================================================
// PromptPreviewPanel - AI prompt preview side panel (Phase 1-c Step 2)
// ============================================================================
// Shows a structured preview of what the AI will receive for the selected
// node: model config, upstream context, assembled prompt, and warnings.
//
// Uses createPortal for overlay, matching NodeHistoryPanel pattern.
// Data source: buildPromptPreview() from Phase 1-c Step 1 (lib/ai/prompt-preview.ts).
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
import { buildPromptPreview } from "../../../../lib/ai/prompt-preview"
import type { PromptPreviewResult } from "../../../../lib/ai/prompt-preview"
import type { CanvasNodeData } from "../canvas/types"

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

/** Source type → color (matches CanvasNodeKind) */
function sourceColor(kind: string): string {
  const colorMap: Record<string, string> = {
    "ai-generate": "#a78bfa",
    "image-generation": "#34d399",
    "image-upload": "#34d399",
    "image-result": "#34d399",
    video: "#f472b6",
    text: "#60a5fa",
    script: "#60a5fa",
    "story-board": "#60a5fa",
    subtitle: "#60a5fa",
  }
  return colorMap[kind] ?? DESIGN_TOKENS.textSecondary
}

/** Format CanvasNodeKind for display */
function formatNodeType(kind: string): string {
  const map: Record<string, string> = {
    "ai-generate": "AI Generate",
    "image-generation": "Image Gen",
    "image-upload": "Upload",
    "image-result": "Result",
    video: "Video",
    text: "Text",
    script: "Script",
    "story-board": "Storyboard",
    subtitle: "Subtitle",
  }
  return map[kind] ?? kind
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
      {open && <div style={{ padding: "0 16px 12px" }}>{children}</div>}
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

// ============================================================================
// Main Panel
// ============================================================================

export function PromptPreviewPanel({ isOpen, onClose, nodeId }: PromptPreviewPanelProps) {
  const nodes = useNodes()
  const edges = useEdges()
  const { config, isLoading, error } = useAiConfig()

  // Build preview using Step 1 buildPromptPreview()
  const preview: PromptPreviewResult | null = useMemo(() => {
    if (!nodeId || !isOpen) return null
    const targetNode = nodes.find((n) => n.id === nodeId)
    if (!targetNode) return null
    try {
      return buildPromptPreview({
        node: targetNode,
        allNodes: nodes,
        edges,
        envDefaultModel: config?.defaultModel,
        envDefaultImageModel: config?.defaultImageModel,
      })
    } catch {
      return null
    }
  }, [nodeId, nodes, edges, isOpen, config])

  // Derive display values from PromptPreviewResult
  const runRequest = preview?.runRequest ?? null
  // RunRequest.message is the assembled prompt string
  const displayPrompt: string =
    (runRequest as { message?: string } | null)?.message ?? ""
  // Active model: node-level > env config > fallback
  const activeModel: string =
    (runRequest as { model?: string } | null)?.model ?? config?.defaultModel ?? "N/A"
  const hasWarnings: boolean =
    ((preview as { warnings?: string[] } | null)?.warnings?.length ?? 0) > 0
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
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: DESIGN_TOKENS.text,
              }}
            >
              Prompt Preview
            </span>
            <Badge color={preview ? "#22c55e" : "#ef4444"} label={preview ? "Ready" : "Error"} />
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
              <div style={{ color: DESIGN_TOKENS.textMuted, fontSize: 12 }}>
                Loading config...
              </div>
            ) : error ? (
              <div style={{ color: "#ef4444", fontSize: 12 }}>Config error: {error}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <InfoRow label="Active Model" value={activeModel} />
                {config?.defaultImageModel && (
                  <InfoRow label="Image Model" value={config.defaultImageModel} />
                )}
                {config?.videoModel && (
                  <InfoRow label="Video Model" value={config.videoModel} />
                )}
                {config?.provider && <InfoRow label="Provider" value={config.provider} />}
              </div>
            )}
          </Section>

          {/* --- 2. Upstream Nodes --- */}
          <Section
            title={`Upstream (${preview?.upstreamNodeIds?.length ?? 0})`}
            icon={<Layers size={14} />}
          >
            {!preview || preview.upstreamNodeIds.length === 0 ? (
              <div style={{ color: DESIGN_TOKENS.textMuted, fontSize: 12 }}>
                No upstream nodes
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {preview.upstreamNodeIds.map((upId: string) => {
                  const upNode = nodes.find((n) => n.id === upId)
                  const kind = (upNode?.data?.nodeKind ?? "unknown") as string
                  const title = (upNode?.data?.label ??
                    upNode?.data?.content ??
                    upId) as string
                  return (
                    <div
                      key={upId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 8px",
                        borderRadius: 6,
                        background: DESIGN_TOKENS.card,
                        border: `1px solid ${DESIGN_TOKENS.border}`,
                      }}
                    >
                      <Badge color={sourceColor(kind)} label={formatNodeType(kind)} />
                      <span
                        style={{
                          fontSize: 12,
                          color: DESIGN_TOKENS.text,
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {title}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          {/* --- 3. Final Prompt --- */}
          <Section title={`Final Prompt (${promptLength} chars)`} icon={<Sparkles size={14} />}>
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
              {displayPrompt || (
                <span style={{ color: DESIGN_TOKENS.textMuted, fontStyle: "italic" }}>
                  No prompt content
                </span>
              )}
            </div>
            <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
              <CopyButton text={displayPrompt} />
            </div>
          </Section>

          {/* --- 4. Warnings & Errors --- */}
          {(hasWarnings || isLongPrompt) && (
            <Section title="Warnings" icon={<AlertTriangle size={14} />} defaultOpen={true}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {hasWarnings &&
                  (preview as { warnings?: string[] }).warnings?.map((warn: string, idx: number) => (
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
                {isLongPrompt && (
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
    document.body,
  )
}

// ============================================================================
// Utility
// ============================================================================

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 12, color: DESIGN_TOKENS.textSecondary }}>{label}</span>
      <span style={{ fontSize: 12, color: DESIGN_TOKENS.text, fontFamily: "monospace" }}>
        {value}
      </span>
    </div>
  )
}
