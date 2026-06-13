// ============================================================================
// AgentModeSwitcher — Agent 模式切换器 (Ask / Max / Preview)
// ============================================================================
// 对标 TapNow Agent 三种模式 + PLAN.md SECTION 6/9
// Ask: 计划→确认→执行
// Max: 自动执行所有操作
// Preview: 草稿节点→确认→落地
// ============================================================================
"use client"

import { memo } from "react"
import { MessageCircle, Zap, Eye } from "lucide-react"
import { DESIGN_TOKENS } from "../../styles/designSystem"

// ============================================================================
// Types — 对齐 packages/shared/src/types.ts 的 AGENT_MODES
// ============================================================================

export type AgentMode = "ask" | "max" | "preview"

export interface AgentModeOption {
  mode: AgentMode
  label: string
  description: string
  icon: typeof MessageCircle
  color: string
  bgColor: string
}

export const AGENT_MODE_OPTIONS: AgentModeOption[] = [
  {
    mode: "ask",
    label: "Ask",
    description: "AI 先出计划，你确认后再执行",
    icon: MessageCircle,
    color: "#60a5fa",
    bgColor: "rgba(59,130,246,0.12)",
  },
  {
    mode: "max",
    label: "Max",
    description: "AI 自动创建节点、连线、执行所有操作",
    icon: Zap,
    color: "#f59e0b",
    bgColor: "rgba(245,158,11,0.12)",
  },
  {
    mode: "preview",
    label: "Preview",
    description: "AI 生成半透明草稿节点，你确认后落地",
    icon: Eye,
    color: "#a78bfa",
    bgColor: "rgba(167,139,250,0.12)",
  },
]

// ============================================================================
// Component
// ============================================================================

interface AgentModeSwitcherProps {
  activeMode: AgentMode
  onChange: (mode: AgentMode) => void
  disabled?: boolean
}

export const AgentModeSwitcher = memo(function AgentModeSwitcher({
  activeMode,
  onChange,
  disabled = false,
}: AgentModeSwitcherProps) {
  const activeOption = AGENT_MODE_OPTIONS.find((o) => o.mode === activeMode)
  const IconComponent = activeOption?.icon ?? MessageCircle

  return (
    <div className="flex items-center gap-0.5">
      {AGENT_MODE_OPTIONS.map((option) => {
        const isActive = activeMode === option.mode
        const Icon = option.icon

        return (
          <button
            key={option.mode}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.mode)}
            className="flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-medium transition disabled:opacity-40"
            title={`${option.label}: ${option.description}`}
            style={{
              borderColor: isActive ? option.color : DESIGN_TOKENS.border,
              backgroundColor: isActive ? option.bgColor : "rgba(255,255,255,0.03)",
              color: isActive ? option.color : DESIGN_TOKENS.textMuted,
            }}
          >
            <Icon size={10} strokeWidth={2} />
            {option.label}
          </button>
        )
      })}

      {/* 描述文字已移除 — 在 header 内联时不占用额外空间 */}
    </div>
  )
})
