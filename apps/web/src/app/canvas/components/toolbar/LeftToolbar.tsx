/**
 * LeftToolbar - 左侧胶囊工具栏
 * - "+" 按钮打开 AddNodePanel（TapNow 风格侧面板）
 * - 底部保留素材库、聊天、用户
 */

import { Plus, Library, MessageCircle, Clock3 } from "lucide-react"
import { DESIGN_TOKENS, ICON_CONFIG } from "../../styles/designSystem"

interface LeftToolbarProps {
  onOpenAssetLibrary: () => void
  onToggleAddNodePanel: () => void
  isAddNodePanelOpen: boolean
  onToggleChat: () => void
  isChatOpen: boolean
  onOpenWorkspaceHistory?: () => void
  onOpenUserMenu: () => void
}

export function LeftToolbar({
  onOpenAssetLibrary,
  onToggleAddNodePanel,
  isAddNodePanelOpen,
  onToggleChat,
  isChatOpen,
  onOpenWorkspaceHistory,
  onOpenUserMenu,
}: LeftToolbarProps) {
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
      {/* 添加节点 (+) 按钮 */}
      <button
        onClick={onToggleAddNodePanel}
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

      {/* 素材库 */}
      <button
        onClick={onOpenAssetLibrary}
        className="flex h-9 w-9 items-center justify-center rounded-full transition-all hover:bg-white/10"
        style={{ color: DESIGN_TOKENS.textMuted }}
        title="素材库"
      >
        <Library size={ICON_CONFIG.size} strokeWidth={ICON_CONFIG.strokeWidth} />
      </button>

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
          backgroundColor: isChatOpen ? DESIGN_TOKENS.accentSoft : "transparent",
        }}
        title={isChatOpen ? "关闭聊天" : "打开聊天"}
      >
        <MessageCircle size={ICON_CONFIG.size} strokeWidth={ICON_CONFIG.strokeWidth} />
      </button>

      {/* 工作记录 */}
      <button
        onClick={onOpenWorkspaceHistory}
        className="flex h-9 w-9 items-center justify-center rounded-full transition-all hover:bg-white/10"
        style={{ color: DESIGN_TOKENS.textMuted }}
        title="工作记录"
      >
        <Clock3 size={ICON_CONFIG.size} strokeWidth={ICON_CONFIG.strokeWidth} />
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
