/**
 * EmptyCanvasGuide - 空画布引导
 * 清晰展示所有可用功能和使用方式
 */

import { Sparkles, Image, Film, FileText, MessageCircle, Upload, Video, Mic, Wand2 } from "lucide-react"
import { DESIGN_TOKENS } from "../../styles/designSystem"

interface EmptyCanvasGuideProps {
  onCreateVideoWorkflow?: () => void
  onOpenScriptImport?: () => void
  onUploadImage: () => void
  /** Whether the right-side chat panel is open */
  chatOpen?: boolean
  /** Width of the chat panel in px (default: 400) */
  chatPanelWidth?: number
  /** Width of the left toolbar in px (default: 88) */
  leftToolbarWidth?: number
}

export function EmptyCanvasGuide({
  onCreateVideoWorkflow,
  onOpenScriptImport,
  onUploadImage,
  chatOpen = false,
  chatPanelWidth = 400,
  leftToolbarWidth = 88,
}: EmptyCanvasGuideProps) {
  const guides = [
    {
      icon: Upload,
      label: "1. 导入剧本",
      desc: "上传 PDF / DOCX / TXT，或把故事梗概直接送入 AI 分析。",
      color: "#f59e0b",
    },
    {
      icon: Wand2,
      label: "2. AI 拆解",
      desc: "自动生成角色圣经、场景圣经和可编辑分镜建议。",
      color: "#8b5cf6",
    },
    {
      icon: Image,
      label: "3. 分镜生图",
      desc: "用普通生图或 Ideogram 4 把镜头变成统一风格画面。",
      color: "#6366f1",
    },
    {
      icon: Video,
      label: "4. Vidu 视频",
      desc: "基于分镜图继续生成图生视频，支持模型、时长和分辨率选择。",
      color: "#ea580c",
    },
    {
      icon: Mic,
      label: "5. 配音试听",
      desc: "为每个镜头台词生成配音，并在分镜卡片中直接播放。",
      color: "#10b981",
    },
  ]

  return (
    <div
      className="absolute top-0 bottom-0 flex items-center justify-center pointer-events-none"
      style={{ left: leftToolbarWidth, right: chatOpen ? chatPanelWidth : 0 }}
    >
      <div className="flex flex-col items-center gap-5 max-w-2xl">
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
          <p className="max-w-xl text-center text-sm leading-relaxed" style={{ color: DESIGN_TOKENS.textMuted }}>
            面向 AI 影视创作者的一站式流程：导入剧本 → AI 拆解角色/场景/分镜 → 生图 → Vidu 视频 → 配音试听。
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
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => onOpenScriptImport?.()}
            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all hover:opacity-90"
            style={{
              backgroundColor: "#f59e0b",
              color: "#111827",
              boxShadow: "0 14px 40px rgba(245, 158, 11, 0.25)",
            }}
            data-testid="empty-guide-import-script"
          >
            <Upload size={14} strokeWidth={1.8} />
            导入剧本 / AI 分析剧本
          </button>
          <button
            onClick={() => onCreateVideoWorkflow?.()}
            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition-all hover:opacity-80"
            style={{
              backgroundColor: DESIGN_TOKENS.accent,
              color: "#fff",
            }}
            data-testid="empty-guide-create-ai-film-workflow"
          >
            <Film size={14} strokeWidth={1.5} />
            创建 AI 影视流程
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

        <div
          className="pointer-events-auto rounded-2xl px-4 py-3 text-[11px] leading-relaxed"
          style={{
            backgroundColor: "rgba(245, 158, 11, 0.08)",
            border: "1px solid rgba(245, 158, 11, 0.22)",
            color: DESIGN_TOKENS.textSecondary,
          }}
        >
          建议新用户先点 <span style={{ color: "#f59e0b", fontWeight: 600 }}>导入剧本 / AI 分析剧本</span>：系统会把剧本文本拆成角色、场景和镜头，再进入生图、Vidu 视频和配音流程。
        </div>
      </div>
    </div>
  )
}
