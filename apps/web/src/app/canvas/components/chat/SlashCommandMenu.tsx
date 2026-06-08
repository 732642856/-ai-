// ============================================================================
// SlashCommandMenu — TapNow-inspired slash command palette
// ============================================================================
"use client"

import { useMemo, useState, useRef, useEffect, type KeyboardEvent } from "react"
import { createPortal } from "react-dom"
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
  type LucideIcon,
} from "lucide-react"
import type { SlashCommand, SlashCommandCategory, SlashCommandGroup } from "../../types/slash-commands"
import { DESIGN_TOKENS, ICON_CONFIG } from "../../styles/designSystem"

// ============================================================================
// Command Definitions — Master List
// ============================================================================

const ALL_COMMANDS: SlashCommand[] = [
  // --- Generation ---
  {
    id: "生成文本",
    label: "生成文本",
    description: "基于选中节点或提示词生成文本内容",
    icon: "FileText",
    category: "generation",
    modelType: "text",
  },
  {
    id: "生成图片",
    label: "生成图片",
    description: "根据文本或图片生成 AI 图片",
    icon: "Image",
    category: "generation",
    modelType: "image",
  },
  {
    id: "生成视频",
    label: "生成视频",
    description: "根据图片或文本生成视频（高成本）",
    icon: "Video",
    category: "generation",
    modelType: "video",
    isCostly: true,
  },
  {
    id: "生成分镜",
    label: "生成分镜",
    description: "根据文本/脚本自动生成分镜镜头序列",
    icon: "LayoutGrid",
    category: "storyboard",
    modelType: "text",
  },
  {
    id: "生成镜头表",
    label: "生成镜头表",
    description: "将分镜整理为 Shot List 表格",
    icon: "List",
    category: "storyboard",
    modelType: "text",
  },
  {
    id: "生成角色",
    label: "生成角色",
    description: "创建角色设定节点",
    icon: "Sparkles",
    category: "generation",
    modelType: "text",
  },
  {
    id: "生成场景",
    label: "生成场景",
    description: "创建场景设定节点",
    icon: "Sun",
    category: "generation",
    modelType: "text",
  },
  {
    id: "生成提示词",
    label: "生成提示词",
    description: "为当前节点内容生成优化后的 AI 提示词",
    icon: "Wand2",
    category: "generation",
    modelType: "text",
  },
  {
    id: "生成摄影方案",
    label: "生成摄影方案",
    description: "根据场景/分镜生成机位、焦段、光线方案",
    icon: "Camera",
    category: "storyboard",
    modelType: "text",
  },

  // --- Editing ---
  {
    id: "扩写",
    label: "扩写",
    description: "基于选中节点内容扩展写作",
    icon: "Pencil",
    category: "editing",
    modelType: "text",
  },
  {
    id: "总结",
    label: "总结",
    description: "总结选中节点内容",
    icon: "FileText",
    category: "editing",
    modelType: "text",
  },
  {
    id: "改写",
    label: "改写",
    description: "用不同风格重新表述选中内容",
    icon: "Pencil",
    category: "editing",
    modelType: "text",
  },
  {
    id: "翻译",
    label: "翻译",
    description: "将选中内容翻译为目标语言",
    icon: "Text",
    category: "editing",
    modelType: "text",
  },
  {
    id: "拆分为节点",
    label: "拆分为节点",
    description: "将长文本拆分为多个子节点",
    icon: "LayoutGrid",
    category: "canvas",
    modelType: "text",
  },

  // --- Canvas Operations ---
  {
    id: "保存为资产",
    label: "保存为资产",
    description: "将选中节点保存到资产库",
    icon: "FolderHeart",
    category: "asset",
    modelType: "none",
    minSelection: 1,
  },
  {
    id: "合并节点",
    label: "合并节点",
    description: "将多个选中节点合并为一个",
    icon: "Copy",
    category: "canvas",
    modelType: "none",
    minSelection: 2,
  },
  {
    id: "删除节点",
    label: "删除节点",
    description: "删除选中节点（不可撤销）",
    icon: "Trash2",
    category: "canvas",
    modelType: "none",
    minSelection: 1,
  },
  {
    id: "自动布局",
    label: "自动布局",
    description: "自动排列选中节点或全画布节点",
    icon: "LayoutGrid",
    category: "canvas",
    modelType: "none",
  },
]

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
  /** Position (relative to the ChatInput textarea) */
  position: { top: number; left: number }
}

export function SlashCommandMenu({
  query,
  selectedCount,
  onSelect,
  onClose,
  position,
}: SlashCommandMenuProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Filter commands by query + selection requirements
  const filteredGroups = useMemo<SlashCommandGroup[]>(() => {
    const q = query.toLowerCase().trim()
    const matched = ALL_COMMANDS.filter((cmd) => {
      // Filter by selection requirement
      if ((cmd.minSelection ?? 0) > selectedCount) return false
      // Filter by query
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
      const cat = cmd.category
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

  return createPortal(
    <div
      ref={listRef}
      className="fixed z-50 max-h-80 w-72 overflow-y-auto rounded-xl border p-1 shadow-2xl"
      style={{
        top: position.top,
        left: position.left,
        backgroundColor: DESIGN_TOKENS.surfaceAlt,
        borderColor: DESIGN_TOKENS.border,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
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
            const Icon = ICON_MAP[cmd.icon] ?? FileText
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
    </div>,
    document.body
  )
}
