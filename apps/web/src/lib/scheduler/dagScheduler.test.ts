// ============================================================================
// DAG Scheduler 单元测试
// ============================================================================
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { topologicalSort, computeCriticalPathPriority } from "./dagScheduler.ts"
import type { DagNode, DagEdge } from "./dagScheduler.ts"

describe("DAG Scheduler", () => {
  describe("topologicalSort", () => {
    it("sorts a simple linear DAG", () => {
      const nodes: DagNode[] = [
        { id: "a" }, { id: "b" }, { id: "c" },
      ]
      const edges: DagEdge[] = [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
      ]
      const result = topologicalSort(nodes, edges)
      assert.deepEqual(result, ["a", "b", "c"])
    })

    it("sorts a diamond DAG", () => {
      const nodes: DagNode[] = [
        { id: "a" }, { id: "b" }, { id: "c" }, { id: "d" },
      ]
      const edges: DagEdge[] = [
        { from: "a", to: "b" },
        { from: "a", to: "c" },
        { from: "b", to: "d" },
        { from: "c", to: "d" },
      ]
      const result = topologicalSort(nodes, edges)
      // a must come first, d must come last
      assert.equal(result[0], "a")
      assert.equal(result[3], "d")
      assert.equal(result.includes("b"), true)
      assert.equal(result.includes("c"), true)
    })

    it("handles independent nodes", () => {
      const nodes: DagNode[] = [{ id: "x" }, { id: "y" }]
      const edges: DagEdge[] = []
      const result = topologicalSort(nodes, edges)
      assert.equal(result.length, 2)
      assert.equal(result.includes("x"), true)
      assert.equal(result.includes("y"), true)
    })

    it("throws on cyclic graph", () => {
      const nodes: DagNode[] = [
        { id: "a" }, { id: "b" },
      ]
      const edges: DagEdge[] = [
        { from: "a", to: "b" },
        { from: "b", to: "a" },
      ]
      assert.throws(() => topologicalSort(nodes, edges), /cycle/)
    })

    it("handles empty graph", () => {
      assert.deepEqual(topologicalSort([], []), [])
    })
  })

  describe("computeCriticalPathPriority", () => {
    it("computes priorities for linear chain", () => {
      const nodes = ["a", "b", "c"]
      const edges: DagEdge[] = [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
      ]
      const durations = new Map([["a", 100], ["b", 200], ["c", 300]])
      const priority = computeCriticalPathPriority(nodes, edges, durations)
      // c should have highest priority (300), a lowest (600)
      // Actually: cpRemaining for c=300, b=500, a=600
      assert.equal(priority.get("c"), 300)
      assert.equal(priority.get("b"), 500)
      assert.equal(priority.get("a"), 600)
    })

    it("parallel paths: longer path has higher priority", () => {
      const nodes = ["a", "b1", "b2", "c"]
      const edges: DagEdge[] = [
        { from: "a", to: "b1" },
        { from: "a", to: "b2" },
        { from: "b1", to: "c" },
        { from: "b2", to: "c" },
      ]
      const durations = new Map([
        ["a", 100], ["b1", 50], ["b2", 200], ["c", 100],
      ])
      const priority = computeCriticalPathPriority(nodes, edges, durations)
      // b2 is on longer path (a->b2->c = 400) vs b1 (a->b1->c = 250)
      assert.equal(priority.get("b2")! > priority.get("b1")!, true)
    })
  })
})
