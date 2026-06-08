/**
 * LeftToolbar - 左侧胶囊工具栏（开发版 + 主干版功能合并）
 */

import {
  Library,
  Image,
  FileText,
  MessageCircle,
  Film,
  UserRound,
  Upload,
  Plus,
  Clock3,
  Save,
} from "lucide-react"
import { DESIGN_TOKENS } from "../../styles/designSystem"

interface LeftToolbarProps {
  onOpenAssetLibrary: () => void
  onCreateNode: () => void
  onUploadImage: () => void
  onAddText: () => void
  onCreateVideoWorkflow?: () => void
  onToggleChat: () => void
  isChatOpen: boolean
  onOpenUserMenu: () => void
  onOpenBiblePanel?: () => void
  onOpenScriptImport?: () => void
  // 主干版新增
  onToggleAddNodePanel?: () => void
  isAddNodePanelOpen?: boolean
  onOpenWorkspaceHistory?: () => void
  onOpenTemplates?: () => void
}

export function LeftToolbar({
  onOpenAssetLibrary,
  onCreateNode,
  onUploadImage,
  onAddText,
  onCreateVideoWorkflow,
  onToggleChat,
  isChatOpen,
  onOpenUserMenu,
  onOpenBiblePanel,
  onOpenScriptImport,
  onToggleAddNodePanel,
  isAddNodePanelOpen,
  onOpenWorkspaceHistory,
  onOpenTemplates,
}: LeftToolbarProps) {
  const tools = [
    { icon: Image, label: "参考图", onClick: onUploadImage },
    { icon: FileText, label: "创意文本", onClick: onAddText },
    { icon: Upload, label: "导入剧本", onClick: onOpenScriptImport || (() => {}) },
    { icon: Film, label: "前期流程", onClick: onCreateVideoWorkflow || onCreateNode },
    { icon: Library, label: "素材库", onClick: onOpenAssetLibrary },
    { icon: UserRound, label: "角色圣经", onClick: onOpenBiblePanel },
    { icon: Save, label: "工作流模板", onClick: onOpenTemplates || (() => {}) },
    { icon: Clock3, label: "工作记录", onClick: onOpenWorkspaceHistory || (() => {}) },
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
      {/* 星语头像 - 新建 Prompt 节点（开发版保留） */}
      <button
        onClick={onCreateNode}
        className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full transition-all hover:scale-105"
        title="新建 Prompt"
      >
        <img
          src="/avatar.png"
          alt="星语"
          className="h-full w-full object-cover"
        />
      </button>

      {/* 分隔线 */}
      <div
        className="my-1.5 h-px w-6"
        style={{ backgroundColor: DESIGN_TOKENS.border }}
      />

      {/* 添加节点 (+) 按钮（主干版新增） */}
      <button
        onClick={onToggleAddNodePanel || (() => {})}
        className="flex h-10 w-10 items-center justify-center rounded-full transition-all hover:scale-105"
        style={{
          backgroundColor: isAddNodePanelOpen
            ? DESIGN_TOKENS.accentSoftHover
            : DESIGN_TOKENS.accentSoft,
          color: isAddNodePanelOpen
            ? DESIGN_TOKENS.accentHover
            : DESIGN_TOKENS.accent,
        }}
        title="添加节点"
      >
        <Plus size={20} strokeWidth={2} />
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
