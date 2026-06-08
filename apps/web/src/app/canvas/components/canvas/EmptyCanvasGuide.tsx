/**
 * EmptyCanvasGuide - 空画布引导
 * 清晰展示所有可用功能和使用方式
 */

import { Sparkles, Image, FileText, MessageCircle } from "lucide-react"
import { DESIGN_TOKENS } from "../../styles/designSystem"

interface EmptyCanvasGuideProps {
  onCreateTextNode?: () => void
  onImportScript?: () => void
  onUploadImage: () => void
  /** Whether the right-side chat panel is open */
  chatOpen?: boolean
  /** Width of the chat panel in px (default: 400) */
  chatPanelWidth?: number
  /** Width of the left toolbar in px (default: 88) */
  leftToolbarWidth?: number
}

export function EmptyCanvasGuide({
  onCreateTextNode,
  onImportScript,
  onUploadImage,
  chatOpen = false,
  chatPanelWidth = 400,
  leftToolbarWidth = 88,
}: EmptyCanvasGuideProps) {
  const guides = [
    {
      icon: FileText,
      label: "导入剧本 / AI 分析",
      desc: "粘贴或导入剧本文本，自动进入 Shot 拆分与 Bible 统一设定",
      color: "#94a3b8",
    },
    {
      icon: Image,
      label: "上传参考图",
      desc: "把图片放进画布，用作角色、风格、场景或后续生图参考",
      color: "#94a3b8",
    },
    {
      icon: MessageCircle,
      label: "右侧 AI 对话",
      desc: "用对话生成文本或图片，需要时再添加到画布",
      color: "#94a3b8",
    },
  ]

  return (
    <div
      className="absolute top-0 bottom-0 flex items-center justify-center pointer-events-none"
      style={{ left: leftToolbarWidth, right: chatOpen ? chatPanelWidth : 0 }}
    >
        <div className="flex flex-col items-center gap-5 max-w-md">
        {/* Title */}
        <div className="flex flex-col items-center gap-2">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{
              backgroundColor: DESIGN_TOKENS.accentSoft,
            }}
          >
            <Sparkles size={22} strokeWidth={1.5} style={{ color: DESIGN_TOKENS.accent }} />
          </div>
          <h2
            className="text-lg font-medium"
            style={{ color: DESIGN_TOKENS.text }}
          >
            欢迎使用星轨画布
          </h2>
          <p className="text-sm" style={{ color: DESIGN_TOKENS.textMuted }}>
            先放一个真正有用的创作素材
          </p>
        </div>

        {/* Guide Cards */}
        <div className="pointer-events-auto flex flex-col gap-2 w-full">
          {guides.map((guide) => (
            <div
              key={guide.label}
              className="flex items-start gap-3 rounded-xl px-4 py-3 transition-all cursor-default"
              style={{
                backgroundColor: DESIGN_TOKENS.card,
                border: `1px solid ${DESIGN_TOKENS.border}`,
              }}
            >
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${guide.color}20` }}
              >
                <guide.icon
                  size={16}
                  strokeWidth={1.5}
                  style={{ color: guide.color }}
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <span
                  className="text-xs font-medium"
                  style={{ color: DESIGN_TOKENS.text }}
                >
                  {guide.label}
                </span>
                <span
                  className="text-[11px] leading-relaxed"
                  style={{ color: DESIGN_TOKENS.textMuted }}
                >
                  {guide.desc}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={() => onImportScript?.()}
            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition-all hover:opacity-80"
            style={{
              backgroundColor: DESIGN_TOKENS.accent,
              color: "#fff",
            }}
          >
            <FileText size={14} strokeWidth={1.5} />
            导入剧本 / AI 分析
          </button>
          <button
            onClick={() => onCreateTextNode?.()}
            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs transition-all hover:scale-[1.02]"
            style={{
              backgroundColor: DESIGN_TOKENS.card,
              color: DESIGN_TOKENS.textSecondary,
              border: `1px solid ${DESIGN_TOKENS.border}`,
            }}
          >
            <Sparkles size={14} strokeWidth={1.5} />
            空白写作
          </button>
          <button
            onClick={() => onUploadImage()}
            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs transition-all hover:scale-[1.02]"
            style={{
              backgroundColor: DESIGN_TOKENS.card,
              color: DESIGN_TOKENS.textSecondary,
              border: `1px solid ${DESIGN_TOKENS.border}`,
            }}
          >
            <Image size={14} strokeWidth={1.5} />
            上传参考图
          </button>
        </div>
      </div>
    </div>
  )
}
