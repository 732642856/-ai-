import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildVideoWorkflowTemplate } from "./videoWorkflowTemplate.ts";

function createIdGenerator() {
  let index = 0;
  return () => `id-${++index}`;
}

describe("buildVideoWorkflowTemplate", () => {
  it("creates the full video workflow template without replacing existing canvas state", () => {
    const result = buildVideoWorkflowTemplate({
      basePosition: { x: 100, y: 200 },
      generateId: createIdGenerator(),
      edgeStyle: { stroke: "#999", strokeWidth: 2 },
    });

    assert.equal(result.nodes.length, 10);
    assert.equal(result.edges.length, 11);
    assert.equal(result.nodes[0].type, "content");
    assert.equal(result.nodes[0].data.title, "前期目标");
    assert.equal(result.nodes[0].position.x, 100);
    assert.equal(result.nodes[0].position.y, 360);
    assert.equal(result.nodes[9].data.nodeKind, "video-result");
  });

  it("connects the template nodes in the expected handoff chain", () => {
    const result = buildVideoWorkflowTemplate({
      basePosition: { x: 0, y: 0 },
      generateId: createIdGenerator(),
    });

    const nodeIdByKind = new Map(result.nodes.map((node) => [node.data.nodeKind, node.id]));
    const edgePairs = new Set(result.edges.map((edge) => `${edge.source}->${edge.target}`));

    assert.equal(
      edgePairs.has(`${nodeIdByKind.get("text")}->${nodeIdByKind.get("script")}`),
      true,
    );
    assert.equal(
      edgePairs.has(`${nodeIdByKind.get("script")}->${nodeIdByKind.get("storyboard")}`),
      true,
    );
    assert.equal(
      edgePairs.has(`${nodeIdByKind.get("image-result")}->${nodeIdByKind.get("video-generation")}`),
      true,
    );
    assert.equal(
      edgePairs.has(`${nodeIdByKind.get("composition")}->${nodeIdByKind.get("video-result")}`),
      true,
    );
  });
});
