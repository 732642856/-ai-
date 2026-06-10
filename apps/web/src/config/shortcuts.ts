/**
 * StarCanvas 快捷键配置
 * 提取自 Excalidraw (MIT License) 并适配 StarCanvas 画布场景
 * Copyright (c) 2020 Excalidraw, Inc.
 */

const isDarwin = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform)

export const getShortcutKey = (shortcut: string): string =>
  shortcut
    .replace(/\b(Opt(?:ion)?|Alt)\b/i, isDarwin ? "Option" : "Alt")
    .replace(/\bShift\b/i, "Shift")
    .replace(/\b(Enter|Return)\b/i, "Enter")
    .replace(/\b(Ctrl|Cmd|Command|CtrlOrCmd)\b/gi, isDarwin ? "Cmd" : "Ctrl")

export type ShortcutAction =
  | "undo"
  | "redo"
  | "cut"
  | "copy"
  | "paste"
  | "selectAll"
  | "deleteSelected"
  | "duplicateSelection"
  | "group"
  | "ungroup"
  | "zoomIn"
  | "zoomOut"
  | "zoomToFit"
  | "resetZoom"
  | "toggleChat"
  | "toggleAssetLibrary"
  | "toggleSettings"
  | "searchNodes"
  | "commandPalette"

const shortcutMap: Record<ShortcutAction, string[]> = {
  undo: ["CtrlOrCmd+Z"],
  redo: ["CtrlOrCmd+Shift+Z"],
  cut: ["CtrlOrCmd+X"],
  copy: ["CtrlOrCmd+C"],
  paste: ["CtrlOrCmd+V"],
  selectAll: ["CtrlOrCmd+A"],
  deleteSelected: ["Delete", "Backspace"],
  duplicateSelection: ["CtrlOrCmd+D"],
  group: ["CtrlOrCmd+G"],
  ungroup: ["CtrlOrCmd+Shift+G"],
  zoomIn: ["CtrlOrCmd++", "CtrlOrCmd+="],
  zoomOut: ["CtrlOrCmd+-"],
  zoomToFit: ["Shift+1"],
  resetZoom: ["CtrlOrCmd+0"],
  toggleChat: ["CtrlOrCmd+Shift+C"],
  toggleAssetLibrary: ["CtrlOrCmd+Shift+A"],
  toggleSettings: ["CtrlOrCmd+,"],
  searchNodes: ["CtrlOrCmd+F"],
  commandPalette: ["CtrlOrCmd+K", "CtrlOrCmd+/"],
}

const resolvedShortcutMap = new Map<ShortcutAction, string[]>()

export function getShortcut(action: ShortcutAction, index = 0): string {
  if (!resolvedShortcutMap.has(action)) {
    resolvedShortcutMap.set(action, (shortcutMap[action] ?? []).map(getShortcutKey))
  }
  const shortcuts = resolvedShortcutMap.get(action)!
  return shortcuts[index] || shortcuts[0] || ""
}

export function matchesShortcut(
  event: KeyboardEvent,
  action: ShortcutAction,
): boolean {
  const shortcuts = shortcutMap[action]
  if (!shortcuts) return false

  return shortcuts.some((shortcut) => {
    const parts = shortcut.split("+").map((p) => p.trim())
    const modifiers = new Set(parts.filter((p) => p !== parts[parts.length - 1]))
    const key = parts[parts.length - 1].toLowerCase()

    const ctrlOrCmd = event.ctrlKey || event.metaKey
    const shift = event.shiftKey
    const alt = event.altKey
    const eventKey = event.key.toLowerCase()

    if (eventKey !== key) return false
    if (modifiers.has("CtrlOrCmd") && !ctrlOrCmd) return false
    if (modifiers.has("Shift") && !shift) return false
    if ((modifiers.has("Alt") || modifiers.has("Option")) && !alt) return false

    // Check for unexpected modifiers
    if (!modifiers.has("CtrlOrCmd") && ctrlOrCmd) return false
    if (!modifiers.has("Shift") && shift) return false
    if (!modifiers.has("Alt") && !modifiers.has("Option") && alt) return false

    return true
  })
}
