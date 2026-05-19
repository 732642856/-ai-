import { CanvasNodeType } from "@creative-canvas/shared"

export {
  analyzePrevis3D,
  analyzePromptFromStoryboard,
  analyzeStickFigure,
  analyzeStoryboard,
  cameraMovementLabelMap,
  cameraMovementPromptMap,
  composeCinematicPrompt,
  composeShotDescription,
  formatCameraPath,
  formatObjectBlocking,
  runCinematicPromptPipeline,
  shotTypeLabelMap,
  shotTypePromptMap,
} from "./prompt-analyzer"
export type {
  AnalyzerSection,
  CinematicPromptPipelineResult,
  Previs3DAnalysis,
  PromptAnalysisResult,
  StickFigureAnalysis,
  StoryboardAnalysis,
} from "./prompt-analyzer"

export type StoryboardShotType = "wide" | "medium" | "close_up" | "over_shoulder" | "insert" | "custom"

export type StoryboardCameraMovement = "static" | "pan" | "tilt" | "dolly" | "truck" | "zoom" | "handheld" | "custom"

export type StoryboardInputMode = "stick_figure" | "rough_sketch" | "text_only" | "reference_image" | "script" | "previs_3d"

export type Previs3DObjectType = "actor" | "prop" | "set_piece" | "background" | "light" | "camera" | "marker"

export interface Vector3D {
  x: number
  y: number
  z: number
}

export interface Transform3D {
  position: Vector3D
  rotation: Vector3D
  scale: Vector3D
}

export interface Previs3DObject {
  id: string
  name: string
  type: Previs3DObjectType
  transform: Transform3D
  color?: string
  assetId?: string
  semanticTags?: string[]
  notes?: string
}

export interface Previs3DCameraRig {
  id: string
  name: string
  transform: Transform3D
  target?: Vector3D
  focalLengthMm: number
  sensorPreset?: "full_frame" | "super_35" | "mft" | "custom"
  aperture?: number
  shotType?: StoryboardShotType
  movement?: StoryboardCameraMovement
  path?: Vector3D[]
}

export interface Previs3DSceneContent {
  sceneId: string
  title?: string
  intentText?: string
  environmentPrompt?: string
  units?: "meters" | "centimeters" | "generic"
  objects: Previs3DObject[]
  cameras: Previs3DCameraRig[]
  activeCameraId?: string
  notes?: string
}

export type StoryboardLayerType =
  | "stick_figure"
  | "subject"
  | "character"
  | "prop"
  | "background"
  | "foreground"
  | "camera"
  | "annotation"

export interface StoryboardLayer {
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
  sketchData?: unknown
  maskAssetId?: string
  generatedAssetId?: string
  semanticTags?: string[]
}

export interface StoryboardFrameContent {
  frameId: string
  title?: string
  inputMode?: StoryboardInputMode
  intentText?: string
  backgroundPrompt?: string
  shotType?: StoryboardShotType
  cameraMovement?: StoryboardCameraMovement
  promptDraft?: string
  generatedPrompt?: string
  negativePrompt?: string
  layers: StoryboardLayer[]
  references?: Array<{
    id: string
    assetId?: string
    url?: string
    purpose: "style" | "character" | "composition" | "scene" | "other"
  }>
}

export interface CanvasNodeContent {
  schemaVersion: number
  text?: string
  assetId?: string
  workId?: string
  storyboard?: StoryboardFrameContent
  previs3d?: Previs3DSceneContent
  metadata?: Record<string, unknown>
}

export interface CreativeCanvasNode {
  id: string
  type: CanvasNodeType
  title?: string
  content: CanvasNodeContent
  position: { x: number; y: number }
  width?: number
  height?: number
}

export interface CreativeCanvasEdge {
  id: string
  source: string
  target: string
  type?: string
  metadata?: Record<string, unknown>
}
