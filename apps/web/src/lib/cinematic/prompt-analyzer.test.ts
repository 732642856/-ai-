/**
 * Cinematic Prompt Analyzer — Pure Function Tests
 *
 * Migrated from packages/canvas logic. Tests verify:
 * - All 9 exported functions plus alias
 * - Empty/null/edge-case inputs
 * - Storyboard-only, Previs3D-only, combined paths
 * - Label/format string stability
 * - No side effects (input immutability)
 * - Cross-layer constraint traceability
 */
import assert from "node:assert/strict"
import test from "node:test"

import {
  analyzePrevis3D,
  analyzePromptFromStoryboard,
  analyzeStickFigure,
  analyzeStoryboard,
  composeCinematicPrompt,
  composeShotDescription,
  formatCameraPath,
  formatObjectBlocking,
  runCinematicPromptPipeline,
} from "./prompt-analyzer.ts"

import type {
  CinematicPromptPipelineResult,
  Previs3DCameraRig,
  Previs3DObject,
  Previs3DSceneContent,
  PromptAnalysisResult,
  StoryboardFrameContent,
  StoryboardLayer,
  Vector3D,
} from "../../types/cinematic.ts"

// ============================================================================
// Test fixtures
// ============================================================================

function makeMinimalStoryboard(overrides: Partial<StoryboardFrameContent> = {}): StoryboardFrameContent {
  return {
    frameId: "frame-1",
    title: "Opening shot",
    layers: [],
    ...overrides,
  }
}

function makeStoryboardWithLayers(layers: Partial<StoryboardLayer>[]): StoryboardFrameContent {
  return {
    frameId: "frame-1",
    title: "Keyframe A",
    shotType: "wide",
    cameraMovement: "dolly",
    intentText: "Hero confronts the antagonist in a foggy station",
    backgroundPrompt: "abandoned train station, fog, cinematic volumetric light",
    negativePrompt: "daylight, clean surfaces",
    layers: layers.map((l, i) => ({
      id: l.id ?? `layer-${i}`,
      name: l.name ?? `layer ${i}`,
      type: l.type ?? "character",
      visible: l.visible ?? true,
      locked: l.locked ?? false,
      zIndex: l.zIndex ?? i,
      opacity: l.opacity ?? 100,
      transform: l.transform ?? { x: 0, y: 0, scale: 1, rotation: 0 },
      semanticTags: l.semanticTags,
      ...l,
    })),
  }
}

function makeMinimalPrevis(overrides: Partial<Previs3DSceneContent> = {}): Previs3DSceneContent {
  return {
    sceneId: "scene-1",
    objects: [],
    cameras: [],
    ...overrides,
  }
}

function makePrevisObjects(count: number): Previs3DObject[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `obj-${i}`,
    name: `Object ${i}`,
    type: i % 2 === 0 ? "actor" : "prop",
    transform: {
      position: { x: i, y: 0, z: i + 1 },
      rotation: { x: 0, y: i * 90, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    },
    semanticTags: i === 0 ? ["hero", "foreground"] : ["background"],
    notes: i === 0 ? "Main character" : undefined,
  }))
}

function makeCamera(position: Vector3D, target: Vector3D, focalLengthMm: number, movement?: string): Previs3DCameraRig {
  return {
    id: "cam-1",
    name: "Main Camera",
    transform: { position, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    target,
    focalLengthMm,
    aperture: 2.8,
    movement: movement as any,
    path: [position, { x: position.x + 1, y: position.y, z: position.z - 1 }, target],
  }
}

// ============================================================================
// formatCameraPath
// ============================================================================

test("formatCameraPath returns placeholder for empty path", () => {
  assert.equal(formatCameraPath([]), "no explicit camera path points")
  assert.equal(formatCameraPath(), "no explicit camera path points")
})

test("formatCameraPath formats single point", () => {
  const path: Vector3D[] = [{ x: 0, y: 1.6, z: 5 }]
  const result = formatCameraPath(path)
  assert.match(result, /P1/)
  assert.match(result, /x:0/)
})

test("formatCameraPath formats multi-point path", () => {
  const path: Vector3D[] = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 1 },
    { x: 2, y: 0, z: 2 },
  ]
  const result = formatCameraPath(path)
  assert.match(result, /P1/)
  assert.match(result, /P2/)
  assert.match(result, /P3/)
  assert.match(result, /->/)
})

// ============================================================================
// formatObjectBlocking
// ============================================================================

test("formatObjectBlocking returns placeholder for empty array", () => {
  assert.equal(formatObjectBlocking([]), "no 3D blocking objects")
})

test("formatObjectBlocking formats single object", () => {
  const objects = makePrevisObjects(1)
  const result = formatObjectBlocking(objects)
  assert.match(result, /Object 0/)
  assert.match(result, /actor/)
  assert.match(result, /hero/)
})

test("formatObjectBlocking formats multiple objects", () => {
  const objects = makePrevisObjects(3)
  const result = formatObjectBlocking(objects)
  assert.match(result, /Object 0/)
  assert.match(result, /Object 1/)
  assert.match(result, /Object 2/)
  assert.match(result, /;/)
})

// ============================================================================
// analyzeStoryboard
// ============================================================================

test("analyzeStoryboard returns neutral result for empty input", () => {
  const frame = makeMinimalStoryboard()
  const result = analyzeStoryboard(frame)
  assert.equal(result.shotType, "medium")
  assert.equal(result.cameraMovement, "static")
  assert.equal(result.visibleLayers.length, 0)
  assert.ok(result.warnings?.length)
})

test("analyzeStoryboard reads shot type and camera movement from frame", () => {
  const frame = makeMinimalStoryboard({ shotType: "close_up", cameraMovement: "handheld" })
  const result = analyzeStoryboard(frame)
  assert.equal(result.shotType, "close_up")
  assert.equal(result.cameraMovement, "handheld")
})

test("analyzeStoryboard filters visible layers only", () => {
  const frame = makeStoryboardWithLayers([
    { id: "visible", name: "Hero", type: "character", visible: true },
    { id: "hidden", name: "Shadow", type: "character", visible: false },
  ])
  const result = analyzeStoryboard(frame)
  assert.equal(result.visibleLayers.length, 1)
  assert.equal(result.visibleLayers[0].id, "visible")
})

test("analyzeStoryboard includes intentText and backgroundPrompt in fragments", () => {
  const frame = makeStoryboardWithLayers([{ id: "l1", name: "BG", type: "background" }])
  const result = analyzeStoryboard(frame)
  const joined = result.promptFragments.join(" ")
  assert.match(joined, /Hero confronts/)
  assert.match(joined, /abandoned train station/)
})

test("analyzeStoryboard constraints reference shot type labels in Chinese", () => {
  const frame = makeStoryboardWithLayers([{ id: "l1", name: "Hero", type: "character" }])
  const result = analyzeStoryboard(frame)
  assert.match(result.constraints.join(" "), /景别/)
  assert.match(result.constraints.join(" "), /镜头运动/)
  assert.match(result.constraints.join(" "), /Hero/)
})

test("analyzeStoryboard does not mutate input", () => {
  const frame = makeStoryboardWithLayers([{ id: "l1", name: "Hero", type: "character", semanticTags: ["tag1"] }])
  const snapshot = JSON.stringify(frame)
  analyzeStoryboard(frame)
  assert.equal(JSON.stringify(frame), snapshot)
})

// ============================================================================
// analyzeStickFigure
// ============================================================================

test("analyzeStickFigure returns empty result when no stick figure layers", () => {
  const frame = makeStoryboardWithLayers([{ id: "l1", name: "BG", type: "background" }])
  const result = analyzeStickFigure(frame)
  assert.equal(result.poseTags.length, 0)
  assert.ok(result.warnings?.length)
})

test("analyzeStickFigure collects pose tags from stick_figure layers", () => {
  const frame = makeStoryboardWithLayers([
    { id: "sf1", name: "Stick Hero", type: "stick_figure", semanticTags: ["wide_stance", "arm_raised"] },
    { id: "sf2", name: "Stick Antagonist", type: "stick_figure", semanticTags: ["crouching", "arm_raised"] },
  ])
  const result = analyzeStickFigure(frame)
  assert.equal(result.poseTags.length, 3) // wide_stance, arm_raised, crouching (arm_raised deduped)
  assert.ok(result.poseTags.includes("wide_stance"))
  assert.ok(result.poseTags.includes("arm_raised"))
})

test("analyzeStickFigure constraints include layer count and tags", () => {
  const frame = makeStoryboardWithLayers([
    { id: "sf1", name: "Stick Hero", type: "stick_figure", semanticTags: ["running"] },
  ])
  const result = analyzeStickFigure(frame)
  assert.match(result.constraints.join(" "), /火柴人图层/)
  assert.match(result.constraints.join(" "), /running/)
})

test("analyzeStickFigure does not mutate input", () => {
  const frame = makeStoryboardWithLayers([
    { id: "sf1", name: "Stick Hero", type: "stick_figure", semanticTags: ["tag1"] },
  ])
  const snapshot = JSON.stringify(frame)
  analyzeStickFigure(frame)
  assert.equal(JSON.stringify(frame), snapshot)
})

// ============================================================================
// analyzePrevis3D
// ============================================================================

test("analyzePrevis3D handles empty scene with no cameras", () => {
  const scene = makeMinimalPrevis()
  const result = analyzePrevis3D(scene)
  assert.equal(result.activeCamera, undefined)
  assert.ok(result.warnings?.length)
})

test("analyzePrevis3D resolves active camera by activeCameraId", () => {
  const camA = makeCamera({ x: 0, y: 1.6, z: 5 }, { x: 0, y: 1, z: 0 }, 35)
  const camB = makeCamera({ x: 5, y: 2, z: 0 }, { x: 0, y: 1, z: 0 }, 85)
  camB.id = "cam-2"
  const scene = makeMinimalPrevis({ objects: [], cameras: [camA, camB], activeCameraId: "cam-2" })
  const result = analyzePrevis3D(scene)
  assert.equal(result.activeCamera?.id, "cam-2")
  assert.equal(result.activeCamera?.focalLengthMm, 85)
})

test("analyzePrevis3D falls back to first camera if activeCameraId not found", () => {
  const camA = makeCamera({ x: 0, y: 1.6, z: 5 }, { x: 0, y: 1, z: 0 }, 35)
  const scene = makeMinimalPrevis({ objects: [], cameras: [camA], activeCameraId: "nonexistent" })
  const result = analyzePrevis3D(scene)
  assert.equal(result.activeCamera?.id, "cam-1")
})

test("analyzePrevis3D constraint includes focalLength, aperture, camera position, target, path count", () => {
  const cam = makeCamera({ x: 0, y: 1.6, z: 5 }, { x: 0, y: 1, z: 1 }, 35)
  const scene = makeMinimalPrevis({ objects: makePrevisObjects(2), cameras: [cam] })
  const result = analyzePrevis3D(scene)
  const constraints = result.constraints.join(" ")
  assert.match(constraints, /35mm/)
  assert.match(constraints, /f\/2\.8/)
  assert.match(constraints, /x:0/)
  assert.match(constraints, /3D 对象：2/)
})

test("analyzePrevis3D objectBlocking contains object names and types", () => {
  const cam = makeCamera({ x: 0, y: 1.6, z: 5 }, { x: 0, y: 1, z: 1 }, 35)
  const scene = makeMinimalPrevis({ objects: makePrevisObjects(2), cameras: [cam] })
  const result = analyzePrevis3D(scene)
  assert.match(result.objectBlocking, /Object 0/)
  assert.match(result.objectBlocking, /actor/)
  assert.match(result.objectBlocking, /Object 1/)
  assert.match(result.objectBlocking, /prop/)
})

test("analyzePrevis3D cameraPath includes path output", () => {
  const cam = makeCamera({ x: 0, y: 1.6, z: 5 }, { x: 0, y: 1, z: 1 }, 35)
  const scene = makeMinimalPrevis({ objects: [], cameras: [cam] })
  const result = analyzePrevis3D(scene)
  assert.match(result.cameraPath, /P1/)
})

test("analyzePrevis3D does not mutate input", () => {
  const cam = makeCamera({ x: 0, y: 1.6, z: 5 }, { x: 0, y: 1, z: 1 }, 35)
  const scene = makeMinimalPrevis({ objects: makePrevisObjects(1), cameras: [cam] })
  const snapshot = JSON.stringify(scene)
  analyzePrevis3D(scene)
  assert.equal(JSON.stringify(scene), snapshot)
})

// ============================================================================
// composeShotDescription
// ============================================================================

test("composeShotDescription combines storyboard and previs data", () => {
  const frame = makeStoryboardWithLayers([{ id: "l1", name: "Hero", type: "character" }])
  const cam = makeCamera({ x: 0, y: 1.6, z: 5 }, { x: 0, y: 1, z: 1 }, 35)
  const scene = makeMinimalPrevis({ objects: makePrevisObjects(1), cameras: [cam] })

  const storyboard = analyzeStoryboard(frame)
  const stickFigure = analyzeStickFigure(frame)
  const previs3d = analyzePrevis3D(scene)
  const pipeline: CinematicPromptPipelineResult = { storyboard, stickFigure, previs3d }

  const desc = composeShotDescription(pipeline)
  assert.match(desc, /镜头说明/)
  assert.match(desc, /远景/)
  assert.match(desc, /35mm/)
  assert.match(desc, /f\/2\.8/)
  assert.match(desc, /空间 Blocking/)
})

test("composeShotDescription handles missing camera gracefully", () => {
  const frame = makeStoryboardWithLayers([])
  const scene = makeMinimalPrevis({ objects: [], cameras: [] })

  const storyboard = analyzeStoryboard(frame)
  const stickFigure = analyzeStickFigure(frame)
  const previs3d = analyzePrevis3D(scene)
  const pipeline: CinematicPromptPipelineResult = { storyboard, stickFigure, previs3d }

  const desc = composeShotDescription(pipeline)
  assert.match(desc, /未设焦段/)
  assert.match(desc, /未设光圈/)
})

// ============================================================================
// composeCinematicPrompt
// ============================================================================

test("composeCinematicPrompt produces PromptAnalysisResult with all sections", () => {
  const frame = makeStoryboardWithLayers([{ id: "l1", name: "Hero", type: "character" }])
  const cam = makeCamera({ x: 0, y: 1.6, z: 5 }, { x: 0, y: 1, z: 1 }, 35)
  const scene = makeMinimalPrevis({ objects: makePrevisObjects(1), cameras: [cam] })

  const storyboard = analyzeStoryboard(frame)
  const stickFigure = analyzeStickFigure(frame)
  const previs3d = analyzePrevis3D(scene)
  const pipeline: CinematicPromptPipelineResult = { storyboard, stickFigure, previs3d }

  const result = composeCinematicPrompt(pipeline, frame)

  assert.equal(typeof result.prompt, "string")
  assert.ok(result.prompt.length > 0)
  assert.equal(typeof result.negativePrompt, "string")
  assert.ok(result.negativePrompt.length > 0)
  assert.equal(typeof result.summary, "string")
  assert.ok(result.constraints.length > 0)
  assert.equal(typeof result.shotDescription, "string")
  assert.equal(result.pipeline, pipeline)
})

test("composeCinematicPrompt includes negative prompt from storyboard", () => {
  const frame = makeStoryboardWithLayers([{ id: "l1", name: "Hero", type: "character" }])
  // negativePrompt is already set by the fixture defaults
  const cam = makeCamera({ x: 0, y: 1.6, z: 5 }, { x: 0, y: 1, z: 1 }, 35)
  const scene = makeMinimalPrevis({ objects: [], cameras: [cam] })

  const storyboard = analyzeStoryboard(frame)
  const stickFigure = analyzeStickFigure(frame)
  const previs3d = analyzePrevis3D(scene)
  const pipeline: CinematicPromptPipelineResult = { storyboard, stickFigure, previs3d }

  const result = composeCinematicPrompt(pipeline, frame)
  assert.match(result.negativePrompt, /daylight/)
})

test("composeCinematicPrompt title uses storyboard title", () => {
  const frame = makeStoryboardWithLayers([{ id: "l1", name: "Hero", type: "character" }])
  const cam = makeCamera({ x: 0, y: 1.6, z: 5 }, { x: 0, y: 1, z: 1 }, 35)
  const scene = makeMinimalPrevis({ objects: [], cameras: [cam] })

  const storyboard = analyzeStoryboard(frame)
  const stickFigure = analyzeStickFigure(frame)
  const previs3d = analyzePrevis3D(scene)
  const pipeline: CinematicPromptPipelineResult = { storyboard, stickFigure, previs3d }

  const result = composeCinematicPrompt(pipeline, frame)
  assert.match(result.title, /Keyframe A/)
  assert.match(result.title, /Cinematic Prompt Pipeline/)
})

// ============================================================================
// runCinematicPromptPipeline
// ============================================================================

test("runCinematicPromptPipeline runs full pipeline end-to-end", () => {
  const frame = makeStoryboardWithLayers([
    { id: "sf", name: "Stick hero", type: "stick_figure", semanticTags: ["wide_stance"] },
    { id: "ch", name: "Hero", type: "character", semanticTags: ["hero", "foreground"] },
  ])
  const cam = makeCamera({ x: 0, y: 1.6, z: 5 }, { x: 0, y: 1, z: 1 }, 35, "dolly")
  const scene = makeMinimalPrevis({ objects: makePrevisObjects(2), cameras: [cam] })

  const result = runCinematicPromptPipeline(frame, scene)

  // Verify full output shape
  assert.equal(typeof result.prompt, "string")
  assert.ok(result.prompt.length > 0)
  assert.equal(typeof result.shotDescription, "string")
  assert.ok(result.constraints.length > 0)
  assert.equal(result.pipeline.storyboard.shotType, "wide")
  assert.equal(result.pipeline.storyboard.cameraMovement, "dolly")
  assert.equal(result.pipeline.previs3d.activeCamera?.id, "cam-1")
})

test("runCinematicPromptPipeline handles minimal inputs gracefully", () => {
  const frame = makeMinimalStoryboard()
  const scene = makeMinimalPrevis()

  const result = runCinematicPromptPipeline(frame, scene)

  // Should not throw, should return a valid result
  assert.equal(typeof result.prompt, "string")
  assert.ok(result.prompt.length > 0)
  assert.ok(result.constraints.length > 0)
})

test("runCinematicPromptPipeline does not mutate inputs", () => {
  const frame = makeStoryboardWithLayers([{ id: "l1", name: "Hero", type: "character" }])
  const cam = makeCamera({ x: 0, y: 1.6, z: 5 }, { x: 0, y: 1, z: 1 }, 35)
  const scene = makeMinimalPrevis({ objects: makePrevisObjects(1), cameras: [cam] })

  const frameSnapshot = JSON.stringify(frame)
  const sceneSnapshot = JSON.stringify(scene)

  runCinematicPromptPipeline(frame, scene)

  assert.equal(JSON.stringify(frame), frameSnapshot)
  assert.equal(JSON.stringify(scene), sceneSnapshot)
})

// ============================================================================
// analyzePromptFromStoryboard (alias)
// ============================================================================

test("analyzePromptFromStoryboard is alias for runCinematicPromptPipeline", () => {
  // Verify it's the same function reference
  assert.equal(analyzePromptFromStoryboard, runCinematicPromptPipeline)
})

test("analyzePromptFromStoryboard produces same result as runCinematicPromptPipeline", () => {
  const frame = makeStoryboardWithLayers([{ id: "l1", name: "Hero", type: "character" }])
  const cam = makeCamera({ x: 0, y: 1.6, z: 5 }, { x: 0, y: 1, z: 1 }, 35)
  const scene = makeMinimalPrevis({ objects: [], cameras: [cam] })

  const result1 = runCinematicPromptPipeline(frame, scene)
  const result2 = analyzePromptFromStoryboard(frame, scene)

  assert.deepEqual(result1, result2)
})

// ============================================================================
// Cross-layer constraint traceability
// ============================================================================

test("prompt contains storyboard shot type and camera movement in English", () => {
  const frame = makeStoryboardWithLayers([{ id: "l1", name: "Hero", type: "character" }])
  const cam = makeCamera({ x: 0, y: 1.6, z: 5 }, { x: 0, y: 1, z: 1 }, 35, "dolly")
  const scene = makeMinimalPrevis({ objects: makePrevisObjects(1), cameras: [cam] })

  const result = runCinematicPromptPipeline(frame, scene)

  // Storyboard layer should contribute English prompt fragments
  assert.match(result.prompt, /wide establishing shot/)
  assert.match(result.prompt, /dolly move/)
})

test("prompt contains 3D object blocking and camera position data", () => {
  const frame = makeStoryboardWithLayers([{ id: "l1", name: "Hero", type: "character" }])
  const cam = makeCamera({ x: 0, y: 1.6, z: 5 }, { x: 0, y: 1, z: 1 }, 35)
  const scene = makeMinimalPrevis({ objects: makePrevisObjects(1), cameras: [cam] })

  const result = runCinematicPromptPipeline(frame, scene)

  assert.match(result.prompt, /Object 0/)
  assert.match(result.prompt, /x:0, y:1\.6, z:5/)
})

test("stick figure pose tags appear in constraints", () => {
  const frame = makeStoryboardWithLayers([
    { id: "sf", name: "Stick", type: "stick_figure", semanticTags: ["crouching"] },
  ])
  const cam = makeCamera({ x: 0, y: 1.6, z: 5 }, { x: 0, y: 1, z: 1 }, 35)
  const scene = makeMinimalPrevis({ objects: [], cameras: [cam] })

  const result = runCinematicPromptPipeline(frame, scene)

  const allConstraints = result.constraints.join(" ")
  assert.match(allConstraints, /crouching/)
})

test("shotDescription contains spatial blocking information", () => {
  const frame = makeStoryboardWithLayers([{ id: "l1", name: "Hero", type: "character" }])
  const cam = makeCamera({ x: 2, y: 1.8, z: 10 }, { x: 0, y: 1, z: 2 }, 50)
  const scene = makeMinimalPrevis({ objects: makePrevisObjects(1), cameras: [cam] })

  const result = runCinematicPromptPipeline(frame, scene)

  assert.match(result.shotDescription, /空间 Blocking/)
  assert.match(result.shotDescription, /50mm/)
})

// ============================================================================
// warnings
// ============================================================================

test("empty storyboard layers produce warnings", () => {
  const frame = makeMinimalStoryboard()
  const result = analyzeStoryboard(frame)
  assert.ok(result.warnings?.length)
})

test("no stick figure layers produce warnings", () => {
  const frame = makeStoryboardWithLayers([{ id: "l1", name: "BG", type: "background" }])
  const result = analyzeStickFigure(frame)
  assert.ok(result.warnings?.length)
})

test("no cameras produce warnings in previs analysis", () => {
  const scene = makeMinimalPrevis({ objects: makePrevisObjects(1) })
  const result = analyzePrevis3D(scene)
  assert.ok(result.warnings?.length)
})

test("visible layers produce no storyboard warnings", () => {
  const frame = makeStoryboardWithLayers([{ id: "l1", name: "Hero", type: "character" }])
  const result = analyzeStoryboard(frame)
  assert.equal(result.warnings, undefined)
})

// ============================================================================
// Idempotency and immutability
// ============================================================================

test("all analysis functions are idempotent", () => {
  const frame = makeStoryboardWithLayers([{ id: "l1", name: "Hero", type: "character" }])
  const cam = makeCamera({ x: 0, y: 1.6, z: 5 }, { x: 0, y: 1, z: 1 }, 35)
  const scene = makeMinimalPrevis({ objects: makePrevisObjects(1), cameras: [cam] })

  const result1 = runCinematicPromptPipeline(frame, scene)
  const result2 = runCinematicPromptPipeline(frame, scene)

  assert.deepEqual(result1, result2)
  // Pipeline result embedded in output should also be identical
  assert.deepEqual(result1.pipeline, result2.pipeline)
})

test("analyzeStoryboard is idempotent", () => {
  const frame = makeStoryboardWithLayers([{ id: "l1", name: "Hero", type: "character" }])
  const r1 = analyzeStoryboard(frame)
  const r2 = analyzeStoryboard(frame)
  assert.deepEqual(r1, r2)
})
