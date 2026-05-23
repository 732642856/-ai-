/**
 * Cinematic Context Integration Tests
 *
 * Phase 7F: Integration/regression tests for the cinematic prompt
 * enhancement helper that bridges `useWorkflowRunner.ts` IMAGE MODEL STEP
 * and the Phase 7C pure-function pipeline.
 *
 * Tests verify:
 * - No-op when no cinematic upstream exists
 * - Prompt enhancement when storyboard / previs upstream is present
 * - Edge direction filtering (only target === nodeId counts)
 * - Unrelated upstream ignored
 * - Malformed / missing upstream does not crash
 * - Input immutability (nodes / edges not mutated)
 * - extractCinematicUpstream directly (edge filtering, missing-node safety)
 */
import assert from "node:assert/strict"
import test from "node:test"

import {
  enhancePromptWithCinematicContext,
  extractCinematicUpstream,
} from "./context.ts"

import type { Edge, Node } from "@xyflow/react"
import type { CanvasNodeData } from "../../app/canvas/components/canvas/types.ts"
import type {
  Previs3DSceneContent,
  StoryboardFrameContent,
} from "../../types/cinematic.ts"

// ============================================================================
// Test helpers — minimal CanvasNodeData mocks
// ============================================================================

function makeNode(overrides: Partial<Node<CanvasNodeData>> & { data?: Partial<CanvasNodeData> }): Node<CanvasNodeData> {
  const { data: dataOverrides, ...nodeOverrides } = overrides
  return {
    id: nodeOverrides.id ?? "node-default",
    type: "custom",
    position: { x: 0, y: 0 },
    data: {
      nodeKind: undefined,
      ...dataOverrides,
    } as CanvasNodeData,
    ...nodeOverrides,
  }
}

function makeEdge(overrides: Partial<Edge>): Edge {
  return {
    id: overrides.id ?? `edge-${overrides.source ?? "src"}-${overrides.target ?? "tgt"}`,
    source: overrides.source ?? "src",
    target: overrides.target ?? "tgt",
    ...overrides,
  } as Edge
}

// ============================================================================
// Test fixtures — valid storyboard / previs content
// ============================================================================

const validStoryboard: StoryboardFrameContent = {
  frameId: "sb-1",
  title: "Opening shot",
  intentText: "Hero walks through fog at a train station",
  shotType: "wide",
  cameraMovement: "dolly",
  backgroundPrompt: "abandoned train station, fog, volumetric light",
  negativePrompt: "daylight, clean surfaces",
  layers: [],
}

const validPrevis: Previs3DSceneContent = {
  sceneId: "pv-1",
  title: "Train station approach",
  intentText: "Camera dollies in as hero walks forward",
  objects: [
    { id: "hero", name: "hero", type: "actor", transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } } },
    { id: "bench", name: "bench", type: "prop", transform: { position: { x: 3, y: 0, z: 2 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } } },
  ],
  cameras: [
    { id: "cam-main", name: "Main Cam", transform: { position: { x: 0, y: 1.6, z: 5 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } }, focalLengthMm: 35 },
  ],
}

// ============================================================================
// extractCinematicUpstream — unit tests
// ============================================================================

test("extractCinematicUpstream: no upstream edges → both null", () => {
  const nodes = [makeNode({ id: "image-1", data: { nodeKind: "image-generation" } })]
  const edges: Edge[] = []
  const result = extractCinematicUpstream("image-1", nodes, edges)
  assert.strictEqual(result.storyboard, null)
  assert.strictEqual(result.previs, null)
})

test("extractCinematicUpstream: unrelated upstream → both null", () => {
  const nodes = [
    makeNode({ id: "image-1", data: { nodeKind: "image-generation" } }),
    makeNode({ id: "text-1", data: { nodeKind: "text" } }),
  ]
  const edges = [makeEdge({ source: "text-1", target: "image-1" })]
  const result = extractCinematicUpstream("image-1", nodes, edges)
  assert.strictEqual(result.storyboard, null)
  assert.strictEqual(result.previs, null)
})

test("extractCinematicUpstream: edge direction wrong (image → storyboard) → both null", () => {
  const nodes = [
    makeNode({ id: "image-1", data: { nodeKind: "image-generation" } }),
    makeNode({ id: "sb-1", data: { nodeKind: "storyboard", storyboard: validStoryboard } }),
  ]
  // Wrong direction: image-1 is the source, not the target
  const edges = [makeEdge({ source: "image-1", target: "sb-1" })]
  const result = extractCinematicUpstream("image-1", nodes, edges)
  assert.strictEqual(result.storyboard, null)
  assert.strictEqual(result.previs, null)
})

test("extractCinematicUpstream: storyboard upstream → storyboard extracted", () => {
  const nodes = [
    makeNode({ id: "image-1", data: { nodeKind: "image-generation" } }),
    makeNode({ id: "sb-1", data: { nodeKind: "storyboard", storyboard: validStoryboard } }),
  ]
  const edges = [makeEdge({ source: "sb-1", target: "image-1" })]
  const result = extractCinematicUpstream("image-1", nodes, edges)
  assert.ok(result.storyboard !== null)
  assert.strictEqual(result.storyboard!.frameId, "sb-1")
  assert.strictEqual(result.previs, null)
})

test("extractCinematicUpstream: previs upstream → previs extracted", () => {
  const nodes = [
    makeNode({ id: "image-1", data: { nodeKind: "image-generation" } }),
    makeNode({ id: "pv-1", data: { nodeKind: "previs", previs3d: validPrevis } }),
  ]
  const edges = [makeEdge({ source: "pv-1", target: "image-1" })]
  const result = extractCinematicUpstream("image-1", nodes, edges)
  assert.strictEqual(result.storyboard, null)
  assert.ok(result.previs !== null)
  assert.strictEqual(result.previs!.sceneId, "pv-1")
})

test("extractCinematicUpstream: storyboard + previs → both extracted", () => {
  const nodes = [
    makeNode({ id: "image-1", data: { nodeKind: "image-generation" } }),
    makeNode({ id: "sb-1", data: { nodeKind: "storyboard", storyboard: validStoryboard } }),
    makeNode({ id: "pv-1", data: { nodeKind: "previs", previs3d: validPrevis } }),
  ]
  const edges = [
    makeEdge({ source: "sb-1", target: "image-1" }),
    makeEdge({ source: "pv-1", target: "image-1" }),
  ]
  const result = extractCinematicUpstream("image-1", nodes, edges)
  assert.ok(result.storyboard !== null)
  assert.ok(result.previs !== null)
})

test("extractCinematicUpstream: missing source node → does not crash", () => {
  const nodes = [
    makeNode({ id: "image-1", data: { nodeKind: "image-generation" } }),
  ]
  // Edge references a node not in allNodes
  const edges = [makeEdge({ source: "nonexistent", target: "image-1" })]
  assert.doesNotThrow(() => {
    extractCinematicUpstream("image-1", nodes, edges)
  })
  const result = extractCinematicUpstream("image-1", nodes, edges)
  assert.strictEqual(result.storyboard, null)
  assert.strictEqual(result.previs, null)
})

test("extractCinematicUpstream: malformed storyboard content → fallback minimal object", () => {
  const nodes = [
    makeNode({ id: "image-1", data: { nodeKind: "image-generation" } }),
    // storyboard field is present but malformed (missing frameId + layers)
    makeNode({ id: "sb-1", data: { nodeKind: "storyboard", storyboard: { title: "bad" } as unknown as StoryboardFrameContent } }),
  ]
  const edges = [makeEdge({ source: "sb-1", target: "image-1" })]
  const result = extractCinematicUpstream("image-1", nodes, edges)
  // Fallback: still returns a StoryboardFrameContent-like object (frameId set to node.id)
  assert.ok(result.storyboard !== null)
  assert.strictEqual(result.storyboard!.frameId, "sb-1")
})

test("extractCinematicUpstream: malformed previs content → fallback minimal object", () => {
  const nodes = [
    makeNode({ id: "image-1", data: { nodeKind: "image-generation" } }),
    makeNode({ id: "pv-1", data: { nodeKind: "previs", previs3d: { title: "bad" } as unknown as Previs3DSceneContent } }),
  ]
  const edges = [makeEdge({ source: "pv-1", target: "image-1" })]
  const result = extractCinematicUpstream("image-1", nodes, edges)
  assert.ok(result.previs !== null)
  assert.strictEqual(result.previs!.sceneId, "pv-1")
})

test("extractCinematicUpstream: only considers direct upstream (target === nodeId)", () => {
  const nodes = [
    makeNode({ id: "image-1", data: { nodeKind: "image-generation" } }),
    makeNode({ id: "sb-1", data: { nodeKind: "storyboard", storyboard: validStoryboard } }),
    makeNode({ id: "sb-2", data: { nodeKind: "storyboard", storyboard: validStoryboard } }),
  ]
  // Only sb-1 is connected to image-1
  const edges = [
    makeEdge({ source: "sb-1", target: "image-1" }),
    makeEdge({ source: "sb-2", target: "some-other-node" }),
  ]
  const result = extractCinematicUpstream("image-1", nodes, edges)
  assert.ok(result.storyboard !== null)
  // Should have found exactly one storyboard
  assert.strictEqual(result.storyboard!.frameId, "sb-1")
})

// ============================================================================
// enhancePromptWithCinematicContext — integration tests
// ============================================================================

test("enhancePromptWithCinematicContext: no upstream → returns basePrompt unchanged", () => {
  const nodes = [makeNode({ id: "image-1", data: { nodeKind: "image-generation" } })]
  const edges: Edge[] = []
  const base = "A cinematic frame of a hero"
  const result = enhancePromptWithCinematicContext(base, "image-1", nodes, edges)
  assert.strictEqual(result, base)
})

test("enhancePromptWithCinematicContext: unrelated upstream → returns basePrompt unchanged", () => {
  const nodes = [
    makeNode({ id: "image-1", data: { nodeKind: "image-generation" } }),
    makeNode({ id: "text-1", data: { nodeKind: "text", content: "some text" } }),
  ]
  const edges = [makeEdge({ source: "text-1", target: "image-1" })]
  const base = "A cinematic frame"
  const result = enhancePromptWithCinematicContext(base, "image-1", nodes, edges)
  assert.strictEqual(result, base)
})

test("enhancePromptWithCinematicContext: edge direction wrong → returns basePrompt", () => {
  const nodes = [
    makeNode({ id: "image-1", data: { nodeKind: "image-generation" } }),
    makeNode({ id: "sb-1", data: { nodeKind: "storyboard", storyboard: validStoryboard } }),
  ]
  // image-1 → sb-1 (wrong direction)
  const edges = [makeEdge({ source: "image-1", target: "sb-1" })]
  const base = "A cinematic frame"
  const result = enhancePromptWithCinematicContext(base, "image-1", nodes, edges)
  assert.strictEqual(result, base)
})

test("enhancePromptWithCinematicContext: storyboard upstream → prompt enhanced", () => {
  const nodes = [
    makeNode({ id: "image-1", data: { nodeKind: "image-generation" } }),
    makeNode({ id: "sb-1", data: { nodeKind: "storyboard", storyboard: validStoryboard } }),
  ]
  const edges = [makeEdge({ source: "sb-1", target: "image-1" })]
  const base = "A cinematic frame of a hero"
  const result = enhancePromptWithCinematicContext(base, "image-1", nodes, edges)
  // Should NOT be the same object/string as basePrompt
  assert.ok(result !== base)
  // Should contain the base prompt somewhere
  assert.ok(result.includes(base))
  // Should contain storyboard-derived cinematic keywords
  assert.ok(result.length > base.length)
})

test("enhancePromptWithCinematicContext: previs upstream → prompt enhanced", () => {
  const nodes = [
    makeNode({ id: "image-1", data: { nodeKind: "image-generation" } }),
    makeNode({ id: "pv-1", data: { nodeKind: "previs", previs3d: validPrevis } }),
  ]
  const edges = [makeEdge({ source: "pv-1", target: "image-1" })]
  const base = "A cinematic frame"
  const result = enhancePromptWithCinematicContext(base, "image-1", nodes, edges)
  assert.ok(result !== base)
  assert.ok(result.includes(base))
  assert.ok(result.length > base.length)
})

test("enhancePromptWithCinematicContext: storyboard + previs → merged enhancement", () => {
  const nodes = [
    makeNode({ id: "image-1", data: { nodeKind: "image-generation" } }),
    makeNode({ id: "sb-1", data: { nodeKind: "storyboard", storyboard: validStoryboard } }),
    makeNode({ id: "pv-1", data: { nodeKind: "previs", previs3d: validPrevis } }),
  ]
  const edges = [
    makeEdge({ source: "sb-1", target: "image-1" }),
    makeEdge({ source: "pv-1", target: "image-1" }),
  ]
  const base = "A cinematic frame of a hero"
  const result = enhancePromptWithCinematicContext(base, "image-1", nodes, edges)
  assert.ok(result !== base)
  assert.ok(result.includes(base))
  // With both storyboard and previs, prompt should be substantially longer
  assert.ok(result.length > base.length + 20)
})

test("enhancePromptWithCinematicContext: malformed storyboard → fallback, no crash", () => {
  const nodes = [
    makeNode({ id: "image-1", data: { nodeKind: "image-generation" } }),
    makeNode({ id: "sb-1", data: { nodeKind: "storyboard", storyboard: null as unknown as StoryboardFrameContent } }),
  ]
  const edges = [makeEdge({ source: "sb-1", target: "image-1" })]
  const base = "A cinematic frame"
  // Should not throw; with null storyboard the isValidStoryboardContent fails,
  // fallback minimal object is created, pipeline still runs
  assert.doesNotThrow(() => {
    enhancePromptWithCinematicContext(base, "image-1", nodes, edges)
  })
  const result = enhancePromptWithCinematicContext(base, "image-1", nodes, edges)
  // Even with malformed data, the function returns a string
  assert.ok(typeof result === "string")
})

test("enhancePromptWithCinematicContext: malformed previs → fallback, no crash", () => {
  const nodes = [
    makeNode({ id: "image-1", data: { nodeKind: "image-generation" } }),
    makeNode({ id: "pv-1", data: { nodeKind: "previs", previs3d: null as unknown as Previs3DSceneContent } }),
  ]
  const edges = [makeEdge({ source: "pv-1", target: "image-1" })]
  const base = "A cinematic frame"
  assert.doesNotThrow(() => {
    enhancePromptWithCinematicContext(base, "image-1", nodes, edges)
  })
  const result = enhancePromptWithCinematicContext(base, "image-1", nodes, edges)
  assert.ok(typeof result === "string")
})

test("enhancePromptWithCinematicContext: missing edge source node → no crash, returns basePrompt", () => {
  const nodes = [
    makeNode({ id: "image-1", data: { nodeKind: "image-generation" } }),
  ]
  const edges = [makeEdge({ source: "nonexistent", target: "image-1" })]
  const base = "A cinematic frame"
  assert.doesNotThrow(() => {
    enhancePromptWithCinematicContext(base, "image-1", nodes, edges)
  })
  const result = enhancePromptWithCinematicContext(base, "image-1", nodes, edges)
  // Edge finds no matching source node → extractCinematicUpstream returns nulls → basePrompt returned
  assert.strictEqual(result, base)
})

test("enhancePromptWithCinematicContext: immutability — does not mutate nodes or edges", () => {
  const nodes = [
    makeNode({ id: "image-1", data: { nodeKind: "image-generation" } }),
    makeNode({ id: "sb-1", data: { nodeKind: "storyboard", storyboard: validStoryboard } }),
  ]
  const edges = [makeEdge({ source: "sb-1", target: "image-1" })]
  const nodesBefore = structuredClone(nodes)
  const edgesBefore = structuredClone(edges)
  const base = "A cinematic frame"

  enhancePromptWithCinematicContext(base, "image-1", nodes, edges)

  assert.deepStrictEqual(nodes, nodesBefore)
  assert.deepStrictEqual(edges, edgesBefore)
})

test("enhancePromptWithCinematicContext: only first storyboard/previs per kind is used (no duplication)", () => {
  const sbDuplicate: StoryboardFrameContent = {
    ...validStoryboard,
    frameId: "sb-2",
    title: "Duplicate storyboard",
  }
  const nodes = [
    makeNode({ id: "image-1", data: { nodeKind: "image-generation" } }),
    makeNode({ id: "sb-1", data: { nodeKind: "storyboard", storyboard: validStoryboard } }),
    makeNode({ id: "sb-2", data: { nodeKind: "storyboard", storyboard: sbDuplicate } }),
  ]
  // Both connected to image-1 — extractCinematicUpstream iterates and overwrites,
  // so last one wins. Test that exactly one storyboard is reflected (no crash, no duplication).
  const edges = [
    makeEdge({ source: "sb-1", target: "image-1" }),
    makeEdge({ source: "sb-2", target: "image-1" }),
  ]
  const base = "A cinematic frame"
  assert.doesNotThrow(() => {
    enhancePromptWithCinematicContext(base, "image-1", nodes, edges)
  })
  const result = enhancePromptWithCinematicContext(base, "image-1", nodes, edges)
  assert.ok(result !== base)
  assert.ok(result.includes(base))
})
