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
  Download,
  Sparkles,
  Loader2,
  type LucideIcon,
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
import { useHistoryDrop } from "./hooks/useHistoryDrop"
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
import { NodeHistoryPanel } from "./components/history/NodeHistoryPanel"
import { WorkflowRunPanel } from "./components/workflow/WorkflowRunPanel"
import { PromptPreviewPanel } from "./components/preview/PromptPreviewPanel"
import ImageNode, { registerImageHoverHandlers, unregisterImageHoverHandlers } from "./components/nodes/ImageNode"
import ContentNode from "./components/nodes/ContentNode"
import WorkflowNode from "./components/nodes/WorkflowNode"
import { generateId } from "./utils/generateId"
import { quickLayout } from "./utils/dagre-layout"
import { useWorkflowRunner } from "./hooks/useWorkflowRunner"
import { buildExecutionPlan } from "./utils/execution-plan"
import { useCanvasPersistence } from "./hooks/useCanvasPersistence"
import { createIdleRunMeta, createPendingRunMeta } from "./utils/nodeRunMeta"
import type { ChatCanvasAction, ApplyActionsReport, ApplyActionResult } from "./features/canvas/actions/chatActions"
import type { WorkflowRunEvent } from "./types/workflow-run"

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
  content: { width: 320, height: 176 },
  image: { width: 220, height: 172 },
  workflow: { width: 280, height: 170 },
} satisfies Record<"content" | "image" | "workflow", { width: number; height: number }>
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
          strokeWidth: 1.5,
          filter: animated ? "drop-shadow(0 0 3px rgba(148, 163, 184, 0.3))" : undefined,
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
  content: ContentNode,
  workflow: WorkflowNode,
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
// HELPERS (used across the component)
// ============================================================================
// Extracts readable text from a canvas node for export/package generation
function getNodeText(node: Node<CanvasNodeData>): string {
  const data = (node.data || {}) as Record<string, unknown>
  return [data.title, data.summary, data.content, data.prompt].filter(Boolean).join("\n")
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
    isCanvasRestored,
    setIsCanvasRestored,
    clearPersistedCanvas,
    allowAIAutoRun,
    showPromptPreview,
    promptPreviewNodeId,
    closePromptPreview,
  } = useCanvasStore()

  // ========================================================================
  // REACT FLOW STATE
  // ========================================================================
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<CanvasNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  // Cache nodes in a ref so callbacks don't need nodes in deps (avoids re-registering)
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes

  // ========================================================================
  // LOCAL STATE
  // ========================================================================
  const [chatOpen, setChatOpen] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [showHelp, setShowHelp] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showNodeHistory, setShowNodeHistory] = useState(false)
  const [historyNodeId, setHistoryNodeId] = useState<string | null>(null)

  // P2-3A: WorkflowRunPanel state
  const [showRunPanel, setShowRunPanel] = useState(false)
  const [runEvents, setRunEvents] = useState<WorkflowRunEvent[]>([])

  // ========================================================================
  // WORKFLOW RUNNER
  // ========================================================================
  const workflowRunner = useWorkflowRunner({
    onRunEvent: useCallback((event: WorkflowRunEvent) => {
      // 新 run 开始时清空旧事件
      if (event.type === "run-started") {
        setRunEvents([])
        setShowRunPanel(true)
      }
      setRunEvents((prev) => [...prev, event])
    }, []),
  })
  const hasWorkflowNodes = nodes.some(
    (n) => n.type === "workflow" || (n.type === "content" && n.data.nodeKind === "text")
  )

  // ========================================================================
  // CANVAS PERSISTENCE — auto-save & restore
  // ========================================================================
  const persistence = useCanvasPersistence({
    isRestored: isCanvasRestored,
    onRestored: () => setIsCanvasRestored(true),
    nodes,
    edges,
    setNodes,
    setEdges,
    setFitViewOnce,
  })

  // ========================================================================
  // SETTINGS & RUN-NODE EVENT LISTENERS
  // ========================================================================
  useEffect(() => {
    const handleOpenSettings = () => setShowSettings(true)
    const handleRunNode = (e: Event) => {
      const nodeId = (e as CustomEvent<{ nodeId: string }>).detail?.nodeId
      if (nodeId) {
        workflowRunner.runNode(nodeId)
      }
    }
    const handleSettingsUpdated = (e: Event) => {
      const detail = (e as CustomEvent<{ allowAIAutoRun?: boolean }>).detail
      if (detail?.allowAIAutoRun !== undefined) {
        useCanvasStore.getState().setAllowAIAutoRun(detail.allowAIAutoRun)
      }
    }
    const handleClearPending = (e: Event) => {
      const nodeId = (e as CustomEvent<{ nodeId: string }>).detail?.nodeId
      if (nodeId) {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    runMeta: createIdleRunMeta(),
                    pendingExecution: false,  // 兼容旧字段，逐步废弃
                  },
                }
              : n
          )
        )
      }
    }
    window.addEventListener("startrails-open-settings", handleOpenSettings)
    window.addEventListener("startrails-run-node", handleRunNode)
    window.addEventListener("startrails-settings-updated", handleSettingsUpdated)
    window.addEventListener("startrails-clear-pending", handleClearPending)
    return () => {
      window.removeEventListener("startrails-open-settings", handleOpenSettings)
      window.removeEventListener("startrails-run-node", handleRunNode)
      window.removeEventListener("startrails-settings-updated", handleSettingsUpdated)
      window.removeEventListener("startrails-clear-pending", handleClearPending)
    }
  }, [workflowRunner, setNodes])

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

  // ── 历史产物拖回画布 (P2-4) ──
  // onNodeCreated: 节点创建后自动选中（Zustand store）
  const { handleHistoryDrop } = useHistoryDrop(setNodes, (nodeId) => setSelectedNodeId(nodeId))

  // 组合 drop handler：先检查历史 payload，未命中回退到文件拖放
  const combinedHandleDrop = useCallback(
    (e: React.DragEvent) => {
      if (handleHistoryDrop(e)) return
      handleDrop(e)
    },
    [handleHistoryDrop, handleDrop],
  )

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
        nodeType: node.type || "content",
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
      const node = nodesRef.current.find((n) => n.id === nodeId)
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
    [viewport, setFloatingToolbar]
  )

  const handleImageNodeMouseLeave = useCallback(() => {
    closeFloatingToolbar()
  }, [closeFloatingToolbar])

  // Track which image node ids are currently registered (stable across renders)
  const registeredNodeIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    const currentImageNodes = nodes.filter((node) => node.type === "image")
    const currentIds = new Set(currentImageNodes.map((n) => n.id))
    const prevIds = registeredNodeIds.current

    // Unregister nodes that no longer exist
    for (const id of prevIds) {
      if (!currentIds.has(id)) {
        unregisterImageHoverHandlers(id)
      }
    }

    // Register new nodes
    for (const node of currentImageNodes) {
      if (!prevIds.has(node.id)) {
        registerImageHoverHandlers(node.id, {
          onMouseEnter: handleImageNodeMouseEnter,
          onMouseLeave: handleImageNodeMouseLeave,
        })
      }
    }

    // Update tracked set
    registeredNodeIds.current = currentIds
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

  const buildProjectPackage = useCallback(() => {
    const now = new Date().toISOString()
    const plainNodes = nodes.map((node) => {
      const data = node.data || {}
      return {
        id: node.id,
        type: node.type || "workflow",
        position: node.position,
        data: {
          title: data.title,
          nodeKind: data.nodeKind,
          workflowRole: data.workflowRole,
          status: data.status,
          runMeta: data.runMeta ?? undefined,
          summary: data.summary,
          prompt: data.prompt,
          content: data.content,
          duration: data.duration,
          model: data.model,
          fileName: data.fileName,
          fileSize: data.fileSize,
          mimeType: data.mimeType,
          imageUrl: data.imageUrl,
          assetUrl: data.assetUrl,
          resultUrl: data.resultUrl,
          inputs: data.inputs,
          outputs: data.outputs,
          createdAt: data.createdAt,
        },
      }
    })

    const shots = plainNodes
      .filter((node) => ["storyboard", "image-generation", "video-generation", "image-result"].includes(String(node.data.nodeKind || "")))
      .map((node, index) => ({
        id: node.id,
        order: index + 1,
        title: node.data.title || `镜头 ${index + 1}`,
        intent: [node.data.summary, node.data.content, node.data.prompt].filter(Boolean).join("\n"),
        visualReference: node.data.imageUrl || node.data.assetUrl || node.data.resultUrl || null,
        status: node.data.status || "draft",
      }))

    const visualReferences = plainNodes
      .filter((node) => ["uploaded-image", "reference", "image-result"].includes(String(node.data.nodeKind || "")) || Boolean(node.data.imageUrl))
      .map((node) => ({
        id: node.id,
        title: node.data.title || node.data.fileName || "视觉参考",
        url: node.data.imageUrl || node.data.assetUrl || node.data.resultUrl || null,
        mimeType: node.data.mimeType || null,
        note: node.data.summary || node.data.prompt || "",
      }))

    const audioIntent = nodes
      .filter((node) => node.data?.nodeKind === "audio" || node.data?.nodeKind === "uploaded-audio")
      .map((node) => ({ id: node.id, title: node.data.title || "声音意图", note: getNodeText(node) }))

    const handoffNotes = nodes
      .filter((node) => ["composition", "video-result", "subtitle", "script", "text"].includes(String(node.data?.nodeKind || "")))
      .map((node) => ({ id: node.id, title: node.data.title || "交接说明", note: getNodeText(node) }))

    return {
      schema: "startrails-project-package/v1",
      source: "星轨画布（前期）",
      exportedAt: now,
      projectName: "星轨前期项目包",
      summary: "由星轨画布（前期）导出，供星轨画布（后期）继续处理节奏、字幕、声音和成片细节。",
      handoffTarget: "星轨画布（后期）",
      stats: {
        nodes: plainNodes.length,
        edges: edges.length,
        shots: shots.length,
        visualReferences: visualReferences.length,
        audioIntent: audioIntent.length,
      },
      shots,
      visualReferences,
      audioIntent,
      handoffNotes,
      canvas: {
        viewport,
        nodes: plainNodes,
        edges: edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
          type: edge.type,
          animated: edge.animated,
        })),
      },
    }
  }, [nodes, edges, viewport])

  const handleExportProjectPackage = useCallback(() => {
    const projectPackage = buildProjectPackage()
    const json = JSON.stringify(projectPackage, null, 2)
    const blob = new Blob([json], { type: "application/json;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    const date = new Date().toISOString().slice(0, 10)
    link.href = url
    link.download = `startrails-project-${date}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }, [buildProjectPackage])

  // ========================================================================
  // ADD NODE
  // ========================================================================
  const getWorkflowDefaults = (nodeKind: CanvasNodeKind): CanvasNodeData => {
    const idleMeta = createIdleRunMeta()
    const defaults: Partial<Record<CanvasNodeKind, CanvasNodeData>> = {
      script: {
        title: "创意梳理",
        workflowRole: "AI 编剧",
        status: "draft", // 兼容旧代码读取
        runMeta: idleMeta,
        summary: "把一句话灵感整理成主题、人物、情绪、类型感和可拍的故事目标。",
        model: "GPT-5.5",
        inputs: [{ label: "创意目标" }],
        outputs: [{ label: "前期文本", type: "text" }],
      },
      storyboard: {
        title: "分镜草稿",
        workflowRole: "Storyboard",
        status: "ready",
        runMeta: idleMeta,
        summary: "按创意拆出镜头草稿，先确定画面重点、景别、构图和调度意图。",
        inputs: [{ label: "前期文本" }],
        outputs: [{ label: "镜头草稿", type: "storyboard" }],
      },
      "image-generation": {
        title: "关键画面设计",
        workflowRole: "Text to Image",
        status: "ready",
        runMeta: idleMeta,
        summary: "根据分镜提示词生成角色、场景、首帧或风格板图片。",
        model: "Banana Pro",
        inputs: [{ label: "分镜提示词" }],
        outputs: [{ label: "关键画面", type: "image" }],
      },
      "video-generation": {
        title: "动效预演",
        workflowRole: "Image to Video",
        status: "draft",
        runMeta: idleMeta,
        summary: "只做前期预演：用关键帧验证动作、机位和氛围，不负责最终节奏精剪。",
        model: "Seedance 2.0",
        duration: "5s",
        inputs: [{ label: "关键画面" }, { label: "运动提示" }],
        outputs: [{ label: "预演片段", type: "video" }],
      },
      "video-sample-frames": {
        title: "视频抽帧",
        workflowRole: "Frame Extractor",
        status: "draft",
        runMeta: idleMeta,
        summary: "从上游视频均匀抽取关键帧，供下游分析或参考。",
        inputs: [{ label: "视频输入", type: "video" }],
        outputs: [{ label: "抽帧结果", type: "image" }],
        generationOutput: null,
      },
      "video-analyze": {
        title: "视频分析",
        workflowRole: "Video Analyzer",
        status: "draft",
        runMeta: idleMeta,
        summary: "分析上游帧画面，生成视频内容摘要。",
        inputs: [{ label: "帧画面输入", type: "image" }],
        outputs: [{ label: "分析结果", type: "text" }],
        generationOutput: null,
      },
      audio: {
        title: "声音意图",
        workflowRole: "Audio Brief",
        status: "draft",
        runMeta: idleMeta,
        summary: "记录旁白、环境声、音乐情绪和声音参考，供后期继续制作。",
        inputs: [{ label: "脚本/情绪" }],
        outputs: [{ label: "声音说明", type: "audio" }],
      },
      subtitle: {
        title: "对白/旁白草稿",
        workflowRole: "Dialogue Draft",
        status: "draft",
        runMeta: idleMeta,
        summary: "沉淀对白、旁白和字幕意图，后期再做时间轴校准。",
        inputs: [{ label: "前期文本" }],
        outputs: [{ label: "文案草稿", type: "subtitle" }],
      },
      composition: {
        title: "前期项目包",
        workflowRole: "Handoff JSON",
        status: "draft",
        runMeta: idleMeta,
        summary: "汇总创意、分镜、关键画面、参考素材和声音意图，整理为 startrails-project.json。",
        inputs: [{ label: "镜头草稿" }, { label: "关键画面" }, { label: "声音说明" }],
        outputs: [{ label: "startrails-project.json", type: "file" }],
      },
      "video-result": {
        title: "交给后期",
        workflowRole: "Post Handoff",
        status: "draft",
        runMeta: idleMeta,
        summary: "把前期项目包交给星轨画布（后期），继续做节奏、字幕、声音和成片精修。",
        inputs: [{ label: "前期项目包" }],
        outputs: [{ label: "后期任务", type: "video" }],
      },
    }

    return {
      title: "工作流节点",
      status: "draft",
      ...defaults[nodeKind],
      nodeKind,
      createdAt: Date.now(),
    }
  }

  const handleAddNode = useCallback(
    (type: "content" | "image" | "workflow", positionOverride?: { x: number; y: number }, nodeKind?: CanvasNodeKind) => {
      const position = positionOverride || getCenteredFlowPosition(type === "workflow" ? NODE_DEFAULT_SIZE.workflow : type === "image" ? NODE_DEFAULT_SIZE.image : NODE_DEFAULT_SIZE.content)
      const resolvedNodeKind = nodeKind || getNodeKindFromType(type)

      const newNode: Node<CanvasNodeData> = {
        id: generateId(),
        type,
        position,
        data: type === "workflow"
          ? getWorkflowDefaults(resolvedNodeKind)
          : type === "image"
          ? { title: "Image", nodeKind: "uploaded-image" as CanvasNodeKind, createdAt: Date.now() }
          : {
              title: resolvedNodeKind === "text" ? "创意文本" : "新建 Prompt",
              prompt: resolvedNodeKind === "prompt" ? "在这里输入你的想法..." : "",
              content: resolvedNodeKind === "text" ? "在这里输入文本内容..." : "",
              nodeKind: resolvedNodeKind,
              createdAt: Date.now(),
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

  const handleCreateVideoWorkflow = useCallback(() => {
    const basePosition = getCenteredFlowPosition({ width: 1120, height: 540 })
    const template: Array<{ kind: CanvasNodeKind; x: number; y: number; overrides?: Partial<CanvasNodeData> }> = [
      { kind: "text", x: 0, y: 160, overrides: { title: "前期目标", content: "输入主题、类型、人物、情绪、画面风格和交付目标。", prompt: "输入主题、类型、人物、情绪、画面风格和交付目标。" } },
      { kind: "script", x: 320, y: 40 },
      { kind: "storyboard", x: 640, y: 40 },
      { kind: "image-generation", x: 960, y: 40 },
      { kind: "image-result", x: 1280, y: 40, overrides: { title: "关键画面结果", runMeta: createIdleRunMeta(), workflowRole: "Image Output", summary: "这里承接生成后的角色、场景、首帧或风格板图片。" } },
      { kind: "video-generation", x: 1600, y: 40 },
      { kind: "audio", x: 960, y: 280 },
      { kind: "subtitle", x: 1280, y: 280 },
      { kind: "composition", x: 1600, y: 280 },
      { kind: "video-result", x: 1920, y: 160 },
    ]

    const newNodes: Node<CanvasNodeData>[] = template.map((item) => {
      const type = item.kind === "text" ? "content" : "workflow"
      return {
        id: generateId(),
        type,
        position: { x: basePosition.x + item.x, y: basePosition.y + item.y },
        data: {
          ...(type === "workflow" ? getWorkflowDefaults(item.kind) : {
            title: "前期目标",
            nodeKind: "text" as CanvasNodeKind,
            runMeta: createIdleRunMeta(),
            content: "输入主题、类型、人物、情绪、画面风格和交付目标。",
            prompt: "输入主题、类型、人物、情绪、画面风格和交付目标。",
            createdAt: Date.now(),
          }),
          ...item.overrides,
        },
      }
    })

    const edgePairs = [
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 8], [1, 6], [1, 7], [6, 8], [7, 8], [8, 9],
    ]
    const newEdges: Edge[] = edgePairs.map(([sourceIndex, targetIndex]) => ({
      id: generateId(),
      source: newNodes[sourceIndex].id,
      target: newNodes[targetIndex].id,
      type: "creative",
      animated: false,
      style: { stroke: DESIGN_TOKENS.nodeEdge, strokeWidth: 2 },
    }))

    setNodes(newNodes)
    setEdges(newEdges)
    dismissCanvasHint()
    setChatOpen(true)
    setTimeout(() => fitViewToVisibleCanvas(650), 80)
  }, [getCenteredFlowPosition, setNodes, setEdges, dismissCanvasHint, fitViewToVisibleCanvas])

  const getNodeKindFromType = (type?: string): CanvasNodeKind => {
    if (type === "image") return "uploaded-image"
    if (type === "content") return "prompt"
    return "script"
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
      const node = nodesRef.current.find((n) => n.id === nodeId)
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
      const node = nodesRef.current.find((n) => n.id === nodeId)
      if (!node) return
      setClipboardNode(node)
    },
    [nodes, setClipboardNode]
  )

  const cutNode = useCallback(
    (nodeId: string) => {
      const node = nodesRef.current.find((n) => n.id === nodeId)
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
  // APPLY CHAT ACTIONS - AI 画布操作执行器（返回结构化报告）
  // ========================================================================
  const applyChatActions = useCallback(
    (actions: ChatCanvasAction[]): ApplyActionsReport => {
      const results: ApplyActionResult[] = []
      const aliasMap: Record<string, string> = {}

      for (let i = 0; i < actions.length; i++) {
        const act = actions[i]

        if (DEBUG_NODE) {
          console.log("[DEBUG_NODE] Applying chat action:", act)
        }

        try {
          switch (act.action) {
            case "create_node": {
              const type = act.nodeType ?? "content"
              const kind = (act.nodeKind ?? (type === "workflow" ? "script" : type === "image" ? "uploaded-image" : "text")) as CanvasNodeKind
              const position = act.position ?? getCenteredFlowPosition(
                type === "workflow" ? NODE_DEFAULT_SIZE.workflow : type === "image" ? NODE_DEFAULT_SIZE.image : NODE_DEFAULT_SIZE.content
              )
              const nodeId = generateId()
              const newNode: Node<CanvasNodeData> = {
                id: nodeId,
                type,
                position,
                data: type === "workflow"
                  ? {
                      ...getWorkflowDefaults(kind),
                      ...(act.title ? { title: act.title } : {}),
                      ...(act.prompt ? { prompt: act.prompt } : {}),
                      ...(act.data ?? {}),
                    }
                  : type === "image"
                  ? { title: act.title ?? "Image", nodeKind: kind, createdAt: Date.now(), ...(act.data ?? {}) }
                  : {
                      title: act.title ?? (kind === "text" ? "创意文本" : "新建 Prompt"),
                      prompt: act.prompt ?? (kind === "prompt" ? "在这里输入你的想法..." : ""),
                      content: act.content ?? (kind === "text" ? "在这里输入文本内容..." : ""),
                      nodeKind: kind,
                      createdAt: Date.now(),
                      ...(act.data ?? {}),
                    },
              }
              setNodes((nds) => [...nds, newNode])
              dismissCanvasHint()
              if (act.title) aliasMap[act.title] = nodeId
              results.push({ index: i, action: "create_node", status: "applied", nodeId, reason: act.description })
              break
            }

            case "update_node": {
              if (!act.nodeId) {
                results.push({ index: i, action: "update_node", status: "skipped", reason: "缺少 nodeId" })
                break
              }
              const found = nodesRef.current.find((n) => n.id === act.nodeId)
              if (!found) {
                results.push({ index: i, action: "update_node", status: "skipped", reason: `节点 ${act.nodeId} 不存在` })
                break
              }
              setNodes((nds) =>
                nds.map((n) =>
                  n.id === act.nodeId
                    ? { ...n, data: { ...n.data, ...(act.updates ?? {}) } }
                    : n
                )
              )
              results.push({ index: i, action: "update_node", status: "applied", nodeId: act.nodeId, reason: act.description })
              break
            }

            case "connect_nodes": {
              if (!act.sourceId || !act.targetId) {
                results.push({ index: i, action: "connect_nodes", status: "skipped", reason: "缺少 sourceId 或 targetId" })
                break
              }
              const src = nodesRef.current.find((n) => n.id === act.sourceId)
              const tgt = nodesRef.current.find((n) => n.id === act.targetId)
              if (!src || !tgt) {
                results.push({
                  index: i, action: "connect_nodes", status: "skipped",
                  reason: `${!src ? "源节点" : "目标节点"}不存在`
                })
                break
              }
              const edgeId = generateId()
              setEdges((eds) => [
                ...eds,
                {
                  id: edgeId,
                  source: act.sourceId!,
                  target: act.targetId!,
                  type: "creative",
                  animated: false,
                  style: { stroke: DESIGN_TOKENS.nodeEdge, strokeWidth: 2 },
                },
              ])
              results.push({ index: i, action: "connect_nodes", status: "applied", edgeId, reason: act.description })
              break
            }

            case "delete_node": {
              const did = act.nodeId ?? act.id
              if (!did) {
                results.push({ index: i, action: "delete_node", status: "skipped", reason: "缺少 nodeId" })
                break
              }
              const exists = nodesRef.current.find((n) => n.id === did)
              if (!exists) {
                results.push({ index: i, action: "delete_node", status: "skipped", reason: `节点 ${did} 不存在` })
                break
              }
              setNodes((nds) => nds.filter((n) => n.id !== did))
              setEdges((eds) => eds.filter((e) => e.source !== did && e.target !== did))
              if (selectedNodeId === did) setSelectedNodeId(null)
              results.push({ index: i, action: "delete_node", status: "applied", nodeId: did, reason: act.description })
              break
            }

            case "select_node": {
              const sid = act.nodeId ?? act.id
              if (sid) setSelectedNodeId(sid)
              results.push({ index: i, action: "select_node", status: "applied", nodeId: sid, reason: act.description })
              break
            }

            case "focus_node": {
              const fid = act.nodeId ?? act.id
              if (!fid) {
                results.push({ index: i, action: "focus_node", status: "skipped", reason: "缺少 nodeId" })
                break
              }
              const target = nodesRef.current.find((n) => n.id === fid)
              if (!target || !reactFlowInstance) {
                results.push({ index: i, action: "focus_node", status: "skipped", reason: target ? "画布未就绪" : `节点 ${fid} 不存在` })
                break
              }
              reactFlowInstance.setCenter(
                target.position.x + (target.measured?.width ?? 280) / 2,
                target.position.y + (target.measured?.height ?? 200) / 2,
                { duration: 600, zoom: 1.1 }
              )
              setSelectedNodeId(fid)
              results.push({ index: i, action: "focus_node", status: "applied", nodeId: fid, reason: act.description })
              break
            }

            case "run_node": {
              const rid = act.nodeId ?? act.id
              if (!rid) {
                results.push({ index: i, action: "run_node", status: "skipped", reason: "缺少 nodeId" })
                break
              }
              const runTarget = nodesRef.current.find((n) => n.id === rid)
              if (!runTarget) {
                results.push({ index: i, action: "run_node", status: "skipped", reason: `节点 ${rid} 不存在` })
                break
              }
              // Safety: only auto-run if user explicitly allowed it
              if (!allowAIAutoRun) {
                // Mark node as pending confirmation via runMeta
                setNodes((nds) =>
                  nds.map((n) =>
                    n.id === rid
                      ? {
                            ...n,
                            data: {
                              ...n.data,
                              runMeta: createPendingRunMeta({
                                reason: "AI 请求运行此节点，需用户确认。",
                                source: "ai",
                              }),
                              pendingExecution: true, // 兼容旧字段
                            },
                          }
                      : n
                  )
                )
                setSelectedNodeId(rid)
                results.push({
                  index: i, action: "run_node", status: "pending_confirmation",
                  nodeId: rid, reason: "AI 建议运行此节点，需用户确认",
                })
                break
              }
              setSelectedNodeId(rid)
              setTimeout(() => {
                workflowRunner.runNode(rid)
              }, 150)
              results.push({ index: i, action: "run_node", status: "applied", nodeId: rid, reason: act.description })
              break
            }

            default:
              results.push({ index: i, action: (act as any).action ?? "unknown", status: "skipped", reason: "未知 action 类型" })
              console.warn("[applyChatActions] Unknown action:", act)
          }
        } catch (err: any) {
          results.push({
            index: i, action: act.action, status: "failed",
            error: err?.message ?? String(err),
            reason: `执行异常: ${err?.message ?? String(err)}`,
          })
        }
      }

      const report: ApplyActionsReport = {
        total: actions.length,
        applied: results.filter((r) => r.status === "applied").length,
        skipped: results.filter((r) => r.status === "skipped").length,
        failed: results.filter((r) => r.status === "failed").length,
        pendingConfirmation: results.filter((r) => r.status === "pending_confirmation").length,
        results,
        aliasMap,
      }

      return report
    },
    [getCenteredFlowPosition, setNodes, setEdges, setSelectedNodeId, reactFlowInstance, dismissCanvasHint, selectedNodeId, allowAIAutoRun]
  )

  // ========================================================================
  // ADD IMAGE FROM CHAT ATTACHMENT
  // ========================================================================
  const handleAddImageFromChat = useCallback(
    (attachment: ChatAttachment) => {
      const isImage = attachment.type === "image"
      const isAiGenerated = !attachment.file // AI-generated images don't have a File object
      const nodeKind = isAiGenerated
        ? "ai-generated-image"
        : attachment.type === "video"
          ? "uploaded-video"
          : attachment.type === "audio"
            ? "uploaded-audio"
            : attachment.type === "file"
              ? "uploaded-file"
              : "uploaded-image"

      let width = attachment.width || 200
      let height = attachment.height || 150

      if (isImage) {
        const maxWidth = IMAGE_NODE_SIZE.maxWidth
        const maxHeight = IMAGE_NODE_SIZE.maxHeight

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
      }

      const position = getCenteredFlowPosition(isImage
        ? { width, height: height + IMAGE_NODE_TITLE_HEIGHT }
        : NODE_DEFAULT_SIZE.workflow
      )

      const newNode: Node<CanvasNodeData> = isImage
        ? {
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
              nodeKind,
              createdAt: Date.now(),
            },
            measured: {
              width,
              height: height + IMAGE_NODE_TITLE_HEIGHT,
            },
          }
        : {
            id: generateId(),
            type: "workflow",
            position,
            data: {
              title: attachment.name,
              nodeKind,
              workflowRole: attachment.type === "video" ? "Video Asset" : attachment.type === "audio" ? "Audio Asset" : "File Asset",
              status: "ready",
              summary: "来自 Chat 附件，可连接到视频生成、音频、字幕或合成节点。",
              fileName: attachment.name,
              fileSize: attachment.size,
              mimeType: attachment.mimeType,
              assetUrl: attachment.src,
              outputs: [{ label: attachment.type === "video" ? "视频素材" : attachment.type === "audio" ? "音频素材" : "文件素材", type: attachment.type }],
              createdAt: Date.now(),
            },
          }

      setNodes((nds) => [...nds, newNode])
      dismissCanvasHint()

      if (DEBUG_NODE) {
        console.log("[DEBUG_NODE] Added attachment from chat:", newNode.id)
      }
    },
    [getCenteredFlowPosition, setNodes, dismissCanvasHint]
  )

  // ========================================================================
  // SAVE TO ASSET LIBRARY
  // ========================================================================
  const handleSaveToAssetLibrary = useCallback(
    (nodeId: string) => {
      const node = nodesRef.current.find((n) => n.id === nodeId)
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
  // AI VARIANT FOR IMAGE NODE
  // ========================================================================
  const handleAIVariant = useCallback(
    async (nodeId: string) => {
      const node = nodesRef.current.find((n) => n.id === nodeId)
      if (!node) return

      const title = node.data.title || node.data.fileName || "图片"
      const promptText = `Generate a variation of this image: ${title}`

      try {
        const res = await fetch("/api/ai/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: promptText,
            model: "gpt-image-2",
          }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || `API error: ${res.status}`)
        }

        const result = await res.json()
        if (!result.imageUrl) throw new Error("No image data returned")

        const imageUrl = result.imageUrl

        const newNode = {
          id: generateId(),
          type: "image" as const,
          position: { x: node.position.x + 320, y: node.position.y + 20 },
          data: {
            title: `变体: ${title}`,
            imageUrl,
            nodeKind: "ai-generated-image" as const,
            sourcePromptId: nodeId,
            displayWidth: node.data.displayWidth || 280,
            displayHeight: node.data.displayHeight || 200,
            createdAt: Date.now(),
          },
        }

        setNodes((nds) => [...nds, newNode])
        setEdges((eds) => [...eds, {
          id: `edge-${nodeId}-${newNode.id}`,
          source: nodeId,
          target: newNode.id,
          type: "creative",
          animated: true,
          style: { stroke: DESIGN_TOKENS.nodeEdge, strokeWidth: 2 },
        }])
      } catch (err) {
        console.error("AI variant failed:", err)
      }
    },
    [setNodes, setEdges]
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

      if ((e.metaKey || e.ctrlKey) && e.key === "r" && selectedNodeId) {
        e.preventDefault()
        const plan = buildExecutionPlan({
          mode: "single",
          rootNodeIds: [selectedNodeId],
          nodes: nodesRef.current,
          edges,
          canvasId: "current",
        })
        workflowRunner.runExecutionPlan(plan)
      }

      // Ctrl+Shift+P: open Prompt Preview for selected node
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "p" && selectedNodeId) {
        e.preventDefault()
        useCanvasStore.getState().openPromptPreview(selectedNodeId)
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
    edges,
    workflowRunner,
  ])

  // ========================================================================
  // RENDER
  // ========================================================================
  return (
      <div className="relative h-screen w-screen overflow-hidden startrails-flow">
      <div className="fixed left-20 top-3 z-20 flex items-center gap-2">
        <div className="pointer-events-none rounded-2xl border px-4 py-2 text-xs shadow-lg backdrop-blur-xl" style={{ borderColor: DESIGN_TOKENS.border, backgroundColor: "rgba(18,18,24,0.7)", color: DESIGN_TOKENS.textSecondary }}>
          <div className="font-semibold" style={{ color: DESIGN_TOKENS.text }}>星轨画布（前期）</div>
          <div className="mt-0.5 text-[11px]" style={{ color: DESIGN_TOKENS.textMuted }}>创意构思 / 分镜草稿 / 视觉设计 / 项目包交接</div>
        </div>
        <button
          type="button"
          onClick={handleExportProjectPackage}
          className="flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-medium backdrop-blur-xl transition hover:bg-white/10" style={{ borderColor: DESIGN_TOKENS.border, backgroundColor: DESIGN_TOKENS.accentSoft, color: DESIGN_TOKENS.textSecondary }}
          title="导出 startrails-project.json，交给星轨画布（后期）继续制作"
        >
          <Download size={14} strokeWidth={1.7} />
          <span>导出项目包</span>
        </button>
      </div>

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
        onDrop={combinedHandleDrop}
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
          onUploadImage={handleUploadClick}
          onCreateVideoWorkflow={handleCreateVideoWorkflow}
        />
      )}

      {/* Left Toolbar */}
      <LeftToolbar
        onOpenAssetLibrary={openAssetLibrary}
        onCreateNode={() => handleAddNode("content")}
        onUploadImage={handleUploadClick}
        onAddText={() => handleAddNode("content", undefined, "text" as CanvasNodeKind)}
        onCreateVideoWorkflow={handleCreateVideoWorkflow}
        onToggleChat={() => setChatOpen((prev) => !prev)}
        isChatOpen={chatOpen}
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
                {/* 缩放滑块 - 真实可拖拽的 range input */}
        <input
          type="range"
          min={ZOOM_CONSTRAINTS.minZoom}
          max={ZOOM_CONSTRAINTS.maxZoom}
          step={0.01}
          value={viewport.zoom}
          onChange={(e) => reactFlowInstance?.zoomTo(parseFloat(e.target.value), { duration: 100 })}
          className="mx-1 h-1 w-20 cursor-pointer rounded-full"
          style={{
            background: `linear-gradient(to right, ${DESIGN_TOKENS.textMuted} ${((viewport.zoom - ZOOM_CONSTRAINTS.minZoom) / (ZOOM_CONSTRAINTS.maxZoom - ZOOM_CONSTRAINTS.minZoom)) * 100}%, rgba(255,255,255,0.1) ${((viewport.zoom - ZOOM_CONSTRAINTS.minZoom) / (ZOOM_CONSTRAINTS.maxZoom - ZOOM_CONSTRAINTS.minZoom)) * 100}%)`,
            accentColor: DESIGN_TOKENS.textMuted,
          }}
        />
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
        {/* 执行工作流按钮 */}
        {hasWorkflowNodes && (
          <>
            <div
              className="mx-1 h-3 w-px"
              style={{ backgroundColor: DESIGN_TOKENS.border }}
            />
            <button
              onClick={() => workflowRunner.state.isRunning ? workflowRunner.stopWorkflow() : workflowRunner.runWorkflow()}
              className="flex h-7 items-center gap-1 rounded-full px-2.5 text-xs transition-colors hover:bg-white/10"
              style={{
                color: workflowRunner.state.isRunning ? "#f59e0b" : DESIGN_TOKENS.textSecondary,
              }}
              title={workflowRunner.state.isRunning ? `停止 (${workflowRunner.state.progress}%)` : "执行工作流"}
            >
              {workflowRunner.state.isRunning ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  <span className="tabular-nums">{workflowRunner.state.progress}%</span>
                </>
              ) : (
                <>
                  <Sparkles size={12} />
                  <span>执行</span>
                </>
              )}
            </button>
          </>
        )}
      </div>

      {/* Canvas Context Menu */}
      {typeof document !== "undefined" &&
        createPortal(
          <CanvasContextMenu
            state={contextMenu}
            onClose={closeContextMenu}
            onAddNode={(type, position, nodeKind) => handleAddNode(type, position, nodeKind as CanvasNodeKind)}
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
            onViewHistory={() => {
              if (contextMenu?.type === "node") {
                setHistoryNodeId(contextMenu.nodeId)
                setShowNodeHistory(true)
              }
            }}
            onRunCurrentNode={() => {
              if (contextMenu?.type === "node") {
                const plan = buildExecutionPlan({
                  mode: "single",
                  rootNodeIds: [contextMenu.nodeId],
                  nodes: nodesRef.current,
                  edges,
                  canvasId: "current",
                })
                workflowRunner.runExecutionPlan(plan)
              }
            }}
            onRunUpstreamAndCurrent={() => {
              if (contextMenu?.type === "node") {
                const plan = buildExecutionPlan({
                  mode: "upstream",
                  rootNodeIds: [contextMenu.nodeId],
                  nodes: nodesRef.current,
                  edges,
                  canvasId: "current",
                })
                workflowRunner.runExecutionPlan(plan)
              }
            }}
            onRunDownstreamChain={() => {
              if (contextMenu?.type === "node") {
                const plan = buildExecutionPlan({
                  mode: "downstream",
                  rootNodeIds: [contextMenu.nodeId],
                  nodes: nodesRef.current,
                  edges,
                  canvasId: "current",
                })
                workflowRunner.runExecutionPlan(plan)
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
            onAIVariant={() => {
              if (floatingToolbar?.type === "image-hover") {
                handleAIVariant(floatingToolbar.nodeId)
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
                type: asset.type === "image" ? "image" : "content",
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

      {/* Node History Panel */}
      {showNodeHistory && typeof document !== "undefined" &&
        createPortal(
          <NodeHistoryPanel
            isOpen={showNodeHistory}
            onClose={() => {
              setShowNodeHistory(false)
              setHistoryNodeId(null)
            }}
            nodeId={historyNodeId}
            nodeTitle={
              historyNodeId
                ? nodes.find((n) => n.id === historyNodeId)?.data?.title
                  ?? nodes.find((n) => n.id === historyNodeId)?.data?.label as string
                  ?? historyNodeId.slice(0, 8)
                : undefined
            }
            currentHistoryId={
              historyNodeId
                ? nodes.find((n) => n.id === historyNodeId)?.data?.runMeta?.currentHistoryId
                : undefined
            }
            onRestorePrompt={(nId, hId) => {
              workflowRunner.restorePromptFromHistory(nId, hId)
            }}
            onRetry={(nId, hId) => {
              workflowRunner.retryFromHistory(nId, hId)
            }}
          />,
          document.body
        )}

      {/* P2-3A: Workflow Run Panel */}
      <WorkflowRunPanel
        isOpen={showRunPanel}
        onClose={() => {
          setShowRunPanel(false)
          // 面板关闭时保留最后一个 run 的 events 供下次查看
          // 新 run 开始时 events 会被清空重建
        }}
        events={runEvents}
        isRunning={workflowRunner.state.isRunning}
      />

      {/* Prompt Preview Panel (Phase 1-c Step 2) */}
      <PromptPreviewPanel
        isOpen={showPromptPreview}
        onClose={closePromptPreview}
        nodeId={promptPreviewNodeId}
      />

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
        onApplyChatActions={applyChatActions}
        showHistoryFromOutside={showHistory}
        onHistoryPanelClosed={() => setShowHistory(false)}
      />
    </div>
  )
}
// StarCanvasInner closes here
// StarCanvas (outer) closes via ReactFlowProvider wrapping

