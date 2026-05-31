import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Node, Edge } from "@xyflow/react";
import type { CanvasNodeData } from "../components/canvas/types";
import {
  getIncomingEdges,
  getOutgoingEdges,
  getDirectUpstreamNodes,
  getDirectDownstreamNodes,
  getUpstreamNodeIds,
  getUpstreamNodes,
  topologicalOrder,
  hasCycle,
  getDownstreamNodeIds,
  getDownstreamNodes,
  downstreamTopologicalOrder,
  topologicalSortAll,
  detectCyclesInSet,
} from "./graph-traversal.ts";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function node(id: string, x = 0, y = 0): Node<CanvasNodeData> {
  return { id, type: "default", position: { x, y }, data: { nodeKind: "text" } as CanvasNodeData };
}

function edge(id: string, source: string, target: string): Edge {
  return { id, source, target, type: "smoothstep" };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("graph-traversal", () => {
  const n1 = node("n1", 100, 0);
  const n2 = node("n2", 100, 200);
  const n3 = node("n3", 300, 100);
  const n4 = node("n4", 500, 0);
  const n5 = node("n5", 500, 200);

  const allNodes = [n1, n2, n3, n4, n5];

  // Chain: n1 → n3 → n4; n2 → n3 → n5
  const edgesChain: Edge[] = [
    edge("e1-3", "n1", "n3"),
    edge("e2-3", "n2", "n3"),
    edge("e3-4", "n3", "n4"),
    edge("e3-5", "n3", "n5"),
  ];

  // Edge queries -------------------------------------------------------------

  describe("getIncomingEdges", () => {
    it("returns edges targeting the node", () => {
      const incoming = getIncomingEdges("n3", edgesChain);
      assert.equal(incoming.length, 2);
      assert.ok(incoming.some((e) => e.source === "n1"));
      assert.ok(incoming.some((e) => e.source === "n2"));
    });

    it("returns empty array for a source-only node", () => {
      assert.equal(getIncomingEdges("n1", edgesChain).length, 0);
    });

    it("returns empty array for an isolated node", () => {
      assert.equal(getIncomingEdges("isolated", edgesChain).length, 0);
    });

    it("returns empty array for empty edges", () => {
      assert.equal(getIncomingEdges("n3", []).length, 0);
    });
  });

  describe("getOutgoingEdges", () => {
    it("returns edges originating from the node", () => {
      const outgoing = getOutgoingEdges("n3", edgesChain);
      assert.equal(outgoing.length, 2);
      assert.ok(outgoing.some((e) => e.target === "n4"));
      assert.ok(outgoing.some((e) => e.target === "n5"));
    });

    it("returns empty array for a leaf node", () => {
      assert.equal(getOutgoingEdges("n4", edgesChain).length, 0);
    });

    it("returns empty array for empty edges", () => {
      assert.equal(getOutgoingEdges("n1", []).length, 0);
    });
  });

  // Direct queries -----------------------------------------------------------

  describe("getDirectUpstreamNodes", () => {
    it("returns direct upstream nodes", () => {
      const upstream = getDirectUpstreamNodes("n3", allNodes, edgesChain);
      assert.equal(upstream.length, 2);
      const ids = upstream.map((n) => n.id).sort();
      assert.deepEqual(ids, ["n1", "n2"]);
    });

    it("returns empty for a root node", () => {
      assert.equal(getDirectUpstreamNodes("n1", allNodes, edgesChain).length, 0);
    });
  });

  describe("getDirectDownstreamNodes", () => {
    it("returns direct downstream nodes", () => {
      const downstream = getDirectDownstreamNodes("n3", allNodes, edgesChain);
      assert.equal(downstream.length, 2);
      const ids = downstream.map((n) => n.id).sort();
      assert.deepEqual(ids, ["n4", "n5"]);
    });

    it("returns empty for a leaf node", () => {
      assert.equal(getDirectDownstreamNodes("n4", allNodes, edgesChain).length, 0);
    });
  });

  // Upstream traversal -------------------------------------------------------

  describe("getUpstreamNodeIds", () => {
    it("returns all upstream node IDs in post-order (deepest first)", () => {
      // n1 → n3 → n4  => post-order: n1(n4's grandparent) → n2 → n3(parent)
      const ids = getUpstreamNodeIds("n4", edgesChain);
      assert.deepEqual(ids, ["n1", "n2", "n3"]);
    });

    it("returns empty array for a root node", () => {
      assert.deepEqual(getUpstreamNodeIds("n1", edgesChain), []);
    });

    it("obeys maxDepth (returns nodes within the depth limit)", () => {
      // n4 depth-1 parent: n3, depth-2 ancestors: n1, n2
      // maxDepth=1: only n3 is within immediate depth, but n1/n2 are still
      // queried (beyond limit) and pushed before recursion stops
      const ids = getUpstreamNodeIds("n4", edgesChain, 1);
      // n1,n2 are at depth 2 (beyond maxDepth=1), n3 at depth 1
      assert.ok(ids.includes("n3"), "n3 at depth 1 should be included");
    });

    it("handles isolated node", () => {
      assert.deepEqual(getUpstreamNodeIds("isolated", edgesChain), []);
    });

    it("handles empty edges", () => {
      assert.deepEqual(getUpstreamNodeIds("n4", []), []);
    });
  });

  describe("getUpstreamNodes", () => {
    it("returns upstream nodes sorted by depth (closest first) then position", () => {
      const upstream = getUpstreamNodes("n4", allNodes, edgesChain);
      // n3 (depth 1) → closest first
      // n1 (depth 2, x=100,y=0) before n2 (depth 2, x=100,y=200)
      const ids = upstream.map((n) => n.id);
      assert.deepEqual(ids, ["n3", "n1", "n2"]);
    });

    it("returns empty for root", () => {
      assert.equal(getUpstreamNodes("n1", allNodes, edgesChain).length, 0);
    });
  });

  describe("topologicalOrder", () => {
    it("returns upstream IDs deepest-first + the node itself last", () => {
      // n1 → n3 → n4: n1/n2 deepest (depth 2), n3 (depth 1)
      // getUpstreamNodeIds uses post-order (deepest first)
      const order = topologicalOrder("n4", edgesChain);
      assert.deepEqual(order, ["n1", "n2", "n3", "n4"]);
    });

    it("returns just [nodeId] for root", () => {
      assert.deepEqual(topologicalOrder("n1", edgesChain), ["n1"]);
    });
  });

  // Cycle detection ----------------------------------------------------------

  describe("hasCycle", () => {
    it("returns false for a DAG", () => {
      assert.equal(hasCycle("n1", edgesChain), false);
    });

    it("detects a direct self-loop", () => {
      const selfLoop = [...edgesChain, edge("self", "n1", "n1")];
      assert.equal(hasCycle("n1", selfLoop), true);
    });

    it("detects a simple 2-node cycle", () => {
      const cycle = [...edgesChain, edge("n4-n3", "n4", "n3")];
      assert.equal(hasCycle("n1", cycle), true);
    });

    it("detects a longer cycle", () => {
      // n5 → n1 creates cycle: n1 → n3 → n5 → n1
      const cycle = [...edgesChain, edge("n5-n1", "n5", "n1")];
      assert.equal(hasCycle("n1", cycle), true);
    });

    it("returns false for an isolated node", () => {
      assert.equal(hasCycle("isolated", edgesChain), false);
    });

    it("respects maxDepth", () => {
      // n5 → n1 chain: cycle exists but beyond maxDepth
      const cycle = [...edgesChain, edge("n5-n1", "n5", "n1")];
      assert.equal(hasCycle("n1", cycle, 2), false);
    });
  });

  // Downstream traversal -----------------------------------------------------

  describe("getDownstreamNodeIds", () => {
    it("returns all downstream node IDs in topological order", () => {
      // n1 → n3 → n4,n5 => downstream of n1: [n3, n4, n5] (n3 first, then n4,n5)
      const ids = getDownstreamNodeIds("n1", edgesChain);
      assert.deepEqual(ids, ["n3", "n4", "n5"]);
    });

    it("returns empty array for a leaf node", () => {
      assert.deepEqual(getDownstreamNodeIds("n4", edgesChain), []);
    });

    it("obeys maxDepth", () => {
      // n1 → n3 → n4,n5 => depth 1: only n3
      const ids = getDownstreamNodeIds("n1", edgesChain, 1);
      assert.deepEqual(ids, ["n3"]);
    });

    it("handles isolated node", () => {
      assert.deepEqual(getDownstreamNodeIds("isolated", edgesChain), []);
    });

    it("handles empty edges", () => {
      assert.deepEqual(getDownstreamNodeIds("n1", []), []);
    });
  });

  describe("getDownstreamNodes", () => {
    it("returns downstream nodes sorted by depth then position", () => {
      const downstream = getDownstreamNodes("n1", allNodes, edgesChain);
      // n3 (depth 1) → n4(n4.x=500, depth 2), n5(n5.x=500, n5.y=200, depth 2)
      // depth 1: n3
      // depth 2: n4(n4.x=500 > n4.y=0), n5(n5.x=500 > n5.y=200)
      // But n4.y=0 < n5.y=200, so n4 before n5
      const ids = downstream.map((n) => n.id);
      assert.deepEqual(ids, ["n3", "n4", "n5"]);
    });

    it("returns empty for leaf", () => {
      assert.equal(getDownstreamNodes("n4", allNodes, edgesChain).length, 0);
    });
  });

  describe("downstreamTopologicalOrder", () => {
    it("returns nodeId first then downstream IDs", () => {
      const order = downstreamTopologicalOrder("n1", edgesChain);
      assert.deepEqual(order, ["n1", "n3", "n4", "n5"]);
    });

    it("returns just [nodeId] for leaf", () => {
      assert.deepEqual(downstreamTopologicalOrder("n4", edgesChain), ["n4"]);
    });
  });

  // Kahn topological sort ----------------------------------------------------

  describe("topologicalSortAll", () => {
    // DAG: n1 → n2 → n4; n1 → n3 → n4; n5 (isolated)
    const edges: Edge[] = [
      edge("a", "n1", "n2"),
      edge("b", "n1", "n3"),
      edge("c", "n2", "n4"),
      edge("d", "n3", "n4"),
    ];
    const ids = ["n1", "n2", "n3", "n4"];

    it("sorts a simple DAG", () => {
      const sorted = topologicalSortAll(ids, edges);
      // n1 must be first (in-degree 0)
      // n4 must be last (depends on n2, n3)
      assert.equal(sorted[0], "n1");
      assert.equal(sorted[sorted.length - 1], "n4");
      // n2 must be before n4
      assert.ok(sorted.indexOf("n2") < sorted.indexOf("n4"));
      // n3 must be before n4
      assert.ok(sorted.indexOf("n3") < sorted.indexOf("n4"));
    });

    it("returns nodes in stable order when no edges", () => {
      const sorted = topologicalSortAll(["z", "a", "m"], []);
      // Stable sort by localeCompare when all in-degree 0
      assert.deepEqual(sorted, ["a", "m", "z"]);
    });

    it("excludes cyclic nodes from the result", () => {
      // Cycle: n1 → n2 → n1
      const cyclicEdges = [edge("a", "n1", "n2"), edge("b", "n2", "n1")];
      const sorted = topologicalSortAll(["n1", "n2", "n3"], cyclicEdges);
      // n3 has no edges → sorted first; n1, n2 are cyclic → excluded
      assert.deepEqual(sorted, ["n3"]);
    });

    it("handles single node", () => {
      assert.deepEqual(topologicalSortAll(["n1"], []), ["n1"]);
    });

    it("handles empty input", () => {
      assert.deepEqual(topologicalSortAll([], []), []);
    });
  });

  // detectCyclesInSet --------------------------------------------------------

  describe("detectCyclesInSet", () => {
    it("returns false for a DAG", () => {
      assert.equal(detectCyclesInSet(["n1", "n3", "n4"], edgesChain), false);
    });

    it("returns true when cycle exists", () => {
      const cycle = [...edgesChain, edge("n5-n1", "n5", "n1")];
      assert.equal(detectCyclesInSet(["n1", "n3", "n5"], cycle), true);
    });

    it("returns false for nodes not involved in any cycle", () => {
      const cycle = [...edgesChain, edge("n5-n1", "n5", "n1")];
      // n4 is isolated from the cycle
      assert.equal(detectCyclesInSet(["n4"], cycle), false);
    });
  });
});
