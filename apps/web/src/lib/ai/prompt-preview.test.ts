// ============================================================================
// Prompt Preview Tests (Phase 1-c)
// ============================================================================
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  buildPromptPreview,
  inferTaskType,
  extractUpstreamContent,
  extractNodePrompt,
  extractNodeModel,
} from "./prompt-preview.ts"
import type { Node, Edge } from "@xyflow/react"
import type { CanvasNodeData } from "../../app/canvas/components/canvas/types.ts"

// ============================================================================
// Helpers
// ============================================================================

function makeNode(id: string, data: Partial<CanvasNodeData> = {}): Node<CanvasNodeData> {
  return { id, type: "text", data: { ...data } } as Node<CanvasNodeData>
}

function makeEdge(source: string, target: string): Edge {
  return { id: `${source}-${target}`, source, target } as Edge
}

// ============================================================================
// inferTaskType
// ============================================================================

describe("inferTaskType", () => {
  it("returns 'text' for text-like kinds", () => {
    assert.equal(inferTaskType("text"), "text")
    assert.equal(inferTaskType("script"), "text")
    assert.equal(inferTaskType("storyboard"), "text")
    assert.equal(inferTaskType("subtitle"), "text")
  })

  it("returns 'image' for image-generation", () => {
    assert.equal(inferTaskType("image-generation"), "image")
    assert.equal(inferTaskType("image-result"), "image")
  })

  it("returns 'text' for unknown kinds (default)", () => {
    assert.equal(inferTaskType("composition" as any), "text")
    assert.equal(inferTaskType("video-generation" as any), "text")
  })
})

// ============================================================================
// extractUpstreamContent
// ============================================================================

describe("extractUpstreamContent", () => {
  it("returns empty text and empty ids when no upstream edges", () => {
    const nodes = [makeNode("a", { prompt: "hello" })]
    const result = extractUpstreamContent("a", nodes, [])
    assert.equal(result.text, "")
    assert.deepEqual(result.nodeIds, [])
  })

  it("extracts content from upstream nodes", () => {
    const nodes = [
      makeNode("a", { prompt: "from a" }),
      makeNode("b", { prompt: "from b" }),
    ]
    const edges = [makeEdge("a", "c"), makeEdge("b", "c")]
    const result = extractUpstreamContent("c", nodes, edges)
    assert.ok(result.text.includes("from a"))
    assert.ok(result.text.includes("from b"))
    assert.deepEqual(result.nodeIds, ["a", "b"])
  })

  it("skips upstream nodes with empty content", () => {
    const nodes = [
      makeNode("a", { prompt: "" }),
      makeNode("b", { prompt: "valid" }),
    ]
    const edges = [makeEdge("a", "c"), makeEdge("b", "c")]
    const result = extractUpstreamContent("c", nodes, edges)
    assert.equal(result.text, "valid")
    assert.deepEqual(result.nodeIds, ["b"])
  })

  it("uses content/prompt/summary/instruction priority", () => {
    const nodes = [
      makeNode("a", { content: "C" }),
      makeNode("b", { summary: "S" }),
      makeNode("c", { instruction: "I" }),
    ]
    const edges = [makeEdge("a", "d"), makeEdge("b", "d"), makeEdge("c", "d")]
    const result = extractUpstreamContent("d", nodes, edges)
    assert.ok(result.text.includes("C"))
    assert.ok(result.text.includes("S"))
    assert.ok(result.text.includes("I"))
  })
})

// ============================================================================
// extractNodePrompt
// ============================================================================

describe("extractNodePrompt", () => {
  it("returns prompt when available", () => {
    assert.equal(extractNodePrompt(makeNode("a", { prompt: "hello" })), "hello")
  })

  it("falls back to content", () => {
    assert.equal(extractNodePrompt(makeNode("a", { content: "world" })), "world")
  })

  it("falls back to instruction", () => {
    assert.equal(extractNodePrompt(makeNode("a", { instruction: "go" })), "go")
  })

  it("returns empty string when nothing set", () => {
    assert.equal(extractNodePrompt(makeNode("a")), "")
  })

  it("prefers prompt over content", () => {
    assert.equal(extractNodePrompt(makeNode("a", { prompt: "P", content: "C" })), "P")
  })
})

// ============================================================================
// extractNodeModel
// ============================================================================

describe("extractNodeModel", () => {
  it("returns model when set", () => {
    assert.equal(extractNodeModel(makeNode("a", { model: "gpt-4o" })), "gpt-4o")
  })

  it("returns undefined when model is empty", () => {
    assert.equal(extractNodeModel(makeNode("a", { model: "" })), undefined)
  })

  it("returns undefined when model is whitespace", () => {
    assert.equal(extractNodeModel(makeNode("a", { model: "  " })), undefined)
  })

  it("returns undefined when no model field", () => {
    assert.equal(extractNodeModel(makeNode("a")), undefined)
  })
})

// ============================================================================
// buildPromptPreview
// ============================================================================

describe("buildPromptPreview", () => {
  it("builds a basic text preview", () => {
    const node = makeNode("a", { nodeKind: "text", prompt: "Write a story" })
    const result = buildPromptPreview({ node, allNodes: [node], edges: [] })

    assert.equal(result.runRequest.model, "gpt-5.5") // fallback
    assert.ok(result.runRequest.message.includes("Write a story"))
    assert.equal(result.runRequest._meta.taskType, "text")
    assert.equal(result.runRequest._meta.nodeKind, "text")
    assert.equal(result.hasUpstream, false)
    assert.deepEqual(result.upstreamNodeIds, [])
  })

  it("builds an image preview", () => {
    const node = makeNode("a", { nodeKind: "image-generation", prompt: "A sunset" })
    const result = buildPromptPreview({ node, allNodes: [node], edges: [] })

    assert.equal(result.runRequest._meta.taskType, "image")
    assert.equal(result.runRequest._meta.nodeKind, "image-generation")
  })

  it("includes upstream content in prompt", () => {
    const upstream = makeNode("up", { content: "previous output" })
    const node = makeNode("a", { nodeKind: "text", prompt: "continue" })
    const edges = [makeEdge("up", "a")]

    const result = buildPromptPreview({ node, allNodes: [upstream, node], edges: edges })
    assert.ok(result.runRequest.message.includes("上游内容"))
    assert.ok(result.runRequest.message.includes("previous output"))
    assert.ok(result.runRequest.message.includes("continue"))
    assert.equal(result.hasUpstream, true)
    assert.deepEqual(result.upstreamNodeIds, ["up"])
  })

  it("uses envDefaultModel when provided", () => {
    const node = makeNode("a", { nodeKind: "text", prompt: "hello" })
    const result = buildPromptPreview({
      node, allNodes: [node], edges: [],
      envDefaultModel: "gpt-4o",
    })
    assert.equal(result.runRequest.model, "gpt-4o")
    assert.equal(result.runRequest._meta.modelSource, "env")
  })

  it("uses nodeModel as highest priority", () => {
    const node = makeNode("a", { nodeKind: "text", prompt: "hello", model: "claude-4-opus" })
    const result = buildPromptPreview({
      node, allNodes: [node], edges: [],
      envDefaultModel: "gpt-4o",
    })
    assert.equal(result.runRequest.model, "claude-4-opus")
    assert.equal(result.runRequest._meta.modelSource, "node")
  })

  it("uses envDefaultImageModel for image nodes", () => {
    const node = makeNode("a", { nodeKind: "image-generation", prompt: "sunset" })
    const result = buildPromptPreview({
      node, allNodes: [node], edges: [],
      envDefaultImageModel: "dall-e-4",
    })
    assert.equal(result.runRequest.model, "dall-e-4")
  })

  it("records raw and sanitized prompt lengths in _meta", () => {
    const node = makeNode("a", { nodeKind: "text", prompt: "hello world" })
    const result = buildPromptPreview({ node, allNodes: [node], edges: [] })
    assert.ok(result.runRequest._meta.rawPromptLength > 0)
    assert.ok(result.runRequest._meta.sanitizedPromptLength > 0)
  })

  it("cleans [object Object] from prompt", () => {
    const upstream = makeNode("up", { content: "[object Object] some text" })
    const node = makeNode("a", { nodeKind: "text", prompt: "go" })
    const result = buildPromptPreview({
      node, allNodes: [upstream, node], edges: [makeEdge("up", "a")],
    })
    assert.ok(!result.runRequest.message.includes("[object Object]"))
    assert.ok(result.runRequest._meta.sanitizeWarnings.length > 0)
  })

  it("returns correct runRequest structure", () => {
    const node = makeNode("a", { nodeKind: "script", prompt: "test" })
    const result = buildPromptPreview({ node, allNodes: [node], edges: [] })

    // All required fields present
    assert.ok(typeof result.runRequest.message === "string")
    assert.ok(typeof result.runRequest.model === "string")
    assert.ok(typeof result.runRequest._meta === "object")
    assert.ok(Array.isArray(result.runRequest._meta.sanitizeWarnings))
    assert.ok(typeof result.runRequest._meta.rawPromptLength === "number")
  })
})
