/**
 * Cinematic Pipeline Types — Runtime Sanity Tests
 *
 * Phase 7B scope:
 * - verify the type file loads without errors
 * - verify basic object shapes can be constructed
 * - verify mappers (label maps) are well-formed
 * - no runtime logic, no React dependency
 *
 * These are type-level tests: they validate that the type module
 * can be imported and that the constant maps are correct.
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  cameraMovementLabelMap,
  cameraMovementPromptMap,
  shotTypeLabelMap,
  shotTypePromptMap,
} from "./cinematic.ts"

import type {
  CinematicPromptPipelineResult,
  Previs3DCameraRig,
  Previs3DObject,
  Previs3DSceneContent,
  PromptAnalysisResult,
  StoryboardAnalysis,
  StoryboardFrameContent,
  StoryboardLayer,
  Transform3D,
  Vector3D,
} from "./cinematic.ts"

describe("Vector3D & Transform3D", () => {
  it("constructs a valid Vector3D", () => {
    const v: Vector3D = { x: 0, y: 1, z: 2 }
    assert.equal(v.x, 0)
    assert.equal(v.y, 1)
    assert.equal(v.z, 2)
  })

  it("constructs a valid Transform3D", () => {
    const t: Transform3D = {
      position: { x: 0, y: 1.6, z: 5 },
      rotation: { x: 0, y: 90, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    }
    assert.equal(t.position.y, 1.6)
    assert.equal(t.rotation.y, 90)
  })
})

describe("Previs3DObject", () => {
  it("constructs a basic 3D object", () => {
    const obj: Previs3DObject = {
      id: "actor-1",
      name: "主角",
      type: "actor",
      transform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 45, z: 0 },
        scale: { x: 1, y: 1.8, z: 1 },
      },
      semanticTags: ["standing", "facing-camera"],
    }
    assert.equal(obj.type, "actor")
    assert.equal(obj.semanticTags?.[0], "standing")
  })
})

describe("Previs3DCameraRig", () => {
  it("constructs a camera rig with full metadata", () => {
    const cam: Previs3DCameraRig = {
      id: "cam-1",
      name: "Main Camera",
      transform: {
        position: { x: 0, y: 1.6, z: 5 },
        rotation: { x: -5, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      target: { x: 0, y: 1, z: 0 },
      focalLengthMm: 35,
      aperture: 2.8,
      shotType: "medium",
      movement: "static",
      path: [
        { x: 0, y: 1.6, z: 5 },
        { x: 1, y: 1.5, z: 4 },
      ],
    }
    assert.equal(cam.focalLengthMm, 35)
    assert.equal(cam.aperture, 2.8)
    assert.equal(cam.path?.length, 2)
  })
})

describe("Previs3DSceneContent", () => {
  it("constructs a complete 3D scene", () => {
    const scene: Previs3DSceneContent = {
      sceneId: "scene-001",
      title: "开场",
      intentText: "主角从阴影中走出",
      units: "meters",
      objects: [
        {
          id: "actor-1",
          name: "主角",
          type: "actor",
          transform: {
            position: { x: 0, y: 0, z: 2 },
            rotation: { x: 0, y: 180, z: 0 },
            scale: { x: 1, y: 1.8, z: 1 },
          },
        },
      ],
      cameras: [
        {
          id: "cam-1",
          name: "Main Camera",
          transform: {
            position: { x: 0, y: 1.6, z: 5 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
          },
          focalLengthMm: 35,
        },
      ],
      activeCameraId: "cam-1",
    }
    assert.equal(scene.objects.length, 1)
    assert.equal(scene.cameras.length, 1)
    assert.equal(scene.activeCameraId, "cam-1")
  })
})

describe("StoryboardLayer", () => {
  it("constructs a visible character layer", () => {
    const layer: StoryboardLayer = {
      id: "layer-1",
      name: "主角层",
      type: "character",
      visible: true,
      locked: false,
      zIndex: 1,
      opacity: 1,
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      semanticTags: ["close-up", "emotion: intense"],
    }
    assert.equal(layer.type, "character")
    assert.equal(layer.visible, true)
  })

  it("supports optional Cinema fields", () => {
    const layer: StoryboardLayer = {
      id: "layer-2",
      name: "火柴人站位",
      type: "stick_figure",
      visible: true,
      locked: true,
      zIndex: 10,
      opacity: 0.7,
      transform: { x: 100, y: 200, scale: 1, rotation: 0 },
      sketchData: { strokes: [] },
      maskAssetId: "mask-abc",
      semanticTags: ["blocking", "pose: standing"],
    }
    assert.equal(layer.maskAssetId, "mask-abc")
    assert.ok(layer.sketchData)
  })
})

describe("StoryboardFrameContent", () => {
  it("constructs a full storyboard frame", () => {
    const frame: StoryboardFrameContent = {
      frameId: "frame-001",
      title: "开场镜头",
      inputMode: "stick_figure",
      intentText: "主角从阴影中走出",
      shotType: "wide",
      cameraMovement: "dolly",
      layers: [
        {
          id: "layer-1",
          name: "背景",
          type: "background",
          visible: true,
          locked: false,
          zIndex: 0,
          opacity: 1,
          transform: { x: 0, y: 0, scale: 1, rotation: 0 },
        },
        {
          id: "layer-2",
          name: "主角",
          type: "character",
          visible: true,
          locked: false,
          zIndex: 5,
          opacity: 1,
          transform: { x: 0, y: 0, scale: 1, rotation: 0 },
        },
      ],
      references: [
        {
          id: "ref-1",
          url: "https://example.com/ref.jpg",
          purpose: "style",
        },
      ],
    }
    assert.equal(frame.frameId, "frame-001")
    assert.equal(frame.shotType, "wide")
    assert.equal(frame.cameraMovement, "dolly")
    assert.equal(frame.layers.length, 2)
    assert.equal(frame.references?.[0]?.purpose, "style")
  })
})

describe("Analysis Pipeline Types", () => {
  it("constructs StoryboardAnalysis", () => {
    const analysis: StoryboardAnalysis = {
      title: "Storyboard Analyzer",
      shotType: "wide",
      cameraMovement: "static",
      visibleLayers: [],
      summary: "远景 / 固定机位：空分镜",
      promptFragments: ["wide establishing shot"],
      constraints: ["景别：远景"],
    }
    assert.equal(analysis.shotType, "wide")
    assert.equal(analysis.cameraMovement, "static")
  })

  it("constructs CinematicPromptPipelineResult", () => {
    const pipeline: CinematicPromptPipelineResult = {
      storyboard: {
        title: "Storyboard Analyzer",
        shotType: "medium",
        cameraMovement: "pan",
        visibleLayers: [],
        summary: "中景 / 横摇",
        promptFragments: [],
        constraints: [],
      },
      stickFigure: {
        title: "Stick Figure Analyzer",
        summary: "无火柴人",
        promptFragments: [],
        constraints: [],
        poseTags: [],
      },
      previs3d: {
        title: "Previs3D Analyzer",
        summary: "35mm lens, f/2.8",
        promptFragments: [],
        constraints: [],
        objectBlocking: "no blocking objects",
        cameraPath: "no path",
      },
    }
    assert.equal(pipeline.storyboard.shotType, "medium")
    assert.equal(pipeline.stickFigure.poseTags.length, 0)
  })

  it("constructs PromptAnalysisResult", () => {
    const result: PromptAnalysisResult = {
      title: "开场镜头 · Cinematic Prompt Pipeline",
      prompt: "wide establishing shot. cinematic lighting.",
      negativePrompt: "avoid broken anatomy",
      summary: "远景 / 固定机位：空分镜",
      constraints: ["景别：远景"],
      shotDescription: "镜头说明：远景，固定机位。",
      pipeline: {
        storyboard: {
          title: "",
          shotType: "wide",
          cameraMovement: "static",
          visibleLayers: [],
          summary: "",
          promptFragments: [],
          constraints: [],
        },
        stickFigure: {
          title: "",
          summary: "",
          promptFragments: [],
          constraints: [],
          poseTags: [],
        },
        previs3d: {
          title: "",
          summary: "",
          promptFragments: [],
          constraints: [],
          objectBlocking: "",
          cameraPath: "",
        },
      },
    }
    assert.ok(result.prompt.length > 0)
    assert.ok(result.negativePrompt.length > 0)
    assert.ok(result.constraints.length > 0)
  })
})

describe("Prompt Mapper Constants", () => {
  it("all shot types have corresponding prompt and label entries", () => {
    const shotTypes = ["wide", "medium", "close_up", "over_shoulder", "insert", "custom"] as const
    for (const t of shotTypes) {
      assert.ok(t in shotTypePromptMap, `missing prompt for ${t}`)
      assert.ok(t in shotTypeLabelMap, `missing label for ${t}`)
    }
  })

  it("all camera movements have corresponding prompt and label entries", () => {
    const movements = ["static", "pan", "tilt", "dolly", "truck", "zoom", "handheld", "custom"] as const
    for (const m of movements) {
      assert.ok(m in cameraMovementPromptMap, `missing prompt for ${m}`)
      assert.ok(m in cameraMovementLabelMap, `missing label for ${m}`)
    }
  })

  it("label maps contain Chinese translations", () => {
    assert.equal(shotTypeLabelMap.wide, "远景")
    assert.equal(shotTypeLabelMap.medium, "中景")
    assert.equal(cameraMovementLabelMap.handheld, "手持")
  })
})
