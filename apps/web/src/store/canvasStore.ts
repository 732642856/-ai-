/**
 * StarTrails Canvas Store — Zustand
 *
 * Manages shared canvas/chat state that needs to be accessed across components.
 * Critical shared state: selectedNodeId, floatingMenu, chatMode, rightPanelMode.
 *
 * Design principles:
 * - Store owns ONLY cross-component shared state
 * - React Flow state (nodes, edges) stays with React Flow's own hooks
 * - Components can still use local useState for component-specific state
 *
 * Migration guide:
 * 1. Import from this store instead of useState for shared state
 * 2. Use `useCanvasStore.getState()` for imperative access (outside React components)
 * 3. Node/edge data flows through React Flow's own state management
 */

import { create } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"
import { devtools } from "zustand/middleware"

// ============================================================================
// Types
// ============================================================================

export type ChatMode = "ASK" | "EXECUTE" | "STORYBOARD" | "ORGANIZE" | "IMAGE_PROMPT"

export type RightPanelMode = "chat" | "storyboard" | "asset" | "previs" | "models" | "queue" | "profile"

export type FloatingMenu =
  | { type: "pane"; x: number; y: number }
  | { type: "node"; x: number; y: number; nodeId: string }
  | null

export type RewriteResult = { title: string; prompt: string } | null

export interface CanvasStore {
  // --- Selected Node (shared between Canvas and Chat) ---
  selectedNodeId: string | null
  setSelectedNodeId: (id: string | null) => void

  // --- Floating Menu ---
  floatingMenu: FloatingMenu
  setFloatingMenu: (menu: FloatingMenu) => void
  closeFloatingMenu: () => void

  // --- Chat Mode ---
  chatMode: ChatMode
  setChatMode: (mode: ChatMode) => void

  // --- Right Panel ---
  rightPanelMode: RightPanelMode
  setRightPanelMode: (mode: RightPanelMode) => void

  // --- AI Rewrite Result (shared between Chat and Canvas) ---
  rewriteResult: RewriteResult
  setRewriteResult: (result: RewriteResult) => void
  clearRewriteResult: () => void

  // --- Busy State ---
  isBusy: boolean
  setIsBusy: (busy: boolean) => void

  // --- Status Message ---
  status: string
  setStatus: (status: string) => void
}

// ============================================================================
// Default Values
// ============================================================================

const defaultFloatingMenu: FloatingMenu = null
const defaultRewriteResult: RewriteResult = null
const defaultStatus = "星轨画布已就绪：先在右侧说一句导演意图，再生成分镜 Prompt 或真实图片。"

// ============================================================================
// Store
// ============================================================================

export const useCanvasStore = create<CanvasStore>()(
  devtools(
    subscribeWithSelector((set) => ({
      // Selected Node
      selectedNodeId: null,
      setSelectedNodeId: (id) => set({ selectedNodeId: id }, false, "setSelectedNodeId"),

      // Floating Menu
      floatingMenu: defaultFloatingMenu,
      setFloatingMenu: (menu) => set({ floatingMenu: menu }, false, "setFloatingMenu"),
      closeFloatingMenu: () => set({ floatingMenu: null }, false, "closeFloatingMenu"),

      // Chat Mode
      chatMode: "EXECUTE",
      setChatMode: (mode) => set({ chatMode: mode }, false, "setChatMode"),

      // Right Panel
      rightPanelMode: "chat",
      setRightPanelMode: (mode) => set({ rightPanelMode: mode }, false, "setRightPanelMode"),

      // Rewrite Result
      rewriteResult: defaultRewriteResult,
      setRewriteResult: (result) => set({ rewriteResult: result }, false, "setRewriteResult"),
      clearRewriteResult: () => set({ rewriteResult: null }, false, "clearRewriteResult"),

      // Busy State
      isBusy: false,
      setIsBusy: (busy) => set({ isBusy: busy }, false, "setIsBusy"),

      // Status
      status: defaultStatus,
      setStatus: (status) => set({ status }, false, "setStatus"),
    })),
    { name: "StarTrails Canvas" }
  )
)

// ============================================================================
// Selectors (for optimized re-renders)
// ============================================================================

export const selectSelectedNodeId = (state: CanvasStore) => state.selectedNodeId
export const selectFloatingMenu = (state: CanvasStore) => state.floatingMenu
export const selectChatMode = (state: CanvasStore) => state.chatMode
export const selectRightPanelMode = (state: CanvasStore) => state.rightPanelMode
export const selectRewriteResult = (state: CanvasStore) => state.rewriteResult
export const selectIsBusy = (state: CanvasStore) => state.isBusy
export const selectStatus = (state: CanvasStore) => state.status

// ============================================================================
// Convenience hooks for specific slices
// ============================================================================

/**
 * Use this when you only need selectedNodeId to avoid re-renders
 * from other store changes.
 *
 * const selectedId = useSelectedNodeId()
 */
export const useSelectedNodeId = () => useCanvasStore(selectSelectedNodeId)
export const useFloatingMenu = () => useCanvasStore(selectFloatingMenu)
export const useChatMode = () => useCanvasStore(selectChatMode)
export const useRightPanelMode = () => useCanvasStore(selectRightPanelMode)
export const useRewriteResult = () => useCanvasStore(selectRewriteResult)
export const useIsBusy = () => useCanvasStore(selectIsBusy)
export const useStatus = () => useCanvasStore(selectStatus)
