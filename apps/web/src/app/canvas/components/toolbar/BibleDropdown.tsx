"use client"

// ============================================================================
// BibleDropdown — Bible 相关操作下拉菜单
// 合并 Bible / 角色 / 场景 / 风格 / 情绪 5个按钮为一个下拉
// ============================================================================

import { useCallback, useRef, useState } from "react"
import { BookOpen, UserRound, Clapperboard, Palette, TrendingUp, ChevronDown } from "lucide-react"
import { DESIGN_TOKENS } from "../../styles/designSystem"

export interface BibleActions {
  characterLibraryCount: number
  sceneCount: number
  onOpenProjectBible: () => void
  onOpenCharacterBible: () => void
  onOpenSceneBible: () => void
  onOpenStyleBible: () => void
  onToggleEmotionCurve: () => void
}

export function BibleDropdown(actions: BibleActions) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const items = [
    { icon: BookOpen, label: `项目 Bible ${actions.characterLibraryCount}/${actions.sceneCount}`, action: actions.onOpenProjectBible },
    { icon: UserRound, label: "角色设定", action: actions.onOpenCharacterBible },
    { icon: Clapperboard, label: "场景设定", action: actions.onOpenSceneBible },
    { icon: Palette, label: "视觉风格", action: actions.onOpenStyleBible },
    { icon: TrendingUp, label: "情绪曲线", action: actions.onToggleEmotionCurve, divider: true },
  ]

  const toggle = useCallback(() => setOpen((v) => !v), [])
  const close = useCallback(() => setOpen(false), [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        onBlur={(e) => { if (!ref.current?.contains(e.relatedTarget)) close() }}
        className="flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-medium backdrop-blur-xl transition hover:bg-white/10"
        style={{
          borderColor: open ? DESIGN_TOKENS.borderStrong : DESIGN_TOKENS.border,
          backgroundColor: open ? "rgba(255,255,255,0.08)" : "rgba(18,18,24,0.7)",
          color: DESIGN_TOKENS.textSecondary,
        }}
        title="角色、场景、风格设定与情绪曲线"
        data-testid="bible-dropdown-toggle"
      >
        <BookOpen size={14} strokeWidth={1.7} />
        <span>Bible</span>
        <ChevronDown size={11} strokeWidth={2} style={{ color: DESIGN_TOKENS.textMuted }} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1.5 z-50 min-w-[160px] rounded-xl border py-1 shadow-2xl backdrop-blur-xl"
          style={{
            backgroundColor: "rgba(18,18,24,0.96)",
            borderColor: DESIGN_TOKENS.border,
          }}
        >
          {items.map((item, i) => (
            <div key={item.label}>
              {item.divider && i > 0 && (
                <div className="mx-3 my-1 h-px" style={{ backgroundColor: DESIGN_TOKENS.border }} />
              )}
              <button
                type="button"
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs transition hover:bg-white/10"
                style={{ color: DESIGN_TOKENS.textSecondary }}
                onClick={() => { item.action(); close() }}
              >
                <item.icon size={13} strokeWidth={1.7} style={{ color: DESIGN_TOKENS.accent }} />
                <span>{item.label}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default BibleDropdown
