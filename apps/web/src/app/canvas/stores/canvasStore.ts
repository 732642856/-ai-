// ============================================================================
// Canvas Store - Zustand state management for the canvas
// ============================================================================
import { create } from 'zustand'
import { addEdge, type Connection, type Edge, type Node, type Viewport } from '@xyflow/react'

export type CanvasNodeKind = "text" | "prompt" | "image" | "storyboard" | "reference" | "group" | "previs" | "uploaded-image" | "uploaded-video" | "uploaded-audio" | "uploaded-file" | "image-result" | "text-result"
export type ChatMode = "ASK" | "EXECUTE" | "STORYBOARD" | "ORGANIZE" | "IMAGE_PROMPT"
export type RightPanelMode = "chat" | "storyboard" | "previs" | "models" | "queue" | "asset" | "profile"

export type ContextMenuState =
  | null
  | {
      type: "canvas"
      screenX: number
      screenY: number
      canvasX: number
      canvasY: number
    }
  | {
      type: "node"
      nodeId: string
      nodeType: string
      screenX: number
      screenY: number
    }

export type FloatingToolbarState =
  | null
  | {
      type: "image-hover"
      nodeId: string
      position: { x: number; y: number; above: boolean }
    }
  | {
      type: "text-format"
      nodeId: string
      position: { x: number; y: number; above: boolean }
    }

export type AssetFolder = "Character" | "Scene" | "Item" | "Style" | "Sound Effect" | "Others"
export type AssetType = "image" | "video" | "audio" | "text" | "prompt" | "character" | "scene" | "style" | "other"

export type AssetItem = {
  id: string
  type: AssetType
  name: string
  src?: string
  thumbnail?: string
  folder: AssetFolder
  favorite?: boolean
  tags?: string[]
  createdAt: number
  metadata?: Record<string, unknown>
}

export type AssetLibraryState = {
  isOpen: boolean
  scope: "personal" | "team"
  query: string
  selectedFolder?: AssetFolder
  assets: AssetItem[]
}

// Default viewport settings - FIX the 188% zoom issue
export const DEFAULT_VIEWPORT: Viewport = {
  x: 0,
  y: 0,
  zoom: 0.85, // Default to 85% instead of 188%
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

  // Nodes & Edges
  nodes: Node[]
  edges: Edge[]
  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void
  onNodesChange: (changes: any) => void
  onEdgesChange: (changes: any) => void
  onConnect: (connection: Connection) => void

  // Selection
  selectedNodeId: string | null
  setSelectedNodeId: (id: string | null) => void

  // Right panel
  rightPanelMode: RightPanelMode
  setRightPanelMode: (mode: RightPanelMode) => void

  // Chat
  chatMode: ChatMode
  setChatMode: (mode: ChatMode) => void

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

  // Empty state hint (auto-dismiss)
  showCanvasHint: boolean
  dismissCanvasHint: () => void
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  // Viewport
  viewport: DEFAULT_VIEWPORT,
  setViewport: (viewport) => set({ viewport }),
  fitViewOnce: true,
  setFitViewOnce: (value) => set({ fitViewOnce: value }),

  // Nodes & Edges
  nodes: [],
  edges: [],
  setNodes: (nodes) => set({ nodes: typeof nodes === 'function' ? nodes(get().nodes) : nodes }),
  setEdges: (edges) => set({ edges: typeof edges === 'function' ? edges(get().edges) : edges }),
  onNodesChange: (changes) => {
    set((state) => ({
      nodes: state.nodes.map((node) => {
        const change = changes.find((c: any) => c.id === node.id)
        if (!change) return node
        if (change.type === 'position' && change.position) {
          return { ...node, position: change.position }
        }
        if (change.type === 'dimensions' && change.dimensions) {
          return { ...node, width: change.dimensions.width, height: change.dimensions.height }
        }
        if (change.type === 'remove') {
          return null as any
        }
        return node
      }).filter(Boolean),
    }))
  },
  onEdgesChange: (changes) => {
    set((state) => ({
      edges: state.edges.map((edge) => {
        const change = changes.find((c: any) => c.id === edge.id)
        if (!change) return edge
        if (change.type === 'remove') {
          return null as any
        }
        return edge
      }).filter(Boolean),
    }))
  },
  onConnect: (connection) => {
    set((state) => ({
      edges: addEdge(
        {
          ...connection,
          type: 'creative',
          animated: false,
          style: { stroke: 'rgba(148, 163, 184, 0.45)', strokeWidth: 2 },
        },
        state.edges
      ),
    }))
  },

  // Selection
  selectedNodeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  // Right panel
  rightPanelMode: 'chat',
  setRightPanelMode: (mode) => set({ rightPanelMode: mode }),

  // Chat
  chatMode: 'ASK',
  setChatMode: (mode) => set({ chatMode: mode }),

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
}))
