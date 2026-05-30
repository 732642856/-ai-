/**
 * CanvasDropOverlay - 拖拽文件到画布时的视觉反馈
 */

import { DESIGN_TOKENS } from "../../styles/designSystem"

interface CanvasDropOverlayProps {
  isVisible: boolean
  error?: string | null
}

export function CanvasDropOverlay({ isVisible, error }: CanvasDropOverlayProps) {
  if (!isVisible) return null

  return (
    <div
      className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center"
      style={{
        backgroundColor: "rgba(7, 9, 17, 0.85)",
      }}
    >
      <div
        className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed px-16 py-12"
        style={{
          borderColor: error ? "#ef4444" : DESIGN_TOKENS.accent,
          backgroundColor: error
            ? "rgba(239, 68, 68, 0.1)"
            : DESIGN_TOKENS.accentSoft,
        }}
      >
        <svg
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke={error ? "#ef4444" : DESIGN_TOKENS.accent}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17,8 12,3 7,8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>

        <div className="text-center">
          <p
            className="text-lg font-medium"
            style={{ color: error ? "#ef4444" : DESIGN_TOKENS.text }}
          >
            {error || "释放以上传到画布"}
          </p>
          <p className="mt-1 text-sm" style={{ color: DESIGN_TOKENS.textMuted }}>
            支持 JPG、PNG、WebP、GIF、TXT、Markdown
          </p>
        </div>
      </div>
    </div>
  )
}
