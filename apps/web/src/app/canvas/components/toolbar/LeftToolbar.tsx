/**
 * LeftToolbar - 左侧胶囊工具栏，TapNow 风格
 */

import { FolderOpen, Image, Sparkles, FileText, MessageCircle, History } from "lucide-react"
import { DESIGN_TOKENS } from "../../styles/designSystem"

interface LeftToolbarProps {
  onOpenAssetLibrary: () => void
  onCreateNode: () => void
  onUploadImage: () => void
  onAddPrompt: () => void
  onAddText: () => void
  onToggleChat: () => void
  isChatOpen: boolean
  onToggleHistory: () => void
  showHistory: boolean
  onOpenUserMenu: () => void
}

export function LeftToolbar({
  onOpenAssetLibrary,
  onCreateNode,
  onUploadImage,
  onAddPrompt,
  onAddText,
  onToggleChat,
  isChatOpen,
  onToggleHistory,
  showHistory,
  onOpenUserMenu,
}: LeftToolbarProps) {
  const tools = [
    { icon: Image, label: "上传图片", onClick: onUploadImage },
    { icon: Sparkles, label: "Prompt", onClick: onAddPrompt },
    { icon: FileText, label: "文本", onClick: onAddText },
    { icon: FolderOpen, label: "素材库", onClick: onOpenAssetLibrary },
  ]

  return (
    <div
      className="fixed left-3 top-1/2 z-20 flex flex-col items-center rounded-full border p-2"
      style={{
        transform: "translateY(-50%)",
        backgroundColor: "rgba(20,20,24,0.9)",
        borderColor: DESIGN_TOKENS.border,
        backdropFilter: "blur(20px)",
      }}
    >
      {/* 星语头像 - 新建节点 */}
      <button
        onClick={onCreateNode}
        className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full transition-all hover:scale-105"
        title="新建节点"
      >
        <img
          src="/星语.JPG"
          alt="星语"
          className="h-full w-full object-cover"
        />
      </button>

      {/* 分隔线 */}
      <div
        className="my-1.5 h-px w-6"
        style={{ backgroundColor: DESIGN_TOKENS.border }}
      />

      {/* 工具按钮 */}
      <div className="flex flex-col items-center gap-1">
        {tools.map((tool) => (
          <button
            key={tool.label}
            onClick={tool.onClick}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-all hover:bg-white/10"
            style={{ color: DESIGN_TOKENS.textMuted }}
            title={tool.label}
          >
            <tool.icon size={18} strokeWidth={1.5} />
          </button>
        ))}
      </div>

      {/* 分隔线 */}
      <div
        className="my-1.5 h-px w-6"
        style={{ backgroundColor: DESIGN_TOKENS.border }}
      />

      {/* 聊天按钮 */}
      <button
        onClick={onToggleChat}
        className="flex h-9 w-9 items-center justify-center rounded-full transition-all hover:bg-white/10"
        style={{
          color: isChatOpen ? DESIGN_TOKENS.accent : DESIGN_TOKENS.textMuted,
          backgroundColor: isChatOpen ? "rgba(100,116,139,0.15)" : "transparent",
        }}
        title={isChatOpen ? "关闭聊天" : "打开聊天"}
      >
        <MessageCircle size={18} strokeWidth={1.5} />
      </button>

      {/* 历史记录按钮 */}
      <button
        onClick={onToggleHistory}
        className="flex h-9 w-9 items-center justify-center rounded-full transition-all hover:bg-white/10"
        style={{
          color: showHistory ? DESIGN_TOKENS.accent : DESIGN_TOKENS.textMuted,
          backgroundColor: showHistory ? "rgba(100,116,139,0.15)" : "transparent",
        }}
        title="历史记录"
      >
        <History size={18} strokeWidth={1.5} />
      </button>

      {/* 分隔线 */}
      <div
        className="my-1.5 h-px w-6"
        style={{ backgroundColor: DESIGN_TOKENS.border }}
      />

      {/* 用户头像 */}
      <button
        onClick={onOpenUserMenu}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full transition-all hover:scale-105"
        style={{
          backgroundColor: DESIGN_TOKENS.accent,
          color: "#fff",
        }}
        title="用户菜单"
      >
        <span className="text-sm font-medium">N</span>
      </button>
    </div>
  )
}
