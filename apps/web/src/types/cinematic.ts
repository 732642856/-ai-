/**
 * Cinematic Pipeline Types
 *
 * Migrated from packages/canvas (V1 Cinema Pipeline).
 *
 * These types are richer supersets of the simpler storyboard/previs definitions
 * in components/canvas/types.ts. The Cinema Pipeline types include:
 * - Full 3D transform data (Vector3D, Transform3D)
 * - Camera rigs with focal length, aperture, target, and movement paths
 * - Structured analysis pipeline types (AnalyzerSection, etc.)
 *
 * Phase 7B scope:
 * - types only: no runtime logic, no React dependency, no side effects
 * - all fields optional where reasonable to maintain compatibility
 * - intended to supersede V2's simpler types in subsequent phases (7C-7E)
 *
 * NOTE: StoryboardShotType / StoryboardCameraMovement / StoryboardLayerType
 * already exist in components/canvas/types.ts with identical values.
 * They are re-exported here for self-containment of the cinematic type module.
 */

// ============================================================================
// Vector & Transform (Cinema-only — not in V2)
// ============================================================================

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

// ============================================================================
// Shot / Camera / Layer Enums (superset of V2 definitions)
// ============================================================================

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

export type StoryboardInputMode =
  | "stick_figure"
  | "rough_sketch"
  | "text_only"
  | "reference_image"
  | "script"
  | "previs_3d"

export type StoryboardLayerType =
  | "stick_figure"
  | "subject"
  | "character"
  | "prop"
  | "background"
  | "foreground"
  | "camera"
  | "annotation"

// ============================================================================
// Previs 3D (Cinema-only — not in V2)
// ============================================================================

export type Previs3DObjectType =
  | "actor"
  | "prop"
  | "set_piece"
  | "background"
  | "light"
  | "camera"
  | "marker"

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

// ============================================================================
// Storyboard Layer & Frame (richer Cinema versions — V2 has simpler variants)
// ============================================================================

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

// ============================================================================
// Analysis Pipeline (Cinema-only — not in V2)
// ============================================================================

export interface AnalyzerSection {
  title: string
  summary: string
  promptFragments: string[]
  constraints: string[]
  warnings?: string[]
}

export interface StoryboardAnalysis extends AnalyzerSection {
  shotType: StoryboardShotType
  cameraMovement: StoryboardCameraMovement
  visibleLayers: StoryboardLayer[]
}

export interface StickFigureAnalysis extends AnalyzerSection {
  poseTags: string[]
}

export interface Previs3DAnalysis extends AnalyzerSection {
  activeCamera?: Previs3DCameraRig
  objectBlocking: string
  cameraPath: string
}

export interface CinematicPromptPipelineResult {
  storyboard: StoryboardAnalysis
  stickFigure: StickFigureAnalysis
  previs3d: Previs3DAnalysis
}

export interface PromptAnalysisResult {
  title: string
  prompt: string
  negativePrompt: string
  summary: string
  constraints: string[]
  shotDescription: string
  pipeline: CinematicPromptPipelineResult
}

// ============================================================================
// Prompt Analysis Mappers (Cinema-only — not in V2)
// ============================================================================

export const shotTypePromptMap: Record<StoryboardShotType, string> = {
  wide: "wide establishing shot, clear spatial geography, full-body blocking",
  medium: "medium shot, readable actor blocking and relationship",
  close_up: "close-up shot, strong facial emotion and shallow depth of field",
  over_shoulder: "over-the-shoulder shot, foreground shoulder silhouette, subject eyeline",
  insert: "insert shot, prop detail, precise hand action",
  custom: "custom director-defined shot size",
}

export const shotTypeLabelMap: Record<StoryboardShotType, string> = {
  wide: "远景",
  medium: "中景",
  close_up: "特写",
  over_shoulder: "过肩",
  insert: "插入镜头",
  custom: "自定义景别",
}

export const cameraMovementPromptMap: Record<StoryboardCameraMovement, string> = {
  static: "locked-off camera, stable composition",
  pan: "slow pan, horizontal reveal",
  tilt: "controlled tilt, vertical reveal",
  dolly: "dolly move, perspective shift through space",
  truck: "lateral tracking move, side-to-side camera motion",
  zoom: "optical zoom, compressed perspective change",
  handheld: "subtle handheld camera, nervous human energy",
  custom: "custom director-defined camera movement",
}

export const cameraMovementLabelMap: Record<StoryboardCameraMovement, string> = {
  static: "固定机位",
  pan: "横摇",
  tilt: "俯仰",
  dolly: "推拉",
  truck: "横移",
  zoom: "变焦",
  handheld: "手持",
  custom: "自定义运动",
}
