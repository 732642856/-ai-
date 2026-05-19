// ============================================================================
// Shared Types for Canvas Components
// ============================================================================
import type { Node, Edge } from '@xyflow/react'
import type { ReactNode } from 'react'

// ============================================================================
// Node Types
// ============================================================================
export type AgentNodeType = "text" | "prompt" | "image" | "storyboard" | "reference" | "group"
export type CanvasNodeKind = AgentNodeType | "previs" | "uploaded-image" | "uploaded-video" | "uploaded-audio" | "uploaded-file" | "image-result" | "text-result"

export type CanvasNodeData = {
  label?: ReactNode
  title?: string
  nodeKind?: CanvasNodeKind
  summary?: string
  prompt?: string
  negativePrompt?: string
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
  previs3d?: any
  generationJob?: any
  sourcePromptId?: string
  sourceGenerationJobId?: string
  generationOutput?: any
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
// Action Types
// ============================================================================
export type CanvasActionType =
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
  | "apply_asset_workflow"
  | "generate_image"
  | "open_panel"
  | "sync_storyboard"
  | "clear_canvas"
  | "focus_canvas"
  | "save_canvas"
  | "create_workflow_template"

export type CanvasAction = {
  type: CanvasActionType
  params?: Record<string, any>
}

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
    eyebrow: "text-violet-200",
    body: "text-violet-100/75",
    meta: "text-violet-200/60",
    border: "1px solid rgba(196, 181, 253, 0.35)",
    background: "rgba(124, 58, 237, 0.16)",
  },
  prompt: {
    eyebrow: "text-purple-200",
    body: "text-purple-100/75",
    meta: "text-purple-200/60",
    border: "1px solid rgba(216, 180, 254, 0.35)",
    background: "rgba(168, 85, 247, 0.16)",
  },
  image: {
    eyebrow: "text-fuchsia-200",
    body: "text-fuchsia-100/75",
    meta: "text-fuchsia-200/60",
    border: "1px solid rgba(232, 121, 249, 0.35)",
    background: "rgba(192, 38, 211, 0.16)",
  },
  storyboard: {
    eyebrow: "text-violet-200",
    body: "text-violet-100/75",
    meta: "text-violet-200/60",
    border: "1px solid rgba(150, 149, 236, 0.4)",
    background: "rgba(109, 40, 217, 0.18)",
  },
  reference: {
    eyebrow: "text-indigo-200",
    body: "text-indigo-100/75",
    meta: "text-indigo-200/60",
    border: "1px solid rgba(129, 140, 248, 0.35)",
    background: "rgba(79, 70, 229, 0.16)",
  },
  group: {
    eyebrow: "text-violet-200",
    body: "text-violet-100/75",
    meta: "text-violet-200/60",
    border: "1px dashed rgba(216, 180, 254, 0.45)",
    background: "rgba(30, 27, 75, 0.42)",
  },
  previs: {
    eyebrow: "text-indigo-200",
    body: "text-indigo-100/75",
    meta: "text-indigo-200/60",
    border: "1px solid rgba(129, 140, 248, 0.35)",
    background: "rgba(67, 56, 202, 0.16)",
  },
  "uploaded-image": {
    eyebrow: "text-violet-200",
    body: "text-violet-100/75",
    meta: "text-violet-200/60",
    border: "1px solid rgba(150, 149, 236, 0.35)",
    background: "rgba(109, 40, 217, 0.16)",
  },
  "uploaded-video": {
    eyebrow: "text-indigo-200",
    body: "text-indigo-100/75",
    meta: "text-indigo-200/60",
    border: "1px solid rgba(129, 140, 248, 0.35)",
    background: "rgba(79, 70, 229, 0.16)",
  },
  "uploaded-audio": {
    eyebrow: "text-purple-200",
    body: "text-purple-100/75",
    meta: "text-purple-200/60",
    border: "1px solid rgba(216, 180, 254, 0.35)",
    background: "rgba(126, 34, 206, 0.16)",
  },
  "uploaded-file": {
    eyebrow: "text-indigo-200",
    body: "text-indigo-100/75",
    meta: "text-indigo-200/60",
    border: "1px solid rgba(129, 140, 248, 0.35)",
    background: "rgba(67, 56, 202, 0.16)",
  },
  "image-result": {
    eyebrow: "text-fuchsia-200",
    body: "text-fuchsia-100/75",
    meta: "text-fuchsia-200/60",
    border: "1px solid rgba(232, 121, 249, 0.35)",
    background: "rgba(192, 38, 211, 0.16)",
  },
  "text-result": {
    eyebrow: "text-purple-200",
    body: "text-purple-100/75",
    meta: "text-purple-200/60",
    border: "1px solid rgba(216, 180, 254, 0.35)",
    background: "rgba(126, 34, 206, 0.16)",
  },
}
