/**
 * Cinematic Prompt Analyzer
 *
 * Migrated from packages/canvas/src/prompt-analyzer.ts.
 *
 * Pure functions for analyzing storyboard frames and Previs3D scenes,
 * generating structured cinematic prompts from 3D camera/blocking data.
 *
 * Phase 7C scope:
 * - pure functions only: no side effects, no network, no React, no Node APIs
 * - types from apps/web/src/types/cinematic.ts (Phase 7B migration)
 * - constants (shotTypePromptMap etc.) also from types/cinematic.ts
 * - NOT wired into runner/workflow/generation yet (Phase 7D scope)
 */

import {
  cameraMovementLabelMap,
  cameraMovementPromptMap,
  shotTypeLabelMap,
  shotTypePromptMap,
} from "../../types/cinematic.ts"

import type {
  CinematicPromptPipelineResult,
  Previs3DAnalysis,
  Previs3DCameraRig,
  Previs3DObject,
  Previs3DSceneContent,
  PromptAnalysisResult,
  StickFigureAnalysis,
  StoryboardAnalysis,
  StoryboardCameraMovement,
  StoryboardFrameContent,
  StoryboardLayer,
  StoryboardShotType,
  Vector3D,
} from "../../types/cinematic.ts"

// ============================================================================
// Private helpers
// ============================================================================

function formatVector(vector?: Vector3D): string {
  if (!vector) {
    return "未设置"
  }

  return `x:${vector.x}, y:${vector.y}, z:${vector.z}`
}

// ============================================================================
// Format functions
// ============================================================================

export function formatCameraPath(path: Vector3D[] = []): string {
  if (path.length === 0) {
    return "no explicit camera path points"
  }

  return path.map((point, index) => `P${index + 1}(${formatVector(point)})`).join(" -> ")
}

export function formatObjectBlocking(objects: Previs3DObject[]): string {
  if (objects.length === 0) {
    return "no 3D blocking objects"
  }

  return objects
    .map((object) => {
      const position = object.transform.position
      const rotation = object.transform.rotation
      const tags = object.semanticTags?.length ? `, tags: ${object.semanticTags.join(" / ")}` : ""
      const notes = object.notes ? `, notes: ${object.notes}` : ""
      return `${object.name}(${object.type}) at ${formatVector(position)}, rotation x:${rotation.x}, y:${rotation.y}, z:${rotation.z}${tags}${notes}`
    })
    .join("; ")
}

// ============================================================================
// Analysis functions
// ============================================================================

export function analyzeStoryboard(storyboard: StoryboardFrameContent): StoryboardAnalysis {
  const shotType: StoryboardShotType = storyboard.shotType ?? "medium"
  const cameraMovement: StoryboardCameraMovement = storyboard.cameraMovement ?? "static"
  const visibleLayers = storyboard.layers.filter((layer) => layer.visible)
  const layerTags = visibleLayers.flatMap((layer) => layer.semanticTags ?? [layer.type])
  const layerSignal = Array.from(new Set(layerTags)).join(", ")

  return {
    title: "Storyboard Analyzer",
    shotType,
    cameraMovement,
    visibleLayers,
    summary: `${shotTypeLabelMap[shotType]} / ${cameraMovementLabelMap[cameraMovement]}：读取分镜标题、导演意图、AI 背景和可见图层。`,
    promptFragments: [
      shotTypePromptMap[shotType],
      storyboard.intentText,
      storyboard.backgroundPrompt,
      cameraMovementPromptMap[cameraMovement],
      layerSignal ? `storyboard layer intent: ${layerSignal}` : undefined,
    ].filter(Boolean) as string[],
    constraints: [
      `景别：${shotTypeLabelMap[shotType]}`,
      `镜头运动：${cameraMovementLabelMap[cameraMovement]}`,
      `可见图层：${visibleLayers.map((layer) => layer.name).join(" / ") || "未设置"}`,
    ],
    warnings: visibleLayers.length === 0 ? ["没有可见分镜图层，Prompt 会缺少视觉意图来源。"] : undefined,
  }
}

export function analyzeStickFigure(storyboard: StoryboardFrameContent): StickFigureAnalysis {
  const stickLayers = storyboard.layers.filter((layer) => layer.visible && layer.type === "stick_figure")
  const poseTags = Array.from(new Set(stickLayers.flatMap((layer) => layer.semanticTags ?? [])))

  return {
    title: "Stick Figure Analyzer",
    poseTags,
    summary: stickLayers.length
      ? `已读取 ${stickLayers.length} 个火柴人 Blocking 图层，用于约束人物站位、姿态、动作线和遮挡。`
      : "未检测到火柴人图层，改用文字意图和 3D Blocking 约束人物调度。",
    promptFragments: [
      stickLayers.length ? "stick-figure blocking translated into believable actor poses and spatial relationships" : undefined,
      poseTags.length ? `pose and blocking tags: ${poseTags.join(", ")}` : undefined,
    ].filter(Boolean) as string[],
    constraints: [
      `火柴人图层：${stickLayers.length}`,
      `姿态标签：${poseTags.join(" / ") || "未设置"}`,
    ],
    warnings: stickLayers.length === 0 ? ["没有火柴人 Blocking，非绘画用户的姿态控制能力会下降。"] : undefined,
  }
}

export function analyzePrevis3D(previs: Previs3DSceneContent): Previs3DAnalysis {
  const activeCamera = previs.cameras.find((camera) => camera.id === previs.activeCameraId) ?? previs.cameras[0]
  const focalLength = activeCamera ? `${activeCamera.focalLengthMm}mm lens` : "director-selected lens"
  const aperture = activeCamera?.aperture ? `f/${activeCamera.aperture}` : "cinematic depth of field"
  const cameraPosition = activeCamera ? `camera position ${formatVector(activeCamera.transform.position)}` : "camera position defined by 3D previs"
  const cameraRotation = activeCamera
    ? `camera rotation x:${activeCamera.transform.rotation.x}, y:${activeCamera.transform.rotation.y}, z:${activeCamera.transform.rotation.z}`
    : "camera rotation defined by 3D previs"
  const cameraTarget = activeCamera?.target ? `camera target ${formatVector(activeCamera.target)}` : "camera target not set"
  const cameraPath = activeCamera ? formatCameraPath(activeCamera.path) : "no explicit camera path points"
  const objectBlocking = formatObjectBlocking(previs.objects)

  return {
    title: "Previs3D Analyzer",
    activeCamera,
    objectBlocking,
    cameraPath,
    summary: `${focalLength}, ${aperture}：已读取 3D 对象 Blocking、摄影机位置/旋转/目标点和运动路径。`,
    promptFragments: [
      previs.environmentPrompt,
      `${focalLength}, ${aperture}, ${cameraPosition}, ${cameraRotation}, ${cameraTarget}`,
      `3D blocking constraints: ${objectBlocking}`,
      `camera movement path: ${cameraPath}`,
    ].filter(Boolean) as string[],
    constraints: [
      `焦段：${focalLength}`,
      `光圈：${aperture}`,
      `摄影机位置：${activeCamera ? formatVector(activeCamera.transform.position) : "未设置"}`,
      `摄影机旋转：${activeCamera ? formatVector(activeCamera.transform.rotation) : "未设置"}`,
      `摄影机目标：${activeCamera?.target ? formatVector(activeCamera.target) : "未设置"}`,
      `路径点：${activeCamera?.path?.length ?? 0}`,
      `3D 对象：${previs.objects.length}`,
    ],
    warnings: activeCamera ? undefined : ["没有摄影机，无法生成准确镜头语言。"],
  }
}

// ============================================================================
// Composition functions
// ============================================================================

export function composeShotDescription(pipeline: CinematicPromptPipelineResult): string {
  const camera = pipeline.previs3d.activeCamera
  const shotType = shotTypeLabelMap[pipeline.storyboard.shotType]
  const movement = cameraMovementLabelMap[camera?.movement ?? pipeline.storyboard.cameraMovement]
  const focalLength = camera ? `${camera.focalLengthMm}mm` : "未设焦段"
  const aperture = camera?.aperture ? `f/${camera.aperture}` : "未设光圈"
  const pathCount = camera?.path?.length ?? 0
  const cameraPosition = camera ? formatVector(camera.transform.position) : "未设置"
  const cameraTarget = camera?.target ? formatVector(camera.target) : "未设置"

  return [
    `镜头说明：${shotType}，${movement}，${focalLength}，${aperture}。`,
    `机位在 ${cameraPosition}，目标点 ${cameraTarget}，路径点 ${pathCount} 个。`,
    pipeline.stickFigure.poseTags.length
      ? `演员调度参考火柴人标签：${pipeline.stickFigure.poseTags.join(" / ")}。`
      : "演员调度主要参考文字意图与 3D Blocking。",
    `空间 Blocking：${pipeline.previs3d.objectBlocking}`,
  ].join(" ")
}

export function composeCinematicPrompt(
  pipeline: CinematicPromptPipelineResult,
  storyboard: StoryboardFrameContent,
): PromptAnalysisResult {
  const promptSections = [
    ...pipeline.storyboard.promptFragments,
    ...pipeline.stickFigure.promptFragments,
    ...pipeline.previs3d.promptFragments,
    "cinematic lighting, coherent perspective, subject-background separation, consistent eyelines, production-ready AI video/image prompt",
  ].filter(Boolean)

  const negativePrompt = [
    storyboard.negativePrompt,
    "avoid broken anatomy, avoid merged characters, avoid inconsistent eyelines, avoid impossible perspective, avoid camera drift, avoid background overpowering the subject",
  ]
    .filter(Boolean)
    .join(" ")

  const shotDescription = composeShotDescription(pipeline)
  const constraints = [
    ...pipeline.storyboard.constraints,
    ...pipeline.stickFigure.constraints,
    ...pipeline.previs3d.constraints,
  ]

  return {
    title: `${storyboard.title ?? "Storyboard"} · Cinematic Prompt Pipeline`,
    prompt: promptSections.join(". "),
    negativePrompt,
    summary: [pipeline.storyboard.summary, pipeline.stickFigure.summary, pipeline.previs3d.summary].join(" "),
    constraints,
    shotDescription,
    pipeline,
  }
}

// ============================================================================
// Pipeline entry points
// ============================================================================

export function runCinematicPromptPipeline(
  storyboard: StoryboardFrameContent,
  previs: Previs3DSceneContent,
): PromptAnalysisResult {
  const pipeline: CinematicPromptPipelineResult = {
    storyboard: analyzeStoryboard(storyboard),
    stickFigure: analyzeStickFigure(storyboard),
    previs3d: analyzePrevis3D(previs),
  }

  return composeCinematicPrompt(pipeline, storyboard)
}

/** Alias for runCinematicPromptPipeline — legacy API compatibility */
export const analyzePromptFromStoryboard = runCinematicPromptPipeline
