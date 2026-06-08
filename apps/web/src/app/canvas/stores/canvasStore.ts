// ============================================================================
// Canvas Store - Zustand state management for the canvas
// ============================================================================
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
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
  CharacterBibleData,
  SceneBibleData,
  VisualStyleBibleData,
} from '../components/canvas/types'
import {
  getPersistedFlag,
  setPersistedFlag,
  persistState,
  clearPersistedState,
} from '../../../lib/localStoragePersist'

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

const ASSETS_STORAGE_KEY = 'startrails_assets'
const AI_AUTO_RUN_KEY = 'startrails_ai_auto_run'
const CANVAS_STORAGE_KEY = 'startrails_canvas'

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

  // Prompt Preview panel
  showPromptPreview: boolean
  promptPreviewNodeId: string | null
  openPromptPreview: (nodeId: string) => void
  closePromptPreview: () => void

  // AI auto-run safety
  allowAIAutoRun: boolean
  setAllowAIAutoRun: (value: boolean) => void

  // === Bible System ===
  bibleCharacters: CharacterBibleData[]
  selectedBibleCharacterId: string | null
  biblePanelOpen: boolean
  openBiblePanel: () => void
  closeBiblePanel: () => void
  addBibleCharacter: (character: CharacterBibleData) => void
  updateBibleCharacter: (id: string, data: Partial<CharacterBibleData>) => void
  removeBibleCharacter: (id: string) => void
  selectBibleCharacter: (id: string | null) => void

  bibleScenes: SceneBibleData[]
  sceneBiblePanelOpen: boolean
  openSceneBiblePanel: () => void
  closeSceneBiblePanel: () => void
  addBibleScene: (scene: SceneBibleData) => void
  updateBibleScene: (id: string, data: Partial<SceneBibleData>) => void
  removeBibleScene: (id: string) => void

  bibleStyles: VisualStyleBibleData[]
  styleBiblePanelOpen: boolean
  openStyleBiblePanel: () => void
  closeStyleBiblePanel: () => void
  addBibleStyle: (style: VisualStyleBibleData) => void
  updateBibleStyle: (id: string, data: Partial<VisualStyleBibleData>) => void
  removeBibleStyle: (id: string) => void

  // Storyboard Shot Editor
  shotEditorOpen: boolean
  shotEditorNodeId: string | null
  shotEditorRawContent: string
  shotEditorNodePrompt: string
  openShotEditor: (nodeId: string, rawContent: string, nodePrompt: string) => void
  closeShotEditor: () => void
}

// Shared helper for persisting asset library
function persistAssets(assets: AssetItem[]): void {
  persistState({ key: ASSETS_STORAGE_KEY, version: 1 }, assets)
}

// Initial asset state — load once at module level
const initialAllowAIAutoRun = getPersistedFlag(AI_AUTO_RUN_KEY, 'false') === 'true'

export const useCanvasStore = create<CanvasStore>()(
  devtools(
    (set) => ({
      // Viewport
      viewport: DEFAULT_VIEWPORT,
      setViewport: (viewport) => set({ viewport }, false, 'setViewport'),
      fitViewOnce: true,
      setFitViewOnce: (value) => set({ fitViewOnce: value }, false, 'setFitViewOnce'),

      // Selection
      selectedNodeId: null,
      setSelectedNodeId: (id) => set({ selectedNodeId: id }, false, 'setSelectedNodeId'),

      // Context Menu
      contextMenu: null,
      setContextMenu: (state) => set({ contextMenu: state }, false, 'setContextMenu'),
      closeContextMenu: () => set({ contextMenu: null }, false, 'closeContextMenu'),

      // Floating Toolbar
      floatingToolbar: null,
      setFloatingToolbar: (state) => set({ floatingToolbar: state }, false, 'setFloatingToolbar'),
      closeFloatingToolbar: () => set({ floatingToolbar: null }, false, 'closeFloatingToolbar'),

      // Asset Library
      assetLibrary: {
        isOpen: false,
        scope: 'personal',
        query: '',
        assets: [],
      },
      openAssetLibrary: () => set((state) => ({
        assetLibrary: { ...state.assetLibrary, isOpen: true }
      }), false, 'openAssetLibrary'),
      closeAssetLibrary: () => set((state) => ({
        assetLibrary: { ...state.assetLibrary, isOpen: false }
      }), false, 'closeAssetLibrary'),
      setAssetLibraryQuery: (query) => set((state) => ({
        assetLibrary: { ...state.assetLibrary, query }
      }), false, 'setAssetLibraryQuery'),
      setAssetLibraryFolder: (folder) => set((state) => ({
        assetLibrary: { ...state.assetLibrary, selectedFolder: folder }
      }), false, 'setAssetLibraryFolder'),
      addAsset: (asset) => set((state) => {
        const newAssets = [...state.assetLibrary.assets, asset]
        persistAssets(newAssets)
        return { assetLibrary: { ...state.assetLibrary, assets: newAssets } }
      }, false, 'addAsset'),
      removeAsset: (id) => set((state) => {
        const newAssets = state.assetLibrary.assets.filter((a) => a.id !== id)
        persistAssets(newAssets)
        return { assetLibrary: { ...state.assetLibrary, assets: newAssets } }
      }, false, 'removeAsset'),
      toggleAssetFavorite: (id) => set((state) => {
        const newAssets = state.assetLibrary.assets.map((a) =>
          a.id === id ? { ...a, favorite: !a.favorite } : a
        )
        persistAssets(newAssets)
        return { assetLibrary: { ...state.assetLibrary, assets: newAssets } }
      }, false, 'toggleAssetFavorite'),

      // Clipboard
      clipboardNode: null,
      setClipboardNode: (node) => set({ clipboardNode: node }, false, 'setClipboardNode'),

      // Image Preview
      previewImageNodeId: null,
      setPreviewImageNodeId: (id) => set({ previewImageNodeId: id }, false, 'setPreviewImageNodeId'),

      // Crop Dialog
      cropImageNodeId: null,
      setCropImageNodeId: (id) => set({ cropImageNodeId: id }, false, 'setCropImageNodeId'),

      // Empty state hint
      showCanvasHint: true,
      dismissCanvasHint: () => set({ showCanvasHint: false }, false, 'dismissCanvasHint'),

      // Canvas persistence
      isCanvasRestored: false,
      setIsCanvasRestored: (value) => set({ isCanvasRestored: value }, false, 'setIsCanvasRestored'),
      clearPersistedCanvas: () => {
        clearPersistedState(CANVAS_STORAGE_KEY)
      },

      // Prompt Preview panel
      showPromptPreview: false,
      promptPreviewNodeId: null,
      openPromptPreview: (nodeId) => set(
        { showPromptPreview: true, promptPreviewNodeId: nodeId },
        false,
        'openPromptPreview',
      ),
      closePromptPreview: () => set(
        { showPromptPreview: false, promptPreviewNodeId: null },
        false,
        'closePromptPreview',
      ),

      // AI auto-run safety (default: require manual confirmation)
      allowAIAutoRun: initialAllowAIAutoRun,
      setAllowAIAutoRun: (value) => {
        setPersistedFlag(AI_AUTO_RUN_KEY, String(value))
        set({ allowAIAutoRun: value }, false, 'setAllowAIAutoRun')
      },

      // === Bible System ===
      bibleCharacters: [],
      selectedBibleCharacterId: null,
      biblePanelOpen: false,
      openBiblePanel: () => set({ biblePanelOpen: true }, false, 'openBiblePanel'),
      closeBiblePanel: () => set({ biblePanelOpen: false, selectedBibleCharacterId: null }, false, 'closeBiblePanel'),
      addBibleCharacter: (character) => set((state) => ({
        bibleCharacters: [...state.bibleCharacters, character],
        selectedBibleCharacterId: character.id,
      }), false, 'addBibleCharacter'),
      updateBibleCharacter: (id, data) => set((state) => ({
        bibleCharacters: state.bibleCharacters.map((c) => (c.id === id ? { ...c, ...data } : c)),
      }), false, 'updateBibleCharacter'),
      removeBibleCharacter: (id) => set((state) => ({
        bibleCharacters: state.bibleCharacters.filter((c) => c.id !== id),
        selectedBibleCharacterId: state.selectedBibleCharacterId === id ? null : state.selectedBibleCharacterId,
      }), false, 'removeBibleCharacter'),
      selectBibleCharacter: (id) => set({ selectedBibleCharacterId: id }, false, 'selectBibleCharacter'),

      bibleScenes: [],
      sceneBiblePanelOpen: false,
      openSceneBiblePanel: () => set({ sceneBiblePanelOpen: true }, false, 'openSceneBiblePanel'),
      closeSceneBiblePanel: () => set({ sceneBiblePanelOpen: false }, false, 'closeSceneBiblePanel'),
      addBibleScene: (scene) => set((state) => ({ bibleScenes: [...state.bibleScenes, scene] }), false, 'addBibleScene'),
      updateBibleScene: (id, data) => set((state) => ({
        bibleScenes: state.bibleScenes.map((s) => (s.id === id ? { ...s, ...data } : s)),
      }), false, 'updateBibleScene'),
      removeBibleScene: (id) => set((state) => ({
        bibleScenes: state.bibleScenes.filter((s) => s.id !== id),
      }), false, 'removeBibleScene'),

      bibleStyles: [],
      styleBiblePanelOpen: false,
      openStyleBiblePanel: () => set({ styleBiblePanelOpen: true }, false, 'openStyleBiblePanel'),
      closeStyleBiblePanel: () => set({ styleBiblePanelOpen: false }, false, 'closeStyleBiblePanel'),
      addBibleStyle: (style) => set((state) => ({ bibleStyles: [...state.bibleStyles, style] }), false, 'addBibleStyle'),
      updateBibleStyle: (id, data) => set((state) => ({
        bibleStyles: state.bibleStyles.map((s) => (s.id === id ? { ...s, ...data } : s)),
      }), false, 'updateBibleStyle'),
      removeBibleStyle: (id) => set((state) => ({
        bibleStyles: state.bibleStyles.filter((s) => s.id !== id),
      }), false, 'removeBibleStyle'),

      // Storyboard Shot Editor
      shotEditorOpen: false,
      shotEditorNodeId: null,
      shotEditorRawContent: "",
      shotEditorNodePrompt: "",
      openShotEditor: (nodeId, rawContent, nodePrompt) => set({
        shotEditorOpen: true,
        shotEditorNodeId: nodeId,
        shotEditorRawContent: rawContent,
        shotEditorNodePrompt: nodePrompt,
      }, false, 'openShotEditor'),
      closeShotEditor: () => set({
        shotEditorOpen: false,
        shotEditorNodeId: null,
        shotEditorRawContent: "",
        shotEditorNodePrompt: "",
      }, false, 'closeShotEditor'),
    }),
    { name: 'canvas' },
  ),
)
