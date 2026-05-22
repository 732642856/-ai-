/**
 * Cinematic Context Extraction
 *
 * Phase 7E: Bridge between runner `useWorkflowRunner.ts` IMAGE MODEL STEP
 * and Phase 7C cinematic pure functions.
 *
 * Responsibilities:
 * 1. Extract storyboard / previs-3d content from upstream nodes
 * 2. Call `runCinematicPromptPipeline` from prompt-analyzer
 * 3. Merge cinematic prompt with base image-generation prompt
 * 4. No-op (return basePrompt) when no cinematic upstream exists
 * 5. Always catch errors → fallback to basePrompt
 *
 * Does NOT:
 * - Import React / React Flow / canvas store
 * - Make network calls
 * - Read env
 * - Mutate inputs
 */

import {
  analyzePrevis3D,
  analyzeStoryboard,
  runCinematicPromptPipeline,
} from "./prompt-analyzer.ts"

import type {
  Previs3DSceneContent,
  StoryboardFrameContent,
} from "../../types/cinematic.ts"

import type { Edge, Node } from "@xyflow/react"
import type { CanvasNodeData } from "../../app/canvas/components/canvas/types.ts"

// ============================================================================
// Inline type guards (does not require modifying CanvasNodeData types)
// ============================================================================

function isValidStoryboardContent(v: unknown): v is StoryboardFrameContent {
  if (!v || typeof v !== "object") return false
  const s = v as Record<string, unknown>
  return typeof s.frameId === "string" && Array.isArray(s.layers)
}

function isValidPrevis3DContent(v: unknown): v is Previs3DSceneContent {
  if (!v || typeof v !== "object") return false
  const p = v as Record<string, unknown>
  return typeof p.sceneId === "string"
    && Array.isArray(p.objects)
    && Array.isArray(p.cameras)
}

// ============================================================================
// Extraction
// ============================================================================

export interface CinematicUpstreamResult {
  storyboard: StoryboardFrameContent | null
  previs: Previs3DSceneContent | null
}

/**
 * Walk upstream edges of the current node, find storyboard / previs nodes,
 * and extract their structured content.
 *
 * Only looks at direct upstream (edges where target === node.id).
 * Does NOT do deep upstream traversal — cinematic context is explicitly
 * connected by the user.
 */
export function extractCinematicUpstream(
  nodeId: string,
  allNodes: Node<CanvasNodeData>[],
  edges: Edge[],
): CinematicUpstreamResult {
  const upstreamEdges = edges.filter((e) => e.target === nodeId)
  let storyboard: StoryboardFrameContent | null = null
  let previs: Previs3DSceneContent | null = null

  for (const edge of upstreamEdges) {
    const upstream = allNodes.find((n) => n.id === edge.source)
    if (!upstream) continue

    const kind = upstream.data?.nodeKind

    // Storyboard node
    if (kind === "storyboard") {
      const raw = upstream.data?.storyboard
      if (isValidStoryboardContent(raw)) {
        storyboard = raw
      } else {
        // Fallback: build minimal StoryboardFrameContent from text fields
        storyboard = {
          frameId: upstream.id,
          title: upstream.data?.title,
          intentText: upstream.data?.prompt ?? upstream.data?.content,
          layers: [],
        }
      }
    }

    // Previs node
    if (kind === "previs") {
      const raw = upstream.data?.previs3d
      if (isValidPrevis3DContent(raw)) {
        previs = raw
      } else {
        // Fallback: build minimal Previs3DSceneContent from text fields
        previs = {
          sceneId: upstream.id,
          title: upstream.data?.title,
          intentText: upstream.data?.prompt ?? upstream.data?.content,
          objects: [],
          cameras: [],
        }
      }
    }
  }

  return { storyboard, previs }
}

// ============================================================================
// Enhancement
// ============================================================================

/**
 * Try to enhance the base image-generation prompt with cinematic context
 * from upstream storyboard / previs nodes.
 *
 * Guarantees:
 * - Returns `basePrompt` unchanged if no cinematic upstream
 * - Returns `basePrompt` unchanged on any error
 * - Never mutates inputs
 */
export function enhancePromptWithCinematicContext(
  basePrompt: string,
  nodeId: string,
  allNodes: Node<CanvasNodeData>[],
  edges: Edge[],
): string {
  try {
    const { storyboard, previs } = extractCinematicUpstream(nodeId, allNodes, edges)

    if (!storyboard && !previs) {
      return basePrompt
    }

    // ── Defaults for missing pieces ────────────────────
    const sb: StoryboardFrameContent = storyboard ?? {
      frameId: "auto-generated",
      layers: [],
    }

    const pv: Previs3DSceneContent = previs ?? {
      sceneId: "auto-generated",
      objects: [],
      cameras: [],
    }

    const result = runCinematicPromptPipeline(sb, pv)

    // ── Merge: cinematic prompt first, user prompt appended ──
    const enhanced = [result.prompt, basePrompt].filter(Boolean).join("\n\n")
    return enhanced
  } catch {
    return basePrompt
  }
}
