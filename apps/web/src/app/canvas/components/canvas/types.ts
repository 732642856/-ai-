// ============================================================================
// Shared Types for Canvas Components
// ============================================================================
import type { Node, Edge } from '@xyflow/react'
import type { ReactNode } from 'react'

// ============================================================================
// Node Types
// ============================================================================
export type AgentNodeType = "text" | "prompt" | "image" | "storyboard" | "shot" | "storyboard-grid" | "document" | "reference" | "group"
export type VideoWorkflowNodeKind =
  | "script"
  | "image-generation"
  | "video-generation"
  | "audio"
  | "subtitle"
  | "composition"
  | "video-result"
export type StoryboardResultQuality = "composed-grid" | "single-shot" | "fallback-shot"

export type CanvasNodeKind =
  | AgentNodeType
  | VideoWorkflowNodeKind
  | "previs"
  | "uploaded-image"
  | "uploaded-video"
  | "uploaded-audio"
  | "uploaded-file"
  | "image-result"
  | "text-result"
  | "ai-generated-image"
  | "video-sample-frames"
  | "video-analyze"

// ============================================================================
// Node Run Status (P1-3 六态模型)
// ============================================================================
export type NodeRunStatus =
  | "idle"
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"

export type NodeRunSource =
  | "manual"
  | "ai"
  | "workflow"
  | "retry"
  | "system"

export interface NodeRunMeta {
  /**
   * 节点当前运行状态（六态模型）
   */
  runStatus: NodeRunStatus

  /**
   * 0 - 100，主要给 ComfyUI / 视频生成 / 长任务用
   */
  progress?: number

  /**
   * 给用户看的状态说明
   * 例如：排队中、提交任务中、轮询结果中、下载输出中
   */
  message?: string

  /**
   * 失败原因
   */
  error?: string

  /**
   * 最近一次开始运行时间 (ISO 8601)
   */
  lastRunAt?: string

  /**
   * 最近一次结束时间，成功/失败/取消都可以记录 (ISO 8601)
   */
  lastFinishedAt?: string

  /**
   * 当前运行 ID，可用于 usage metering / history / task 关联
   */
  runId?: string

  /**
   * 当前运行对应的 history id
   * P1-5 节点生成历史会用到
   */
  currentHistoryId?: string

  /**
   * 外部任务 ID
   * 例如：ComfyUI prompt_id、ModelScope task_id、APIMart task_id
   */
  externalTaskId?: string

  /**
   * 外部原始状态
   * 例如 SUCCEED / FAILED / queued / running
   */
  rawStatus?: string

  /**
   * 触发来源
   */
  source?: NodeRunSource

  /**
   * pending 状态的原因
   * 例如：AI 请求自动运行，需要用户确认
   */
  pendingReason?: string
}

// @deprecated 旧五态模型，保留仅用于兼容读取，新代码请使用 NodeRunStatus
export type WorkflowNodeStatus = "draft" | "ready" | "running" | "done" | "error"

export type StoryboardShotData = {
  id: string
  order: number
  title: string
  shotType?: string
  cameraMovement?: string
  duration?: string
  description: string
  visualPrompt: string
  negativePrompt?: string
  dialogue?: string
  notes?: string
  sourceStoryboardNodeId?: string
  generatedImageNodeId?: string
  generatedImageUrl?: string
  generatedImageAssetId?: string
  generationStatus?: "idle" | "queued" | "generating" | "succeeded" | "failed"
  generationError?: string
  generationStartedAt?: number
  generationFinishedAt?: number
  generationRequestId?: string
  generationAttempts?: number
  generationErrorCode?: string
  generationRetryable?: boolean
  lastGeneratedAt?: string
  status?: "draft" | "ready" | "generating" | "done" | "error"
  errorMessage?: string
}

export type StoryboardGridData = {
  id: string
  title: string
  sourceStoryboardNodeId?: string
  shotNodeIds: string[]
  columns: 1 | 2 | 3
  maxShots: number
  shotStates?: Array<{
    shotNodeId: string
    order?: number
    title?: string
    status: "missing" | "generating" | "ready" | "failed"
    imageUrl?: string
    errorMessage?: string
  }>
  outputImageUrl?: string
  outputImageNodeId?: string
  status?: "draft" | "generating" | "done" | "error"
  errorMessage?: string
}

export type StoryboardCompositeSettings = {
  layout: "auto" | "2x2" | "1x4" | "4x1"
  showShotNumber: boolean
  showShotTitle: boolean
  stylePrompt: string
  strategy: "auto-compose-or-generate" | "always-generate-composite"
}

export type StoryboardAssistantStage = "idea" | "story" | "storyboard-text"

export type CanvasNodeData = {
  label?: ReactNode
  title?: string
  nodeKind?: CanvasNodeKind
  workflowRole?: string

  // ---- 新：统一运行状态 ----
  runMeta?: NodeRunMeta

  // ---- 旧：兼容字段，禁止新写入 ----
  status?: WorkflowNodeStatus
  errorMessage?: string
  pendingExecution?: boolean  // AI suggested run_node, waiting for user confirmation

  // ---- 业务字段 ----
  summary?: string
  prompt?: string
  content?: string
  negativePrompt?: string
  instruction?: string
  inputs?: Array<{ id?: string; label: string; type?: string }>
  outputs?: Array<{ id?: string; label: string; type?: string; url?: string }>
  duration?: string
  model?: string
  resultUrl?: string
  imageUrl?: string
  assetUrl?: string
  fileName?: string
  fileSize?: number
  mimeType?: string
  imageWidth?: number
  imageHeight?: number
  displayWidth?: number
  displayHeight?: number
  aspectRatio?: number
  createdAt?: number
  uploadedAt?: string
  assetKind?: string
  assetPurpose?: string
  storyboard?: any
  shot?: StoryboardShotData
  storyboardGrid?: StoryboardGridData
  previs3d?: any
  generationJob?: any
  sourcePromptId?: string
  sourceGenerationJobId?: string
  sourceType?: "shot" | "storyboard" | "prompt" | "image" | string
  sourceStoryboardNodeId?: string
  sourceShotId?: string
  sourceShotOrder?: number
  sourceShotTitle?: string
  sourcePrompt?: string
  generatedAt?: string
  generationId?: string
  generationOutput?: any
  compositeSettings?: StoryboardCompositeSettings
  storyboardAssistantStage?: StoryboardAssistantStage
  autoSizeMode?: "auto" | "fixed-width-height-grows" | "manual"
  writingMode?: "normal" | "focus"
  generation?: any
  generatedShotNodeIds?: string[]
  generatedStoryboardGridNodeId?: string
  storyboardOutputImageNodeId?: string
  storyboardOutputImageUrl?: string
  storyboardOutputAssetId?: string
  storyboardResultQuality?: StoryboardResultQuality
  storyboardWarning?: string
  storyboardError?: string
  storyboardErrorPhase?: string
  storyboardProcessVisible?: boolean
  role?: string
  isStoryboardProcessNode?: boolean
  isStoryboardFinalOutput?: boolean
  hiddenByStoryboardProcessMode?: boolean
  // --- Video metadata (V1-3，全部可选) ---
  videoDurationMs?: number
  videoWidth?: number
  videoHeight?: number
  videoFps?: number
  videoFrameCount?: number
  thumbnailUrl?: string

  // --- Image asset persistence (IndexedDB / remote) ---
  assetId?: string
  /** @internal Where the image data lives: "indexeddb" | "remote" | "missing" */
  persistence?: "indexeddb" | "remote" | "missing"
  /** @internal Source of the image: "upload" | "generated" | "remote" */
  source?: "upload" | "generated" | "remote"
  /** @internal Error identifier when image asset is not found on restore */
  loadError?: string

  // --- Persistence internal marker (deprecated, kept for reading old data) ---
  /** @deprecated Use `persistence` field instead */
  _imageStripped?: boolean
}

// ============================================================================
// Creative Flow Types
// ============================================================================
export type CreativeFlowId = "mood" | "character" | "storyboard" | "first_frame" | "background" | "video"
export type RightPanelMode = "chat" | "storyboard" | "previs" | "models" | "queue" | "asset" | "profile"

export type CreativeFlowConfig = {
  id: CreativeFlowId
  icon: string
  label: string
  title: string
  desc: string
  draft: string
  mode: RightPanelMode
  nodeKind?: "prompt" | "storyboard" | "previs"
  primaryOutput: string
  workflowSteps: string[]
  nextAction: string
}

// ============================================================================
// Asset Types
// ============================================================================
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

// ============================================================================
// Context Menu Types
// ============================================================================
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
  | {
      type: "edge"
      edgeId: string
      screenX: number
      screenY: number
    }

// ============================================================================
// Floating Toolbar Types
// ============================================================================
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

// ============================================================================
// Chat Types
// ============================================================================
export type ChatMode = "ASK" | "EXECUTE" | "STORYBOARD" | "ORGANIZE" | "IMAGE_PROMPT"

export type ChatMessage = {
  id: string
  role: "assistant" | "user" | "system"
  content: string
  actions?: string[]
  statusSteps?: Array<{
    id?: string
    label: string
    status?: "done" | "running" | "pending" | "warning"
    detail?: string
  }>
  suggestions?: Array<{
    label: string
    prompt: string
    mode?: ChatMode
  }>
  needsUserConfirmation?: boolean
  createdAt: string
}

// ============================================================================
// Canvas Operation Types (internal UI operations)
// NOTE: These are internal canvas UI operations (context menus, toolbar, etc.),
// NOT the same as AI-generated chat CanvasAction (see hooks/useChatSSE.ts).
// The AI chat system uses a different structure: { action, nodeType, nodeId, ... }
// ============================================================================
export type CanvasOperationType =
  | "create_node"
  | "update_node"
  | "delete_node"
  | "connect_nodes"
  | "create_group"
  | "layout_canvas"
  | "generate_prompt"
  | "split_storyboard"
  | "generate_image_prompt"
  | "generate_storyboard"
  | "ask_clarification"
  | "no_action"
  | "select_node"
  | "focus_node"
  | "run_node"
  | "apply_asset_workflow"
  | "generate_image"
  | "open_panel"
  | "sync_storyboard"
  | "clear_canvas"
  | "focus_canvas"
  | "save_canvas"
  | "create_workflow_template"

export type CanvasOperation = {
  type: CanvasOperationType
  params?: Record<string, any>
}

// Keep old names as aliases for backward compatibility
/** @deprecated Use CanvasOperationType instead. The AI chat system uses a separate CanvasAction type in hooks/useChatSSE.ts */
export type CanvasActionType = CanvasOperationType
/** @deprecated Use CanvasOperation instead. The AI chat system uses a separate CanvasAction type in hooks/useChatSSE.ts */
export type CanvasAction = CanvasOperation

// ============================================================================
// Storyboard Types (from @creative-canvas/canvas)
// ============================================================================
export type StoryboardLayerType =
  | "stick_figure"
  | "subject"
  | "character"
  | "prop"
  | "background"
  | "foreground"
  | "camera"
  | "annotation"

export type StoryboardShotType =
  | "wide"
  | "medium"
  | "close_up"
  | "over_shoulder"
  | "insert"
  | "custom"

export type StoryboardCameraMovement =
  | "static"
  | "pan"
  | "tilt"
  | "dolly"
  | "truck"
  | "zoom"
  | "handheld"
  | "custom"

export type StoryboardLayer = {
  id: string
  name: string
  type: StoryboardLayerType
  visible: boolean
  locked: boolean
  zIndex: number
  opacity: number
  transform: {
    x: number
    y: number
    scale: number
    rotation: number
  }
  semanticTags: string[]
}

export type StoryboardFrameContent = {
  frameId: string
  title: string
  inputMode: StoryboardLayerType
  intentText: string
  backgroundPrompt: string
  shotType: StoryboardShotType
  cameraMovement: StoryboardCameraMovement
  promptDraft: string
  generatedPrompt: string
  negativePrompt: string
  layers: StoryboardLayer[]
  references: Array<any>
}

// ============================================================================
// Node Styles
// ============================================================================
export const nodeToneStyles: Record<CanvasNodeKind, {
  eyebrow: string
  body: string
  meta: string
  border: string
  background: string
}> = {
  text: {
    eyebrow: "text-slate-300",
    body: "text-slate-200/75",
    meta: "text-slate-300/60",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    background: "rgba(100, 116, 139, 0.1)",
  },
  prompt: {
    eyebrow: "text-slate-300",
    body: "text-slate-200/75",
    meta: "text-slate-300/60",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    background: "rgba(100, 116, 139, 0.1)",
  },
  image: {
    eyebrow: "text-slate-300",
    body: "text-slate-200/75",
    meta: "text-slate-300/60",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    background: "rgba(100, 116, 139, 0.1)",
  },
  storyboard: {
    eyebrow: "text-slate-300",
    body: "text-slate-200/75",
    meta: "text-slate-300/60",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    background: "rgba(100, 116, 139, 0.1)",
  },
  document: {
    eyebrow: "text-slate-300",
    body: "text-slate-200/75",
    meta: "text-slate-300/60",
    border: "1px solid rgba(148, 163, 184, 0.22)",
    background: "rgba(100, 116, 139, 0.12)",
  },
  shot: {
    eyebrow: "text-slate-300",
    body: "text-slate-200/75",
    meta: "text-slate-300/60",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    background: "rgba(100, 116, 139, 0.1)",
  },
  "storyboard-grid": {
    eyebrow: "text-slate-300",
    body: "text-slate-200/75",
    meta: "text-slate-300/60",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    background: "rgba(100, 116, 139, 0.1)",
  },
  reference: {
    eyebrow: "text-slate-300",
    body: "text-slate-200/75",
    meta: "text-slate-300/60",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    background: "rgba(100, 116, 139, 0.1)",
  },
  group: {
    eyebrow: "text-slate-300",
    body: "text-slate-200/75",
    meta: "text-slate-300/60",
    border: "1px dashed rgba(148, 163, 184, 0.25)",
    background: "rgba(100, 116, 139, 0.06)",
  },
  previs: {
    eyebrow: "text-slate-300",
    body: "text-slate-200/75",
    meta: "text-slate-300/60",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    background: "rgba(100, 116, 139, 0.1)",
  },
  "uploaded-image": {
    eyebrow: "text-slate-300",
    body: "text-slate-200/75",
    meta: "text-slate-300/60",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    background: "rgba(100, 116, 139, 0.1)",
  },
  "uploaded-video": {
    eyebrow: "text-slate-300",
    body: "text-slate-200/75",
    meta: "text-slate-300/60",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    background: "rgba(100, 116, 139, 0.1)",
  },
  "uploaded-audio": {
    eyebrow: "text-slate-300",
    body: "text-slate-200/75",
    meta: "text-slate-300/60",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    background: "rgba(100, 116, 139, 0.1)",
  },
  "uploaded-file": {
    eyebrow: "text-slate-300",
    body: "text-slate-200/75",
    meta: "text-slate-300/60",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    background: "rgba(100, 116, 139, 0.1)",
  },
  "image-result": {
    eyebrow: "text-slate-300",
    body: "text-slate-200/75",
    meta: "text-slate-300/60",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    background: "rgba(100, 116, 139, 0.1)",
  },
  "text-result": {
    eyebrow: "text-slate-300",
    body: "text-slate-200/75",
    meta: "text-slate-300/60",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    background: "rgba(100, 116, 139, 0.1)",
  },
  script: {
    eyebrow: "text-slate-300",
    body: "text-slate-200/75",
    meta: "text-slate-300/60",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    background: "rgba(100, 116, 139, 0.1)",
  },
  "image-generation": {
    eyebrow: "text-slate-300",
    body: "text-slate-200/75",
    meta: "text-slate-300/60",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    background: "rgba(100, 116, 139, 0.1)",
  },
  "video-generation": {
    eyebrow: "text-slate-300",
    body: "text-slate-200/75",
    meta: "text-slate-300/60",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    background: "rgba(100, 116, 139, 0.1)",
  },
  audio: {
    eyebrow: "text-slate-300",
    body: "text-slate-200/75",
    meta: "text-slate-300/60",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    background: "rgba(100, 116, 139, 0.1)",
  },
  subtitle: {
    eyebrow: "text-slate-300",
    body: "text-slate-200/75",
    meta: "text-slate-300/60",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    background: "rgba(100, 116, 139, 0.1)",
  },
  composition: {
    eyebrow: "text-slate-300",
    body: "text-slate-200/75",
    meta: "text-slate-300/60",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    background: "rgba(100, 116, 139, 0.1)",
  },
  "video-result": {
    eyebrow: "text-slate-300",
    body: "text-slate-200/75",
    meta: "text-slate-300/60",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    background: "rgba(100, 116, 139, 0.1)",
  },
  "ai-generated-image": {
    eyebrow: "text-slate-300",
    body: "text-slate-200/75",
    meta: "text-slate-300/60",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    background: "rgba(100, 116, 139, 0.1)",
  },
  "video-sample-frames": {
    eyebrow: "text-slate-300",
    body: "text-slate-200/75",
    meta: "text-slate-300/60",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    background: "rgba(100, 116, 139, 0.1)",
  },
  "video-analyze": {
    eyebrow: "text-slate-300",
    body: "text-slate-200/75",
    meta: "text-slate-300/60",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    background: "rgba(100, 116, 139, 0.1)",
  },
}
