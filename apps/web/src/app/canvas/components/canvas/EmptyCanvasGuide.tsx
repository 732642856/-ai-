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
  onCreateVideoWorkflow?: () => void
}

export function EmptyCanvasGuide({
  onQuickStart,
  onOpenChat,
  onOpenAssetLibrary,
  onUploadImage,
  onCreateVideoWorkflow,
}: EmptyCanvasGuideProps) {
  const actions = [
    {
      icon: Sparkles,
      label: "前期流程",
      onClick: () => onCreateVideoWorkflow?.() || onQuickStart("帮我从一句创意拆成前期分镜和视觉方案", "pre-production"),
    },
    {
      icon: Image,
      label: "参考图",
      onClick: () => onUploadImage(),
    },
    {
      icon: Wand2,
      label: "关键画面",
      onClick: () => onQuickStart("帮我生成角色、场景或首帧关键画面提示词", "keyframe-design"),
    },
    {
      icon: Music,
      label: "声音意图",
      onClick: () => onOpenChat(),
    },
    {
      icon: LayoutGrid,
      label: "素材模板",
      onClick: () => onOpenAssetLibrary(),
    },
  ]

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {/* 引导文字 */}
        <div className="flex items-center gap-2 text-sm" style={{ color: DESIGN_TOKENS.textSecondary }}>
          <Sparkles size={16} strokeWidth={1.5} style={{ color: DESIGN_TOKENS.accent }} />
          <span>星轨画布（前期）：先把创意、分镜草稿、关键画面整理成可交接项目包</span>
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
