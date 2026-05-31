// ============================================================================
// StarCanvas - 主画布组件 (TapNow-inspired 重构版)
// ============================================================================
"use client";

import "@xyflow/react/dist/style.css";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  type EdgeMouseHandler,
} from "@xyflow/react";
import {
  memo,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

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
  Wand2,
  Image as ImageIcon,
  Settings2,
  Eye,
  type LucideIcon,
} from "lucide-react";

// ============================================================================
// DESIGN SYSTEM
// ============================================================================
import { DESIGN_TOKENS, ICON_CONFIG } from "./styles/designSystem";

// ============================================================================
// TYPES
// ============================================================================
import type {
  CanvasNodeData,
  CanvasNodeKind,
  AssetItem,
  StoryboardResultQuality,
} from "./components/canvas/types";

// ============================================================================
// HOOKS & STORES
// ============================================================================
import { useCanvasStore } from "./stores/canvasStore";
import { useCanvasDropUpload } from "./hooks/useCanvasDropUpload";
import { useHistoryDrop } from "./hooks/useHistoryDrop";
import type { ChatAttachment } from "./hooks/useChatAttachments";

// ============================================================================
// COMPONENTS
// ============================================================================
import { EmptyCanvasGuide } from "./components/canvas/EmptyCanvasGuide";
import { CanvasDropOverlay } from "./components/canvas/CanvasDropOverlay";
import { AssetLibraryPanel } from "./components/canvas/AssetLibraryPanel";
import { CanvasContextMenu } from "./components/menus/CanvasContextMenu";
import { NodeContextMenu } from "./components/menus/NodeContextMenu";
import { EdgeContextMenu } from "./components/menus/EdgeContextMenu";
import { ImageHoverToolbar } from "./components/toolbar/ImageHoverToolbar";
import { LeftToolbar } from "./components/toolbar/LeftToolbar";
import { AddNodePanel } from "./components/toolbar/AddNodePanel";
import { ChatPanel } from "./components/chat/ChatPanel";
import { SettingsPanel } from "./components/panels/SettingsPanel";
import { NodeHistoryPanel } from "./components/history/NodeHistoryPanel";
import { WorkspaceHistoryPanel } from "./components/history/WorkspaceHistoryPanel";
import { WorkflowRunPanel } from "./components/workflow/WorkflowRunPanel";
import { PromptPreviewPanel } from "./components/preview/PromptPreviewPanel";
import { SourceTracePanel } from "./components/preview/SourceTracePanel";
import ImageNode, {
  registerImageHoverHandlers,
  unregisterImageHoverHandlers,
} from "./components/nodes/ImageNode";
import ContentNode from "./components/nodes/ContentNode";
import WorkflowNode from "./components/nodes/WorkflowNode";
import ShotNode from "./components/nodes/ShotNode";
import StoryboardGridNode from "./components/nodes/StoryboardGridNode";
import { generateId } from "./utils/generateId";
import { quickLayout } from "./utils/dagre-layout";
import { parseStoryboardTextToShots } from "./utils/storyboardParser";
import { generateImageFromPrompt } from "./utils/imageGeneration";
import { composeStoryboardGrid } from "./utils/storyboardGridComposer";
import { buildVideoWorkflowTemplate } from "./utils/videoWorkflowTemplate";
import { useWorkflowRunner } from "./hooks/useWorkflowRunner";
import { buildExecutionPlan } from "./utils/execution-plan";
import { useCanvasPersistence } from "./hooks/useCanvasPersistence";
import {
  createFailedRunMeta,
  createIdleRunMeta,
  createPendingRunMeta,
  createRunningRunMeta,
  createSucceededRunMeta,
} from "./utils/nodeRunMeta";
import {
  persistImageFile,
  persistImageDataUrl,
  hydrateImageAsset,
  getLocalImageAsset,
  revokeAllTrackedObjectUrls,
} from "@/lib/assets/localImageStore";
import {
  createDocumentNode,
  isTextDocumentFile,
  readTextDocumentFile,
} from "@/lib/documents/textDocumentImport";
import { prepareReferenceImageForGeneration } from "@/lib/images/prepareReferenceImage";
import {
  getImageProviderCapability,
  assertImageToImageSupported,
} from "@/lib/ai/imageProviderCapabilities";
import {
  normalizeGenerationError,
  formatGenerationErrorForDisplay,
} from "@/lib/ai/normalizeGenerationError";
import { createImageGenerationSnapshot } from "@/lib/ai/createGenerationSnapshot";
import { createShotImageNode } from "@/lib/storyboard/createShotImageNode";
import {
  STORYBOARD_SHOT_LAYOUT,
  createNormalizedShotTitle,
  createStoryboardSourceEdge,
  getStoryboardGridPosition,
  getStoryboardShotPosition,
} from "@/lib/storyboard/layoutStoryboardShots";
import {
  DEFAULT_STORYBOARD_COMPOSITE_SETTINGS,
  STORYBOARD_FRAME_ASPECT_RATIO,
  buildStoryboardCompositePrompt,
  createStoryboardCompositeEdges,
  getShotImageUrlFromCanvas,
  shouldUseLocalStoryboardCompose,
  validateStoryboardGridImageUrls,
  type StoryboardCompositeLayout,
  type StoryboardCompositeSettings,
} from "@/lib/storyboard/storyboardComposite";
import type {
  ChatCanvasAction,
  ApplyActionsReport,
  ApplyActionResult,
} from "./features/canvas/actions/chatActions";
import type { WorkflowRunEvent } from "./types/workflow-run";
import type { CanvasSnapshot } from "./types/canvas-snapshot";
import { useCanvasSnapshotStore } from "./stores/useCanvasSnapshotStore";
import { useWorkspaceHistoryStore } from "./stores/useWorkspaceHistoryStore";
import {
  CANVAS_SNAPSHOT_SCHEMA_VERSION,
  sanitizeAndValidateCanvasSnapshot,
} from "./utils/canvasSnapshotSanitizer";

// ============================================================================
// DEBUG SWITCHES
// ============================================================================
const isDebugEnabled = (key: string) =>
  typeof window !== "undefined" && window.localStorage.getItem(key) === "1";

const DEBUG_DROP = isDebugEnabled("DEBUG_DROP_UPLOAD");
const DEBUG_AI = isDebugEnabled("DEBUG_AI_PAYLOAD");
const DEBUG_NODE = isDebugEnabled("DEBUG_NODE_ACTIONS");

// ============================================================================
// CONSTANTS
// ============================================================================
const DEFAULT_ZOOM = 0.85;
const CHAT_PANEL_WIDTH = 400;
const LEFT_TOOLBAR_SAFE_WIDTH = 88;
const IMAGE_NODE_TITLE_HEIGHT = 22;
const IMAGE_NODE_SIZE = {
  minWidth: 120,
  minHeight: 96,
  maxWidth: 220,
  maxHeight: 180,
};
const NODE_DEFAULT_SIZE = {
  content: { width: 680, height: 560 },
  image: { width: 220, height: 172 },
  workflow: { width: 280, height: 170 },
} satisfies Record<
  "content" | "image" | "workflow",
  { width: number; height: number }
>;
const ZOOM_CONSTRAINTS = {
  minZoom: 0.25,
  maxZoom: 2,
};
const SHOT_GENERATION_WATCHDOG_TIMEOUT_MS = 90_000;
const SHOT_GENERATION_WATCHDOG_INTERVAL_MS = 10_000;
const SHOT_GENERATION_BATCH_CONCURRENCY = 1;
const STORYBOARD_FINAL_OUTPUT_OFFSET_X = 420;
const STORYBOARD_PROCESS_NODE_OFFSET_X = 860;
const STORYBOARD_PROCESS_IMAGE_OFFSET_X = STORYBOARD_PROCESS_NODE_OFFSET_X + STORYBOARD_SHOT_LAYOUT.shotWidth + 72;
const STORYBOARD_PROCESS_GRID_OFFSET_X = STORYBOARD_PROCESS_IMAGE_OFFSET_X + 400;

function getStoryboardProcessNodePosition(sourceNode: Node<CanvasNodeData>, index: number) {
  return {
    x: sourceNode.position.x + STORYBOARD_PROCESS_NODE_OFFSET_X,
    y: sourceNode.position.y + index * STORYBOARD_SHOT_LAYOUT.rowGap,
  };
}

function getStoryboardProcessImagePosition(sourceNode: Node<CanvasNodeData>, index: number) {
  return {
    x: sourceNode.position.x + STORYBOARD_PROCESS_IMAGE_OFFSET_X,
    y: sourceNode.position.y + index * STORYBOARD_SHOT_LAYOUT.rowGap,
  };
}

function getStoryboardProcessGridPosition(sourceNode: Node<CanvasNodeData>, shotCount: number) {
  return {
    x: sourceNode.position.x + STORYBOARD_PROCESS_GRID_OFFSET_X,
    y: sourceNode.position.y + Math.max(0, Math.floor((Math.max(1, shotCount) - 1) / 2)) * STORYBOARD_SHOT_LAYOUT.rowGap,
  };
}

function getStoryboardFinalOutputPosition(sourceNode?: Node<CanvasNodeData>) {
  return sourceNode
    ? { x: sourceNode.position.x + STORYBOARD_FINAL_OUTPUT_OFFSET_X, y: sourceNode.position.y }
    : { x: 0, y: 0 };
}

function isStoryboardProcessNode(node: Node<CanvasNodeData>, sourceNodeId: string) {
  const data = node.data;
  return Boolean(
    (data.sourceStoryboardNodeId === sourceNodeId ||
      data.storyboardGrid?.sourceStoryboardNodeId === sourceNodeId ||
      data.shot?.sourceStoryboardNodeId === sourceNodeId) &&
      (node.type === "shot" ||
        node.type === "storyboardGrid" ||
        data.role === "storyboard-process" ||
        data.role === "shot-image" ||
        data.isStoryboardProcessNode === true),
  );
}

function isStoryboardFinalOutputNode(node: Node<CanvasNodeData>, sourceNodeId: string) {
  const data = node.data;
  return Boolean(
    data.sourceStoryboardNodeId === sourceNodeId &&
      (data.role === "storyboard-final-output" || data.isStoryboardFinalOutput === true),
  );
}

function getVisibleCanvasNodes(nodes: Node<CanvasNodeData>[]) {
  return nodes.filter((node) => node.hidden !== true);
}

function shouldRecoverHiddenCanvasNode(node: Node<CanvasNodeData>) {
  const data = node.data;
  const isStoryboardProcess =
    data.role === "storyboard-process" ||
    data.role === "shot-image" ||
    data.isStoryboardProcessNode === true ||
    data.hiddenByStoryboardProcessMode === true ||
    node.type === "shot" ||
    node.type === "storyboardGrid";

  return !isStoryboardProcess;
}

function applyFallbackCanvasLayout(nodes: Node<CanvasNodeData>[]) {
  return nodes.map((node, index) => {
    const hasValidPosition =
      node.position &&
      Number.isFinite(node.position.x) &&
      Number.isFinite(node.position.y);

    if (hasValidPosition) return node;

    return {
      ...node,
      position: {
        x: 120 + (index % 3) * 460,
        y: 120 + Math.floor(index / 3) * 360,
      },
    };
  });
}

function applyCanvasVisibilityRecovery(nodes: Node<CanvasNodeData>[]) {
  const visibleNodes = getVisibleCanvasNodes(nodes);
  if (visibleNodes.length > 0) return nodes;

  const primaryRecoverableIds = nodes
    .filter((node) => node.hidden === true && shouldRecoverHiddenCanvasNode(node))
    .map((node) => node.id);
  const fallbackRecoverableIds = nodes
    .filter((node) => node.hidden === true)
    .map((node) => node.id);
  const recoverableIds = new Set(
    primaryRecoverableIds.length > 0 ? primaryRecoverableIds : fallbackRecoverableIds,
  );

  if (recoverableIds.size === 0) return nodes;

  return nodes.map((node) =>
    recoverableIds.has(node.id)
      ? {
          ...node,
          hidden: false,
          data: {
            ...node.data,
            hiddenByStoryboardProcessMode: false,
          },
        }
      : node,
  );
}

function applyCanvasVisibilityAndLayoutRecovery(nodes: Node<CanvasNodeData>[]) {
  return applyFallbackCanvasLayout(applyCanvasVisibilityRecovery(nodes));
}

function applyStoryboardProcessVisibility(params: {
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
  sourceNodeId: string;
  showProcess: boolean;
}) {
  const processNodeIds = new Set(
    params.nodes
      .filter((node) => isStoryboardProcessNode(node, params.sourceNodeId))
      .map((node) => node.id),
  );
  const finalOutputNodeIds = new Set(
    params.nodes
      .filter((node) => isStoryboardFinalOutputNode(node, params.sourceNodeId))
      .map((node) => node.id),
  );

  const nodes = params.nodes.map((node) => {
    if (processNodeIds.has(node.id)) {
      return {
        ...node,
        hidden: !params.showProcess,
        data: {
          ...node.data,
          hiddenByStoryboardProcessMode: !params.showProcess,
        },
      };
    }
    if (finalOutputNodeIds.has(node.id)) {
      return { ...node, hidden: false };
    }
    return node;
  });

  const edges = params.edges.map((edge) => {
    const touchesProcess = processNodeIds.has(edge.source) || processNodeIds.has(edge.target);
    const isSourceToFinal = edge.source === params.sourceNodeId && finalOutputNodeIds.has(edge.target);
    if (isSourceToFinal) return { ...edge, hidden: false };
    if (touchesProcess) return { ...edge, hidden: !params.showProcess };
    return edge;
  });

  return { nodes, edges };
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<Array<PromiseSettledResult<R>>> {
  const results: Array<PromiseSettledResult<R>> = new Array(items.length);
  let nextIndex = 0;

  async function runNext() {
    const currentIndex = nextIndex;
    nextIndex += 1;
    if (currentIndex >= items.length) return;

    try {
      results[currentIndex] = {
        status: "fulfilled",
        value: await worker(items[currentIndex], currentIndex),
      };
    } catch (reason) {
      results[currentIndex] = { status: "rejected", reason };
    }

    await runNext();
  }

  const workerCount = Math.min(Math.max(1, limit), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runNext()));
  return results;
}

// ============================================================================
// Custom Edge Component
// ============================================================================
const CreativeEdge = memo(
  ({
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
    });

    return (
      <>
        <BaseEdge
          id={id}
          path={edgePath}
          style={{
            ...style,
            stroke: DESIGN_TOKENS.nodeEdge,
            strokeWidth: 1.5,
            filter: animated
              ? "drop-shadow(0 0 3px rgba(148, 163, 184, 0.3))"
              : undefined,
          }}
        />
        {animated && (
          <circle r={4} fill={DESIGN_TOKENS.nodeHandle}>
            <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} />
          </circle>
        )}
      </>
    );
  },
);
CreativeEdge.displayName = "CreativeEdge";

// ============================================================================
// Node Types
// ============================================================================
const nodeTypes = {
  image: ImageNode,
  content: ContentNode,
  workflow: WorkflowNode,
  shot: ShotNode,
  storyboardGrid: StoryboardGridNode,
};

const edgeTypes = { creative: CreativeEdge };

// ============================================================================
// STAR CANVAS (OUTER - provides ReactFlowProvider)
// ============================================================================
export default function StarCanvas() {
  return (
    <ReactFlowProvider>
      <StarCanvasInner />
    </ReactFlowProvider>
  );
}

// ============================================================================
// HELPERS (used across the component)
// ============================================================================
// Extracts readable text from a canvas node for export/package generation
function getNodeText(node: Node<CanvasNodeData>): string {
  const data = (node.data || {}) as Record<string, unknown>;
  return [data.title, data.summary, data.content, data.prompt]
    .filter(Boolean)
    .join("\n");
}

// ============================================================================
// STAR CANVAS INNER (uses hooks that require ReactFlow context)
// ============================================================================
function StarCanvasInner() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const pendingDocumentUploadPositionRef = useRef<{ x: number; y: number } | null>(null);

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
  } = useCanvasStore();

  // ========================================================================
  // REACT FLOW STATE
  // ========================================================================
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<CanvasNodeData>>(
    [],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  // Cache nodes/edges in refs so callbacks don't need state deps (avoids re-registering)
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const latestShotGenerationRequestIdsRef = useRef<Record<string, string>>({});
  nodesRef.current = nodes;
  edgesRef.current = edges;

  useEffect(() => {
    return () => {
      revokeAllTrackedObjectUrls();
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setNodes((nds) =>
        nds.map((node) => {
          const shot = node.data.shot;
          if (!shot || shot.generationStatus !== "generating") return node;

          const startedAt = shot.generationStartedAt ?? 0;
          if (!startedAt || now - startedAt < SHOT_GENERATION_WATCHDOG_TIMEOUT_MS) {
            return node;
          }

          if (shot.generationRequestId) {
            delete latestShotGenerationRequestIdsRef.current[node.id];
          }

          const message = "图片生成超过 90 秒仍未返回，已自动标记为失败。请点击重试。";
          return {
            ...node,
            data: {
              ...node.data,
              generation: node.data.generation
                ? {
                    ...node.data.generation,
                    status: "failed" as const,
                    completedAt: new Date().toISOString(),
                    error: message,
                  }
                : node.data.generation,
              shot: {
                ...shot,
                status: "error" as const,
                generationStatus: "failed" as const,
                generationFinishedAt: now,
                generationErrorCode: "WATCHDOG_TIMEOUT",
                generationRetryable: true,
                errorMessage: message,
                generationError: message,
              },
            },
          };
        }),
      );
    }, SHOT_GENERATION_WATCHDOG_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [setNodes]);

  // ========================================================================
  // LOCAL STATE
  // ========================================================================
  const [chatOpen, setChatOpen] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showWorkspaceHistory, setShowWorkspaceHistory] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddNodePanel, setShowAddNodePanel] = useState(false);
  const [showNodeHistory, setShowNodeHistory] = useState(false);
  const [historyNodeId, setHistoryNodeId] = useState<string | null>(null);
  const [isComposingSelectedShots, setIsComposingSelectedShots] = useState(false);
  const [showStoryboardCompositeSettings, setShowStoryboardCompositeSettings] =
    useState(false);
  const [storyboardCompositeSettings, setStoryboardCompositeSettings] =
    useState<StoryboardCompositeSettings>(DEFAULT_STORYBOARD_COMPOSITE_SETTINGS);
  const [draftStoryboardCompositeSettings, setDraftStoryboardCompositeSettings] =
    useState<StoryboardCompositeSettings>(DEFAULT_STORYBOARD_COMPOSITE_SETTINGS);

  // SourceTracePanel state
  const [showSourceTrace, setShowSourceTrace] = useState(false);
  const [traceHistoryId, setTraceHistoryId] = useState<string | null>(null);
  const [traceNodeInfo, setTraceNodeInfo] = useState<{
    nodeId: string;
    nodeTitle?: string;
  } | null>(null);

  // P2-3A: WorkflowRunPanel state
  const [showRunPanel, setShowRunPanel] = useState(false);
  const [runEvents, setRunEvents] = useState<WorkflowRunEvent[]>([]);
  const appendWorkspaceHistory = useWorkspaceHistoryStore((state) => state.append);
  const addCanvasSnapshot = useCanvasSnapshotStore((state) => state.addSnapshot);

  const addWorkspaceHistoryEvent = useCallback(
    (event: Parameters<typeof appendWorkspaceHistory>[0]) => {
      appendWorkspaceHistory(event);
    },
    [appendWorkspaceHistory],
  );

  const createDocumentDerivedNode = useCallback(
    (nodeId: string, target: "inspiration" | "storyboard") => {
      const sourceNode = nodesRef.current.find((node) => node.id === nodeId);
      if (!sourceNode || sourceNode.data.nodeKind !== "document") return;

      const sourceText = [
        sourceNode.data.content,
        sourceNode.data.prompt,
        sourceNode.data.summary,
      ]
        .filter(
          (part): part is string =>
            typeof part === "string" && part.trim().length > 0,
        )
        .map((part) => part.trim())[0];

      if (!sourceText) {
        setNodes((nds) =>
          nds.map((node) =>
            node.id === nodeId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    errorMessage: "这个文档节点是空的，请先补充正文。",
                  },
                }
              : node,
          ),
        );
        return;
      }

      const derivedNodeId = generateId();
      const isStoryboard = target === "storyboard";
      const defaultSize = isStoryboard
        ? NODE_DEFAULT_SIZE.content
        : NODE_DEFAULT_SIZE.workflow;
      const derivedNode: Node<CanvasNodeData> = {
        id: derivedNodeId,
        type: isStoryboard ? "content" : "workflow",
        position: {
          x: sourceNode.position.x + (sourceNode.measured?.width || defaultSize.width) + 80,
          y: sourceNode.position.y,
        },
        width: defaultSize.width,
        height: defaultSize.height,
        measured: defaultSize,
        data: isStoryboard
          ? {
              title: "故事分镜",
              nodeKind: "storyboard",
              content: sourceText,
              prompt: sourceText,
              summary: `由文档《${sourceNode.data.title || sourceNode.data.fileName || "未命名文档"}》转入。`,
              storyboardAssistantStage: "idea",
              autoSizeMode: "fixed-width-height-grows",
              displayWidth: defaultSize.width,
              displayHeight: defaultSize.height,
              sourceType: "document",
              sourcePromptId: nodeId,
              createdAt: Date.now(),
            }
          : {
              ...getWorkflowDefaults("script"),
              title: "灵感碎片",
              content: sourceText,
              prompt: sourceText,
              summary: `从文档《${sourceNode.data.title || sourceNode.data.fileName || "未命名文档"}》提炼故事种子。`,
              sourceType: "document",
              sourcePromptId: nodeId,
              createdAt: Date.now(),
            },
      };

      setNodes((nds) => [
        ...nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, errorMessage: undefined } }
            : node,
        ),
        derivedNode,
      ]);
      setEdges((eds) => [
        ...eds,
        {
          id: `edge-${nodeId}-${derivedNodeId}`,
          source: nodeId,
          target: derivedNodeId,
          type: "creative",
          animated: true,
          style: { stroke: DESIGN_TOKENS.nodeEdge, strokeWidth: 1.5 },
          data: {
            relation: isStoryboard
              ? "document-to-storyboard"
              : "document-to-inspiration",
          },
        },
      ]);
      setSelectedNodeId(derivedNodeId);
      addWorkspaceHistoryEvent({
        id: generateId(),
        type: "node-created",
        title: isStoryboard ? "文档进入故事分镜" : "文档转为灵感碎片",
        summary: sourceNode.data.title || sourceNode.data.fileName,
        nodeId: derivedNodeId,
        relatedNodeIds: [nodeId, derivedNodeId],
        createdAt: new Date().toISOString(),
      });
    },
    [setNodes, setEdges, setSelectedNodeId, addWorkspaceHistoryEvent],
  );

  const handleCreateStoryboardAssistantFromInspiration = useCallback(
    (nodeId: string) => {
      const sourceNode = nodesRef.current.find((node) => node.id === nodeId);
      if (!sourceNode || sourceNode.data.nodeKind !== "script") return;

      const sourceTextParts = [
        sourceNode.data.content,
        sourceNode.data.prompt,
        sourceNode.data.summary,
      ]
        .filter(
          (part): part is string =>
            typeof part === "string" && part.trim().length > 0,
        )
        .map((part) => part.trim());
      const sourceText = Array.from(new Set(sourceTextParts)).join("\n\n");

      if (!sourceText.trim()) {
        setNodes((nds) =>
          nds.map((node) =>
            node.id === nodeId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    errorMessage: "请先运行灵感碎片，或粘贴一段可提炼为故事种子的内容。",
                  },
                }
              : node,
          ),
        );
        return;
      }

      const storyboardNodeId = generateId();
      const storyboardNode: Node<CanvasNodeData> = {
        id: storyboardNodeId,
        type: "content",
        position: {
          x: sourceNode.position.x + NODE_DEFAULT_SIZE.workflow.width + 80,
          y: sourceNode.position.y,
        },
        data: {
          title: "故事分镜",
          nodeKind: "storyboard",
          content: sourceText,
          prompt: sourceText,
          summary: "由灵感碎片提炼出的故事种子，可继续生成完整故事。",
          storyboardAssistantStage: "idea",
          autoSizeMode: "fixed-width-height-grows",
          displayWidth: NODE_DEFAULT_SIZE.content.width,
          displayHeight: NODE_DEFAULT_SIZE.content.height,
          createdAt: Date.now(),
        },
        width: NODE_DEFAULT_SIZE.content.width,
        height: NODE_DEFAULT_SIZE.content.height,
        measured: NODE_DEFAULT_SIZE.content,
      };

      setNodes((nds) => [
        ...nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, errorMessage: undefined } }
            : node,
        ),
        storyboardNode,
      ]);
      setEdges((eds) => [
        ...eds,
        {
          id: `edge-${nodeId}-${storyboardNodeId}`,
          source: nodeId,
          target: storyboardNodeId,
          type: "creative",
          animated: true,
          style: { stroke: DESIGN_TOKENS.nodeEdge, strokeWidth: 1.5 },
          data: { relation: "inspiration-to-storyboard" },
        },
      ]);
      setSelectedNodeId(storyboardNodeId);
      addWorkspaceHistoryEvent({
        id: generateId(),
        type: "node-created",
        title: "灵感碎片进入故事分镜",
        summary: sourceNode.data.title || sourceNode.data.summary,
        nodeId: storyboardNodeId,
        relatedNodeIds: [nodeId, storyboardNodeId],
        createdAt: new Date().toISOString(),
      });
    },
    [setNodes, setEdges, setSelectedNodeId, addWorkspaceHistoryEvent],
  );

  const handleSplitStoryboardNode = useCallback(
    (
      nodeId: string,
      createGrid = true,
      options: { processVisible?: boolean } = {},
    ): { shotNodeIds: string[]; gridNodeId?: string } => {
      const sourceNode = nodesRef.current.find((node) => node.id === nodeId);
      if (!sourceNode) return { shotNodeIds: [] };

      const sourceTextParts = [
        sourceNode.data.content,
        sourceNode.data.prompt,
        sourceNode.data.summary,
      ]
        .filter(
          (part): part is string =>
            typeof part === "string" && part.trim().length > 0,
        )
        .map((part) => part.trim());
      const sourceText = Array.from(new Set(sourceTextParts)).join("\n\n");
      const parsedShots = parseStoryboardTextToShots(sourceText, nodeId);
      const seenShotKeys = new Set<string>();
      const shots = parsedShots.filter((shot) => {
        const key = [
          shot.order,
          shot.title,
          shot.description,
          shot.visualPrompt,
        ]
          .join("|")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
        if (seenShotKeys.has(key)) return false;
        seenShotKeys.add(key);
        return true;
      });
      if (shots.length === 0) {
        const message = sourceText.trim()
          ? "没有识别到可拆分的分镜格式。建议使用 1. / 2. / 镜头1 / Markdown 表格等格式。"
          : "这个文本节点是空的，请先粘贴文字分镜。";
        setNodes((nds) =>
          nds.map((node) =>
            node.id === nodeId
              ? { ...node, data: { ...node.data, errorMessage: message } }
              : node,
          ),
        );
        return { shotNodeIds: [] };
      }

      const processVisible = options.processVisible ?? sourceNode.data.storyboardProcessVisible === true;
      const shotNodes: Node<CanvasNodeData>[] = shots.map((shot, index) => {
        const normalizedTitle = createNormalizedShotTitle(shot);
        const normalizedShot: typeof shot = {
          ...shot,
          title: normalizedTitle,
          sourceStoryboardNodeId: nodeId,
        };

        return {
          id: generateId(),
          type: "shot",
          position: getStoryboardProcessNodePosition(sourceNode, index),
          hidden: !processVisible,
          data: {
            title: normalizedTitle,
            nodeKind: "shot",
            sourceStoryboardNodeId: nodeId,
            role: "storyboard-process",
            isStoryboardProcessNode: true,
            hiddenByStoryboardProcessMode: !processVisible,
            shot: { ...normalizedShot, id: generateId() },
            content: shot.description,
            prompt: shot.visualPrompt,
            displayWidth: STORYBOARD_SHOT_LAYOUT.shotWidth,
            displayHeight: STORYBOARD_SHOT_LAYOUT.shotHeight,
            createdAt: Date.now(),
          },
          width: STORYBOARD_SHOT_LAYOUT.shotWidth,
          height: STORYBOARD_SHOT_LAYOUT.shotHeight,
          measured: {
            width: STORYBOARD_SHOT_LAYOUT.shotWidth,
            height: STORYBOARD_SHOT_LAYOUT.shotHeight,
          },
        };
      });

      const shotNodesForGrid = shotNodes.slice(0, 9);
      const gridColumns = shotNodesForGrid.length <= 1 ? 1 : shotNodesForGrid.length <= 2 ? 2 : 3;
      const gridMaxShots = shotNodesForGrid.length;

      const gridNodeId = generateId();
      const shouldCreateGridNode = createGrid && shotNodesForGrid.length > 1;
      const gridNode: Node<CanvasNodeData> | null = shouldCreateGridNode
        ? {
            id: gridNodeId,
            type: "storyboardGrid",
            position: getStoryboardProcessGridPosition(sourceNode, shotNodesForGrid.length),
            hidden: !processVisible,
            data: {
              title: "分镜合成预览",
              nodeKind: "storyboard-grid",
              role: "storyboard-process",
              isStoryboardProcessNode: true,
              hiddenByStoryboardProcessMode: !processVisible,
              storyboardGrid: {
                id: generateId(),
                title: "分镜合成预览",
                sourceStoryboardNodeId: nodeId,
                shotNodeIds: shotNodesForGrid.map((node) => node.id),
                columns: gridColumns,
                maxShots: gridMaxShots,
                shotStates: shotNodesForGrid.map((node) => ({
                  shotNodeId: node.id,
                  order: node.data.shot?.order,
                  title: node.data.shot?.title,
                  status: "missing" as const,
                })),
                status: "draft",
              },
              displayWidth: 360,
              displayHeight: 360,
              createdAt: Date.now(),
            },
            width: 360,
            height: 360,
            measured: {
              width: 360,
              height: 360,
            },
          }
        : null;

      const visibleProcessNodeIds = new Set([
        ...shotNodes.map((node) => node.id),
        ...(gridNode ? [gridNode.id] : []),
      ]);
      const nextNodes = [
        ...nodesRef.current.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  title: node.data.title || "分镜剧本 Source",
                  nodeKind: node.data.nodeKind || "text",
                  errorMessage: undefined,
                  generatedShotNodeIds: shotNodes.map((shotNode) => shotNode.id),
                  generatedStoryboardGridNodeId: gridNode?.id,
                  storyboardProcessVisible: processVisible,
                },
              }
            : visibleProcessNodeIds.has(node.id)
              ? { ...node, hidden: !processVisible }
              : node,
        ),
        ...shotNodes,
        ...(gridNode ? [gridNode] : []),
      ];
      const storyboardEdges = shotNodes.map((shotNode) => ({
        ...createStoryboardSourceEdge(nodeId, shotNode.id),
        hidden: !processVisible,
        style: { stroke: DESIGN_TOKENS.nodeEdge, strokeWidth: 1.5 },
      }));
      const gridEdges = gridNode
        ? shotNodes.slice(0, 9).map((shotNode) => ({
            hidden: !processVisible,
            id: `edge-${shotNode.id}-${gridNode.id}`,
            source: shotNode.id,
            target: gridNode.id,
            type: "creative",
            animated: false,
            style: { stroke: DESIGN_TOKENS.nodeEdge, strokeWidth: 1.5 },
          }))
        : [];
      const nextEdges = [...edgesRef.current, ...storyboardEdges, ...gridEdges];
      nodesRef.current = nextNodes;
      edgesRef.current = nextEdges;
      setNodes(nextNodes);
      setEdges(nextEdges);
      addWorkspaceHistoryEvent({
        id: generateId(),
        type: "shots-split",
        title: `拆出 ${shotNodes.length} 个 Shot`,
        summary: sourceNode.data.title || "文字分镜",
        nodeId: shotNodes[0]?.id || nodeId,
        relatedNodeIds: [nodeId, ...shotNodes.map((node) => node.id)],
        createdAt: new Date().toISOString(),
      });
      return {
        shotNodeIds: shotNodes.map((node) => node.id),
        gridNodeId: gridNode?.id,
      };
    },
    [setNodes, setEdges, addWorkspaceHistoryEvent],
  );

  const handleGenerateShotImage = useCallback(
    async (nodeId: string): Promise<boolean> => {
      const shotNode = nodesRef.current.find((node) => node.id === nodeId);
      const shot = shotNode?.data.shot;
      if (!shotNode || !shot) return false;

      const prompt = (shot.visualPrompt || shot.description || "").trim();
      const sourceStoryboardNode = shot.sourceStoryboardNodeId
        ? nodesRef.current.find((node) => node.id === shot.sourceStoryboardNodeId)
        : undefined;
      const startedAt = Date.now();
      if (!prompt) {
        const message = "请先填写生图 Prompt 或镜头描述";
        setNodes((nds) =>
          nds.map((node) =>
            node.id === nodeId && node.data.shot
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    shot: {
                      ...node.data.shot,
                      status: "error" as const,
                      generationStatus: "failed" as const,
                      generationStartedAt: startedAt,
                      generationFinishedAt: Date.now(),
                      generationErrorCode: "EMPTY_PROMPT",
                      generationRetryable: false,
                      errorMessage: message,
                      generationError: message,
                    },
                  },
                }
              : node,
          ),
        );
        return false;
      }

      const requestId = generateId();
      latestShotGenerationRequestIdsRef.current[nodeId] = requestId;
      const model = "gpt-image-2";
      const size = "1792x1024";
      const nextAttempt = (shot.generationAttempts || 0) + 1;
      const generationSnapshot = createImageGenerationSnapshot({
        requestId,
        mode: "text-to-image",
        userPrompt: prompt,
        model,
        size,
        sourceNodeId: nodeId,
      });

      setNodes((nds) => {
        const updated = nds.map((node) =>
          node.id === nodeId && node.data.shot
            ? {
                ...node,
                data: {
                  ...node.data,
                  prompt,
                  generation: generationSnapshot,
                  shot: {
                    ...node.data.shot,
                    status: "generating" as const,
                    generationStatus: "generating" as const,
                    generationStartedAt: startedAt,
                    generationFinishedAt: undefined,
                    generationRequestId: requestId,
                    generationAttempts: nextAttempt,
                    generationErrorCode: undefined,
                    generationRetryable: undefined,
                    errorMessage: undefined,
                    generationError: undefined,
                  },
                },
              }
            : node,
        );
        nodesRef.current = updated;
        return updated;
      });

      try {
        const result = await generateImageFromPrompt({
          prompt,
          model,
          size,
          requestId,
        });
        if (latestShotGenerationRequestIdsRef.current[nodeId] !== requestId) {
          return false;
        }
        const generatedAt = new Date().toISOString();
        const completedSnapshot = {
          ...generationSnapshot,
          enhancedPrompt: result.prompt,
          model: result.model || model,
          status: "succeeded" as const,
          completedAt: generatedAt,
        };
        const latestShotNode = nodesRef.current.find((node) => node.id === nodeId) ?? shotNode;
        const latestShot = latestShotNode.data.shot ?? shot;
        const latestSourceStoryboardNode = latestShot.sourceStoryboardNodeId
          ? nodesRef.current.find((node) => node.id === latestShot.sourceStoryboardNodeId)
          : sourceStoryboardNode;
        const sourceStoryboardNodeId = latestSourceStoryboardNode?.id ?? latestShot.sourceStoryboardNodeId;
        const latestProcessVisible = latestSourceStoryboardNode?.data.storyboardProcessVisible === true;
        const shotOrderIndex = Math.max(0, (latestShot.order ?? 1) - 1);
        const imageNodeId = latestShot.generatedImageNodeId || generateId();
        const { imageNode, edge } = createShotImageNode({
          shotNode: latestShotNode,
          existingNodes: nodesRef.current,
          existingEdges: edgesRef.current,
          generationResult: {
            imageUrl: result.imageUrl,
            assetId: result.assetId,
            model: result.model || model,
            generationId: result.requestId || requestId,
            generationSnapshot: completedSnapshot,
            enhancedPrompt: result.prompt,
          },
          prompt,
          generatedAt,
          imageNodeId,
        });

        setNodes((nds) => {
          const imageExists = nds.some((node) => node.id === imageNode.id);
          const processImageNode: Node<CanvasNodeData> = {
            ...imageNode,
            position: latestSourceStoryboardNode
              ? getStoryboardProcessImagePosition(latestSourceStoryboardNode, shotOrderIndex)
              : imageNode.position,
            hidden: !latestProcessVisible,
            data: {
              ...imageNode.data,
              title: imageNode.data.title || "镜头过程图",
              role: "shot-image",
              sourceType: "shot",
              sourceStoryboardNodeId,
              isStoryboardProcessNode: true,
              hiddenByStoryboardProcessMode: !latestProcessVisible,
            },
          };
          const updated = nds.map((node) => {
            if (node.id === nodeId && node.data.shot) {
              if (node.data.shot.generationRequestId !== requestId) return node;
              return {
                ...node,
                data: {
                  ...node.data,
                  prompt,
                  generation: completedSnapshot,
                  shot: {
                    ...node.data.shot,
                    generatedImageUrl: result.imageUrl,
                    generatedImageAssetId: result.assetId,
                    generatedImageNodeId: imageNode.id,
                    status: "done" as const,
                    generationStatus: "succeeded" as const,
                    generationFinishedAt: Date.now(),
                    generationRequestId: result.requestId || requestId,
                    generationAttempts: result.attempts || node.data.shot.generationAttempts || nextAttempt,
                    generationErrorCode: undefined,
                    generationRetryable: undefined,
                    errorMessage: undefined,
                    generationError: undefined,
                    lastGeneratedAt: generatedAt,
                  },
                },
              };
            }
            if (node.id === imageNode.id) return processImageNode;
            return node;
          });
          const nextNodes = imageExists ? updated : [...updated, processImageNode];
          nodesRef.current = nextNodes;
          return nextNodes;
        });

        setEdges((eds) => {
          const filtered = eds.filter(
            (existingEdge) =>
              existingEdge.id !== edge.id &&
              !(
                existingEdge.source === nodeId &&
                existingEdge.target === imageNode.id &&
                (existingEdge.data as Record<string, unknown> | undefined)
                  ?.relation === "generated-image"
              ),
          );
          const nextEdges = [
            ...filtered,
            {
              ...edge,
              hidden: !latestProcessVisible,
              style: { stroke: DESIGN_TOKENS.nodeEdge, strokeWidth: 1.5 },
            },
          ];
          edgesRef.current = nextEdges;
          return nextEdges;
        });
        addWorkspaceHistoryEvent({
          id: generateId(),
          type: "image-generated",
          title: `生成镜头图片：${shot.title || shotNode.data.title || "未命名镜头"}`,
          summary: prompt.slice(0, 80),
          nodeId: imageNode.id,
          relatedNodeIds: [nodeId, imageNode.id],
          createdAt: new Date().toISOString(),
        });
        return true;
      } catch (error: any) {
        if (latestShotGenerationRequestIdsRef.current[nodeId] !== requestId) {
          return false;
        }
        const message = error?.message || "生成失败";
        setNodes((nds) => {
          const updated = nds.map((node) =>
            node.id === nodeId && node.data.shot
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    generation: {
                      ...generationSnapshot,
                      status: "failed" as const,
                      completedAt: new Date().toISOString(),
                      error: message,
                    },
                    shot: {
                      ...node.data.shot,
                      status: "error" as const,
                      generationStatus: "failed" as const,
                      generationFinishedAt: Date.now(),
                      generationRequestId: error?.requestId || requestId,
                      generationAttempts: error?.attempts || node.data.shot.generationAttempts || nextAttempt,
                      generationErrorCode: error?.code || "UNKNOWN_ERROR",
                      generationRetryable: error?.retryable ?? true,
                      errorMessage: message,
                      generationError: message,
                    },
                  },
                }
              : node,
          );
          nodesRef.current = updated;
          return updated;
        });
        return false;
      } finally {
        if (latestShotGenerationRequestIdsRef.current[nodeId] === requestId) {
          setNodes((nds) => {
            const updated = nds.map((node) => {
              if (node.id !== nodeId || !node.data.shot) return node;
              if (
                node.data.shot.generationRequestId !== requestId ||
                node.data.shot.generationStatus !== "generating"
              ) {
                return node;
              }
              const message = "图片生成没有返回最终状态，已自动结束。请点击重试。";
              return {
                ...node,
                data: {
                  ...node.data,
                  generation: {
                    ...generationSnapshot,
                    status: "failed" as const,
                    completedAt: new Date().toISOString(),
                    error: message,
                  },
                  shot: {
                    ...node.data.shot,
                    status: "error" as const,
                    generationStatus: "failed" as const,
                    generationFinishedAt: Date.now(),
                    generationErrorCode: "FINAL_STATE_GUARD",
                    generationRetryable: true,
                    errorMessage: message,
                    generationError: message,
                  },
                },
              };
            });
            nodesRef.current = updated;
            return updated;
          });
        }
      }
    },
    [setNodes, setEdges, addWorkspaceHistoryEvent],
  );

  const finalizeStoryboardResult = useCallback(
    (params: {
      sourceNodeId: string;
      mode: StoryboardResultQuality;
      imageUrl: string;
      assetId?: string;
      imageNodeId?: string;
      shotImageNodeId?: string;
      warning?: string;
      message: string;
      relatedProcessNodeIds?: string[];
    }) => {
      const sourceNode = nodesRef.current.find((node) => node.id === params.sourceNodeId);
      const finalImageNodeId = params.imageNodeId || params.shotImageNodeId || generateId();
      const outputPosition = getStoryboardFinalOutputPosition(sourceNode);
      let nextNodes: Node<CanvasNodeData>[] = [];
      let finalNodeExists = false;

      setNodes((nds) => {
        nextNodes = nds.map((node) => {
          if (node.id === params.sourceNodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                runMeta: createSucceededRunMeta({ message: params.message }),
                errorMessage: undefined,
                storyboardOutputImageNodeId: finalImageNodeId,
                storyboardOutputImageUrl: params.imageUrl,
                storyboardOutputAssetId: params.assetId,
                storyboardResultQuality: params.mode,
                storyboardWarning: params.warning,
                storyboardError: undefined,
                storyboardErrorPhase: undefined,
                storyboardProcessVisible: false,
              },
            };
          }

          if (node.id === finalImageNodeId || node.id === params.shotImageNodeId) {
            finalNodeExists = true;
            return {
              ...node,
              type: "image",
              hidden: false,
              position: node.id === params.shotImageNodeId ? outputPosition : node.position,
              data: {
                ...node.data,
                title: "最终分镜图",
                imageUrl: params.imageUrl,
                assetId: params.assetId ?? node.data.assetId,
                nodeKind: "ai-generated-image",
                sourcePromptId: params.sourceNodeId,
                sourceStoryboardNodeId: params.sourceNodeId,
                sourceType: "storyboard",
                role: "storyboard-final-output",
                isStoryboardFinalOutput: true,
                isStoryboardProcessNode: false,
                hiddenByStoryboardProcessMode: false,
                source: "generated",
                persistence: params.assetId ? "indexeddb" : node.data.persistence,
                displayWidth: node.data.displayWidth ?? 380,
                displayHeight: node.data.displayHeight ?? 214,
                createdAt: node.data.createdAt ?? Date.now(),
              },
            };
          }

          return node;
        });

        if (!finalNodeExists) {
          nextNodes = [
            ...nextNodes,
            {
              id: finalImageNodeId,
              type: "image",
              position: outputPosition,
              hidden: false,
              data: {
                title: "最终分镜图",
                imageUrl: params.imageUrl,
                assetId: params.assetId,
                nodeKind: "ai-generated-image",
                sourcePromptId: params.sourceNodeId,
                sourceStoryboardNodeId: params.sourceNodeId,
                sourceType: "storyboard",
                role: "storyboard-final-output",
                isStoryboardFinalOutput: true,
                source: "generated",
                persistence: params.assetId ? "indexeddb" : undefined,
                displayWidth: 380,
                displayHeight: 214,
                createdAt: Date.now(),
              },
            },
          ];
        }

        const visibility = applyStoryboardProcessVisibility({
          nodes: nextNodes,
          edges: edgesRef.current,
          sourceNodeId: params.sourceNodeId,
          showProcess: false,
        });
        nextNodes = visibility.nodes;
        nodesRef.current = nextNodes;
        edgesRef.current = visibility.edges;
        setEdges(visibility.edges);
        return nextNodes;
      });

      setEdges((eds) => {
        const sourceToFinalEdgeId = `edge-storyboard-final-${params.sourceNodeId}-${finalImageNodeId}`;
        const cleanedEdges = eds.filter((edge) => {
          const touchesFinal = edge.source === finalImageNodeId || edge.target === finalImageNodeId;
          return !touchesFinal || edge.id === sourceToFinalEdgeId;
        });
        const withFinalEdge = cleanedEdges.some((edge) => edge.id === sourceToFinalEdgeId)
          ? cleanedEdges
          : [
              ...cleanedEdges,
              {
                id: sourceToFinalEdgeId,
                source: params.sourceNodeId,
                target: finalImageNodeId,
                type: "creative",
                animated: true,
                hidden: false,
                data: { relation: "storyboard-final-output" },
                style: { stroke: DESIGN_TOKENS.nodeEdge, strokeWidth: 1.5 },
              },
            ];
        const visibility = applyStoryboardProcessVisibility({
          nodes: nodesRef.current,
          edges: withFinalEdge,
          sourceNodeId: params.sourceNodeId,
          showProcess: false,
        });
        edgesRef.current = visibility.edges;
        return visibility.edges;
      });
    },
    [setNodes, setEdges],
  );

  const handleGenerateStoryboardGrid = useCallback(
    async (nodeId: string): Promise<boolean> => {
      const gridNode = nodesRef.current.find((node) => node.id === nodeId);
      const grid = gridNode?.data.storyboardGrid;
      if (!gridNode || !grid) return false;

      const shotNodes = grid.shotNodeIds
        .map((shotId) => nodesRef.current.find((node) => node.id === shotId))
        .filter((node): node is Node<CanvasNodeData> => Boolean(node));
      const shotStates = shotNodes.map((node) => {
        const shot = node.data.shot;
        return {
          shotNodeId: node.id,
          order: shot?.order,
          title: shot?.title,
          status:
            shot?.generationStatus === "generating" || shot?.status === "generating"
              ? ("generating" as const)
              : shot?.generationStatus === "failed" || shot?.status === "error"
                ? ("failed" as const)
                : shot?.generatedImageUrl
                  ? ("ready" as const)
                  : ("missing" as const),
          imageUrl: shot?.generatedImageUrl,
          errorMessage: shot?.generationError || shot?.errorMessage,
        };
      });
      const imageUrls = shotStates.map((state) => state.imageUrl || null);

      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  storyboardGrid: {
                    ...grid,
                    shotStates,
                    status: "generating",
                    errorMessage: undefined,
                  },
                },
              }
            : node,
        ),
      );

      try {
        const validation = validateStoryboardGridImageUrls(
          imageUrls,
          shotNodes.map((n) => n.data.shot?.title || n.data.title || ""),
        );
        if (!validation.valid) {
          throw new Error(validation.message);
        }
        const dataUrl = await composeStoryboardGrid({
          images: imageUrls.slice(0, grid.maxShots || 9),
          columns: grid.columns || 3,
        });
        const persisted = await persistImageDataUrl(dataUrl, {
          fileName: `storyboard-grid-${Date.now()}.png`,
        });
        const imageNodeId = grid.outputImageNodeId || generateId();
        const sourceNodeForOutput = grid.sourceStoryboardNodeId
          ? nodesRef.current.find((node) => node.id === grid.sourceStoryboardNodeId)
          : undefined;
        const outputPosition = sourceNodeForOutput
          ? getStoryboardFinalOutputPosition(sourceNodeForOutput)
          : { x: gridNode.position.x + STORYBOARD_FINAL_OUTPUT_OFFSET_X, y: gridNode.position.y };
        const newImageNode: Node<CanvasNodeData> = {
          id: imageNodeId,
          type: "image",
          position: outputPosition,
          data: {
            title: "最终分镜图",
            imageUrl: persisted.objectUrl,
            assetId: persisted.assetId,
            nodeKind: "ai-generated-image",
            sourcePromptId: grid.sourceStoryboardNodeId || nodeId,
            sourceStoryboardNodeId: grid.sourceStoryboardNodeId,
            sourceType: "storyboard",
            role: "storyboard-final-output",
            isStoryboardFinalOutput: true,
            isStoryboardProcessNode: false,
            hiddenByStoryboardProcessMode: false,
            source: "generated",
            persistence: "indexeddb",
            displayWidth: 380,
            displayHeight: 214,
            createdAt: Date.now(),
          },
        };

        setNodes((nds) => {
          const exists = nds.some((node) => node.id === imageNodeId);
          const updated = nds
            .map((node) =>
              node.id === nodeId
                ? {
                    ...node,
                    data: {
                      ...node.data,
                      storyboardGrid: {
                        ...grid,
                        shotStates,
                        outputImageUrl: persisted.objectUrl,
                        outputImageNodeId: imageNodeId,
                        status: "done" as const,
                      },
                    },
                  }
                : node.id === grid.sourceStoryboardNodeId
                  ? {
                      ...node,
                      data: {
                        ...node.data,
                        storyboardOutputImageNodeId: imageNodeId,
                        storyboardOutputImageUrl: persisted.objectUrl,
                      },
                    }
                  : node.id === imageNodeId
                  ? {
                      ...node,
                      hidden: false,
                      position: outputPosition,
                      data: {
                        ...node.data,
                        title: "最终分镜图",
                        imageUrl: persisted.objectUrl,
                        assetId: persisted.assetId,
                        sourceStoryboardNodeId: grid.sourceStoryboardNodeId,
                        sourceType: "storyboard",
                        role: "storyboard-final-output",
                        isStoryboardFinalOutput: true,
                        isStoryboardProcessNode: false,
                        hiddenByStoryboardProcessMode: false,
                      },
                    }
                  : node,
            )
            .concat(exists ? [] : [newImageNode]);
          nodesRef.current = updated;
          return updated;
        });
        setEdges((eds) => {
          const finalEdgeId = `edge-storyboard-final-${grid.sourceStoryboardNodeId || nodeId}-${imageNodeId}`;
          const updated = eds.some((edge) => edge.id === finalEdgeId)
            ? eds.map((edge) => (edge.id === finalEdgeId ? { ...edge, hidden: false } : edge))
            : [
                ...eds,
                {
                  id: finalEdgeId,
                  source: grid.sourceStoryboardNodeId || nodeId,
                  target: imageNodeId,
                  type: "creative",
                  animated: true,
                  hidden: false,
                  data: { relation: "storyboard-final-output" },
                  style: { stroke: DESIGN_TOKENS.nodeEdge, strokeWidth: 1.5 },
                },
              ];
          edgesRef.current = updated;
          return updated;
        });
        return true;
      } catch (error: any) {
        setNodes((nds) =>
          nds.map((node) =>
            node.id === nodeId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    storyboardGrid: {
                      ...grid,
                      shotStates,
                      status: "error",
                      errorMessage:
                        error?.message ||
                        "分镜合成图输出失败。请先确认镜头图片已生成；这个节点只是预览和合成分镜图，不会自己调用生图模型。",
                    },
                  },
                }
              : node,
          ),
        );
        return false;
      }
    },
    [setNodes, setEdges],
  );

  const getStoryboardShotNodes = useCallback((sourceNodeId: string) => {
    const directShotNodes = nodesRef.current.filter(
      (node) =>
        node.type === "shot" &&
        node.data.shot &&
        (node.data.sourceStoryboardNodeId === sourceNodeId ||
          node.data.shot.sourceStoryboardNodeId === sourceNodeId),
    );
    if (directShotNodes.length > 0) return directShotNodes;

    const gridNode = nodesRef.current.find(
      (node) =>
        node.type === "storyboardGrid" &&
        node.data.storyboardGrid?.sourceStoryboardNodeId === sourceNodeId,
    );
    const gridShotIds = gridNode?.data.storyboardGrid?.shotNodeIds ?? [];
    return gridShotIds
      .map((shotId) => nodesRef.current.find((node) => node.id === shotId))
      .filter((node): node is Node<CanvasNodeData> =>
        Boolean(node?.type === "shot" && node.data.shot),
      );
  }, []);

  const getStoryboardGridNode = useCallback((sourceNodeId: string) => {
    const bySource = nodesRef.current.find(
      (node) =>
        node.type === "storyboardGrid" &&
        node.data.storyboardGrid?.sourceStoryboardNodeId === sourceNodeId,
    );
    if (bySource) return bySource;

    const shotIds = getStoryboardShotNodes(sourceNodeId).map((node) => node.id);
    return nodesRef.current.find(
      (node) =>
        node.type === "storyboardGrid" &&
        node.data.storyboardGrid?.shotNodeIds?.some((shotId) =>
          shotIds.includes(shotId),
        ),
    );
  }, [getStoryboardShotNodes]);

  const getSelectedShotNodes = useCallback(
    () =>
      nodesRef.current.filter(
        (n) => n.selected && n.type === "shot" && n.data.shot,
      ),
    [],
  );

  const handleGenerateStoryboardImageFromSource = useCallback(
    async (nodeId: string) => {
      const sourceNode = nodesRef.current.find((node) => node.id === nodeId);
      if (!sourceNode) return;

      const sourceKind = sourceNode.data.nodeKind;
      const canGenerateFromSource =
        sourceNode.type === "content" ||
        sourceKind === "storyboard" ||
        sourceKind === "text" ||
        sourceKind === "prompt" ||
        sourceKind === "document";
      if (!canGenerateFromSource) return;

      const updateSourceRunMeta = (params: {
        message: string;
        progress?: number;
        status?: "pending" | "running" | "succeeded" | "failed";
        error?: string;
      }) => {
        setNodes((nds) =>
          nds.map((node) => {
            if (node.id !== nodeId) return node;

            const runMeta =
              params.status === "failed"
                ? createFailedRunMeta({ error: params.error || params.message, message: params.message })
                : params.status === "succeeded"
                  ? createSucceededRunMeta({ message: params.message })
                  : params.status === "running"
                    ? createRunningRunMeta({ source: "manual", message: params.message })
                    : createPendingRunMeta({ source: "manual", message: params.message });

            return {
              ...node,
              data: {
                ...node.data,
                errorMessage: params.status === "failed" ? params.error || params.message : undefined,
                runMeta: {
                  ...runMeta,
                  source: "manual",
                  progress: params.progress ?? runMeta.progress,
                },
              },
            };
          }),
        );
      };

      updateSourceRunMeta({
        status: "pending",
        progress: 8,
        message: "准备生成分镜图：先拆镜头，再生成镜头图；单镜头会直接作为最终结果，多镜头再合成分镜图",
      });

      const processVisible = sourceNode.data.storyboardProcessVisible === true;
      let shotNodes = getStoryboardShotNodes(nodeId);
      let gridNode = getStoryboardGridNode(nodeId);
      if (shotNodes.length === 0) {
        updateSourceRunMeta({
          status: "running",
          progress: 18,
          message: "正在拆分镜头：系统会创建可编辑的镜头卡片",
        });
        const created = handleSplitStoryboardNode(nodeId, true, { processVisible });
        shotNodes = created.shotNodeIds
          .map((shotId) => nodesRef.current.find((node) => node.id === shotId))
          .filter((node): node is Node<CanvasNodeData> =>
            Boolean(node?.type === "shot" && node.data.shot),
          );
        gridNode = created.gridNodeId
          ? nodesRef.current.find((node) => node.id === created.gridNodeId)
          : getStoryboardGridNode(nodeId);
      }

      if (shotNodes.length === 0) {
        const message = "没有可生成的镜头。请先写完整故事，或输入已经拆分好的文字分镜。";
        updateSourceRunMeta({ status: "failed", progress: 100, message, error: message });
        return;
      }

      const existingProcessImageNodeIds = nodesRef.current
        .filter(
          (node) =>
            node.data.sourceStoryboardNodeId === nodeId &&
            (node.data.role === "shot-image" || node.data.sourceType === "shot"),
        )
        .map((node) => node.id);
      const processNodeIds = new Set([
        ...shotNodes.map((node) => node.id),
        ...existingProcessImageNodeIds,
        ...(gridNode ? [gridNode.id] : []),
      ]);
      if (!processVisible && processNodeIds.size > 0) {
        setNodes((nds) =>
          nds.map((node) =>
            processNodeIds.has(node.id)
              ? {
                  ...node,
                  hidden: true,
                  data: {
                    ...node.data,
                    hiddenByStoryboardProcessMode: true,
                  },
                }
              : node,
          ),
        );
      }

      const candidateShotNodes = shotNodes.slice(0, 9);
      const missingShotNodes = candidateShotNodes.filter(
        (shotNode) => !getShotImageUrlFromCanvas({ shotId: shotNode.id, nodes: nodesRef.current }),
      );

      updateSourceRunMeta({
        status: "running",
        progress: missingShotNodes.length > 0 ? 35 : 70,
        message:
          missingShotNodes.length > 0
            ? `正在生成镜头图：0/${missingShotNodes.length}，每个镜头会独立成功或失败`
            : candidateShotNodes.length <= 1
              ? "镜头图已存在，正在准备最终分镜图"
              : "镜头图已存在，正在准备合成最终分镜图",
      });

      await runWithConcurrency(
        missingShotNodes,
        SHOT_GENERATION_BATCH_CONCURRENCY,
        async (shotNode, index) => {
          updateSourceRunMeta({
            status: "running",
            progress: Math.min(65, 35 + Math.round((index / Math.max(1, missingShotNodes.length)) * 30)),
            message: `正在生成镜头图：${index + 1}/${missingShotNodes.length}，生成过程节点会在右侧更新`,
          });
          return handleGenerateShotImage(shotNode.id);
        },
      );
      const validShotImages: Array<{
        shotNodeId: string;
        imageUrl: string;
        imageNodeId?: string;
        assetId?: string;
      }> = [];
      candidateShotNodes.forEach((shotNode) => {
        const latestShotNode = nodesRef.current.find((node) => node.id === shotNode.id) ?? shotNode;
        const imageUrl = getShotImageUrlFromCanvas({ shotId: latestShotNode.id, nodes: nodesRef.current });
        if (!imageUrl) return;
        const imageNodeId = latestShotNode.data.shot?.generatedImageNodeId;
        const imageNode = imageNodeId
          ? nodesRef.current.find((node) => node.id === imageNodeId)
          : nodesRef.current.find(
              (node) =>
                node.type === "image" &&
                (node.data.sourceShotId === latestShotNode.id ||
                  node.data.generationOutput?.sourceShotId === latestShotNode.id),
            );
        validShotImages.push({
          shotNodeId: latestShotNode.id,
          imageUrl,
          imageNodeId: imageNode?.id ?? imageNodeId,
          assetId: latestShotNode.data.shot?.generatedImageAssetId || imageNode?.data.assetId,
        });
      });

      if (validShotImages.length > 0 && validShotImages.length < candidateShotNodes.length) {
        const failedShotIds = candidateShotNodes
          .filter((shot) => !validShotImages.some((v) => v.shotNodeId === shot.id))
          .map((shot) => shot.id);
        const failedTitles = candidateShotNodes
          .filter((shot) => failedShotIds.includes(shot.id))
          .map((shot) => shot.data.shot?.title || shot.data.title || "未命名镜头");
        const message =
          failedTitles.length === 1
            ? `镜头「${failedTitles[0]}」图片生成失败。请重试该镜头后再合成。`
            : `以下 ${failedTitles.length} 个镜头图片生成失败：${failedTitles.join("、")}。请重试后再合成。`;
        updateSourceRunMeta({ status: "failed", progress: 100, message, error: message });
        setNodes((nds) => {
          const updated = nds.map((node) =>
            node.id === nodeId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    generatedShotNodeIds: candidateShotNodes.map((shotNode) => shotNode.id),
                    generatedStoryboardGridNodeId: gridNode?.id,
                    storyboardError: message,
                    storyboardErrorPhase: "partial-shot-failure",
                    storyboardWarning: undefined,
                  },
                }
              : node,
          );
          const visibility = applyStoryboardProcessVisibility({
            nodes: updated,
            edges: edgesRef.current,
            sourceNodeId: nodeId,
            showProcess: processVisible,
          });
          nodesRef.current = visibility.nodes;
          edgesRef.current = visibility.edges;
          setEdges(visibility.edges);
          return visibility.nodes;
        });
        return;
      }

      if (validShotImages.length === 0) {
        const latestCandidateShotNodes = candidateShotNodes
          .map((shotNode) => nodesRef.current.find((node) => node.id === shotNode.id) ?? shotNode)
          .filter((shotNode): shotNode is Node<CanvasNodeData> => Boolean(shotNode.data.shot));
        const firstFailedShot = latestCandidateShotNodes.find((shotNode) => {
          const status = shotNode.data.shot?.generationStatus;
          return status === "failed";
        });
        const failureReason = firstFailedShot?.data.shot?.generationError || firstFailedShot?.data.shot?.errorMessage;
        const message = failureReason
          ? `镜头图片生成失败：${failureReason}`
          : "镜头图片生成失败，请稍后重试。";
        updateSourceRunMeta({ status: "failed", progress: 100, message, error: message });
        setNodes((nds) => {
          const updated = nds.map((node) =>
            node.id === nodeId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    generatedShotNodeIds: candidateShotNodes.map((shotNode) => shotNode.id),
                    generatedStoryboardGridNodeId: gridNode?.id,
                    storyboardError: message,
                    storyboardErrorPhase: "shot-image-generation",
                    storyboardWarning: undefined,
                  },
                }
              : node,
          );
          const visibility = applyStoryboardProcessVisibility({
            nodes: updated,
            edges: edgesRef.current,
            sourceNodeId: nodeId,
            showProcess: processVisible,
          });
          nodesRef.current = visibility.nodes;
          edgesRef.current = visibility.edges;
          setEdges(visibility.edges);
          return visibility.nodes;
        });
        return;
      }

      if (validShotImages.length === 1) {
        const [singleShot] = validShotImages;
        const summary = "分镜图已生成：已根据文本生成 1 个镜头。";
        finalizeStoryboardResult({
          sourceNodeId: nodeId,
          mode: "single-shot",
          imageUrl: singleShot.imageUrl,
          assetId: singleShot.assetId,
          imageNodeId: singleShot.imageNodeId,
          shotImageNodeId: singleShot.imageNodeId,
          message: summary,
        });
        addWorkspaceHistoryEvent({
          id: generateId(),
          type: "image-generated",
          title: "一键生成分镜图",
          summary,
          nodeId: singleShot.imageNodeId || nodeId,
          relatedNodeIds: [nodeId, ...candidateShotNodes.map((node) => node.id), singleShot.imageNodeId].filter(
            (id): id is string => Boolean(id),
          ),
          createdAt: new Date().toISOString(),
        });
        return;
      }

      gridNode = gridNode ?? getStoryboardGridNode(nodeId);
      if (!gridNode) {
        const freshSourceNode = nodesRef.current.find((node) => node.id === nodeId) ?? sourceNode;
        const gridNodeId = generateId();
        const gridCols = candidateShotNodes.length <= 2 ? 2 : 3;
        const newGridNode: Node<CanvasNodeData> = {
          id: gridNodeId,
          type: "storyboardGrid",
          position: getStoryboardProcessGridPosition(freshSourceNode, candidateShotNodes.length),
          hidden: !processVisible,
          data: {
            title: "分镜合成预览",
            nodeKind: "storyboard-grid",
            role: "storyboard-process",
            isStoryboardProcessNode: true,
            storyboardGrid: {
              id: generateId(),
              title: "分镜合成预览",
              sourceStoryboardNodeId: nodeId,
              shotNodeIds: candidateShotNodes.map((node) => node.id),
              columns: gridCols,
              maxShots: candidateShotNodes.length,
              shotStates: candidateShotNodes.map((node) => ({
                shotNodeId: node.id,
                order: node.data.shot?.order,
                title: node.data.shot?.title,
                status: getShotImageUrlFromCanvas({ shotId: node.id, nodes: nodesRef.current })
                  ? ("ready" as const)
                  : ("missing" as const),
              })),
              status: "draft",
            },
            displayWidth: 360,
            displayHeight: 360,
            createdAt: Date.now(),
          },
          width: 360,
          height: 360,
          measured: { width: 360, height: 360 },
        };
        setNodes((nds) => [...nds, newGridNode]);
        setEdges((eds) => [
          ...eds,
          ...candidateShotNodes.map((shotNode) => ({
            hidden: !processVisible,
            id: `edge-${shotNode.id}-${gridNodeId}`,
            source: shotNode.id,
            target: gridNodeId,
            type: "creative",
            animated: false,
            style: { stroke: DESIGN_TOKENS.nodeEdge, strokeWidth: 1.5 },
          })),
        ]);
        gridNode = newGridNode;
      }

      updateSourceRunMeta({
        status: "running",
        progress: 82,
        message: "正在合成最终分镜图：过程面板默认隐藏，最终会输出一张图片节点",
      });
      const composed = await handleGenerateStoryboardGrid(gridNode.id);
      const latestGridNode = nodesRef.current.find((node) => node.id === gridNode.id);
      const outputImageNodeId = latestGridNode?.data.storyboardGrid?.outputImageNodeId;
      const outputImageUrl = latestGridNode?.data.storyboardGrid?.outputImageUrl;
      const outputAssetId = outputImageNodeId
        ? nodesRef.current.find((node) => node.id === outputImageNodeId)?.data.assetId
        : undefined;

      if (composed && outputImageUrl) {
        const summary = `分镜图已生成：已合成 ${validShotImages.length} 个镜头。`;
        finalizeStoryboardResult({
          sourceNodeId: nodeId,
          mode: "composed-grid",
          imageUrl: outputImageUrl,
          assetId: outputAssetId,
          imageNodeId: outputImageNodeId,
          message: summary,
        });
        addWorkspaceHistoryEvent({
          id: generateId(),
          type: "image-generated",
          title: "一键生成分镜图",
          summary,
          nodeId: outputImageNodeId || gridNode.id,
          relatedNodeIds: [nodeId, ...candidateShotNodes.map((node) => node.id), gridNode.id, outputImageNodeId].filter(
            (id): id is string => Boolean(id),
          ),
          createdAt: new Date().toISOString(),
        });
        return;
      }

      const fallbackShot = validShotImages[0];
      const warning = "镜头图已生成，但合成分镜图暂时失败，已使用第一张镜头图作为临时结果。";
      finalizeStoryboardResult({
        sourceNodeId: nodeId,
        mode: "fallback-shot",
        imageUrl: fallbackShot.imageUrl,
        assetId: fallbackShot.assetId,
        imageNodeId: fallbackShot.imageNodeId,
        shotImageNodeId: fallbackShot.imageNodeId,
        warning,
        message: "镜头图已生成",
      });
      addWorkspaceHistoryEvent({
        id: generateId(),
        type: "image-generated",
        title: "一键生成分镜图",
        summary: warning,
        nodeId: fallbackShot.imageNodeId || nodeId,
        relatedNodeIds: [nodeId, ...candidateShotNodes.map((node) => node.id), gridNode?.id, fallbackShot.imageNodeId].filter(
          (id): id is string => Boolean(id),
        ),
        createdAt: new Date().toISOString(),
      });
    },
    [
      getStoryboardShotNodes,
      getStoryboardGridNode,
      handleSplitStoryboardNode,
      handleGenerateShotImage,
      handleGenerateStoryboardGrid,
      finalizeStoryboardResult,
      setNodes,
      setEdges,
      addWorkspaceHistoryEvent,
    ],
  );

  const selectedShotNodes = nodes.filter(
    (n) => n.selected && n.type === "shot" && n.data.shot,
  );
  const selectedShotCount = selectedShotNodes.length;
  const getShotImageUrl = useCallback(
    (shotId: string) =>
      getShotImageUrlFromCanvas({ shotId, nodes: nodesRef.current }),
    [],
  );

  const selectedShotMissingCount = selectedShotNodes.filter(
    (n) => !getShotImageUrl(n.id),
  ).length;

  const handleGenerateSelectedShotImages = useCallback(async () => {
    const selectedShots = getSelectedShotNodes();
    if (selectedShots.length < 1) return;

    const toGenerate = selectedShots.filter((n) => !getShotImageUrl(n.id));
    if (toGenerate.length < 1) return;

    await runWithConcurrency(
      toGenerate,
      SHOT_GENERATION_BATCH_CONCURRENCY,
      (node) => handleGenerateShotImage(node.id),
    );
  }, [getSelectedShotNodes, getShotImageUrl, handleGenerateShotImage]);

  const getStoryboardCompositeImageSize = useCallback(
    (layout: StoryboardCompositeLayout) => {
      const cellWidth = 260;
      const cellHeight = Math.round(cellWidth / STORYBOARD_FRAME_ASPECT_RATIO);
      const gap = 10;
      const width = layout.columns * cellWidth + (layout.columns + 1) * gap;
      const height = layout.rows * cellHeight + (layout.rows + 1) * gap;
      return { width, height };
    },
    [],
  );

  // ========================================================================
  // COMPOSE SELECTED SHOTS — 框选 shot 节点 → 一次生成/合成一张多格分镜图
  // ========================================================================
  const handleComposeSelectedShots = useCallback(async () => {
    const selectedShotNodes = getSelectedShotNodes();
    if (selectedShotNodes.length < 2 || isComposingSelectedShots) return;

    const shotNodeIds = selectedShotNodes.map((node) => node.id);
    const imageUrls = shotNodeIds.map((shotId) => getShotImageUrl(shotId) ?? null);
    const settings = { ...storyboardCompositeSettings, layout: "auto" as const };
    const {
      prompt: compositePrompt,
      sourcePrompt,
      layout,
    } = buildStoryboardCompositePrompt(selectedShotNodes, settings);
    const { columns: cols, rows } = layout;
    const shouldUseLocalCompose = shouldUseLocalStoryboardCompose({
      imageUrls,
      settings,
    });

    const missingImageCount = imageUrls.filter((url) => !url?.trim()).length;
    const shouldGenerateComposite = !shouldUseLocalCompose;

    if (!sourcePrompt && missingImageCount > 0) {
      const message =
        missingImageCount === selectedShotNodes.length
          ? "选中的镜头没有可用于生成的剧本文本、生图 Prompt 或镜头图片"
          : `选中的 ${selectedShotNodes.length} 个镜头中有 ${missingImageCount} 个缺少镜头图片，也没有可用于重新生成整张分镜图的剧本文本或生图 Prompt`;
      setNodes((nds) =>
        nds.map((node) =>
          shotNodeIds.includes(node.id) && node.data.shot
            ? {
                ...node,
                data: {
                  ...node.data,
                  shot: {
                    ...node.data.shot,
                    status: "error" as const,
                    generationStatus: "failed" as const,
                    generationFinishedAt: Date.now(),
                    generationErrorCode: "EMPTY_COMPOSITE_SOURCE",
                    generationRetryable: false,
                    errorMessage: message,
                    generationError: message,
                  },
                },
              }
            : node,
        ),
      );
      return;
    }

    const anchorNode = selectedShotNodes[0];
    const gridNodeId = generateId();
    const model = "gpt-image-2";
    const size = "1792x1024";
    const requestId = generateId();
    const startedAt = Date.now();
    const generationSnapshot = createImageGenerationSnapshot({
      requestId,
      mode: "text-to-image",
      userPrompt: compositePrompt,
      model,
      size,
      sourceNodeId: shotNodeIds.join(","),
    });

    shotNodeIds.forEach((shotId) => {
      latestShotGenerationRequestIdsRef.current[shotId] = requestId;
    });
    setIsComposingSelectedShots(true);
    setNodes((nds) =>
      nds.map((node) =>
        shotNodeIds.includes(node.id) && node.data.shot
          ? {
              ...node,
              data: {
                ...node.data,
                shot: {
                  ...node.data.shot,
                  status: "generating" as const,
                  generationStatus: "generating" as const,
                  generationStartedAt: startedAt,
                  generationFinishedAt: undefined,
                  generationRequestId: requestId,
                  generationAttempts: (node.data.shot.generationAttempts || 0) + 1,
                  generationErrorCode: undefined,
                  generationRetryable: undefined,
                  errorMessage: undefined,
                  generationError: undefined,
                },
              },
            }
          : node,
      ),
    );
    try {
      const result = shouldUseLocalCompose
        ? await composeStoryboardGrid({
            images: imageUrls,
            columns: cols,
          }).then(async (dataUrl) => {
            const persisted = await persistImageDataUrl(dataUrl, {
              fileName: `storyboard-composite-${Date.now()}.png`,
            });
            return {
              imageUrl: persisted.objectUrl,
              assetId: persisted.assetId,
              prompt: compositePrompt,
              model,
            };
          })
        : await generateImageFromPrompt({
            prompt: compositePrompt,
            model,
            size,
            requestId,
          });
      const completedAt = new Date().toISOString();
      const displaySize = getStoryboardCompositeImageSize(layout);
      const completedSnapshot = {
        ...generationSnapshot,
        enhancedPrompt: result.prompt,
        model: result.model || model,
        status: "succeeded" as const,
        completedAt,
      };

      const newImageNode: Node<CanvasNodeData> = {
        id: gridNodeId,
        type: "image",
        position: {
          x: anchorNode.position.x + STORYBOARD_SHOT_LAYOUT.shotWidth + 520,
          y: anchorNode.position.y,
        },
        data: {
          title: `${selectedShotNodes.length} 格分镜图`,
          imageUrl: result.imageUrl,
          assetId: result.assetId,
          nodeKind: "ai-generated-image",
          source: "generated",
          sourceType: "shot",
          sourcePrompt,
          prompt: compositePrompt,
          generation: completedSnapshot,
          generationId: requestId,
          generatedAt: completedAt,
          generationOutput: {
            type: "storyboard-composite",
            sourceShotIds: shotNodeIds,
            layout: {
              columns: cols,
              rows,
              label: layout.label,
              requestedLayout: layout.requestedLayout,
              fallbackFrom: layout.fallbackFrom,
            },
            strategy: settings.strategy,
            localCompose: shouldUseLocalCompose,
            missingImageCount,
            generatedComposite: shouldGenerateComposite,
          },
            compositeSettings: {
              ...settings,
              layout: "auto",
            },
          persistence: result.assetId ? "indexeddb" : "remote",
          displayWidth: displaySize.width,
          displayHeight: displaySize.height,
          createdAt: Date.now(),
        },
      };

      setNodes((nds) => [
        ...nds.map((node) =>
          shotNodeIds.includes(node.id) && node.data.shot
            ? {
                ...node,
                data: {
                  ...node.data,
                  shot: {
                    ...node.data.shot,
                    status: "done" as const,
                    generationStatus: "succeeded" as const,
                    generationFinishedAt: Date.now(),
                    generationRequestId: result.requestId || requestId,
                    generationAttempts: result.attempts || node.data.shot.generationAttempts,
                    generationErrorCode: undefined,
                    generationRetryable: undefined,
                    errorMessage: undefined,
                    generationError: undefined,
                  },
                },
              }
            : node,
        ),
        newImageNode,
      ]);
      setEdges((eds) =>
        createStoryboardCompositeEdges({
          sourceShotIds: shotNodeIds,
          compositeNodeId: gridNodeId,
          existingEdges: eds,
          removePreviousCompositeEdgesForSources: true,
          edgeStyle: { stroke: DESIGN_TOKENS.nodeEdge, strokeWidth: 1.5 },
        }),
      );
      addWorkspaceHistoryEvent({
        id: generateId(),
        type: "image-generated",
        title: `生成 ${selectedShotNodes.length} 格分镜图`,
        summary: shouldUseLocalCompose
          ? "已使用选中镜头图片合成多格分镜图"
          : sourcePrompt.slice(0, 120),
        nodeId: gridNodeId,
        relatedNodeIds: [...shotNodeIds, gridNodeId],
        createdAt: completedAt,
      });
    } catch (error: any) {
      const message = error?.message || "多格分镜图生成失败";
      setNodes((nds) =>
        nds.map((node) =>
          shotNodeIds.includes(node.id) && node.data.shot
            ? {
                ...node,
                data: {
                  ...node.data,
                  shot: {
                    ...node.data.shot,
                    status: "error" as const,
                    generationStatus: "failed" as const,
                    generationFinishedAt: Date.now(),
                    generationRequestId: error?.requestId || requestId,
                    generationAttempts: error?.attempts || node.data.shot.generationAttempts,
                    generationErrorCode: error?.code || "COMPOSITE_GENERATION_FAILED",
                    generationRetryable: error?.retryable ?? true,
                    errorMessage: message,
                    generationError: message,
                  },
                },
              }
            : node,
        ),
      );
    } finally {
      setNodes((nds) =>
        nds.map((node) => {
          if (!shotNodeIds.includes(node.id) || !node.data.shot) return node;
          if (
            node.data.shot.generationRequestId !== requestId ||
            node.data.shot.generationStatus !== "generating"
          ) {
            return node;
          }
          const message = "多格分镜图生成没有返回最终状态，已自动结束。请点击重试。";
          return {
            ...node,
            data: {
              ...node.data,
              shot: {
                ...node.data.shot,
                status: "error" as const,
                generationStatus: "failed" as const,
                generationFinishedAt: Date.now(),
                generationErrorCode: "FINAL_STATE_GUARD",
                generationRetryable: true,
                errorMessage: message,
                generationError: message,
              },
            },
          };
        }),
      );
      setIsComposingSelectedShots(false);
    }
  }, [
    getSelectedShotNodes,
    getShotImageUrl,
    isComposingSelectedShots,
    storyboardCompositeSettings,
    getStoryboardCompositeImageSize,
    setNodes,
    setEdges,
    addWorkspaceHistoryEvent,
  ]);


  const workflowRunner = useWorkflowRunner({
    onRunEvent: useCallback((event: WorkflowRunEvent) => {
      // 新 run 开始时清空旧事件
      if (event.type === "run-started") {
        setRunEvents([]);
        setShowRunPanel(true);
      }
      setRunEvents((prev) => [...prev, event]);
    }, []),
  });
  const hasWorkflowNodes = nodes.some(
    (n) =>
      n.type === "workflow" ||
      (n.type === "content" && n.data.nodeKind === "text"),
  );

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
  });

  // ========================================================================
  // SETTINGS & RUN-NODE EVENT LISTENERS
  // ========================================================================
  useEffect(() => {
    const handleOpenSettings = () => setShowSettings(true);
    const handleRunNode = (e: Event) => {
      const nodeId = (e as CustomEvent<{ nodeId: string }>).detail?.nodeId;
      if (nodeId) {
        workflowRunner.runNode(nodeId);
      }
    };
    const handleSettingsUpdated = (e: Event) => {
      const detail = (e as CustomEvent<{ allowAIAutoRun?: boolean }>).detail;
      if (detail?.allowAIAutoRun !== undefined) {
        useCanvasStore.getState().setAllowAIAutoRun(detail.allowAIAutoRun);
      }
    };
    const handleClearPending = (e: Event) => {
      const nodeId = (e as CustomEvent<{ nodeId: string }>).detail?.nodeId;
      if (nodeId) {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    runMeta: createIdleRunMeta(),
                    pendingExecution: false, // 兼容旧字段，逐步废弃
                  },
                }
              : n,
          ),
        );
      }
    };
    const handleGenerateShot = (e: Event) => {
      const nodeId = (e as CustomEvent<{ nodeId: string }>).detail?.nodeId;
      if (nodeId) handleGenerateShotImage(nodeId);
    };
    const handleGenerateGrid = (e: Event) => {
      const nodeId = (e as CustomEvent<{ nodeId: string }>).detail?.nodeId;
      if (nodeId) handleGenerateStoryboardGrid(nodeId);
    };
    const handleSplitStoryboard = (e: Event) => {
      const nodeId = (e as CustomEvent<{ nodeId: string }>).detail?.nodeId;
      if (nodeId) handleSplitStoryboardNode(nodeId);
    };
    const handleGenerateStoryboardImage = (e: Event) => {
      const nodeId = (e as CustomEvent<{ nodeId: string }>).detail?.nodeId;
      if (nodeId) handleGenerateStoryboardImageFromSource(nodeId);
    };
    const handleCreateStoryboardAssistant = (e: Event) => {
      const nodeId = (e as CustomEvent<{ nodeId: string }>).detail?.nodeId;
      if (nodeId) handleCreateStoryboardAssistantFromInspiration(nodeId);
    };
    window.addEventListener("startrails-open-settings", handleOpenSettings);
    window.addEventListener("startrails-run-node", handleRunNode);
    window.addEventListener("starcanvas:generate-shot", handleGenerateShot);
    window.addEventListener("starcanvas:generate-grid", handleGenerateGrid);
    window.addEventListener("starcanvas:split-storyboard", handleSplitStoryboard);
    window.addEventListener(
      "starcanvas:generate-storyboard-image",
      handleGenerateStoryboardImage,
    );
    window.addEventListener(
      "starcanvas:create-storyboard-assistant",
      handleCreateStoryboardAssistant,
    );
    window.addEventListener(
      "startrails-settings-updated",
      handleSettingsUpdated,
    );
    window.addEventListener("startrails-clear-pending", handleClearPending);
    return () => {
      window.removeEventListener(
        "startrails-open-settings",
        handleOpenSettings,
      );
      window.removeEventListener("startrails-run-node", handleRunNode);
      window.removeEventListener(
        "starcanvas:generate-shot",
        handleGenerateShot,
      );
      window.removeEventListener(
        "starcanvas:generate-grid",
        handleGenerateGrid,
      );
      window.removeEventListener(
        "starcanvas:split-storyboard",
        handleSplitStoryboard,
      );
      window.removeEventListener(
        "starcanvas:generate-storyboard-image",
        handleGenerateStoryboardImage,
      );
      window.removeEventListener(
        "starcanvas:create-storyboard-assistant",
        handleCreateStoryboardAssistant,
      );
      window.removeEventListener(
        "startrails-settings-updated",
        handleSettingsUpdated,
      );
      window.removeEventListener(
        "startrails-clear-pending",
        handleClearPending,
      );
    };
  }, [
    workflowRunner,
    setNodes,
    handleGenerateShotImage,
    handleGenerateStoryboardGrid,
    handleSplitStoryboardNode,
    handleGenerateStoryboardImageFromSource,
    handleCreateStoryboardAssistantFromInspiration,
  ]);

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
  } = useCanvasDropUpload(setNodes, dismissCanvasHint, (documentNodes) => {
    documentNodes.forEach((node) => {
      addWorkspaceHistoryEvent({
        id: generateId(),
        type: "document-uploaded",
        title: `上传文档：${node.data.title || node.data.fileName || "未命名文档"}`,
        summary: typeof node.data.summary === "string" ? node.data.summary : undefined,
        nodeId: node.id,
        createdAt: new Date().toISOString(),
      });
    });
  });

  // ── 历史产物拖回画布 (P2-4) ──
  // onNodeCreated: 节点创建后自动选中（Zustand store）
  const { handleHistoryDrop } = useHistoryDrop(setNodes, (nodeId) =>
    setSelectedNodeId(nodeId),
  );

  // 组合 drop handler：先检查历史 payload，未命中回退到文件拖放
  const combinedHandleDrop = useCallback(
    (e: React.DragEvent) => {
      if (handleHistoryDrop(e)) return;
      handleDrop(e);
    },
    [handleHistoryDrop, handleDrop],
  );

  // ========================================================================
  // GET SELECTED NODE
  // ========================================================================
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId],
  );

  const getCanvasFocusScreenPoint = useCallback(() => {
    const availableWidth =
      window.innerWidth -
      (chatOpen ? CHAT_PANEL_WIDTH : 0) -
      LEFT_TOOLBAR_SAFE_WIDTH;
    return {
      x: LEFT_TOOLBAR_SAFE_WIDTH + Math.max(availableWidth, 0) / 2,
      y: window.innerHeight / 2,
    };
  }, [chatOpen]);

  const getCenteredFlowPosition = useCallback(
    (nodeSize: { width: number; height: number } = { width: 0, height: 0 }) => {
      if (!reactFlowInstance) return { x: 400, y: 300 };
      const centerPosition = reactFlowInstance.screenToFlowPosition(
        getCanvasFocusScreenPoint(),
      );
      return {
        x: centerPosition.x - nodeSize.width / 2,
        y: centerPosition.y - nodeSize.height / 2,
      };
    },
    [reactFlowInstance, getCanvasFocusScreenPoint],
  );

  const focusCanvasNode = useCallback(
    (nodeId: string) => {
      const target = nodesRef.current.find((node) => node.id === nodeId);
      if (!target) return false;
      setSelectedNodeId(nodeId);
      if (!reactFlowInstance) return true;
      reactFlowInstance.setCenter(
        target.position.x + (target.measured?.width ?? target.width ?? 280) / 2,
        target.position.y + (target.measured?.height ?? target.height ?? 200) / 2,
        { duration: 600, zoom: Math.max(viewport.zoom, 1) },
      );
      return true;
    },
    [reactFlowInstance, setSelectedNodeId, viewport.zoom],
  );

  const fitViewToVisibleCanvas = useCallback(
    (duration = 500) => {
      if (!reactFlowInstance) return;
      const visibleNodes = getVisibleCanvasNodes(nodesRef.current);
      if (visibleNodes.length === 0) return;
      const horizontalFocusOffset =
        ((chatOpen ? CHAT_PANEL_WIDTH : 0) - LEFT_TOOLBAR_SAFE_WIDTH) / 2;
      setTimeout(() => {
        reactFlowInstance.fitView({
          nodes: visibleNodes.map((node) => ({ id: node.id })),
          padding: 0.28,
          maxZoom: 1.1,
          duration,
        });
        if (horizontalFocusOffset !== 0) {
          setTimeout(() => {
            const currentViewport = reactFlowInstance.getViewport();
            reactFlowInstance.setViewport(
              {
                ...currentViewport,
                x: currentViewport.x - horizontalFocusOffset,
              },
              { duration: 220 },
            );
          }, duration + 20);
        }
      }, 50);
    },
    [reactFlowInstance, chatOpen],
  );

  // ========================================================================
  // FIT VIEW ON LOAD
  // ========================================================================
  useEffect(() => {
    if (fitViewOnce && reactFlowInstance && nodes.length > 0) {
      fitViewToVisibleCanvas();
      setFitViewOnce(false);
    }
  }, [
    fitViewOnce,
    reactFlowInstance,
    nodes.length,
    setFitViewOnce,
    fitViewToVisibleCanvas,
  ]);

  const recoverCanvasVisibility = useCallback(() => {
    setNodes((nds) => {
      const recovered = applyCanvasVisibilityAndLayoutRecovery(nds);
      nodesRef.current = recovered;
      return recovered;
    });
    setTimeout(() => fitViewToVisibleCanvas(450), 80);
  }, [fitViewToVisibleCanvas, setNodes]);

  useEffect(() => {
    if (!isCanvasRestored || nodes.length === 0) return;
    const visibleNodes = getVisibleCanvasNodes(nodes);
    if (visibleNodes.length > 0) return;

    recoverCanvasVisibility();
  }, [isCanvasRestored, nodes, recoverCanvasVisibility]);

  const visibleCanvasNodeCount = useMemo(() => getVisibleCanvasNodes(nodes).length, [nodes]);
  const hasHiddenOnlyCanvas = isCanvasRestored && nodes.length > 0 && visibleCanvasNodeCount === 0;

  // ========================================================================
  // VIEWPORT CHANGE
  // ========================================================================
  const onMoveEnd = useCallback(
    (_: any, vp: Viewport) => {
      setViewport(vp);
    },
    [setViewport],
  );

  // ========================================================================
  // SELECTION
  // ========================================================================
  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: Node<CanvasNodeData>[] }) => {
      setNodes((nds) => {
        const selectedIds = new Set(selectedNodes.map((node) => node.id));
        return nds.map((node) => ({
          ...node,
          selected: selectedIds.has(node.id),
        }));
      });

      if (selectedNodes.length === 1) {
        setSelectedNodeId(selectedNodes[0].id);
      } else {
        setSelectedNodeId(null);
      }
      closeContextMenu();
      closeFloatingToolbar();
    },
    [setNodes, setSelectedNodeId, closeContextMenu, closeFloatingToolbar],
  );

  // ========================================================================
  // CONTEXT MENU - CANVAS
  // ========================================================================
  const handlePaneContextMenu = useCallback(
    (event: ReactMouseEvent<Element> | MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (!reactFlowInstance) return;

      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!bounds) return;

      const canvasX =
        (event.clientX - bounds.left - viewport.x) / viewport.zoom;
      const canvasY = (event.clientY - bounds.top - viewport.y) / viewport.zoom;

      setContextMenu({
        type: "canvas",
        screenX: event.clientX,
        screenY: event.clientY,
        canvasX,
        canvasY,
      });
    },
    [reactFlowInstance, viewport, setContextMenu],
  );

  // ========================================================================
  // CONTEXT MENU - NODE
  // ========================================================================
  const handleNodeContextMenu = useCallback(
    (event: ReactMouseEvent<Element>, node: Node<CanvasNodeData>) => {
      event.preventDefault();
      event.stopPropagation();

      setContextMenu({
        type: "node",
        nodeId: node.id,
        nodeType: node.type || "content",
        screenX: event.clientX,
        screenY: event.clientY,
      });
    },
    [setContextMenu],
  );

  // ========================================================================
  // CONTEXT MENU - EDGE
  // ========================================================================
  const handleEdgeContextMenu: EdgeMouseHandler = useCallback(
    (event, edge) => {
      event.preventDefault();
      event.stopPropagation();

      setContextMenu({
        type: "edge",
        edgeId: edge.id,
        screenX: event.clientX,
        screenY: event.clientY,
      });
    },
    [setContextMenu],
  );

  // ========================================================================
  // IMAGE HOVER
  // ========================================================================
  const handleImageNodeMouseEnter = useCallback(
    (nodeId: string, event: MouseEvent) => {
      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!bounds) return;
      const node = nodesRef.current.find((n) => n.id === nodeId);
      if (!node) return;

      const nodeX = node.position.x * viewport.zoom + viewport.x + bounds.left;
      const nodeY = node.position.y * viewport.zoom + viewport.y + bounds.top;
      const nodeWidth = (node.measured?.width || 280) * viewport.zoom;
      const nodeHeight = (node.measured?.height || 200) * viewport.zoom;

      const screenX = nodeX + nodeWidth / 2;
      const screenY = nodeY + nodeHeight + 10;

      const above = screenY + 60 > window.innerHeight;

      setFloatingToolbar({
        type: "image-hover",
        nodeId,
        position: {
          x: screenX - 130,
          y: above ? nodeY - 70 : screenY,
          above,
        },
      });
    },
    [viewport, setFloatingToolbar],
  );

  const handleImageNodeMouseLeave = useCallback(() => {
    closeFloatingToolbar();
  }, [closeFloatingToolbar]);

  // Track which image node ids are currently registered (stable across renders)
  const registeredNodeIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentImageNodes = nodes.filter((node) => node.type === "image");
    const currentIds = new Set(currentImageNodes.map((n) => n.id));
    const prevIds = registeredNodeIds.current;

    // Unregister nodes that no longer exist
    for (const id of prevIds) {
      if (!currentIds.has(id)) {
        unregisterImageHoverHandlers(id);
      }
    }

    // Register new nodes
    for (const node of currentImageNodes) {
      if (!prevIds.has(node.id)) {
        registerImageHoverHandlers(node.id, {
          onMouseEnter: handleImageNodeMouseEnter,
          onMouseLeave: handleImageNodeMouseLeave,
        });
      }
    }

    // Update tracked set
    registeredNodeIds.current = currentIds;
  }, [nodes, handleImageNodeMouseEnter, handleImageNodeMouseLeave]);

  // ========================================================================
  // FILE UPLOAD
  // ========================================================================
  const handleFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      // Calculate center position within visible canvas area, excluding the chat panel.
      let basePosition = getCenteredFlowPosition(NODE_DEFAULT_SIZE.image);

      // Process each file. 这里只读取原图尺寸并控制画布展示尺寸，不压缩、不改写用户原图。
      const newNodes: Node<CanvasNodeData>[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith("image/")) continue;

        try {
          const metadataUrl = URL.createObjectURL(file);
          const dimensions = await new Promise<{
            width: number;
            height: number;
          }>((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
              URL.revokeObjectURL(metadataUrl);
              resolve({
                width: image.naturalWidth,
                height: image.naturalHeight,
              });
            };
            image.onerror = () => {
              URL.revokeObjectURL(metadataUrl);
              reject(new Error("图片加载失败"));
            };
            image.src = metadataUrl;
          });

          // Persist to IndexedDB and use its tracked runtime preview URL.
          const { assetId, objectUrl } = await persistImageFile(file, {
            width: dimensions.width,
            height: dimensions.height,
          });

          const maxWidth = IMAGE_NODE_SIZE.maxWidth;
          const maxHeight = IMAGE_NODE_SIZE.maxHeight;
          let width = dimensions.width;
          let height = dimensions.height;

          if (width > maxWidth) {
            const ratio = maxWidth / width;
            width = maxWidth;
            height = height * ratio;
          }
          if (height > maxHeight) {
            const ratio = maxHeight / height;
            height = maxHeight;
            width = width * ratio;
          }

          width = Math.max(width, IMAGE_NODE_SIZE.minWidth);
          height = Math.max(height, IMAGE_NODE_SIZE.minHeight);

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
              assetId,
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type,
              imageWidth: dimensions.width,
              imageHeight: dimensions.height,
              displayWidth: width,
              displayHeight: height,
              aspectRatio: dimensions.width / dimensions.height,
              nodeKind: "uploaded-image",
              source: "upload",
              persistence: "indexeddb",
              createdAt: Date.now(),
            },
            measured: {
              width,
              height: height + 22,
            },
          };

          newNodes.push(node);
        } catch (error) {
          console.error("[UPLOAD_IMAGE] Error processing image:", error);
        }
      }

      if (newNodes.length > 0) {
        setNodes((nds) => [...nds, ...newNodes]);
        dismissCanvasHint();
      }

      e.target.value = "";
    },
    [getCenteredFlowPosition, setNodes, dismissCanvasHint],
  );

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDocumentUploadClick = useCallback((position?: { x: number; y: number }) => {
    pendingDocumentUploadPositionRef.current = position ?? null;
    documentInputRef.current?.click();
  }, []);

  const handleCreateCanvasSnapshot = useCallback(() => {
    const snapshotId = generateId();
    const now = new Date().toISOString();
    const textNodes = nodesRef.current.filter(
      (node) =>
        node.data?.nodeKind === "document" ||
        node.data?.nodeKind === "storyboard" ||
        node.data?.nodeKind === "text",
    );
    const primaryTitle = textNodes[0]?.data?.title || "当前画布";
    const snapshot: CanvasSnapshot = {
      id: snapshotId,
      title: `${primaryTitle} · 关键版本`,
      summary: `${nodesRef.current.length} 个节点，${edgesRef.current.length} 条连线`,
      createdAt: now,
      schemaVersion: CANVAS_SNAPSHOT_SCHEMA_VERSION,
      nodeCount: nodesRef.current.length,
      edgeCount: edgesRef.current.length,
      nodes: nodesRef.current,
      edges: edgesRef.current,
      viewport,
    };

    addCanvasSnapshot(snapshot);
    addWorkspaceHistoryEvent({
      id: generateId(),
      type: "snapshot-created",
      title: `保存关键版本：${snapshot.title}`,
      summary: snapshot.summary,
      snapshotId,
      createdAt: now,
    });
  }, [addCanvasSnapshot, addWorkspaceHistoryEvent, viewport]);

  const handleRestoreCanvasSnapshot = useCallback(
    (snapshot: CanvasSnapshot) => {
      const safeSnapshot = sanitizeAndValidateCanvasSnapshot(snapshot);
      if (!safeSnapshot) {
        addWorkspaceHistoryEvent({
          id: generateId(),
          type: "snapshot-restored",
          title: "恢复关键版本失败",
          summary: "快照结构无效或包含不安全数据，已阻止恢复。",
          snapshotId: snapshot.id,
          createdAt: new Date().toISOString(),
        });
        return;
      }

      setNodes(applyCanvasVisibilityAndLayoutRecovery(safeSnapshot.nodes));
      setEdges(safeSnapshot.edges);
      setSelectedNodeId(null);
      setFitViewOnce(true);
      addWorkspaceHistoryEvent({
        id: generateId(),
        type: "snapshot-restored",
        title: `恢复关键版本：${safeSnapshot.title}`,
        summary: safeSnapshot.summary,
        snapshotId: safeSnapshot.id,
        createdAt: new Date().toISOString(),
      });
      setShowWorkspaceHistory(false);
    },
    [reactFlowInstance, setEdges, setFitViewOnce, setNodes, setSelectedNodeId, addWorkspaceHistoryEvent],
  );

  const handleDocumentFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []).filter(isTextDocumentFile);
      if (files.length === 0) {
        e.target.value = "";
        return;
      }

      const basePosition =
        pendingDocumentUploadPositionRef.current ??
        getCenteredFlowPosition({ width: 560, height: 420 });
      pendingDocumentUploadPositionRef.current = null;
      const newNodes: Node<CanvasNodeData>[] = [];

      try {
        for (let i = 0; i < files.length; i++) {
          const document = await readTextDocumentFile(files[i]);
          newNodes.push(
            createDocumentNode({
              id: generateId(),
              document,
              position: {
                x: basePosition.x + i * 40,
                y: basePosition.y + i * 40,
              },
            }),
          );
        }
      } catch (error: any) {
        console.error("[UPLOAD_DOCUMENT] Error processing document:", error);
      }

      if (newNodes.length > 0) {
        setNodes((nds) => [...nds, ...newNodes]);
        newNodes.forEach((node) => {
          addWorkspaceHistoryEvent({
            id: generateId(),
            type: "document-uploaded",
            title: `上传文档：${node.data.title || node.data.fileName || "未命名文档"}`,
            summary: node.data.summary,
            nodeId: node.id,
            createdAt: new Date().toISOString(),
          });
        });
        dismissCanvasHint();
      }

      e.target.value = "";
    },
    [getCenteredFlowPosition, setNodes, dismissCanvasHint, addWorkspaceHistoryEvent],
  );

  const buildProjectPackage = useCallback(() => {
    const now = new Date().toISOString();
    const plainNodes = nodes.map((node) => {
      const data = node.data || {};
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
      };
    });

    const shots = plainNodes
      .filter((node) =>
        [
          "storyboard",
          "image-generation",
          "video-generation",
          "image-result",
        ].includes(String(node.data.nodeKind || "")),
      )
      .map((node, index) => ({
        id: node.id,
        order: index + 1,
        title: node.data.title || `镜头 ${index + 1}`,
        intent: [node.data.summary, node.data.content, node.data.prompt]
          .filter(Boolean)
          .join("\n"),
        visualReference:
          node.data.imageUrl ||
          node.data.assetUrl ||
          node.data.resultUrl ||
          null,
        status: node.data.status || "draft",
      }));

    const visualReferences = plainNodes
      .filter(
        (node) =>
          ["uploaded-image", "reference", "image-result"].includes(
            String(node.data.nodeKind || ""),
          ) || Boolean(node.data.imageUrl),
      )
      .map((node) => ({
        id: node.id,
        title: node.data.title || node.data.fileName || "视觉参考",
        url:
          node.data.imageUrl ||
          node.data.assetUrl ||
          node.data.resultUrl ||
          null,
        mimeType: node.data.mimeType || null,
        note: node.data.summary || node.data.prompt || "",
      }));

    const audioIntent = nodes
      .filter(
        (node) =>
          node.data?.nodeKind === "audio" ||
          node.data?.nodeKind === "uploaded-audio",
      )
      .map((node) => ({
        id: node.id,
        title: node.data.title || "声音意图",
        note: getNodeText(node),
      }));

    const handoffNotes = nodes
      .filter((node) =>
        ["composition", "video-result", "subtitle", "script", "text"].includes(
          String(node.data?.nodeKind || ""),
        ),
      )
      .map((node) => ({
        id: node.id,
        title: node.data.title || "交接说明",
        note: getNodeText(node),
      }));

    return {
      schema: "startrails-project-package/v1",
      source: "星轨画布（前期）",
      exportedAt: now,
      projectName: "星轨前期项目包",
      summary:
        "由星轨画布（前期）导出，供星轨画布（后期）继续处理节奏、字幕、声音和成片细节。",
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
    };
  }, [nodes, edges, viewport]);

  const handleExportProjectPackage = useCallback(() => {
    const projectPackage = buildProjectPackage();
    const json = JSON.stringify(projectPackage, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `startrails-project-${date}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [buildProjectPackage]);

  // ========================================================================
  // ADD NODE
  // ========================================================================
  const getWorkflowDefaults = (nodeKind: CanvasNodeKind): CanvasNodeData => {
    const idleMeta = createIdleRunMeta();
    const defaults: Partial<Record<CanvasNodeKind, CanvasNodeData>> = {
      script: {
        title: "灵感碎片",
        workflowRole: "灵感提炼",
        status: "draft", // 兼容旧代码读取
        runMeta: idleMeta,
        summary: "粘贴新闻、文章、链接、资料摘录或随手想法，让 AI 提炼成可继续创作的故事种子。",
        model: "GPT-5.5",
        inputs: [{ label: "新闻 / 文章 / 想法 / 链接" }],
        outputs: [{ label: "故事种子", type: "text" }],
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
        summary:
          "只做前期预演：用关键帧验证动作、机位和氛围，不负责最终节奏精剪。",
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
        summary:
          "汇总创意、分镜、关键画面、参考素材和声音意图，整理为 startrails-project.json。",
        inputs: [
          { label: "镜头草稿" },
          { label: "关键画面" },
          { label: "声音说明" },
        ],
        outputs: [{ label: "startrails-project.json", type: "file" }],
      },
      "video-result": {
        title: "交给后期",
        workflowRole: "Post Handoff",
        status: "draft",
        runMeta: idleMeta,
        summary:
          "把前期项目包交给星轨画布（后期），继续做节奏、字幕、声音和成片精修。",
        inputs: [{ label: "前期项目包" }],
        outputs: [{ label: "后期任务", type: "video" }],
      },
    };

    return {
      title: "工作流节点",
      status: "draft",
      ...defaults[nodeKind],
      nodeKind,
      createdAt: Date.now(),
    };
  };

  const handleAddNode = useCallback(
    (
      type: "content" | "image" | "workflow",
      positionOverride?: { x: number; y: number },
      nodeKind?: CanvasNodeKind,
    ) => {
      const defaultSize =
        type === "workflow"
          ? NODE_DEFAULT_SIZE.workflow
          : type === "image"
            ? NODE_DEFAULT_SIZE.image
            : NODE_DEFAULT_SIZE.content;
      const position = positionOverride || getCenteredFlowPosition(defaultSize);
      const resolvedNodeKind = nodeKind || getNodeKindFromType(type);

      const newNode: Node<CanvasNodeData> = {
        id: generateId(),
        type,
        position,
        width: defaultSize.width,
        height: defaultSize.height,
        measured: {
          width: defaultSize.width,
          height: defaultSize.height,
        },
        data:
          type === "workflow"
            ? getWorkflowDefaults(resolvedNodeKind)
            : type === "image"
              ? {
                  title: "Image",
                  nodeKind: "uploaded-image" as CanvasNodeKind,
                  displayWidth: defaultSize.width,
                  displayHeight: defaultSize.height,
                  createdAt: Date.now(),
                }
              : {
                  title:
                    resolvedNodeKind === "storyboard"
                      ? "故事分镜"
                      : "写作文本",
                  prompt: "",
                  content: "",
                  nodeKind: resolvedNodeKind,
                  storyboardAssistantStage: resolvedNodeKind === "storyboard" ? "idea" : undefined,
                  autoSizeMode: resolvedNodeKind === "storyboard" ? "fixed-width-height-grows" : undefined,
                  displayWidth: defaultSize.width,
                  displayHeight: defaultSize.height,
                  createdAt: Date.now(),
                },
      };

      if (DEBUG_NODE) {
        console.log("[DEBUG_NODE] Creating node:", newNode);
      }

      setNodes((nds) => [...nds, newNode]);
      dismissCanvasHint();
    },
    [getCenteredFlowPosition, setNodes, dismissCanvasHint],
  );

  const handleCreateVideoWorkflow = useCallback(() => {
    const basePosition = getCenteredFlowPosition({ width: 1120, height: 540 });
    const { nodes: newNodes, edges: newEdges } = buildVideoWorkflowTemplate({
      basePosition,
      generateId,
      edgeStyle: { stroke: DESIGN_TOKENS.nodeEdge, strokeWidth: 2 },
    });

    setNodes((nds) => {
      const nextNodes = [...nds, ...newNodes];
      nodesRef.current = nextNodes;
      return nextNodes;
    });
    setEdges((eds) => {
      const nextEdges = [...eds, ...newEdges];
      edgesRef.current = nextEdges;
      return nextEdges;
    });
    dismissCanvasHint();
    setChatOpen(true);
    setTimeout(() => fitViewToVisibleCanvas(650), 80);
  }, [
    getCenteredFlowPosition,
    setNodes,
    setEdges,
    dismissCanvasHint,
    fitViewToVisibleCanvas,
  ]);

  const getNodeKindFromType = (type?: string): CanvasNodeKind => {
    if (type === "image") return "uploaded-image";
    if (type === "content") return "prompt";
    return "script";
  };

  // ========================================================================
  // NODE OPERATIONS
  // ========================================================================
  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => {
        const nextNodes = nds.filter((n) => n.id !== nodeId);
        nodesRef.current = nextNodes;
        return nextNodes;
      });
      setEdges((eds) => {
        const nextEdges = eds.filter(
          (e) => e.source !== nodeId && e.target !== nodeId,
        );
        edgesRef.current = nextEdges;
        return nextEdges;
      });
      setSelectedNodeId(null);
    },
    [setNodes, setEdges, setSelectedNodeId],
  );

  const deleteSelectedElements = useCallback(() => {
    const selectedNodeIds = new Set(
      nodesRef.current.filter((node) => node.selected).map((node) => node.id),
    );
    const selectedEdgeIds = new Set(
      edgesRef.current.filter((edge) => edge.selected).map((edge) => edge.id),
    );

    if (
      selectedNodeIds.size === 0 &&
      selectedEdgeIds.size === 0 &&
      selectedNodeId
    ) {
      selectedNodeIds.add(selectedNodeId);
    }

    if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0) return;

    setNodes((nds) => {
      const nextNodes = nds.filter((node) => !selectedNodeIds.has(node.id));
      nodesRef.current = nextNodes;
      return nextNodes;
    });
    setEdges((eds) => {
      const nextEdges = eds.filter(
        (edge) =>
          !selectedEdgeIds.has(edge.id) &&
          !selectedNodeIds.has(edge.source) &&
          !selectedNodeIds.has(edge.target),
      );
      edgesRef.current = nextEdges;
      return nextEdges;
    });
    setSelectedNodeId(null);
  }, [selectedNodeId, setNodes, setEdges, setSelectedNodeId]);

  const deleteEdge = useCallback(
    (edgeId: string) => {
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    },
    [setEdges],
  );

  const duplicateNode = useCallback(
    (nodeId: string) => {
      const node = nodesRef.current.find((n) => n.id === nodeId);
      if (!node) return;

      const newNode: Node<CanvasNodeData> = {
        ...node,
        id: generateId(),
        position: {
          x: node.position.x + 50,
          y: node.position.y + 50,
        },
        selected: false,
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [nodes, setNodes],
  );

  const copyNode = useCallback(
    (nodeId: string) => {
      const node = nodesRef.current.find((n) => n.id === nodeId);
      if (!node) return;
      setClipboardNode(node);
    },
    [nodes, setClipboardNode],
  );

  const cutNode = useCallback(
    (nodeId: string) => {
      const node = nodesRef.current.find((n) => n.id === nodeId);
      if (!node) return;
      setClipboardNode(node);
      deleteNode(nodeId);
    },
    [nodes, setClipboardNode, deleteNode],
  );

  const pasteNode = useCallback(() => {
    if (!clipboardNode || !reactFlowInstance) return;

    const position = reactFlowInstance.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });

    const newNode: Node<CanvasNodeData> = {
      ...clipboardNode,
      id: generateId(),
      position: {
        x: position.x + Math.random() * 40 - 20,
        y: position.y + Math.random() * 40 - 20,
      },
      selected: false,
    };

    setNodes((nds) => [...nds, newNode]);
    setClipboardNode(null);
  }, [clipboardNode, reactFlowInstance, setNodes, setClipboardNode]);

  // ========================================================================
  // APPLY CHAT ACTIONS - AI 画布操作执行器（返回结构化报告）
  // ========================================================================
  const applyChatActions = useCallback(
    (actions: ChatCanvasAction[]): ApplyActionsReport => {
      const results: ApplyActionResult[] = [];
      const aliasMap: Record<string, string> = {};

      for (let i = 0; i < actions.length; i++) {
        const act = actions[i];

        if (DEBUG_NODE) {
          console.log("[DEBUG_NODE] Applying chat action:", act);
        }

        try {
          switch (act.action) {
            case "create_node": {
              const type = act.nodeType ?? "content";
              const kind = (act.nodeKind ??
                (type === "workflow"
                  ? "script"
                  : type === "image"
                    ? "uploaded-image"
                    : "text")) as CanvasNodeKind;
              const defaultSize =
                type === "workflow"
                  ? NODE_DEFAULT_SIZE.workflow
                  : type === "image"
                    ? NODE_DEFAULT_SIZE.image
                    : NODE_DEFAULT_SIZE.content;
              const position =
                act.position ?? getCenteredFlowPosition(defaultSize);
              const nodeId = generateId();
              const newNode: Node<CanvasNodeData> = {
                id: nodeId,
                type,
                position,
                width: defaultSize.width,
                height: defaultSize.height,
                measured: {
                  width: defaultSize.width,
                  height: defaultSize.height,
                },
                data:
                  type === "workflow"
                    ? {
                        ...getWorkflowDefaults(kind),
                        ...(act.title ? { title: act.title } : {}),
                        ...(act.prompt ? { prompt: act.prompt } : {}),
                        ...(act.data ?? {}),
                      }
                    : type === "image"
                      ? {
                          title: act.title ?? "Image",
                          nodeKind: kind,
                          displayWidth: defaultSize.width,
                          displayHeight: defaultSize.height,
                          createdAt: Date.now(),
                          ...(act.data ?? {}),
                        }
                      : {
                          title:
                            act.title ??
                            (kind === "storyboard"
                              ? "AI 文字分镜"
                              : kind === "text"
                                ? "创意文本"
                                : "写作文本"),
                          prompt: act.prompt ?? "",
                          content: act.content ?? "",
                          nodeKind: kind,
                          displayWidth: defaultSize.width,
                          displayHeight: defaultSize.height,
                          createdAt: Date.now(),
                          ...(act.data ?? {}),
                        },
              };
              setNodes((nds) => [...nds, newNode]);
              dismissCanvasHint();
              if (act.title) aliasMap[act.title] = nodeId;
              results.push({
                index: i,
                action: "create_node",
                status: "applied",
                nodeId,
                reason: act.description,
              });
              break;
            }

            case "update_node": {
              if (!act.nodeId) {
                results.push({
                  index: i,
                  action: "update_node",
                  status: "skipped",
                  reason: "缺少 nodeId",
                });
                break;
              }
              const found = nodesRef.current.find((n) => n.id === act.nodeId);
              if (!found) {
                results.push({
                  index: i,
                  action: "update_node",
                  status: "skipped",
                  reason: `节点 ${act.nodeId} 不存在`,
                });
                break;
              }
              setNodes((nds) =>
                nds.map((n) =>
                  n.id === act.nodeId
                    ? { ...n, data: { ...n.data, ...(act.updates ?? {}) } }
                    : n,
                ),
              );
              results.push({
                index: i,
                action: "update_node",
                status: "applied",
                nodeId: act.nodeId,
                reason: act.description,
              });
              break;
            }

            case "connect_nodes": {
              if (!act.sourceId || !act.targetId) {
                results.push({
                  index: i,
                  action: "connect_nodes",
                  status: "skipped",
                  reason: "缺少 sourceId 或 targetId",
                });
                break;
              }
              const src = nodesRef.current.find((n) => n.id === act.sourceId);
              const tgt = nodesRef.current.find((n) => n.id === act.targetId);
              if (!src || !tgt) {
                results.push({
                  index: i,
                  action: "connect_nodes",
                  status: "skipped",
                  reason: `${!src ? "源节点" : "目标节点"}不存在`,
                });
                break;
              }
              const edgeId = generateId();
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
              ]);
              results.push({
                index: i,
                action: "connect_nodes",
                status: "applied",
                edgeId,
                reason: act.description,
              });
              break;
            }

            case "delete_node": {
              const did = act.nodeId ?? act.id;
              if (!did) {
                results.push({
                  index: i,
                  action: "delete_node",
                  status: "skipped",
                  reason: "缺少 nodeId",
                });
                break;
              }
              const exists = nodesRef.current.find((n) => n.id === did);
              if (!exists) {
                results.push({
                  index: i,
                  action: "delete_node",
                  status: "skipped",
                  reason: `节点 ${did} 不存在`,
                });
                break;
              }
              setNodes((nds) => {
                const nextNodes = nds.filter((n) => n.id !== did);
                nodesRef.current = nextNodes;
                return nextNodes;
              });
              setEdges((eds) => {
                const nextEdges = eds.filter(
                  (e) => e.source !== did && e.target !== did,
                );
                edgesRef.current = nextEdges;
                return nextEdges;
              });
              if (selectedNodeId === did) setSelectedNodeId(null);
              results.push({
                index: i,
                action: "delete_node",
                status: "applied",
                nodeId: did,
                reason: act.description,
              });
              break;
            }

            case "select_node": {
              const sid = act.nodeId ?? act.id;
              if (sid) setSelectedNodeId(sid);
              results.push({
                index: i,
                action: "select_node",
                status: "applied",
                nodeId: sid,
                reason: act.description,
              });
              break;
            }

            case "focus_node": {
              const fid = act.nodeId ?? act.id;
              if (!fid) {
                results.push({
                  index: i,
                  action: "focus_node",
                  status: "skipped",
                  reason: "缺少 nodeId",
                });
                break;
              }
              const target = nodesRef.current.find((n) => n.id === fid);
              if (!target || !reactFlowInstance) {
                results.push({
                  index: i,
                  action: "focus_node",
                  status: "skipped",
                  reason: target ? "画布未就绪" : `节点 ${fid} 不存在`,
                });
                break;
              }
              reactFlowInstance.setCenter(
                target.position.x + (target.measured?.width ?? 280) / 2,
                target.position.y + (target.measured?.height ?? 200) / 2,
                { duration: 600, zoom: 1.1 },
              );
              setSelectedNodeId(fid);
              results.push({
                index: i,
                action: "focus_node",
                status: "applied",
                nodeId: fid,
                reason: act.description,
              });
              break;
            }

            case "run_node": {
              const rid = act.nodeId ?? act.id;
              if (!rid) {
                results.push({
                  index: i,
                  action: "run_node",
                  status: "skipped",
                  reason: "缺少 nodeId",
                });
                break;
              }
              const runTarget = nodesRef.current.find((n) => n.id === rid);
              if (!runTarget) {
                results.push({
                  index: i,
                  action: "run_node",
                  status: "skipped",
                  reason: `节点 ${rid} 不存在`,
                });
                break;
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
                      : n,
                  ),
                );
                setSelectedNodeId(rid);
                results.push({
                  index: i,
                  action: "run_node",
                  status: "pending_confirmation",
                  nodeId: rid,
                  reason: "AI 建议运行此节点，需用户确认",
                });
                break;
              }
              setSelectedNodeId(rid);
              setTimeout(() => {
                workflowRunner.runNode(rid);
              }, 150);
              results.push({
                index: i,
                action: "run_node",
                status: "applied",
                nodeId: rid,
                reason: act.description,
              });
              break;
            }

            default:
              results.push({
                index: i,
                action: (act as any).action ?? "unknown",
                status: "skipped",
                reason: "未知 action 类型",
              });
              console.warn("[applyChatActions] Unknown action:", act);
          }
        } catch (err: any) {
          results.push({
            index: i,
            action: act.action,
            status: "failed",
            error: err?.message ?? String(err),
            reason: `执行异常: ${err?.message ?? String(err)}`,
          });
        }
      }

      const report: ApplyActionsReport = {
        total: actions.length,
        applied: results.filter((r) => r.status === "applied").length,
        skipped: results.filter((r) => r.status === "skipped").length,
        failed: results.filter((r) => r.status === "failed").length,
        pendingConfirmation: results.filter(
          (r) => r.status === "pending_confirmation",
        ).length,
        results,
        aliasMap,
      };

      return report;
    },
    [
      getCenteredFlowPosition,
      setNodes,
      setEdges,
      setSelectedNodeId,
      reactFlowInstance,
      dismissCanvasHint,
      selectedNodeId,
      allowAIAutoRun,
    ],
  );

  // ========================================================================
  // ADD IMAGE FROM CHAT ATTACHMENT
  // ========================================================================
  const handleAddImageFromChat = useCallback(
    (attachment: ChatAttachment) => {
      const isImage = attachment.type === "image";
      const isAiGenerated = !attachment.file; // AI-generated images don't have a File object
      const nodeKind = isAiGenerated
        ? "ai-generated-image"
        : attachment.type === "video"
          ? "uploaded-video"
          : attachment.type === "audio"
            ? "uploaded-audio"
            : attachment.type === "file"
              ? "uploaded-file"
              : "uploaded-image";

      let width = attachment.width || 200;
      let height = attachment.height || 150;

      if (isImage) {
        const maxWidth = IMAGE_NODE_SIZE.maxWidth;
        const maxHeight = IMAGE_NODE_SIZE.maxHeight;

        if (width > maxWidth) {
          const ratio = maxWidth / width;
          width = maxWidth;
          height = height * ratio;
        }
        if (height > maxHeight) {
          const ratio = maxHeight / height;
          height = maxHeight;
          width = width * ratio;
        }

        width = Math.max(width, IMAGE_NODE_SIZE.minWidth);
        height = Math.max(height, IMAGE_NODE_SIZE.minHeight);
      }

      const position = getCenteredFlowPosition(
        isImage
          ? { width, height: height + IMAGE_NODE_TITLE_HEIGHT }
          : NODE_DEFAULT_SIZE.workflow,
      );

      // For images with a File object, persist to IndexedDB
      const assetIdPromise =
        isImage && attachment.file
          ? persistImageFile(attachment.file, {
              width: attachment.width,
              height: attachment.height,
            })
              .then((r) => r.assetId)
              .catch(() => undefined)
          : isAiGenerated && attachment.src?.startsWith("data:image")
            ? persistImageDataUrl(attachment.src, { fileName: attachment.name })
                .then((r) => r.assetId)
                .catch(() => undefined)
            : Promise.resolve(undefined);

      assetIdPromise.then((assetId) => {
        const newNode: Node<CanvasNodeData> = isImage
          ? {
              id: generateId(),
              type: "image",
              position,
              data: {
                title: attachment.name,
                imageUrl: attachment.src,
                assetId,
                fileName: attachment.name,
                fileSize: attachment.size,
                mimeType: attachment.mimeType,
                imageWidth: attachment.width,
                imageHeight: attachment.height,
                displayWidth: width,
                displayHeight: height,
                aspectRatio: (attachment.width || 1) / (attachment.height || 1),
                nodeKind,
                source: isAiGenerated ? "generated" : "upload",
                persistence: assetId ? "indexeddb" : undefined,
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
                workflowRole:
                  attachment.type === "video"
                    ? "Video Asset"
                    : attachment.type === "audio"
                      ? "Audio Asset"
                      : "File Asset",
                status: "ready",
                summary:
                  "来自 Chat 附件，可连接到视频生成、音频、字幕或合成节点。",
                fileName: attachment.name,
                fileSize: attachment.size,
                mimeType: attachment.mimeType,
                assetUrl: attachment.src,
                outputs: [
                  {
                    label:
                      attachment.type === "video"
                        ? "视频素材"
                        : attachment.type === "audio"
                          ? "音频素材"
                          : "文件素材",
                    type: attachment.type,
                  },
                ],
                createdAt: Date.now(),
              },
            };

        setNodes((nds) => [...nds, newNode]);
        dismissCanvasHint();

        if (DEBUG_NODE) {
          console.log("[DEBUG_NODE] Added attachment from chat:", newNode.id);
        }
      }); // end assetIdPromise.then
    },
    [getCenteredFlowPosition, setNodes, dismissCanvasHint],
  );

  // ========================================================================
  // SAVE TO ASSET LIBRARY
  // ========================================================================
  const handleSaveToAssetLibrary = useCallback(
    (nodeId: string) => {
      const node = nodesRef.current.find((n) => n.id === nodeId);
      if (!node) return;

      // Don't persist runtime-only URLs to localStorage
      let src = node.data.imageUrl || node.data.assetUrl;
      if (src && (src.startsWith("blob:") || src.startsWith("data:"))) {
        src = undefined;
      }

      const asset: AssetItem = {
        id: generateId(),
        type: "image",
        name: node.data.fileName || node.data.title || "Untitled",
        src,
        folder: "Others",
        createdAt: Date.now(),
        metadata: {
          assetId: node.data.assetId,
          persistence: node.data.persistence,
          source: node.data.source,
        },
      };

      addAsset(asset);
    },
    [nodes, addAsset],
  );

  // ========================================================================
  // AI VARIANT FOR IMAGE NODE
  // ========================================================================
  const handleAIVariant = useCallback(
    async (nodeId: string) => {
      const node = nodesRef.current.find((n) => n.id === nodeId);
      if (!node) return;

      const title = node.data.title || node.data.fileName || "图片";
      const promptText = `Generate a variation of this image: ${title}`;
      const model = "gpt-image-2";
      const size = "1792x1024";
      const requestId = crypto.randomUUID();
      const capability = getImageProviderCapability(model);

      try {
        assertImageToImageSupported(capability);
        if (!node.data.assetId) {
          throw new Error(
            "当前图片没有可用的本地资源，请重新上传后再生成变体。",
          );
        }

        const asset = await getLocalImageAsset(node.data.assetId);
        if (!asset?.blob) {
          throw new Error("参考图资源不存在，请重新上传图片。");
        }

        const prepared = await prepareReferenceImageForGeneration(asset.blob, {
          maxBytes: capability.maxInputImageBytes,
          maxSide: capability.maxInputImageSide,
          mimeType: capability.acceptedInputMimeTypes.includes("image/jpeg")
            ? "image/jpeg"
            : "image/webp",
        });
        const referenceImage = {
          assetId: node.data.assetId,
          sourceNodeId: nodeId,
          mimeType: prepared.mimeType,
          width: prepared.width,
          height: prepared.height,
          originalByteSize: prepared.originalByteSize,
          sentByteSize: prepared.byteSize,
          compressed: prepared.compressed,
        };

        const generation = createImageGenerationSnapshot({
          requestId,
          mode: "image-to-image",
          userPrompt: promptText,
          model,
          size,
          sourceNodeId: nodeId,
          sourceAssetId: node.data.assetId,
          referenceImage,
        });

        setNodes((nds) =>
          nds.map((item) =>
            item.id === nodeId
              ? { ...item, data: { ...item.data, generation } }
              : item,
          ),
        );

        const res = await fetch("/api/ai/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: promptText,
            model,
            size,
            requestId,
            sourceImage: prepared.dataUrl,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const normalized =
            errData.error && typeof errData.error === "object"
              ? errData.error
              : normalizeGenerationError({
                  status: res.status,
                  body: errData,
                  provider: capability.provider,
                });
          throw Object.assign(
            new Error(formatGenerationErrorForDisplay(normalized)),
            { generationError: normalized },
          );
        }

        const result = await res.json();
        if (!result.imageUrl) throw new Error("No image data returned");

        // Persist AI-generated image to IndexedDB
        let displayUrl = result.imageUrl;
        let assetId: string | undefined;

        if (result.imageUrl.startsWith("data:image")) {
          const persisted = await persistImageDataUrl(result.imageUrl, {
            fileName: `variant-${Date.now()}.png`,
          });
          displayUrl = persisted.objectUrl;
          assetId = persisted.assetId;
        }

        const newNode = {
          id: generateId(),
          type: "image" as const,
          position: { x: node.position.x + 320, y: node.position.y + 20 },
          data: {
            title: `变体: ${title}`,
            imageUrl: displayUrl,
            assetId,
            nodeKind: "ai-generated-image" as const,
            prompt: promptText,
            summary: result.prompt,
            generation: {
              ...generation,
              enhancedPrompt: result.prompt,
              model: result.model || model,
              status: "succeeded" as const,
              completedAt: new Date().toISOString(),
              endpoint: result.endpoint,
              referenceFormat: result.referenceFormat,
            },
            generationOutput: {
              prompt: promptText,
              finalPrompt: result.prompt,
              revisedPrompt: result.revisedPrompt,
              model: result.model || model,
              size,
              sourceImageAssetId: node.data.assetId,
              referenceImage,
              requestId,
              endpoint: result.endpoint,
              referenceFormat: result.referenceFormat,
            },
            sourcePromptId: nodeId,
            source: "generated" as const,
            persistence: assetId ? ("indexeddb" as const) : undefined,
            displayWidth: node.data.displayWidth || 280,
            displayHeight: node.data.displayHeight || 200,
            createdAt: Date.now(),
          },
        };

        setNodes((nds) => [...nds, newNode]);
        setEdges((eds) => [
          ...eds,
          {
            id: `edge-${nodeId}-${newNode.id}`,
            source: nodeId,
            target: newNode.id,
            type: "creative",
            animated: true,
            style: { stroke: DESIGN_TOKENS.nodeEdge, strokeWidth: 2 },
          },
        ]);

        setNodes((nds) =>
          nds.map((item) =>
            item.id === nodeId && item.data.generation?.requestId === requestId
              ? {
                  ...item,
                  data: {
                    ...item.data,
                    generation: {
                      ...item.data.generation,
                      enhancedPrompt: result.prompt,
                      status: "succeeded" as const,
                      completedAt: new Date().toISOString(),
                      endpoint: result.endpoint,
                      referenceFormat: result.referenceFormat,
                    },
                  },
                }
              : item,
          ),
        );
      } catch (err) {
        const normalized =
          (err as any)?.generationError ||
          normalizeGenerationError({
            error: err,
            provider: capability.provider,
          });
        console.debug("[StarCanvas] AI variant failed raw:", normalized.raw);
        setNodes((nds) =>
          nds.map((item) => {
            if (item.id !== nodeId) return item;
            const generation = item.data.generation;
            return {
              ...item,
              data: {
                ...item.data,
                generation: generation
                  ? {
                      ...generation,
                      status: "failed" as const,
                      error: {
                        code: normalized.code,
                        status: normalized.status,
                        provider: normalized.provider,
                        userMessage: normalized.userMessage,
                        detail: normalized.detail,
                        retryable: normalized.retryable,
                      },
                      completedAt: new Date().toISOString(),
                    }
                  : generation,
                errorMessage: formatGenerationErrorForDisplay(normalized),
              },
            };
          }),
        );
      }
    },
    [setNodes, setEdges],
  );

  // ========================================================================
  // KEYBOARD SHORTCUTS
  // ========================================================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelectedElements();
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "c" && selectedNodeId) {
        copyNode(selectedNodeId);
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "x" && selectedNodeId) {
        cutNode(selectedNodeId);
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "v") {
        pasteNode();
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "d" && selectedNodeId) {
        e.preventDefault();
        duplicateNode(selectedNodeId);
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "r" && selectedNodeId) {
        e.preventDefault();
        const plan = buildExecutionPlan({
          mode: "single",
          rootNodeIds: [selectedNodeId],
          nodes: nodesRef.current,
          edges,
          canvasId: "current",
        });
        workflowRunner.runExecutionPlan(plan);
      }

      // Ctrl+Shift+P: open Prompt Preview for selected node
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key === "p" &&
        selectedNodeId
      ) {
        e.preventDefault();
        useCanvasStore.getState().openPromptPreview(selectedNodeId);
      }

      if (e.key === "Escape") {
        closeContextMenu();
        closeFloatingToolbar();
        setSelectedNodeId(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedNodeId,
    deleteSelectedElements,
    copyNode,
    cutNode,
    pasteNode,
    duplicateNode,
    closeContextMenu,
    closeFloatingToolbar,
    setSelectedNodeId,
    edges,
    workflowRunner,
  ]);

  // ========================================================================
  // SUPPRESS NATIVE BROWSER CONTEXT MENU INSIDE THE CANVAS WRAPPER
  // ========================================================================
  // React 合成事件的 preventDefault 在某些浏览器(Safari/Chrome)上无法阻止
  // 原生右键菜单，必须在原生 DOM 事件层绑定才可靠。
  useEffect(() => {
    const el = reactFlowWrapper.current;
    if (!el) return;
    const suppress = (e: MouseEvent) => {
      e.preventDefault();
    };
    el.addEventListener("contextmenu", suppress);
    return () => el.removeEventListener("contextmenu", suppress);
  }, []);

  // ========================================================================
  // RENDER
  // ========================================================================
  return (
    <div className="relative h-screen w-screen overflow-hidden startrails-flow">
      <div className="fixed left-20 top-3 z-20 flex items-center gap-2">
        <div
          className="pointer-events-none rounded-2xl border px-4 py-2 text-xs shadow-lg backdrop-blur-xl"
          style={{
            borderColor: DESIGN_TOKENS.border,
            backgroundColor: "rgba(18,18,24,0.7)",
            color: DESIGN_TOKENS.textSecondary,
          }}
        >
          <div className="font-semibold" style={{ color: DESIGN_TOKENS.text }}>
            星轨画布（前期）
          </div>
          <div
            className="mt-0.5 text-[11px]"
            style={{ color: DESIGN_TOKENS.textMuted }}
          >
            创意构思 / 分镜草稿 / 视觉设计 / 项目包交接
          </div>
        </div>
        <button
          type="button"
          onClick={handleExportProjectPackage}
          className="flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-medium backdrop-blur-xl transition hover:bg-white/10"
          style={{
            borderColor: DESIGN_TOKENS.border,
            backgroundColor: DESIGN_TOKENS.accentSoft,
            color: DESIGN_TOKENS.textSecondary,
          }}
          title="导出 startrails-project.json，交给星轨画布（后期）继续制作"
        >
          <Download size={14} strokeWidth={1.7} />
          <span>导出项目包</span>
        </button>
      </div>

      {selectedShotCount >= 2 && (
        <div
          className="fixed left-1/2 top-4 z-40 flex -translate-x-1/2 items-center gap-3 rounded-2xl border px-4 py-2.5 shadow-2xl backdrop-blur-xl"
          style={{
            backgroundColor: "rgba(12,12,16,0.96)",
            borderColor: "rgba(255,255,255,0.18)",
            color: DESIGN_TOKENS.text,
            boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
          }}
        >
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-medium" style={{ color: DESIGN_TOKENS.text }}>
              已选 {selectedShotCount} 个镜头
            </span>
            <span className="text-[11px]" style={{ color: DESIGN_TOKENS.textMuted }}>
              {selectedShotMissingCount > 0
                ? `将用 ${selectedShotCount} 个镜头一次生成一张多格分镜图`
                : "已有单图时会直接合成一张多格分镜图"}
            </span>
          </div>
          <div className="h-7 w-px" style={{ backgroundColor: "rgba(255,255,255,0.12)" }} />
          <button
            onClick={handleGenerateSelectedShotImages}
            disabled={selectedShotMissingCount === 0}
            className="flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              borderColor: "rgba(255,255,255,0.12)",
              color: DESIGN_TOKENS.textSecondary,
              backgroundColor: "rgba(255,255,255,0.04)",
            }}
            title="可选：给选中镜头分别生成单张图片。会消耗多次图片生成额度。"
          >
            <Wand2 size={15} strokeWidth={1.8} />
            <span>分别生成单图</span>
          </button>
          <button
            onClick={() => {
              setDraftStoryboardCompositeSettings(storyboardCompositeSettings);
              setShowStoryboardCompositeSettings((value) => !value);
            }}
            className="flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors hover:bg-white/10"
            style={{
              borderColor: "rgba(255,255,255,0.12)",
              color: DESIGN_TOKENS.textSecondary,
              backgroundColor: showStoryboardCompositeSettings
                ? "rgba(255,255,255,0.12)"
                : "rgba(255,255,255,0.04)",
            }}
            title="设置编号、标题、统一风格和生成策略；单格固定影视横屏 16:9"
          >
            <Settings2 size={15} strokeWidth={1.8} />
            <span>设置</span>
          </button>
          <button
            onClick={handleComposeSelectedShots}
            disabled={isComposingSelectedShots}
            className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70"
            style={{
              color: "#fff",
              background: `linear-gradient(135deg, ${DESIGN_TOKENS.accent}, #7c3aed)`,
              boxShadow: "0 10px 28px rgba(124,58,237,0.28)",
            }}
            title="只生成/输出一张多格分镜图，并把选中的 Shot 都连接到这张图"
          >
            {isComposingSelectedShots ? (
              <Loader2 size={15} strokeWidth={1.8} className="animate-spin" />
            ) : (
              <ImageIcon size={15} strokeWidth={1.8} />
            )}
            <span>{isComposingSelectedShots ? "生成中" : "生成一张分镜图"}</span>
          </button>
          {showStoryboardCompositeSettings && (
            <div
              className="absolute left-1/2 top-full mt-3 w-[420px] -translate-x-1/2 rounded-2xl border p-4 shadow-2xl"
              style={{
                backgroundColor: "rgba(14,14,20,0.98)",
                borderColor: "rgba(255,255,255,0.16)",
                color: DESIGN_TOKENS.text,
              }}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">分镜图设置</div>
                  <div className="mt-1 text-[11px]" style={{ color: DESIGN_TOKENS.textMuted }}>
                    每格固定影视横屏 16:9；这里只设置显示信息、风格和生成策略
                  </div>
                </div>
                <div className="rounded-full border px-2 py-1 text-[11px]" style={{ borderColor: "rgba(255,255,255,0.12)", color: DESIGN_TOKENS.textMuted }}>
                  {selectedShotCount} 镜头
                </div>
              </div>

              <div className="space-y-4 text-xs">
                <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.03)" }}>
                  <div className="mb-1 font-medium">影视分镜格式</div>
                  <div className="text-[11px] leading-5" style={{ color: DESIGN_TOKENS.textMuted }}>
                    自动按镜头数量排布；每一格强制为横屏 16:9 电影画幅，不提供竖屏、方图或社媒比例选择。
                  </div>
                </div>

                <div>
                  <div className="mb-2 font-medium">显示信息</div>
                  <div className="flex flex-wrap gap-2">
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
                      <input
                        type="checkbox"
                        checked={draftStoryboardCompositeSettings.showShotNumber}
                        onChange={(event) =>
                          setDraftStoryboardCompositeSettings((prev) => ({
                            ...prev,
                            showShotNumber: event.target.checked,
                          }))
                        }
                      />
                      <span>显示镜头编号</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
                      <input
                        type="checkbox"
                        checked={draftStoryboardCompositeSettings.showShotTitle}
                        onChange={(event) =>
                          setDraftStoryboardCompositeSettings((prev) => ({
                            ...prev,
                            showShotTitle: event.target.checked,
                          }))
                        }
                      />
                      <span>显示简短标题</span>
                    </label>
                  </div>
                </div>

                <label className="block">
                  <div className="mb-2 font-medium">统一风格 Prompt</div>
                  <textarea
                    value={draftStoryboardCompositeSettings.stylePrompt}
                    onChange={(event) =>
                      setDraftStoryboardCompositeSettings((prev) => ({
                        ...prev,
                        stylePrompt: event.target.value,
                      }))
                    }
                    rows={3}
                    className="w-full resize-none rounded-xl border bg-transparent px-3 py-2 text-xs outline-none placeholder:text-white/30 focus:border-white/35"
                    style={{ borderColor: "rgba(255,255,255,0.12)", color: DESIGN_TOKENS.text }}
                    placeholder="例如：cinematic storyboard, consistent character, same lighting"
                  />
                </label>

                <div>
                  <div className="mb-2 font-medium">生成策略</div>
                  <div className="space-y-2">
                    {[
                      [
                        "auto-compose-or-generate",
                        "自动：全部已有单图时本地合成，否则生成完整分镜图",
                      ],
                      [
                        "always-generate-composite",
                        "始终调用模型生成完整分镜图",
                      ],
                    ].map(([value, label]) => (
                      <label
                        key={value}
                        className="flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2"
                        style={{
                          borderColor:
                            draftStoryboardCompositeSettings.strategy === value
                              ? DESIGN_TOKENS.accent
                              : "rgba(255,255,255,0.12)",
                          backgroundColor:
                            draftStoryboardCompositeSettings.strategy === value
                              ? DESIGN_TOKENS.accentSoft
                              : "transparent",
                        }}
                      >
                        <input
                          type="radio"
                          name="storyboard-composite-strategy"
                          checked={draftStoryboardCompositeSettings.strategy === value}
                          onChange={() =>
                            setDraftStoryboardCompositeSettings((prev) => ({
                              ...prev,
                              strategy:
                                value as StoryboardCompositeSettings["strategy"],
                            }))
                          }
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDraftStoryboardCompositeSettings(storyboardCompositeSettings);
                    setShowStoryboardCompositeSettings(false);
                  }}
                  className="rounded-full border px-4 py-2 text-xs font-medium hover:bg-white/10"
                  style={{ borderColor: "rgba(255,255,255,0.12)", color: DESIGN_TOKENS.textSecondary }}
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStoryboardCompositeSettings({
                      ...draftStoryboardCompositeSettings,
                      layout: "auto",
                    });
                    setShowStoryboardCompositeSettings(false);
                  }}
                  className="rounded-full px-4 py-2 text-xs font-semibold text-white"
                  style={{ background: `linear-gradient(135deg, ${DESIGN_TOKENS.accent}, #7c3aed)` }}
                >
                  应用
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        type="file"
        accept="image/*"
        multiple
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        type="file"
        accept=".txt,.md,.markdown,text/plain,text/markdown,text/x-markdown"
        multiple
        ref={documentInputRef}
        onChange={handleDocumentFileChange}
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
                eds,
              ),
            );
          }}
          onInit={setReactFlowInstance}
          onMoveEnd={onMoveEnd}
          onSelectionChange={onSelectionChange}
          onPaneContextMenu={handlePaneContextMenu}
          onNodeContextMenu={handleNodeContextMenu}
          onEdgeContextMenu={handleEdgeContextMenu}
          onPaneClick={() => {
            setSelectedNodeId(null);
            closeContextMenu();
            closeFloatingToolbar();
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

      {hasHiddenOnlyCanvas && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center px-6">
          <div
            className="pointer-events-auto max-w-sm rounded-3xl border p-5 text-center shadow-2xl backdrop-blur-xl"
            style={{
              borderColor: DESIGN_TOKENS.border,
              backgroundColor: "rgba(18, 18, 24, 0.86)",
              color: DESIGN_TOKENS.textSecondary,
            }}
          >
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
              <Eye size={18} style={{ color: DESIGN_TOKENS.text }} />
            </div>
            <div className="text-sm font-semibold" style={{ color: DESIGN_TOKENS.text }}>
              画布节点被隐藏了
            </div>
            <div className="mt-2 text-xs leading-5" style={{ color: DESIGN_TOKENS.textMuted }}>
              Chat 能读到 {nodes.length} 个节点，但当前没有可见节点。点击恢复会显示可恢复节点并自动定位。
            </div>
            <button
              type="button"
              onClick={recoverCanvasVisibility}
              className="mt-4 rounded-full px-4 py-2 text-xs font-semibold transition hover:scale-[1.02]"
              style={{
                backgroundColor: DESIGN_TOKENS.text,
                color: DESIGN_TOKENS.bg,
              }}
            >
              恢复并定位节点
            </button>
          </div>
        </div>
      )}

      {/* Empty Canvas Guide */}
      {nodes.length === 0 && (
        <EmptyCanvasGuide
          onUploadImage={handleUploadClick}
          onCreateTextNode={() => handleAddNode("content", undefined, "storyboard")}
          chatOpen={chatOpen}
          chatPanelWidth={CHAT_PANEL_WIDTH}
          leftToolbarWidth={LEFT_TOOLBAR_SAFE_WIDTH}
        />
      )}

      {/* Left Toolbar */}
      <LeftToolbar
        onOpenAssetLibrary={openAssetLibrary}
        onToggleAddNodePanel={() => setShowAddNodePanel((prev) => !prev)}
        isAddNodePanelOpen={showAddNodePanel}
        onToggleChat={() => setChatOpen((prev) => !prev)}
        isChatOpen={chatOpen}
        onOpenWorkspaceHistory={() => setShowWorkspaceHistory(true)}
        onOpenUserMenu={() => setShowUserMenu((prev) => !prev)}
      />

      {/* Add Node Panel (TapNow-style) */}
      <AddNodePanel
        isOpen={showAddNodePanel}
        onClose={() => setShowAddNodePanel(false)}
        onAddNode={(nodeType, nodeKind) =>
          handleAddNode(nodeType, undefined, nodeKind)
        }
        onUploadImage={handleUploadClick}
        onUploadDocument={handleDocumentUploadClick}
        onCreateVideoWorkflow={handleCreateVideoWorkflow}
        onOpenAssetLibrary={openAssetLibrary}
      />

      {/* User Menu Portal */}
      {showUserMenu &&
        typeof document !== "undefined" &&
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
                alert("登录功能：接入 Auth0 / Clerk / Supabase Auth");
                setShowUserMenu(false);
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-white/5"
              style={{ color: DESIGN_TOKENS.text }}
            >
              <span>登录 / 注册</span>
            </button>
            <div
              className="mx-2 my-1 h-px"
              style={{ backgroundColor: DESIGN_TOKENS.border }}
            />
            <button
              onClick={() => {
                setShowSettings(true);
                setShowUserMenu(false);
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-white/5"
              style={{ color: DESIGN_TOKENS.textSecondary }}
            >
              <span>设置</span>
            </button>
            <button
              onClick={() => {
                setShowUserMenu(false);
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-white/5"
              style={{ color: DESIGN_TOKENS.textMuted }}
            >
              <span>退出</span>
            </button>
          </div>,
          document.body,
        )}

      {/* Help Panel */}
      {showHelp &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed right-3 top-14 z-50 w-80 rounded-xl border p-4"
            style={{
              backgroundColor: "rgba(30,30,36,0.95)",
              borderColor: DESIGN_TOKENS.border,
              backdropFilter: "blur(20px)",
            }}
          >
            <h3
              className="mb-3 text-sm font-medium"
              style={{ color: DESIGN_TOKENS.text }}
            >
              ⌨️ 快捷键
            </h3>
            <div
              className="mb-4 flex flex-col gap-1.5 text-xs"
              style={{ color: DESIGN_TOKENS.textSecondary }}
            >
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
                    style={{
                      backgroundColor: "rgba(255,255,255,0.1)",
                      color: DESIGN_TOKENS.accent,
                    }}
                  >
                    {key}
                  </code>
                  <span>{desc}</span>
                </div>
              ))}
            </div>

            <h3
              className="mb-3 text-sm font-medium"
              style={{ color: DESIGN_TOKENS.text }}
            >
              🖱️ 鼠标操作
            </h3>
            <div
              className="mb-4 flex flex-col gap-1.5 text-xs"
              style={{ color: DESIGN_TOKENS.textSecondary }}
            >
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
                    style={{
                      backgroundColor: "rgba(255,255,255,0.1)",
                      color: DESIGN_TOKENS.accent,
                    }}
                  >
                    {key}
                  </code>
                  <span>{desc}</span>
                </div>
              ))}
            </div>

            <h3
              className="mb-3 text-sm font-medium"
              style={{ color: DESIGN_TOKENS.text }}
            >
              📝 画布操作
            </h3>
            <div
              className="flex flex-col gap-1.5 text-xs"
              style={{ color: DESIGN_TOKENS.textSecondary }}
            >
              {[
                ["底部工具栏", "缩放、自动布局"],
                ["左侧工具栏", "添加节点、打开聊天"],
                ["@引用", "在输入框输入@引用节点"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between">
                  <code
                    className="rounded px-1.5 py-0.5 text-[10px]"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.1)",
                      color: DESIGN_TOKENS.accent,
                    }}
                  >
                    {key}
                  </code>
                  <span>{desc}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowHelp(false)}
              className="mt-4 w-full rounded-lg py-2 text-xs transition-colors hover:bg-white/5"
              style={{
                color: DESIGN_TOKENS.textMuted,
                backgroundColor: "rgba(255,255,255,0.05)",
              }}
            >
              关闭
            </button>
          </div>,
          document.body,
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
              const layoutedNodes = quickLayout(nds, edges, 3);
              // 布局后自动适应当前可见画布区域，避免被右侧聊天面板遮挡
              fitViewToVisibleCanvas();
              return layoutedNodes;
            });
          }}
          className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-white/10"
          style={{ color: DESIGN_TOKENS.textMuted }}
          title="自动布局"
        >
          <Layout size={14} strokeWidth={1.5} />
        </button>
        {/* 网格视图 */}
        <button
          onClick={() => setShowGrid((prev) => !prev)}
          className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-white/10"
          style={{
            color: showGrid ? DESIGN_TOKENS.accent : DESIGN_TOKENS.textMuted,
          }}
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
          onChange={(e) =>
            reactFlowInstance?.zoomTo(parseFloat(e.target.value), {
              duration: 100,
            })
          }
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
          onClick={() => setShowHelp((prev) => !prev)}
          className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-white/10"
          style={{
            color: showHelp ? DESIGN_TOKENS.accent : DESIGN_TOKENS.textMuted,
          }}
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
              onClick={() =>
                workflowRunner.state.isRunning
                  ? workflowRunner.stopWorkflow()
                  : workflowRunner.runWorkflow()
              }
              className="flex h-7 items-center gap-1 rounded-full px-2.5 text-xs transition-colors hover:bg-white/10"
              style={{
                color: workflowRunner.state.isRunning
                  ? "#f59e0b"
                  : DESIGN_TOKENS.textSecondary,
              }}
              title={
                workflowRunner.state.isRunning
                  ? `停止 (${workflowRunner.state.progress}%)`
                  : "执行工作流"
              }
            >
              {workflowRunner.state.isRunning ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  <span className="tabular-nums">
                    {workflowRunner.state.progress}%
                  </span>
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
            onAddNode={(type, position, nodeKind) =>
              handleAddNode(type, position, nodeKind as CanvasNodeKind)
            }
            onUploadImage={handleUploadClick}
            onUploadDocument={handleDocumentUploadClick}
            onPaste={pasteNode}
            hasClipboard={!!clipboardNode}
          />,
          document.body,
        )}

      {/* Node Context Menu */}
      {typeof document !== "undefined" &&
        createPortal(
          <NodeContextMenu
            state={contextMenu}
            onClose={closeContextMenu}
            onDelete={() => {
              if (contextMenu?.type === "node") {
                deleteNode(contextMenu.nodeId);
              }
            }}
            onDuplicate={() => {
              if (contextMenu?.type === "node") {
                duplicateNode(contextMenu.nodeId);
              }
            }}
            onCopy={() => {
              if (contextMenu?.type === "node") {
                copyNode(contextMenu.nodeId);
              }
            }}
            onCut={() => {
              if (contextMenu?.type === "node") {
                cutNode(contextMenu.nodeId);
              }
            }}
            onPreviewImage={() => {
              if (contextMenu?.type === "node") {
                setPreviewImageNodeId(contextMenu.nodeId);
              }
            }}
            onCropImage={() => {
              if (contextMenu?.type === "node") {
                setCropImageNodeId(contextMenu.nodeId);
              }
            }}
            onSaveToAssetLibrary={() => {
              if (contextMenu?.type === "node") {
                handleSaveToAssetLibrary(contextMenu.nodeId);
              }
            }}
            onEdit={() => {
              if (contextMenu?.type === "node") {
                setSelectedNodeId(contextMenu.nodeId);
              }
            }}
            onViewHistory={() => {
              if (contextMenu?.type === "node") {
                setHistoryNodeId(contextMenu.nodeId);
                setShowNodeHistory(true);
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
                });
                workflowRunner.runExecutionPlan(plan);
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
                });
                workflowRunner.runExecutionPlan(plan);
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
                });
                workflowRunner.runExecutionPlan(plan);
              }
            }}
            onStopWorkflow={workflowRunner.stopWorkflow}
            onSplitStoryboard={() => {
              if (contextMenu?.type === "node")
                handleSplitStoryboardNode(contextMenu.nodeId, false);
            }}
            onSplitStoryboardWithGrid={() => {
              if (contextMenu?.type === "node")
                handleSplitStoryboardNode(contextMenu.nodeId, true);
            }}
            onGenerateShotImage={() => {
              if (contextMenu?.type === "node")
                handleGenerateShotImage(contextMenu.nodeId);
            }}
            onGenerateStoryboardGrid={() => {
              if (contextMenu?.type === "node")
                handleGenerateStoryboardGrid(contextMenu.nodeId);
            }}
            onGenerateStoryboardImage={() => {
              if (contextMenu?.type === "node")
                handleGenerateStoryboardImageFromSource(contextMenu.nodeId);
            }}
            onCreateStoryboardAssistant={() => {
              if (contextMenu?.type === "node")
                handleCreateStoryboardAssistantFromInspiration(contextMenu.nodeId);
            }}
            onCreateInspirationFromDocument={() => {
              if (contextMenu?.type === "node")
                createDocumentDerivedNode(contextMenu.nodeId, "inspiration");
            }}
            onCreateStoryboardFromDocument={() => {
              if (contextMenu?.type === "node")
                createDocumentDerivedNode(contextMenu.nodeId, "storyboard");
            }}
            onComposeSelectedShots={handleComposeSelectedShots}
            selectedShotCount={selectedShotCount}
            isWorkflowRunning={workflowRunner.state.isRunning}
            nodeKind={
              nodes.find(
                (n) =>
                  n.id ===
                  (contextMenu?.type === "node" ? contextMenu.nodeId : null),
              )?.data?.nodeKind
            }
          />,
          document.body,
        )}

      {/* Edge Context Menu */}
      {typeof document !== "undefined" &&
        createPortal(
          <EdgeContextMenu
            state={contextMenu}
            onClose={closeContextMenu}
            onDelete={() => {
              if (contextMenu?.type === "edge") {
                deleteEdge(contextMenu.edgeId);
              }
            }}
          />,
          document.body,
        )}

      {/* Image Hover Toolbar */}
      {typeof document !== "undefined" &&
        createPortal(
          <ImageHoverToolbar
            state={floatingToolbar}
            onClose={closeFloatingToolbar}
            onPreview={() => {
              if (floatingToolbar?.type === "image-hover") {
                setPreviewImageNodeId(floatingToolbar.nodeId);
                closeFloatingToolbar();
              }
            }}
            onCrop={() => {
              if (floatingToolbar?.type === "image-hover") {
                setCropImageNodeId(floatingToolbar.nodeId);
                closeFloatingToolbar();
              }
            }}
            onSaveToLibrary={() => {
              if (floatingToolbar?.type === "image-hover") {
                handleSaveToAssetLibrary(floatingToolbar.nodeId);
                closeFloatingToolbar();
              }
            }}
            onReplaceImage={() => {
              if (floatingToolbar?.type === "image-hover") {
                handleUploadClick();
                closeFloatingToolbar();
              }
            }}
            onDelete={() => {
              if (floatingToolbar?.type === "image-hover") {
                deleteNode(floatingToolbar.nodeId);
                closeFloatingToolbar();
              }
            }}
            onAIVariant={() => {
              if (floatingToolbar?.type === "image-hover") {
                handleAIVariant(floatingToolbar.nodeId);
                closeFloatingToolbar();
              }
            }}
          />,
          document.body,
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
              let position = { x: 400, y: 300 };
              if (reactFlowInstance) {
                position = reactFlowInstance.screenToFlowPosition({
                  x: window.innerWidth / 2,
                  y: window.innerHeight / 2,
                });
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
              };

              setNodes((nds) => [...nds, newNode]);
              closeAssetLibrary();
            }}
          />,
          document.body,
        )}

      {/* Settings Panel */}
      {showSettings &&
        typeof document !== "undefined" &&
        createPortal(
          <SettingsPanel
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
          />,
          document.body,
        )}

      {/* Workspace History Panel */}
      {showWorkspaceHistory &&
        typeof document !== "undefined" &&
        createPortal(
          <WorkspaceHistoryPanel
            isOpen={showWorkspaceHistory}
            onClose={() => setShowWorkspaceHistory(false)}
            onSelectNode={(nodeId) => {
              focusCanvasNode(nodeId);
              setShowWorkspaceHistory(false);
            }}
            onCreateSnapshot={handleCreateCanvasSnapshot}
            onRestoreSnapshot={handleRestoreCanvasSnapshot}
          />,
          document.body,
        )}

      {/* Node History Panel */}
      {showNodeHistory &&
        typeof document !== "undefined" &&
        createPortal(
          <NodeHistoryPanel
            isOpen={showNodeHistory}
            onClose={() => {
              setShowNodeHistory(false);
              setHistoryNodeId(null);
            }}
            nodeId={historyNodeId}
            nodeTitle={
              historyNodeId
                ? (nodes.find((n) => n.id === historyNodeId)?.data?.title ??
                  (nodes.find((n) => n.id === historyNodeId)?.data
                    ?.label as string) ??
                  historyNodeId.slice(0, 8))
                : undefined
            }
            currentHistoryId={
              historyNodeId
                ? nodes.find((n) => n.id === historyNodeId)?.data?.runMeta
                    ?.currentHistoryId
                : undefined
            }
            onRestorePrompt={(nId, hId) => {
              workflowRunner.restorePromptFromHistory(nId, hId);
            }}
            onRetry={(nId, hId) => {
              workflowRunner.retryFromHistory(nId, hId);
            }}
            onViewTrace={(hId, nId, nTitle) => {
              setShowSourceTrace(true);
              setTraceHistoryId(hId);
              setTraceNodeInfo({ nodeId: nId, nodeTitle: nTitle });
            }}
          />,
          document.body,
        )}

      {/* P2-3A: Workflow Run Panel */}
      <WorkflowRunPanel
        isOpen={showRunPanel}
        onClose={() => {
          setShowRunPanel(false);
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

      {/* Source Trace Panel (Phase 1-d) */}
      {showSourceTrace &&
        traceHistoryId &&
        traceNodeInfo &&
        typeof document !== "undefined" && (
          <SourceTracePanel
            isOpen={showSourceTrace}
            onClose={() => {
              setShowSourceTrace(false);
              setTraceHistoryId(null);
              setTraceNodeInfo(null);
            }}
            historyId={traceHistoryId}
            nodeId={traceNodeInfo.nodeId}
            nodeTitle={traceNodeInfo.nodeTitle}
            onNavigate={setTraceHistoryId}
          />
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
          <MessageCircle
            size={16}
            strokeWidth={1.7}
            style={{ color: DESIGN_TOKENS.accent }}
          />
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
  );
}
// StarCanvasInner closes here
// StarCanvas (outer) closes via ReactFlowProvider wrapping
