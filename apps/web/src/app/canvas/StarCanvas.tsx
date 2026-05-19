// ============================================================================
// StarCanvas - 主画布组件 (TapNow-inspired 重构版)
// ============================================================================
"use client"

import "@xyflow/react/dist/style.css"
import { createPortal } from "react-dom"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  getBezierPath,
  BaseEdge,
  type Edge,
  type Node,
  type ReactFlowInstance,
  type Viewport,
  type EdgeProps,
} from "@xyflow/react"
import { memo, type ChangeEvent, type MouseEvent as ReactMouseEvent } from "react"

// ============================================================================
// ICONS
// ============================================================================
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Grid3X3,
  Layout,
  HelpCircle,
  Search,
  Minimize2,
  MessageCircle,
} from "lucide-react"

// ============================================================================
// DESIGN SYSTEM
// ============================================================================
import { DESIGN_TOKENS, ICON_CONFIG } from "./styles/designSystem"

// ============================================================================
// TYPES
// ============================================================================
import type {
  CanvasNodeData,
  CanvasNodeKind,
  AssetItem,
} from "./components/canvas/types"

// ============================================================================
// HOOKS & STORES
// ============================================================================
import { useCanvasStore } from "./stores/canvasStore"
import { useCanvasDropUpload } from "./hooks/useCanvasDropUpload"
import type { ChatAttachment } from "./hooks/useChatAttachments"

// ============================================================================
// COMPONENTS
// ============================================================================
import { EmptyCanvasGuide } from "./components/canvas/EmptyCanvasGuide"
import { CanvasDropOverlay } from "./components/canvas/CanvasDropOverlay"
import { AssetLibraryPanel } from "./components/canvas/AssetLibraryPanel"
import { CanvasContextMenu } from "./components/menus/CanvasContextMenu"
import { NodeContextMenu } from "./components/menus/NodeContextMenu"
import { ImageHoverToolbar } from "./components/toolbar/ImageHoverToolbar"
import { LeftToolbar } from "./components/toolbar/LeftToolbar"
import { ChatPanel } from "./components/chat/ChatPanel"
import { SettingsPanel } from "./components/panels/SettingsPanel"
import ImageNode, { registerImageHoverHandlers, unregisterImageHoverHandlers } from "./components/nodes/ImageNode"
import PromptNode from "./components/nodes/PromptNode"
import TextNode from "./components/nodes/TextNode"
import { generateId } from "./utils/generateId"
import { quickLayout } from "./utils/dagre-layout"

// ============================================================================
// DEBUG SWITCHES
// ============================================================================
const isDebugEnabled = (key: string) =>
  typeof window !== "undefined" && window.localStorage.getItem(key) === "1"

const DEBUG_DROP = isDebugEnabled("DEBUG_DROP_UPLOAD")
const DEBUG_AI = isDebugEnabled("DEBUG_AI_PAYLOAD")
const DEBUG_NODE = isDebugEnabled("DEBUG_NODE_ACTIONS")

// ============================================================================
// CONSTANTS
// ============================================================================
const DEFAULT_ZOOM = 0.85
const CHAT_PANEL_WIDTH = 400
const LEFT_TOOLBAR_SAFE_WIDTH = 88
const IMAGE_NODE_TITLE_HEIGHT = 22
const IMAGE_NODE_SIZE = {
  minWidth: 120,
  minHeight: 96,
  maxWidth: 220,
  maxHeight: 180,
}
const NODE_DEFAULT_SIZE = {
  prompt: { width: 320, height: 176 },
  text: { width: 320, height: 160 },
  image: { width: 220, height: 172 },
} satisfies Record<"prompt" | "text" | "image", { width: number; height: number }>
const ZOOM_CONSTRAINTS = {
  minZoom: 0.25,
  maxZoom: 2,
}

// ============================================================================
// Custom Edge Component
// ============================================================================
const CreativeEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  animated,
}: EdgeProps) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: DESIGN_TOKENS.nodeEdge,
          strokeWidth: 2,
          filter: animated ? "drop-shadow(0 0 6px rgba(148, 163, 184, 0.5))" : undefined,
        }}
      />
      {animated && (
        <circle r={4} fill={DESIGN_TOKENS.nodeHandle}>
          <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
    </>
  )
})
CreativeEdge.displayName = "CreativeEdge"

// ============================================================================
// Node Types
// ============================================================================
const nodeTypes = {
  image: ImageNode,
  prompt: PromptNode,
  text: TextNode,
}

const edgeTypes = { creative: CreativeEdge }

// ============================================================================
// STAR CANVAS (OUTER - provides ReactFlowProvider)
// ============================================================================
export default function StarCanvas() {
  return (
    <ReactFlowProvider>
      <StarCanvasInner />
    </ReactFlowProvider>
  )
}

// ============================================================================
// STAR CANVAS INNER (uses hooks that require ReactFlow context)
// ============================================================================
function StarCanvasInner() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ========================================================================
  // ZUSTAND STORE
  // ========================================================================
  const {
    viewport,
    setViewport,
    fitViewOnce,
    setFitViewOnce,
    selectedNodeId,
    setSelectedNodeId,
    rightPanelMode,
    setRightPanelMode,
    contextMenu,
    setContextMenu,
    closeContextMenu,
    floatingToolbar,
    setFloatingToolbar,
    closeFloatingToolbar,
    assetLibrary,
    openAssetLibrary,
    closeAssetLibrary,
    setAssetLibraryQuery,
    setAssetLibraryFolder,
    addAsset,
    removeAsset,
    toggleAssetFavorite,
    clipboardNode,
    setClipboardNode,
    previewImageNodeId,
    setPreviewImageNodeId,
    cropImageNodeId,
    setCropImageNodeId,
    showCanvasHint,
    dismissCanvasHint,
  } = useCanvasStore()

  // ========================================================================
  // REACT FLOW STATE
  // ========================================================================
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<CanvasNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  // ========================================================================
  // LOCAL STATE
  // ========================================================================
  const [chatOpen, setChatOpen] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [showHelp, setShowHelp] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // ========================================================================
  // SETTINGS PANEL EVENT LISTENER
  // ========================================================================
  useEffect(() => {
    const handleOpenSettings = () => setShowSettings(true)
    window.addEventListener("startrails-open-settings", handleOpenSettings)
    return () => window.removeEventListener("startrails-open-settings", handleOpenSettings)
  }, [])

  // ========================================================================
  // DRAG & DROP UPLOAD
  // ========================================================================
  const {
    isDragOver,
    dragError,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    clearError,
  } = useCanvasDropUpload(setNodes, dismissCanvasHint)

  // ========================================================================
  // GET SELECTED NODE
  // ========================================================================
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  )

  const getCanvasFocusScreenPoint = useCallback(() => {
    const availableWidth = window.innerWidth - (chatOpen ? CHAT_PANEL_WIDTH : 0) - LEFT_TOOLBAR_SAFE_WIDTH
    return {
      x: LEFT_TOOLBAR_SAFE_WIDTH + Math.max(availableWidth, 0) / 2,
      y: window.innerHeight / 2,
    }
  }, [chatOpen])

  const getCenteredFlowPosition = useCallback(
    (nodeSize: { width: number; height: number } = { width: 0, height: 0 }) => {
      if (!reactFlowInstance) return { x: 400, y: 300 }
      const centerPosition = reactFlowInstance.screenToFlowPosition(getCanvasFocusScreenPoint())
      return {
        x: centerPosition.x - nodeSize.width / 2,
        y: centerPosition.y - nodeSize.height / 2,
      }
    },
    [reactFlowInstance, getCanvasFocusScreenPoint]
  )

  const fitViewToVisibleCanvas = useCallback(
    (duration = 500) => {
      if (!reactFlowInstance || nodes.length === 0) return
      const horizontalFocusOffset = ((chatOpen ? CHAT_PANEL_WIDTH : 0) - LEFT_TOOLBAR_SAFE_WIDTH) / 2
      setTimeout(() => {
        reactFlowInstance.fitView({
          padding: 0.28,
          maxZoom: 1.1,
          duration,
        })
        if (horizontalFocusOffset !== 0) {
          setTimeout(() => {
            const currentViewport = reactFlowInstance.getViewport()
            reactFlowInstance.setViewport(
              { ...currentViewport, x: currentViewport.x - horizontalFocusOffset },
              { duration: 220 }
            )
          }, duration + 20)
        }
      }, 50)
    },
    [reactFlowInstance, nodes.length, chatOpen]
  )

  // ========================================================================
  // FIT VIEW ON LOAD
  // ========================================================================
  useEffect(() => {
    if (fitViewOnce && reactFlowInstance && nodes.length > 0) {
      fitViewToVisibleCanvas()
      setFitViewOnce(false)
    }
  }, [fitViewOnce, reactFlowInstance, nodes.length, setFitViewOnce, fitViewToVisibleCanvas])

  // ========================================================================
  // VIEWPORT CHANGE
  // ========================================================================
  const onMoveEnd = useCallback(
    (_: any, vp: Viewport) => {
      setViewport(vp)
    },
    [setViewport]
  )

  // ========================================================================
  // SELECTION
  // ========================================================================
  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: Node<CanvasNodeData>[] }) => {
      if (selectedNodes.length === 1) {
        setSelectedNodeId(selectedNodes[0].id)
      } else {
        setSelectedNodeId(null)
      }
      closeContextMenu()
      closeFloatingToolbar()
    },
    [setSelectedNodeId, closeContextMenu, closeFloatingToolbar]
  )

  // ========================================================================
  // CONTEXT MENU - CANVAS
  // ========================================================================
  const handlePaneContextMenu = useCallback(
    (event: ReactMouseEvent<Element> | MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()

      if (!reactFlowInstance) return

      const bounds = reactFlowWrapper.current?.getBoundingClientRect()
      if (!bounds) return

      const canvasX = (event.clientX - bounds.left - viewport.x) / viewport.zoom
      const canvasY = (event.clientY - bounds.top - viewport.y) / viewport.zoom

      setContextMenu({
        type: "canvas",
        screenX: event.clientX,
        screenY: event.clientY,
        canvasX,
        canvasY,
      })
    },
    [reactFlowInstance, viewport, setContextMenu]
  )

  // ========================================================================
  // CONTEXT MENU - NODE
  // ========================================================================
  const handleNodeContextMenu = useCallback(
    (event: ReactMouseEvent<Element>, node: Node<CanvasNodeData>) => {
      event.preventDefault()
      event.stopPropagation()

      setContextMenu({
        type: "node",
        nodeId: node.id,
        nodeType: node.type || "prompt",
        screenX: event.clientX,
        screenY: event.clientY,
      })
    },
    [setContextMenu]
  )

  // ========================================================================
  // IMAGE HOVER
  // ========================================================================
  const handleImageNodeMouseEnter = useCallback(
    (nodeId: string, event: MouseEvent) => {
      const bounds = reactFlowWrapper.current?.getBoundingClientRect()
      if (!bounds) return

      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return

      const nodeX = node.position.x * viewport.zoom + viewport.x + bounds.left
      const nodeY = node.position.y * viewport.zoom + viewport.y + bounds.top
      const nodeWidth = (node.measured?.width || 280) * viewport.zoom
      const nodeHeight = (node.measured?.height || 200) * viewport.zoom

      const screenX = nodeX + nodeWidth / 2
      const screenY = nodeY + nodeHeight + 10

      const above = screenY + 60 > window.innerHeight

      setFloatingToolbar({
        type: "image-hover",
        nodeId,
        position: {
          x: screenX - 130,
          y: above ? nodeY - 70 : screenY,
          above,
        },
      })
    },
    [nodes, viewport, setFloatingToolbar]
  )

  const handleImageNodeMouseLeave = useCallback(() => {
    closeFloatingToolbar()
  }, [closeFloatingToolbar])

  useEffect(() => {
    const imageNodes = nodes.filter((node) => node.type === "image")
    imageNodes.forEach((node) => {
      registerImageHoverHandlers(node.id, {
        onMouseEnter: handleImageNodeMouseEnter,
        onMouseLeave: handleImageNodeMouseLeave,
      })
    })

    return () => {
      imageNodes.forEach((node) => unregisterImageHoverHandlers(node.id))
    }
  }, [nodes, handleImageNodeMouseEnter, handleImageNodeMouseLeave])

  // ========================================================================
  // FILE UPLOAD
  // ========================================================================
  const handleFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      if (files.length === 0) return

      // Calculate center position within visible canvas area, excluding the chat panel.
      let basePosition = getCenteredFlowPosition(NODE_DEFAULT_SIZE.image)

      // Process each file. 这里只读取原图尺寸并控制画布展示尺寸，不压缩、不改写用户原图。
      const newNodes: Node<CanvasNodeData>[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (!file.type.startsWith("image/")) continue

        try {
          const objectUrl = URL.createObjectURL(file)
          const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
            const image = new Image()
            image.onload = () => {
              resolve({ width: image.naturalWidth, height: image.naturalHeight })
            }
            image.onerror = () => {
              URL.revokeObjectURL(objectUrl)
              reject(new Error("图片加载失败"))
            }
            image.src = objectUrl
          })
          const maxWidth = IMAGE_NODE_SIZE.maxWidth
          const maxHeight = IMAGE_NODE_SIZE.maxHeight
          let width = dimensions.width
          let height = dimensions.height

          if (width > maxWidth) {
            const ratio = maxWidth / width
            width = maxWidth
            height = height * ratio
          }
          if (height > maxHeight) {
            const ratio = maxHeight / height
            height = maxHeight
            width = width * ratio
          }

          width = Math.max(width, IMAGE_NODE_SIZE.minWidth)
          height = Math.max(height, IMAGE_NODE_SIZE.minHeight)

          const node: Node<CanvasNodeData> = {
            id: generateId(),
            type: "image",
            position: {
              x: basePosition.x + i * 40,
              y: basePosition.y + i * 40,
            },
            data: {
              title: file.name,
              imageUrl: objectUrl,
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type,
              imageWidth: dimensions.width,
              imageHeight: dimensions.height,
              displayWidth: width,
              displayHeight: height,
              aspectRatio: dimensions.width / dimensions.height,
              nodeKind: "uploaded-image",
              createdAt: Date.now(),
            },
            measured: {
              width,
              height: height + 22,
            },
          }

          newNodes.push(node)
        } catch (error) {
          console.error("[UPLOAD_IMAGE] Error processing image:", error)
        }
      }

      if (newNodes.length > 0) {
        setNodes((nds) => [...nds, ...newNodes])
        dismissCanvasHint()
      }

      e.target.value = ""
    },
    [getCenteredFlowPosition, setNodes, dismissCanvasHint]
  )

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  // ========================================================================
  // ADD NODE
  // ========================================================================
  const handleAddNode = useCallback(
    (type: "prompt" | "text" | "image") => {
      const position = getCenteredFlowPosition(NODE_DEFAULT_SIZE[type])

      const newNode: Node<CanvasNodeData> = {
        id: generateId(),
        type,
        position,
        data: {
          title: type === "prompt" ? "New Prompt" : type === "text" ? "New Text" : "Image",
          prompt: "",
          nodeKind: getNodeKindFromType(type),
        },
      }

      if (DEBUG_NODE) {
        console.log("[DEBUG_NODE] Creating node:", newNode)
      }

      setNodes((nds) => [...nds, newNode])
      dismissCanvasHint()
    },
    [getCenteredFlowPosition, setNodes, dismissCanvasHint]
  )

  const getNodeKindFromType = (type?: string): CanvasNodeKind => {
    if (type === "image") return "uploaded-image"
    if (type === "prompt") return "prompt"
    if (type === "text") return "text"
    return "prompt"
  }

  // ========================================================================
  // NODE OPERATIONS
  // ========================================================================
  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId))
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
      setSelectedNodeId(null)
    },
    [setNodes, setEdges, setSelectedNodeId]
  )

  const duplicateNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return

      const newNode: Node<CanvasNodeData> = {
        ...node,
        id: generateId(),
        position: {
          x: node.position.x + 50,
          y: node.position.y + 50,
        },
        selected: false,
      }

      setNodes((nds) => [...nds, newNode])
    },
    [nodes, setNodes]
  )

  const copyNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return
      setClipboardNode(node)
    },
    [nodes, setClipboardNode]
  )

  const cutNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return
      setClipboardNode(node)
      deleteNode(nodeId)
    },
    [nodes, setClipboardNode, deleteNode]
  )

  const pasteNode = useCallback(() => {
    if (!clipboardNode || !reactFlowInstance) return

    const position = reactFlowInstance.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })

    const newNode: Node<CanvasNodeData> = {
      ...clipboardNode,
      id: generateId(),
      position: {
        x: position.x + Math.random() * 40 - 20,
        y: position.y + Math.random() * 40 - 20,
      },
      selected: false,
    }

    setNodes((nds) => [...nds, newNode])
    setClipboardNode(null)
  }, [clipboardNode, reactFlowInstance, setNodes, setClipboardNode])

  // ========================================================================
  // ADD IMAGE FROM CHAT ATTACHMENT
  // ========================================================================
  const handleAddImageFromChat = useCallback(
    (attachment: ChatAttachment) => {
      const maxWidth = IMAGE_NODE_SIZE.maxWidth
      const maxHeight = IMAGE_NODE_SIZE.maxHeight
      let width = attachment.width || 200
      let height = attachment.height || 150

      if (width > maxWidth) {
        const ratio = maxWidth / width
        width = maxWidth
        height = height * ratio
      }
      if (height > maxHeight) {
        const ratio = maxHeight / height
        height = maxHeight
        width = width * ratio
      }

      width = Math.max(width, IMAGE_NODE_SIZE.minWidth)
      height = Math.max(height, IMAGE_NODE_SIZE.minHeight)

      const position = getCenteredFlowPosition({
        width,
        height: height + IMAGE_NODE_TITLE_HEIGHT,
      })

      const newNode: Node<CanvasNodeData> = {
        id: generateId(),
        type: "image",
        position,
        data: {
          title: attachment.name,
          imageUrl: attachment.src,
          fileName: attachment.name,
          fileSize: attachment.size,
          mimeType: attachment.mimeType,
          imageWidth: attachment.width,
          imageHeight: attachment.height,
          displayWidth: width,
          displayHeight: height,
          aspectRatio: (attachment.width || 1) / (attachment.height || 1),
          nodeKind: "uploaded-image",
          createdAt: Date.now(),
        },
        measured: {
          width,
          height: height + IMAGE_NODE_TITLE_HEIGHT,
        },
      }

      setNodes((nds) => [...nds, newNode])
      dismissCanvasHint()

      if (DEBUG_NODE) {
        console.log("[DEBUG_NODE] Added image from chat:", newNode.id)
      }
    },
    [getCenteredFlowPosition, setNodes, dismissCanvasHint]
  )

  // ========================================================================
  // SAVE TO ASSET LIBRARY
  // ========================================================================
  const handleSaveToAssetLibrary = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return

      const asset: AssetItem = {
        id: generateId(),
        type: "image",
        name: node.data.fileName || node.data.title || "Untitled",
        src: node.data.imageUrl || node.data.assetUrl,
        folder: "Others",
        createdAt: Date.now(),
      }

      addAsset(asset)
    },
    [nodes, addAsset]
  )

  // ========================================================================
  // KEYBOARD SHORTCUTS
  // ========================================================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return

      if ((e.key === "Delete" || e.key === "Backspace") && selectedNodeId) {
        deleteNode(selectedNodeId)
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "c" && selectedNodeId) {
        copyNode(selectedNodeId)
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "x" && selectedNodeId) {
        cutNode(selectedNodeId)
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "v") {
        pasteNode()
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "d" && selectedNodeId) {
        e.preventDefault()
        duplicateNode(selectedNodeId)
      }

      if (e.key === "Escape") {
        closeContextMenu()
        closeFloatingToolbar()
        setSelectedNodeId(null)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [
    selectedNodeId,
    deleteNode,
    copyNode,
    cutNode,
    pasteNode,
    duplicateNode,
    closeContextMenu,
    closeFloatingToolbar,
    setSelectedNodeId,
  ])

  // ========================================================================
  // RENDER
  // ========================================================================
  return (
    <div className="relative h-screen w-screen overflow-hidden startrails-flow">
      {/* Hidden file input */}
      <input
        type="file"
        accept="image/*"
        multiple
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      {/* React Flow Canvas */}
      <div
        ref={reactFlowWrapper}
        className="h-full w-full"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={(connection) => {
            setEdges((eds) =>
              addEdge(
                {
                  ...connection,
                  type: "creative",
                  animated: false,
                  style: { stroke: DESIGN_TOKENS.nodeEdge, strokeWidth: 2 },
                },
                eds
              )
            )
          }}
          onInit={setReactFlowInstance}
          onMoveEnd={onMoveEnd}
          onSelectionChange={onSelectionChange}
          onPaneContextMenu={handlePaneContextMenu}
          onNodeContextMenu={handleNodeContextMenu}
          onPaneClick={() => {
            setSelectedNodeId(null)
            closeContextMenu()
            closeFloatingToolbar()
          }}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          minZoom={ZOOM_CONSTRAINTS.minZoom}
          maxZoom={ZOOM_CONSTRAINTS.maxZoom}
          fitView={nodes.length > 0}
          fitViewOptions={{ padding: 0.2, maxZoom: 1.1, duration: 500 }}
          deleteKeyCode={null}
          selectionKeyCode={null}
          multiSelectionKeyCode={null}
          panOnScroll
          selectionOnDrag
          panOnDrag={[1, 2]}
          defaultEdgeOptions={{
            type: "creative",
            animated: false,
            style: { stroke: DESIGN_TOKENS.nodeEdge, strokeWidth: 2 },
          }}
          proOptions={{ hideAttribution: true }}
        >
          {/* Background */}
          {showGrid && (
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1}
              color="rgba(255,255,255,0.06)"
            />
          )}

        </ReactFlow>
      </div>

      {/* Drop Overlay */}
      <CanvasDropOverlay isVisible={isDragOver} error={dragError} />

      {/* Empty Canvas Guide */}
      {nodes.length === 0 && (
        <EmptyCanvasGuide
          onQuickStart={(draft) => {
            setChatOpen(true)
          }}
          onOpenChat={() => setChatOpen(true)}
          onOpenAssetLibrary={openAssetLibrary}
          onUploadImage={handleUploadClick}
        />
      )}

      {/* Left Toolbar */}
      <LeftToolbar
        onOpenAssetLibrary={openAssetLibrary}
        onCreateNode={() => handleAddNode("prompt")}
        onUploadImage={handleUploadClick}
        onAddPrompt={() => handleAddNode("prompt")}
        onAddText={() => handleAddNode("text")}
        onToggleChat={() => setChatOpen((prev) => !prev)}
        isChatOpen={chatOpen}
        onToggleHistory={() => {
          setShowHistory((prev) => !prev)
          setChatOpen(true) // 打开 ChatPanel 以显示历史
        }}
        showHistory={showHistory}
        onOpenUserMenu={() => setShowUserMenu((prev) => !prev)}
      />

      {/* User Menu Portal */}
      {showUserMenu && typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed right-3 top-14 z-50 w-48 rounded-xl border py-1"
            style={{
              backgroundColor: "rgba(30,30,36,0.95)",
              borderColor: DESIGN_TOKENS.border,
              backdropFilter: "blur(20px)",
            }}
          >
            <button
              onClick={() => {
                // TODO: 接入真实登录
                alert("登录功能：接入 Auth0 / Clerk / Supabase Auth")
                setShowUserMenu(false)
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-white/5"
              style={{ color: DESIGN_TOKENS.text }}
            >
              <span>登录 / 注册</span>
            </button>
            <div className="mx-2 my-1 h-px" style={{ backgroundColor: DESIGN_TOKENS.border }} />
            <button
              onClick={() => {
                setShowSettings(true)
                setShowUserMenu(false)
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-white/5"
              style={{ color: DESIGN_TOKENS.textSecondary }}
            >
              <span>设置</span>
            </button>
            <button
              onClick={() => {
                setShowUserMenu(false)
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-white/5"
              style={{ color: DESIGN_TOKENS.textMuted }}
            >
              <span>退出</span>
            </button>
          </div>,
          document.body
        )}

      {/* Help Panel */}
      {showHelp && typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed right-3 top-14 z-50 w-80 rounded-xl border p-4"
            style={{
              backgroundColor: "rgba(30,30,36,0.95)",
              borderColor: DESIGN_TOKENS.border,
              backdropFilter: "blur(20px)",
            }}
          >
            <h3 className="mb-3 text-sm font-medium" style={{ color: DESIGN_TOKENS.text }}>⌨️ 快捷键</h3>
            <div className="mb-4 flex flex-col gap-1.5 text-xs" style={{ color: DESIGN_TOKENS.textSecondary }}>
              {[
                ["Delete", "删除选中节点"],
                ["Ctrl+C", "复制节点"],
                ["Ctrl+X", "剪切节点"],
                ["Ctrl+V", "粘贴节点"],
                ["Ctrl+D", "复制节点"],
                ["Escape", "取消选择"],
                ["Enter/Space", "选中节点"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between">
                  <code
                    className="rounded px-1.5 py-0.5 text-[10px]"
                    style={{ backgroundColor: "rgba(255,255,255,0.1)", color: DESIGN_TOKENS.accent }}
                  >{key}</code>
                  <span>{desc}</span>
                </div>
              ))}
            </div>
            
            <h3 className="mb-3 text-sm font-medium" style={{ color: DESIGN_TOKENS.text }}>🖱️ 鼠标操作</h3>
            <div className="mb-4 flex flex-col gap-1.5 text-xs" style={{ color: DESIGN_TOKENS.textSecondary }}>
              {[
                ["左键单击", "选中节点"],
                ["左键双击", "编辑节点内容"],
                ["右键单击", "打开节点菜单"],
                ["右键画布", "打开画布菜单"],
                ["滚轮", "缩放画布"],
                ["拖拽空白", "移动画布视图"],
                ["框选", "多选节点"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between">
                  <code
                    className="rounded px-1.5 py-0.5 text-[10px]"
                    style={{ backgroundColor: "rgba(255,255,255,0.1)", color: DESIGN_TOKENS.accent }}
                  >{key}</code>
                  <span>{desc}</span>
                </div>
              ))}
            </div>
            
            <h3 className="mb-3 text-sm font-medium" style={{ color: DESIGN_TOKENS.text }}>📝 画布操作</h3>
            <div className="flex flex-col gap-1.5 text-xs" style={{ color: DESIGN_TOKENS.textSecondary }}>
              {[
                ["底部工具栏", "缩放、自动布局"],
                ["左侧工具栏", "添加节点、打开聊天"],
                ["@引用", "在输入框输入@引用节点"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between">
                  <code
                    className="rounded px-1.5 py-0.5 text-[10px]"
                    style={{ backgroundColor: "rgba(255,255,255,0.1)", color: DESIGN_TOKENS.accent }}
                  >{key}</code>
                  <span>{desc}</span>
                </div>
              ))}
            </div>
            
            <button
              onClick={() => setShowHelp(false)}
              className="mt-4 w-full rounded-lg py-2 text-xs transition-colors hover:bg-white/5"
              style={{ color: DESIGN_TOKENS.textMuted, backgroundColor: "rgba(255,255,255,0.05)" }}
            >关闭</button>
          </div>,
          document.body
        )}
      <div
        className="fixed bottom-3 left-3 z-20 flex items-center gap-1 rounded-full border px-2 py-1.5"
        style={{
          backgroundColor: "rgba(20,20,24,0.85)",
          borderColor: DESIGN_TOKENS.border,
          backdropFilter: "blur(20px)",
        }}
      >
        {/* 布局视图 - 使用 dagre 算法 */}
        <button
          onClick={() => {
            setNodes((nds) => {
              const layoutedNodes = quickLayout(nds, edges, 3)
              // 布局后自动适应当前可见画布区域，避免被右侧聊天面板遮挡
              fitViewToVisibleCanvas()
              return layoutedNodes
            })
          }}
          className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-white/10"
          style={{ color: DESIGN_TOKENS.textMuted }}
          title="自动布局"
        >
          <Layout size={14} strokeWidth={1.5} />
        </button>
        {/* 网格视图 */}
        <button
          onClick={() => setShowGrid(prev => !prev)}
          className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-white/10"
          style={{ color: showGrid ? DESIGN_TOKENS.accent : DESIGN_TOKENS.textMuted }}
          title="显示/隐藏网格"
        >
          <Grid3X3 size={14} strokeWidth={1.5} />
        </button>
        <div
          className="mx-1 h-3 w-px"
          style={{ backgroundColor: DESIGN_TOKENS.border }}
        />
        <button
          onClick={() => reactFlowInstance?.zoomOut({ duration: 200 })}
          className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-white/10"
          style={{ color: DESIGN_TOKENS.textMuted }}
          title="缩小"
        >
          <ZoomOut size={14} strokeWidth={1.5} />
        </button>
        {/* 缩放滑块条 */}
        <div className="relative mx-1 h-1 w-20 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
          <div
            className="absolute left-0 top-0 h-full rounded-full"
            style={{
              width: `${Math.min(100, Math.max(0, (viewport.zoom - 0.25) / (2 - 0.25) * 100))}%`,
              backgroundColor: DESIGN_TOKENS.textMuted,
            }}
          />
          <div
            className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border"
            style={{
              left: `${Math.min(100, Math.max(0, (viewport.zoom - 0.25) / (2 - 0.25) * 100))}%`,
              transform: "translate(-50%, -50%)",
              backgroundColor: "#fff",
              borderColor: DESIGN_TOKENS.border,
            }}
          />
        </div>
        <span
          className="min-w-[36px] text-center text-xs tabular-nums"
          style={{ color: DESIGN_TOKENS.textMuted }}
        >
          {Math.round(viewport.zoom * 100)}%
        </span>
        <button
          onClick={() => reactFlowInstance?.zoomIn({ duration: 200 })}
          className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-white/10"
          style={{ color: DESIGN_TOKENS.textMuted }}
          title="放大"
        >
          <ZoomIn size={14} strokeWidth={1.5} />
        </button>
        <div
          className="mx-1 h-3 w-px"
          style={{ backgroundColor: DESIGN_TOKENS.border }}
        />
        <button
          onClick={() => fitViewToVisibleCanvas(400)}
          className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-white/10"
          style={{ color: DESIGN_TOKENS.textMuted }}
          title="适应窗口"
        >
          <Minimize2 size={14} strokeWidth={1.5} />
        </button>
        <div
          className="mx-1 h-3 w-px"
          style={{ backgroundColor: DESIGN_TOKENS.border }}
        />
        {/* 帮助按钮 */}
        <button
          onClick={() => setShowHelp(prev => !prev)}
          className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-white/10"
          style={{ color: showHelp ? DESIGN_TOKENS.accent : DESIGN_TOKENS.textMuted }}
          title="快捷键帮助"
        >
          <HelpCircle size={14} strokeWidth={1.5} />
        </button>
      </div>

      {/* Canvas Context Menu */}
      {typeof document !== "undefined" &&
        createPortal(
          <CanvasContextMenu
            state={contextMenu}
            onClose={closeContextMenu}
            onAddNode={handleAddNode}
            onUploadImage={handleUploadClick}
            onPaste={pasteNode}
            hasClipboard={!!clipboardNode}
          />,
          document.body
        )}

      {/* Node Context Menu */}
      {typeof document !== "undefined" &&
        createPortal(
          <NodeContextMenu
            state={contextMenu}
            onClose={closeContextMenu}
            onDelete={() => {
              if (contextMenu?.type === "node") {
                deleteNode(contextMenu.nodeId)
              }
            }}
            onDuplicate={() => {
              if (contextMenu?.type === "node") {
                duplicateNode(contextMenu.nodeId)
              }
            }}
            onCopy={() => {
              if (contextMenu?.type === "node") {
                copyNode(contextMenu.nodeId)
              }
            }}
            onCut={() => {
              if (contextMenu?.type === "node") {
                cutNode(contextMenu.nodeId)
              }
            }}
            onPreviewImage={() => {
              if (contextMenu?.type === "node") {
                setPreviewImageNodeId(contextMenu.nodeId)
              }
            }}
            onCropImage={() => {
              if (contextMenu?.type === "node") {
                setCropImageNodeId(contextMenu.nodeId)
              }
            }}
            onSaveToAssetLibrary={() => {
              if (contextMenu?.type === "node") {
                handleSaveToAssetLibrary(contextMenu.nodeId)
              }
            }}
            onEdit={() => {
              if (contextMenu?.type === "node") {
                setSelectedNodeId(contextMenu.nodeId)
              }
            }}
            nodeKind={
              nodes.find((n) =>
                n.id === (contextMenu?.type === "node" ? contextMenu.nodeId : null)
              )?.data?.nodeKind
            }
          />,
          document.body
        )}

      {/* Image Hover Toolbar */}
      {typeof document !== "undefined" &&
        createPortal(
          <ImageHoverToolbar
            state={floatingToolbar}
            onClose={closeFloatingToolbar}
            onPreview={() => {
              if (floatingToolbar?.type === "image-hover") {
                setPreviewImageNodeId(floatingToolbar.nodeId)
                closeFloatingToolbar()
              }
            }}
            onCrop={() => {
              if (floatingToolbar?.type === "image-hover") {
                setCropImageNodeId(floatingToolbar.nodeId)
                closeFloatingToolbar()
              }
            }}
            onSaveToLibrary={() => {
              if (floatingToolbar?.type === "image-hover") {
                handleSaveToAssetLibrary(floatingToolbar.nodeId)
                closeFloatingToolbar()
              }
            }}
            onReplaceImage={() => {
              if (floatingToolbar?.type === "image-hover") {
                handleUploadClick()
                closeFloatingToolbar()
              }
            }}
            onDelete={() => {
              if (floatingToolbar?.type === "image-hover") {
                deleteNode(floatingToolbar.nodeId)
                closeFloatingToolbar()
              }
            }}
          />,
          document.body
        )}

      {/* Asset Library Panel */}
      {typeof document !== "undefined" &&
        createPortal(
          <AssetLibraryPanel
            isOpen={assetLibrary.isOpen}
            onClose={closeAssetLibrary}
            assets={assetLibrary.assets}
            selectedFolder={assetLibrary.selectedFolder}
            query={assetLibrary.query}
            onQueryChange={setAssetLibraryQuery}
            onFolderChange={setAssetLibraryFolder}
            onToggleFavorite={toggleAssetFavorite}
            onDeleteAsset={removeAsset}
            onSelectAsset={(asset) => {
              // Add asset to canvas
              let position = { x: 400, y: 300 }
              if (reactFlowInstance) {
                position = reactFlowInstance.screenToFlowPosition({
                  x: window.innerWidth / 2,
                  y: window.innerHeight / 2,
                })
              }

              const newNode: Node<CanvasNodeData> = {
                id: generateId(),
                type: asset.type === "image" ? "image" : "text",
                position,
                data: {
                  title: asset.name,
                  imageUrl: asset.src,
                  assetUrl: asset.src,
                  nodeKind: asset.type === "image" ? "uploaded-image" : "text",
                },
              }

              setNodes((nds) => [...nds, newNode])
              closeAssetLibrary()
            }}
          />,
          document.body
        )}

      {/* Settings Panel */}
      {showSettings && typeof document !== "undefined" &&
        createPortal(
          <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />,
          document.body
        )}

      {/* Floating Chat Reopen Button */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-medium shadow-2xl transition-all hover:-translate-y-0.5 hover:bg-white/10"
          style={{
            backgroundColor: "rgba(20,20,24,0.92)",
            borderColor: DESIGN_TOKENS.border,
            color: DESIGN_TOKENS.text,
            backdropFilter: "blur(20px)",
            boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
          }}
          title="打开星轨Ai"
        >
          <MessageCircle size={16} strokeWidth={1.7} style={{ color: DESIGN_TOKENS.accent }} />
          <span>打开星轨Ai</span>
        </button>
      )}

      {/* Chat Panel */}
      <ChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        selectedNodeId={selectedNodeId}
        selectedNode={selectedNode}
        canvasNodes={nodes}
        onAddImageToCanvas={handleAddImageFromChat}
        showHistoryFromOutside={showHistory}
        onHistoryPanelClosed={() => setShowHistory(false)}
      />
    </div>
  )
}
// StarCanvasInner closes here
// StarCanvas (outer) closes via ReactFlowProvider wrapping

