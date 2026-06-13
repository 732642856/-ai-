// ============================================================================
// SlashCommandMenu — TapNow-inspired slash command palette
// ============================================================================
"use client"

import { useMemo, useState, useRef, useEffect, type KeyboardEvent } from "react"
import {
  Pencil,
  Text,
  Image,
  Video,
  List,
  FileText,
  Wand2,
  Copy,
  Trash2,
  FolderHeart,
  Sparkles,
  LayoutGrid,
  Camera,
  Music,
  Sun,
  Bot,
  type LucideIcon,
} from "lucide-react"
import {
  SLASH_COMMANDS as ALL_COMMANDS,
  type SlashCommand,
  type SlashCommandCategory,
  type SlashCommandGroup,
} from "@/lib/slashCommands/slashCommands"
import { DESIGN_TOKENS, ICON_CONFIG } from "../../styles/designSystem"

// ============================================================================
// Icon mapping
// ============================================================================

const ICON_MAP: Record<string, LucideIcon> = {
  Pencil,
  Text,
  Image,
  Video,
  List,
  FileText,
  Wand2,
  Copy,
  Trash2,
  FolderHeart,
  Sparkles,
  LayoutGrid,
  Camera,
  Music,
  Sun,
  Bot,
}

// ============================================================================
// Category labels
// ============================================================================

const CATEGORY_LABELS: Record<SlashCommandCategory, string> = {
  generation: "AI 生成",
  editing: "文本编辑",
  canvas: "画布操作",
  storyboard: "分镜创作",
  asset: "资产管理",
  workflow: "工作流",
}

function getCommandCategory(command: SlashCommand): SlashCommandCategory {
  if (command.category) return command.category
  if (command.targets.includes("canvas")) return "canvas"
  if (command.targets.includes("video")) return "workflow"
  if (command.targets.includes("shot") && !command.targets.includes("text")) return "generation"
  if (command.id.includes("storyboard") || command.id.includes("shot")) return "storyboard"
  return "editing"
}

function getCommandIcon(command: SlashCommand): string {
  if (command.icon) return command.icon
  if (command.targets.includes("video")) return "Video"
  if (command.targets.includes("image")) return "Image"
  if (command.targets.includes("canvas")) return "LayoutGrid"
  if (command.id.includes("storyboard")) return "List"
  return "FileText"
}

// ============================================================================
// Component
// ============================================================================

interface SlashCommandMenuProps {
  /** Current filter text (what the user typed after "/") */
  query: string
  /** Currently selected node(s) — used to filter commands by minSelection */
  selectedCount: number
  /** Called when a command is selected */
  onSelect: (command: SlashCommand) => void
  /** Called when menu should close (Escape, etc.) */
  onClose: () => void
}

export function SlashCommandMenu({
  query,
  selectedCount,
  onSelect,
  onClose,
}: SlashCommandMenuProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Filter commands by query + selection requirements
  const filteredGroups = useMemo<SlashCommandGroup[]>(() => {
    const q = query.toLowerCase().trim()
    const matched = ALL_COMMANDS.filter((cmd) => {
      // Chat 面板只显示对全局入口有意义的命令：文本、分镜、画布、视频流水线。
      if (!cmd.targets.some((target) => ["text", "shot", "canvas", "video"].includes(target))) return false
      if ((cmd.minSelection ?? 0) > selectedCount) return false
      if (!q) return true
      return (
        cmd.label.toLowerCase().includes(q) ||
        cmd.id.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q)
      )
    })

    // Group by category
    const groupMap = new Map<string, SlashCommand[]>()
    for (const cmd of matched) {
      const cat = getCommandCategory(cmd)
      if (!groupMap.has(cat)) groupMap.set(cat, [])
      groupMap.get(cat)!.push(cmd)
    }

    return Array.from(groupMap.entries()).map(([cat, cmds]) => ({
      category: cat as SlashCommandCategory,
      label: CATEGORY_LABELS[cat as SlashCommandCategory] ?? cat,
      commands: cmds,
    }))
  }, [query, selectedCount])

  // Flatten for keyboard navigation
  const flatCommands = useMemo(() => {
    return filteredGroups.flatMap((g) => g.commands)
  }, [filteredGroups])

  // Reset active index when filter changes
  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  // Scroll active item into view
  useEffect(() => {
    const el = itemRefs.current[activeIndex]
    if (el) {
      el.scrollIntoView({ block: "nearest" })
    }
  }, [activeIndex])

  // Keyboard handling (from ChatInput — events bubble here)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, flatCommands.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === "Enter") {
        e.preventDefault()
        if (flatCommands[activeIndex]) {
          onSelect(flatCommands[activeIndex])
        }
      } else if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }
    }
    // Use capture to intercept before ChatInput handles
    document.addEventListener("keydown", handler as any, true)
    return () => document.removeEventListener("keydown", handler as any, true)
  }, [flatCommands, activeIndex, onSelect, onClose])

  // Update itemRefs array length
  itemRefs.current = []
  const registerRef = (el: HTMLButtonElement | null, idx: number) => {
    itemRefs.current[idx] = el
  }

  if (flatCommands.length === 0) return null

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 z-[80] mb-3 max-h-[260px] w-[min(22rem,calc(100vw-3rem))] overflow-y-auto rounded-xl border p-1 shadow-2xl"
      style={{
        backgroundColor: "rgba(21, 21, 27, 0.98)",
        borderColor: DESIGN_TOKENS.borderStrong,
        boxShadow: "0 24px 70px rgba(0,0,0,0.72)",
      }}
      onMouseDown={(e) => e.preventDefault()} // prevent input blur
    >
      {filteredGroups.map((group) => (
        <div key={group.category}>
          {/* Category header */}
          <div
            className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: DESIGN_TOKENS.textMuted }}
          >
            {group.label}
          </div>
          {/* Commands in this group */}
          {group.commands.map((cmd, i) => {
            const globalIdx = flatCommands.indexOf(cmd)
            const isActive = globalIdx === activeIndex
            const Icon = ICON_MAP[getCommandIcon(cmd)] ?? FileText
            return (
              <button
                key={cmd.id}
                ref={(el) => registerRef(el, globalIdx)}
                onClick={() => onSelect(cmd)}
                onMouseEnter={() => setActiveIndex(globalIdx)}
                className="w-full rounded-lg px-3 py-2 text-left transition-colors"
                style={{
                  backgroundColor: isActive ? DESIGN_TOKENS.accentSoft : "transparent",
                  color: isActive ? DESIGN_TOKENS.accent : DESIGN_TOKENS.textPrimary,
                }}
              >
                <div className="flex items-center gap-2">
                  <Icon
                    size={16}
                    strokeWidth={1.5}
                    style={{ color: isActive ? DESIGN_TOKENS.accent : DESIGN_TOKENS.textMuted }}
                  />
                  <span className="text-sm font-medium">{cmd.label}</span>
                  {cmd.isCostly && (
                    <span
                      className="ml-auto rounded bg-amber-500/20 px-1 text-[9px] font-bold text-amber-400"
                    >
                      Cost
                    </span>
                  )}
                </div>
                <div
                  className="mt-0.5 text-xs pl-6"
                  style={{ color: DESIGN_TOKENS.textMuted }}
                >
                  {cmd.description}
                </div>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
