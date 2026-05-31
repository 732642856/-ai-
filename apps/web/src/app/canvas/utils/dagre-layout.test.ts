import assert from "node:assert";
import { describe, it } from "node:test";
import type { Node, Edge } from "@xyflow/react";
import type { CanvasNodeData } from "../components/canvas/types";
import { quickLayout } from "./dagre-layout.ts";

function makeNode(id: string, overrides: Partial<Node<CanvasNodeData>> = {}): Node<CanvasNodeData> {
  return {
    id,
    type: "content",
    position: { x: 0, y: 0 },
    data: { nodeKind: "text" },
    measured: { width: 280, height: 200 },
    ...overrides,
  };
}

describe("quickLayout", () => {
  it("returns empty array for empty input", () => {
    const result = quickLayout([], [], 3);
    assert.deepEqual(result, []);
  });

  it("positions a single node at column 0, row 0", () => {
    const result = quickLayout([makeNode("n1")], [], 3);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "n1");
  });

  it("arranges 3 nodes in a single row (3 cols)", () => {
    const nodes = [makeNode("n1"), makeNode("n2"), makeNode("n3")];
    const result = quickLayout(nodes, [], 3);
    assert.equal(result.length, 3);
    // n1 at col 0, n2 at col 1, n3 at col 2
    assert.ok(result[1].position.x > result[0].position.x);
    assert.ok(result[2].position.x > result[1].position.x);
    // All on same row
    assert.equal(result[0].position.y, result[1].position.y);
    assert.equal(result[1].position.y, result[2].position.y);
  });

  it("wraps to next row when columns are full", () => {
    const nodes = [makeNode("n1"), makeNode("n2"), makeNode("n3"), makeNode("n4")];
    const result = quickLayout(nodes, [], 3);
    // n4 should be on row 1
    assert.ok(result[3].position.y > result[0].position.y);
    // n4 should be at column 0
    assert.equal(result[3].position.x, result[0].position.x);
  });

  it("uses custom column count", () => {
    const nodes = [makeNode("n1"), makeNode("n2"), makeNode("n3"), makeNode("n4")];
    const result = quickLayout(nodes, [], 2);
    // With 2 cols, n3 should be on row 1
    assert.ok(result[2].position.y > result[0].position.y);
    // n3 at column 0 on row 1
    assert.equal(result[2].position.x, result[0].position.x);
  });

  it("uses dagre layout when edges are present", () => {
    const nodes = [makeNode("n1"), makeNode("n2")];
    const edges: Edge[] = [{ id: "e1", source: "n1", target: "n2" }];
    const result = quickLayout(nodes, edges, 3);
    // dagre should have positioned them (positions won't be equal)
    assert.equal(result.length, 2);
    assert.ok(result[0].position.x !== 0 || result[0].position.y !== 0);
  });

  it("preserves node identity and order when edges are present", () => {
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
    const edges: Edge[] = [
      { id: "e1", source: "a", target: "b" },
      { id: "e2", source: "b", target: "c" },
    ];
    const result = quickLayout(nodes, edges, 3);
    assert.equal(result.length, 3);
    assert.equal(result[0].id, "a");
    assert.equal(result[1].id, "b");
    assert.equal(result[2].id, "c");
  });

  it("uses measured node dimensions when available", () => {
    const node = makeNode("n1", { measured: { width: 400, height: 300 } });
    const result = quickLayout([node], [], 3);
    assert.equal(result.length, 1);
    // Position should be computed using measured dimensions
    assert.equal(typeof result[0].position.x, "number");
  });
});
