/**
 * EmptyCanvasGuide - 空画布引导，TapNow 风格
 */

import { Sparkles, Image, Wand2, Music, LayoutGrid } from "lucide-react"
import { DESIGN_TOKENS } from "../../styles/designSystem"

interface EmptyCanvasGuideProps {
  onQuickStart: (draft: string, mode: string) => void
  onOpenChat: () => void
  onOpenAssetLibrary: () => void
  onUploadImage: () => void
}

export function EmptyCanvasGuide({
  onQuickStart,
  onOpenChat,
  onOpenAssetLibrary,
  onUploadImage,
}: EmptyCanvasGuideProps) {
  const actions = [
    {
      icon: Sparkles,
      label: "文字生视频",
      onClick: () => onQuickStart("帮我生成一段视频", "text-to-video"),
    },
    {
      icon: Image,
      label: "图片换背景",
      onClick: () => onUploadImage(),
    },
    {
      icon: Wand2,
      label: "首帧生成视频",
      onClick: () => onUploadImage(),
    },
    {
      icon: Music,
      label: "音频生视频",
      onClick: () => onOpenChat(),
    },
    {
      icon: LayoutGrid,
      label: "模板",
      onClick: () => onOpenAssetLibrary(),
    },
  ]

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {/* 引导文字 */}
        <div className="flex items-center gap-2 text-sm" style={{ color: DESIGN_TOKENS.textSecondary }}>
          <Sparkles size={16} strokeWidth={1.5} style={{ color: DESIGN_TOKENS.accent }} />
          <span>双击画布自由生成，或查看模板</span>
        </div>

        {/* 快捷操作按钮 */}
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2">
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs transition-all hover:scale-[1.02]"
              style={{
                backgroundColor: DESIGN_TOKENS.card,
                color: DESIGN_TOKENS.textSecondary,
                border: `1px solid ${DESIGN_TOKENS.border}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = DESIGN_TOKENS.cardHover
                e.currentTarget.style.borderColor = DESIGN_TOKENS.borderStrong
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = DESIGN_TOKENS.card
                e.currentTarget.style.borderColor = DESIGN_TOKENS.border
              }}
            >
              <action.icon size={14} strokeWidth={1.5} />
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
