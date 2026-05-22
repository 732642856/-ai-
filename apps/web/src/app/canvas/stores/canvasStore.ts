// ============================================================================
// Canvas Store - Zustand state management for the canvas
// ============================================================================
import { create } from 'zustand'
import { addEdge, type Connection, type Edge, type Node, type Viewport } from '@xyflow/react'
import type {
  CanvasNodeKind,
  ChatMode,
  RightPanelMode,
  ContextMenuState,
  FloatingToolbarState,
  AssetFolder,
  AssetType,
  AssetItem,
  AssetLibraryState,
} from '../components/canvas/types'

// Re-export types for backward compatibility
export type { CanvasNodeKind, ChatMode, RightPanelMode, ContextMenuState, FloatingToolbarState, AssetFolder, AssetType, AssetItem, AssetLibraryState }

// Default viewport settings
export const DEFAULT_VIEWPORT: Viewport = {
  x: 0,
  y: 0,
  zoom: 0.85,
}

export const VIEWPORT_CONSTRAINTS = {
  minZoom: 0.25,
  maxZoom: 2,
  fitViewPadding: 0.3,
}

interface CanvasStore {
  // Viewport
  viewport: Viewport
  setViewport: (viewport: Viewport) => void
  fitViewOnce: boolean
  setFitViewOnce: (value: boolean) => void

  // Selection
  selectedNodeId: string | null
  setSelectedNodeId: (id: string | null) => void

  // Context Menu
  contextMenu: ContextMenuState
  setContextMenu: (state: ContextMenuState) => void
  closeContextMenu: () => void

  // Floating Toolbar
  floatingToolbar: FloatingToolbarState
  setFloatingToolbar: (state: FloatingToolbarState) => void
  closeFloatingToolbar: () => void

  // Asset Library
  assetLibrary: AssetLibraryState
  openAssetLibrary: () => void
  closeAssetLibrary: () => void
  setAssetLibraryQuery: (query: string) => void
  setAssetLibraryFolder: (folder: AssetFolder | undefined) => void
  addAsset: (asset: AssetItem) => void
  removeAsset: (id: string) => void
  toggleAssetFavorite: (id: string) => void

  // Clipboard
  clipboardNode: Node | null
  setClipboardNode: (node: Node | null) => void

  // Image Preview
  previewImageNodeId: string | null
  setPreviewImageNodeId: (id: string | null) => void

  // Crop Dialog
  cropImageNodeId: string | null
  setCropImageNodeId: (id: string | null) => void

  // Empty state hint
  showCanvasHint: boolean
  dismissCanvasHint: () => void

  // Canvas persistence
  isCanvasRestored: boolean
  setIsCanvasRestored: (value: boolean) => void
  clearPersistedCanvas: () => void

  // AI auto-run safety
  allowAIAutoRun: boolean
  setAllowAIAutoRun: (value: boolean) => void
}

export const useCanvasStore = create<CanvasStore>((set) => ({
  // Viewport
  viewport: DEFAULT_VIEWPORT,
  setViewport: (viewport) => set({ viewport }),
  fitViewOnce: true,
  setFitViewOnce: (value) => set({ fitViewOnce: value }),

  // Selection
  selectedNodeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  // Context Menu
  contextMenu: null,
  setContextMenu: (state) => set({ contextMenu: state }),
  closeContextMenu: () => set({ contextMenu: null }),

  // Floating Toolbar
  floatingToolbar: null,
  setFloatingToolbar: (state) => set({ floatingToolbar: state }),
  closeFloatingToolbar: () => set({ floatingToolbar: null }),

  // Asset Library
  assetLibrary: {
    isOpen: false,
    scope: 'personal',
    query: '',
    assets: [],
  },
  openAssetLibrary: () => set((state) => ({
    assetLibrary: { ...state.assetLibrary, isOpen: true }
  })),
  closeAssetLibrary: () => set((state) => ({
    assetLibrary: { ...state.assetLibrary, isOpen: false }
  })),
  setAssetLibraryQuery: (query) => set((state) => ({
    assetLibrary: { ...state.assetLibrary, query }
  })),
  setAssetLibraryFolder: (folder) => set((state) => ({
    assetLibrary: { ...state.assetLibrary, selectedFolder: folder }
  })),
  addAsset: (asset) => set((state) => {
    const newAssets = [...state.assetLibrary.assets, asset]
    if (typeof window !== 'undefined') {
      localStorage.setItem('startrails_assets', JSON.stringify(newAssets))
    }
    return { assetLibrary: { ...state.assetLibrary, assets: newAssets } }
  }),
  removeAsset: (id) => set((state) => {
    const newAssets = state.assetLibrary.assets.filter((a) => a.id !== id)
    if (typeof window !== 'undefined') {
      localStorage.setItem('startrails_assets', JSON.stringify(newAssets))
    }
    return { assetLibrary: { ...state.assetLibrary, assets: newAssets } }
  }),
  toggleAssetFavorite: (id) => set((state) => {
    const newAssets = state.assetLibrary.assets.map((a) =>
      a.id === id ? { ...a, favorite: !a.favorite } : a
    )
    if (typeof window !== 'undefined') {
      localStorage.setItem('startrails_assets', JSON.stringify(newAssets))
    }
    return { assetLibrary: { ...state.assetLibrary, assets: newAssets } }
  }),

  // Clipboard
  clipboardNode: null,
  setClipboardNode: (node) => set({ clipboardNode: node }),

  // Image Preview
  previewImageNodeId: null,
  setPreviewImageNodeId: (id) => set({ previewImageNodeId: id }),

  // Crop Dialog
  cropImageNodeId: null,
  setCropImageNodeId: (id) => set({ cropImageNodeId: id }),

  // Empty state hint
  showCanvasHint: true,
  dismissCanvasHint: () => set({ showCanvasHint: false }),

  // Canvas persistence
  isCanvasRestored: false,
  setIsCanvasRestored: (value) => set({ isCanvasRestored: value }),
  clearPersistedCanvas: () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("startrails_canvas")
      }
    } catch {
      // ignore
    }
  },

  // AI auto-run safety (default: require manual confirmation)
  allowAIAutoRun: (() => {
    try {
      if (typeof window !== "undefined") {
        return localStorage.getItem("startrails_ai_auto_run") === "true"
      }
    } catch {}
    return false
  })(),
  setAllowAIAutoRun: (value) => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("startrails_ai_auto_run", String(value))
      }
    } catch {}
    set({ allowAIAutoRun: value })
  },
}))
