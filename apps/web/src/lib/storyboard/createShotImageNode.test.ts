import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Edge, Node } from "@xyflow/react";
import type { CanvasNodeData } from "@/app/canvas/components/canvas/types";
import { createShotImageNode } from "./createShotImageNode.ts";

function makeShotNode(): Node<CanvasNodeData> {
  return {
    id: "shot-node-1",
    type: "shot",
    position: { x: 100, y: 200 },
    width: 300,
    data: {
      sourceStoryboardNodeId: "storyboard-1",
      displayWidth: 300,
      shot: {
        id: "shot-1",
        order: 3,
        title: "天安门广场远景",
        description: "白天的天安门广场",
        visualPrompt: "cinematic wide shot",
        sourceStoryboardNodeId: "storyboard-1",
      },
    },
  };
}

describe("createShotImageNode", () => {
  it("creates a shot image node and lineage edge", () => {
    const shotNode = makeShotNode();
    const generatedAt = "2026-05-25T10:00:00.000Z";

    const result = createShotImageNode({
      shotNode,
      existingNodes: [shotNode],
      existingEdges: [],
      generationResult: {
        imageUrl: "blob:http://localhost/generated",
        assetId: "asset-1",
        model: "gpt-image-2",
        generationId: "req-1",
      },
      prompt: "cinematic wide shot",
      generatedAt,
      imageNodeId: "image-node-1",
    });

    assert.equal(result.mode, "create");
    assert.equal(result.imageNode.id, "image-node-1");
    assert.equal(result.imageNode.type, "image");
    assert.deepEqual(result.imageNode.position, { x: 480, y: 200 });
    assert.equal(result.imageNode.data.title, "镜头 03 图片");
    assert.equal(result.imageNode.data.sourceShotId, "shot-node-1");
    assert.equal(result.imageNode.data.sourceStoryboardNodeId, "storyboard-1");
    assert.equal(result.imageNode.data.sourceShotOrder, 3);
    assert.equal(result.imageNode.data.sourcePrompt, "cinematic wide shot");
    assert.equal(result.imageNode.data.generatedAt, generatedAt);
    assert.equal(result.imageNode.data.assetId, "asset-1");

    assert.equal(result.edge.source, "shot-node-1");
    assert.equal(result.edge.target, "image-node-1");
    assert.equal(result.edge.data?.relation, "generated-image");
    assert.equal(result.edge.data?.sourceType, "shot");
    assert.equal(result.edge.data?.targetType, "image");
  });

  it("updates an existing image node by sourceShotId", () => {
    const shotNode = makeShotNode();
    const existingImageNode: Node<CanvasNodeData> = {
      id: "existing-image-1",
      type: "image",
      position: { x: 800, y: 240 },
      data: {
        title: "旧标题",
        sourceShotId: "shot-node-1",
        imageUrl: "https://cdn.example.com/old.png",
        assetId: "old-asset",
        createdAt: 1,
      },
    };

    const result = createShotImageNode({
      shotNode,
      existingNodes: [shotNode, existingImageNode],
      generationResult: {
        imageUrl: "blob:http://localhost/new-generated",
        assetId: "asset-new",
      },
      prompt: "new prompt",
      generatedAt: "2026-05-25T10:00:00.000Z",
      imageNodeId: "should-not-use",
    });

    assert.equal(result.mode, "update");
    assert.equal(result.imageNode.id, "existing-image-1");
    assert.deepEqual(result.imageNode.position, { x: 800, y: 240 });
    assert.equal(result.imageNode.data.title, "镜头 03 图片");
    assert.equal(result.imageNode.data.assetId, "asset-new");
    assert.equal(result.imageNode.data.createdAt, 1);
    assert.equal(result.edge.target, "existing-image-1");
  });

  it("updates an existing image node by generated-image edge", () => {
    const shotNode = makeShotNode();
    const existingImageNode: Node<CanvasNodeData> = {
      id: "edge-linked-image",
      type: "image",
      position: { x: 700, y: 200 },
      data: {},
    };
    const existingEdges: Edge[] = [
      {
        id: "edge-existing",
        source: "shot-node-1",
        target: "edge-linked-image",
        data: { relation: "generated-image" },
      },
    ];

    const result = createShotImageNode({
      shotNode,
      existingNodes: [shotNode, existingImageNode],
      existingEdges,
      generationResult: { imageUrl: "https://cdn.example.com/new.png" },
      prompt: "prompt",
      generatedAt: "2026-05-25T10:00:00.000Z",
      imageNodeId: "new-image",
    });

    assert.equal(result.mode, "update");
    assert.equal(result.imageNode.id, "edge-linked-image");
  });

  it("uses fallback title when shot order is missing", () => {
    const shotNode = makeShotNode();
    shotNode.data.shot = {
      ...shotNode.data.shot!,
      order: undefined as unknown as number,
    };

    const result = createShotImageNode({
      shotNode,
      existingNodes: [shotNode],
      generationResult: { imageUrl: "https://cdn.example.com/image.png" },
      prompt: "prompt",
      generatedAt: "2026-05-25T10:00:00.000Z",
      imageNodeId: "image-1",
    });

    assert.equal(result.imageNode.data.title, "分镜图片");
  });
});
