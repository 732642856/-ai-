import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Node } from "@xyflow/react";
import type { CanvasNodeData } from "@/app/canvas/components/canvas/types";
import {
  STORYBOARD_SHOT_LAYOUT,
  createNormalizedShotTitle,
  createShotShortTitle,
  createStoryboardSourceEdge,
  getStoryboardGridPosition,
  getStoryboardShotPosition,
} from "./layoutStoryboardShots.ts";

function makeSourceNode(): Node<CanvasNodeData> {
  return {
    id: "source-1",
    type: "text",
    position: { x: 100, y: 200 },
    data: { title: "分镜剧本 Source" },
  };
}

describe("layoutStoryboardShots", () => {
  it("normalizes shot title with padded order and short title", () => {
    const title = createNormalizedShotTitle({
      order: 3,
      title: "白天的天安门广场，天安门城楼庄严矗立，游客缓慢走过。",
      description: "fallback",
      visualPrompt: "prompt",
    });

    assert.ok(title.startsWith("镜头 03 / 白天的天安门广场"));
    assert.ok(title.replace("镜头 03 / ", "").length <= 16);
  });

  it("strips existing shot prefix before creating short title", () => {
    assert.equal(
      createShotShortTitle({
        title: "镜头 02：城楼红墙特写，金瓦反光。",
        description: "fallback",
        visualPrompt: "prompt",
      }),
      "城楼红墙特写，金瓦反光",
    );
  });

  it("returns stable single-column positions by order index", () => {
    const sourceNode = makeSourceNode();

    const expectedX = sourceNode.position.x + STORYBOARD_SHOT_LAYOUT.sourceOffsetX;

    assert.deepEqual(getStoryboardShotPosition(sourceNode, 0), {
      x: expectedX,
      y: 200,
    });
    assert.deepEqual(getStoryboardShotPosition(sourceNode, 1), {
      x: expectedX,
      y: 200 + STORYBOARD_SHOT_LAYOUT.rowGap,
    });
    assert.deepEqual(getStoryboardShotPosition(sourceNode, 3), {
      x: expectedX,
      y: 200 + STORYBOARD_SHOT_LAYOUT.rowGap * 3,
    });
  });

  it("places storyboard grid to the right of the vertical shot list", () => {
    assert.deepEqual(getStoryboardGridPosition(makeSourceNode()), {
      x: 100 + STORYBOARD_SHOT_LAYOUT.gridOffsetX,
      y: 200,
    });
  });

  it("creates source-to-shot lineage edge metadata", () => {
    const edge = createStoryboardSourceEdge("source-1", "shot-1");

    assert.equal(edge.source, "source-1");
    assert.equal(edge.target, "shot-1");
    assert.equal(edge.data?.relation, "storyboard-shot");
    assert.equal(edge.data?.sourceType, "storyboard");
    assert.equal(edge.data?.targetType, "shot");
  });
});
