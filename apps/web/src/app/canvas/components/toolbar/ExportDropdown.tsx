"use client"

// ============================================================================
// ExportDropdown — 导出操作下拉菜单
// 合并 8 个导出按钮为一个紧凑下拉
// ============================================================================

import { useCallback, useRef, useState } from "react"
import { Download, BookOpen, Printer, FileText, Table2, Subtitles, Clapperboard, ChevronDown, Film, type LucideIcon } from "lucide-react"
import { DESIGN_TOKENS } from "../../styles/designSystem"

export interface ExportActions {
  onExportProjectPackage: () => void
  onExportStoryboardPdf: () => void
  onPrintStoryboardPdf: () => void
  onExportScreenplay: () => void
  onExportStoryboardCsv: () => void
  onExportCharacterCsv: () => void
  onExportSubtitles: () => void
  onExportCompositionScript: () => void
  onExportToJianyingDraft: () => void
  onExportJianyingCompatible: () => void
}

export function ExportDropdown(actions: ExportActions) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const items: Array<{ icon: LucideIcon; label: string; action: () => void; shortcut: string } | { separator: true }> = [
    { icon: Download, label: "导出项目包", action: actions.onExportProjectPackage, shortcut: "" },
    { icon: BookOpen, label: "导出分镜本", action: actions.onExportStoryboardPdf, shortcut: "" },
    { icon: Printer, label: "打印 PDF", action: actions.onPrintStoryboardPdf, shortcut: "" },
    { icon: FileText, label: "剧本", action: actions.onExportScreenplay, shortcut: "" },
    { icon: Table2, label: "分镜表", action: actions.onExportStoryboardCsv, shortcut: "" },
    { icon: Table2, label: "角色表", action: actions.onExportCharacterCsv, shortcut: "" },
    { icon: Subtitles, label: "字幕", action: actions.onExportSubtitles, shortcut: "" },
    { icon: Clapperboard, label: "合成", action: actions.onExportCompositionScript, shortcut: "" },
    { separator: true },
    { icon: Film, label: "剪映草稿 (JSON)", action: actions.onExportToJianyingDraft, shortcut: "" },
    { icon: Film, label: "剪映兼容包 (ZIP)", action: actions.onExportJianyingCompatible, shortcut: "" },
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
        title="导出各类项目文件"
        data-testid="export-dropdown-toggle"
      >
        <Download size={14} strokeWidth={1.7} />
        <span>导出</span>
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
          {items.map((item, i) => {
            // 渲染分隔线
            if ("separator" in item) {
              return (
                <div
                  key={`sep-${i}`}
                  className="my-1 mx-2 h-px"
                  style={{ backgroundColor: DESIGN_TOKENS.border }}
                />
              );
            }
            // 常规菜单项
            return (
              <button
                key={item.label}
                type="button"
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs transition hover:bg-white/10"
                style={{ color: DESIGN_TOKENS.textSecondary }}
                onClick={() => { item.action(); close() }}
              >
                <item.icon size={13} strokeWidth={1.7} style={{ color: DESIGN_TOKENS.accent }} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  )
}

export default ExportDropdown
