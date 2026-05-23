/**
 * EmptyCanvasGuide - 空画布引导
 * 清晰展示所有可用功能和使用方式
 */

import { Sparkles, Image, Film, FileText, MessageCircle } from "lucide-react"
import { DESIGN_TOKENS } from "../../styles/designSystem"

interface EmptyCanvasGuideProps {
  onCreateVideoWorkflow?: () => void
  onUploadImage: () => void
  /** Whether the right-side chat panel is open */
  chatOpen?: boolean
  /** Width of the chat panel in px (default: 400) */
  chatPanelWidth?: number
}

export function EmptyCanvasGuide({
  onCreateVideoWorkflow,
  onUploadImage,
  chatOpen = false,
  chatPanelWidth = 400,
}: EmptyCanvasGuideProps) {
  const guides = [
    {
      icon: Sparkles,
      label: "星语 Prompt",
      desc: "点击左侧星语头像创建 Prompt 节点，输入描述后可 AI 生图",
      color: "#94a3b8",
    },
    {
      icon: Image,
      label: "参考图",
      desc: "上传图片到画布，悬停后可用 AI 生成变体",
      color: "#94a3b8",
    },
    {
      icon: FileText,
      label: "创意文本",
      desc: "创建文本节点，选中后可用 AI 润色内容",
      color: "#94a3b8",
    },
    {
      icon: Film,
      label: "前期流程",
      desc: "一键生成完整的前期工作流：创意梳理 → 分镜 → 画面设计",
      color: "#94a3b8",
    },
    {
      icon: MessageCircle,
      label: "星轨 AI 对话",
      desc: "右侧对话框，支持文本对话和 AI 生图，可添加到画布",
      color: "#94a3b8",
    },
  ]

  return (
    <div
      className="absolute top-0 bottom-0 left-0 flex items-center justify-center pointer-events-none"
      style={{ right: chatOpen ? chatPanelWidth : 0 }}
    >
      <div className="flex flex-col items-center gap-5 max-w-lg">
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
            从下方选择一个功能开始创作
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
            onClick={() => onCreateVideoWorkflow?.()}
            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition-all hover:opacity-80"
            style={{
              backgroundColor: DESIGN_TOKENS.accent,
              color: "#fff",
            }}
          >
            <Film size={14} strokeWidth={1.5} />
            快速开始：创建前期工作流
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
