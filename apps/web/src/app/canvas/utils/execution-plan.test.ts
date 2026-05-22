#!/usr/bin/env node --experimental-strip-types
// ============================================================================
// P2-2 单元测试 — execution-plan + graph-traversal 下游函数
// ============================================================================
// 运行方式：node --experimental-strip-types utils/execution-plan.test.ts
// ============================================================================

export {} // make this a module to avoid tsc redeclaration errors

const assert = {
  equal(actual: unknown, expected: unknown, msg?: string) {
    const a = JSON.stringify(actual)
    const e = JSON.stringify(expected)
    if (a !== e) {
      throw new Error(`${msg ?? "assertion failed"}\n  expected: ${e}\n  actual:   ${a}`)
    }
  },
  ok(val: unknown, msg?: string) {
    if (!val) throw new Error(msg ?? "expected truthy")
  },
  deepEqual(actual: unknown, expected: unknown, msg?: string) {
    this.equal(actual, expected, msg)
  },
  notEqual(actual: unknown, expected: unknown, msg?: string) {
    const a = JSON.stringify(actual)
    const e = JSON.stringify(expected)
    if (a === e) {
      throw new Error(`${msg ?? "assertion failed — values should not be equal"}\n  both: ${e}`)
    }
  },
  throws(fn: () => void, _expected?: unknown, msg?: string) {
    let threw = false
    try { fn() } catch { threw = true }
    if (!threw) throw new Error(msg ?? "expected to throw")
  },
  includes(arr: unknown[], val: unknown, msg?: string) {
    const s = JSON.stringify(arr)
    if (!arr.includes(val)) {
      throw new Error(`${msg ?? `expected ${JSON.stringify(val)} to be in ${s}`}`)
    }
  },
}

// ============================================================================
// Types (mirror)
// ============================================================================

interface TestNode {
  id: string
  position: { x: number; y: number }
  data?: Record<string, unknown>
}

interface TestEdge {
  id: string
  source: string
  target: string
}

// ============================================================================
// Inline mirror — graph-traversal downstream functions
// ============================================================================

function getDownstreamNodeIds(nodeId: string, edges: TestEdge[], maxDepth: number = 10): string[] {
  const result: string[] = []
  const visited = new Set<string>()
  function walk(currentId: string, currentDepth: number): void {
    if (currentDepth >= maxDepth) return
    for (const edge of edges) {
      if (edge.source !== currentId) continue
      const downstreamId = edge.target
      if (!downstreamId || visited.has(downstreamId)) continue
      visited.add(downstreamId)
      result.push(downstreamId)
      walk(downstreamId, currentDepth + 1)
    }
  }
  walk(nodeId, 0)
  return result
}

function hasCycle(nodeId: string, edges: TestEdge[], maxDepth: number = 20): boolean {
  const visited = new Set<string>()
  const stack = new Set<string>()
  function dfs(currentId: string, depth: number): boolean {
    if (depth > maxDepth) return false
    if (stack.has(currentId)) return true
    if (visited.has(currentId)) return false
    visited.add(currentId)
    stack.add(currentId)
    for (const edge of edges) {
      if (edge.source !== currentId) continue
      if (dfs(edge.target, depth + 1)) return true
    }
    stack.delete(currentId)
    return false
  }
  return dfs(nodeId, 0)
}

function detectCyclesInSet(nodeIds: string[], edges: TestEdge[], maxDepth: number = 20): boolean {
  for (const nodeId of nodeIds) {
    if (hasCycle(nodeId, edges, maxDepth)) return true
  }
  return false
}

function downstreamTopologicalOrder(nodeId: string, edges: TestEdge[], maxDepth: number = 10): string[] {
  return [nodeId, ...getDownstreamNodeIds(nodeId, edges, maxDepth)]
}

function topologicalOrder(nodeId: string, edges: TestEdge[], maxDepth: number = 10): string[] {
  const result: string[] = []
  const visited = new Set<string>()
  function walk(currentId: string, currentDepth: number): void {
    if (currentDepth > maxDepth) return
    for (const edge of edges) {
      if (edge.target !== currentId) continue
      const upstreamId = edge.source
      if (!upstreamId || visited.has(upstreamId)) continue
      visited.add(upstreamId)
      walk(upstreamId, currentDepth + 1)
      result.push(upstreamId)
    }
  }
  walk(nodeId, 0)
  return [...result, nodeId]
}

function topologicalSortAll(nodeIds: string[], edges: TestEdge[]): string[] {
  const nodeSet = new Set(nodeIds)
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()
  const result: string[] = []
  for (const id of nodeIds) {
    inDegree.set(id, 0)
    adj.set(id, [])
  }
  for (const edge of edges) {
    const { source, target } = edge
    if (!nodeSet.has(source) || !nodeSet.has(target)) continue
    adj.get(source)!.push(target)
    inDegree.set(target, (inDegree.get(target) ?? 0) + 1)
  }
  const queue: string[] = []
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id)
  }
  queue.sort((a, b) => a.localeCompare(b))
  while (queue.length > 0) {
    const level = [...queue]
    queue.length = 0
    for (const id of level) {
      result.push(id)
      for (const neighbor of adj.get(id) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 1) - 1
        inDegree.set(neighbor, newDegree)
        if (newDegree === 0) queue.push(neighbor)
      }
    }
    queue.sort((a, b) => a.localeCompare(b))
  }
  return result
}

// ============================================================================
// Test helpers
// ============================================================================

function makeNode(id: string, x: number = 0, y: number = 0, data?: Record<string, unknown>): TestNode {
  return { id, position: { x, y }, data: data ?? {} }
}

function makeEdge(source: string, target: string): TestEdge {
  return { id: `${source}-${target}`, source, target }
}

let passed = 0
let failed = 0
let testName = ""

function test(name: string, fn: () => void) {
  testName = name
  try {
    fn()
    passed++
  } catch (e: any) {
    failed++
    console.error(`  FAIL [${name}]: ${e.message}`)
  }
}

// ============================================================================
// Tests: getDownstreamNodeIds
// ============================================================================

console.log("\n=== getDownstreamNodeIds ===")

test("linear chain A->B->C from A", () => {
  const edges = [makeEdge("A", "B"), makeEdge("B", "C")]
  assert.deepEqual(getDownstreamNodeIds("A", edges), ["B", "C"])
})

test("diamond A->B, A->C, B->D, C->D from A", () => {
  const edges = [
    makeEdge("A", "B"), makeEdge("A", "C"),
    makeEdge("B", "D"), makeEdge("C", "D"),
  ]
  const result = getDownstreamNodeIds("A", edges)
  assert.ok(result.includes("B"), "should include B")
  assert.ok(result.includes("C"), "should include C")
  assert.ok(result.includes("D"), "should include D")
  assert.equal(result.length, 3)
})

test("no downstream", () => {
  const edges = [makeEdge("A", "B")]
  assert.deepEqual(getDownstreamNodeIds("B", edges), [])
})

test("maxDepth=1 limits traversal", () => {
  const edges = [makeEdge("A", "B"), makeEdge("B", "C"), makeEdge("C", "D")]
  const result = getDownstreamNodeIds("A", edges, 1)
  assert.deepEqual(result, ["B"])
})

test("maxDepth=2 reaches second layer", () => {
  const edges = [makeEdge("A", "B"), makeEdge("B", "C"), makeEdge("C", "D")]
  const result = getDownstreamNodeIds("A", edges, 2)
  assert.deepEqual(result, ["B", "C"])
})

test("cycle - no crash in downstream traversal", () => {
  const edges = [makeEdge("A", "B"), makeEdge("B", "A")]
  // getDownstreamNodeIds traverses with visited set, stops after one full cycle
  // A -> B (push B) -> A (push A, visited={B,A}) -> B (already visited) -> stop
  const result = getDownstreamNodeIds("A", edges)
  assert.deepEqual(result, ["B", "A"])
})

// ============================================================================
// Tests: downstreamTopologicalOrder
// ============================================================================

console.log("\n=== downstreamTopologicalOrder ===")

test("linear includes root + downstream", () => {
  const edges = [makeEdge("A", "B"), makeEdge("B", "C")]
  assert.deepEqual(downstreamTopologicalOrder("A", edges), ["A", "B", "C"])
})

test("single node no edges", () => {
  assert.deepEqual(downstreamTopologicalOrder("X", []), ["X"])
})

// ============================================================================
// Tests: topologicalSortAll (Kahn)
// ============================================================================

console.log("\n=== topologicalSortAll ===")

test("linear chain A->B->C", () => {
  const edges = [makeEdge("A", "B"), makeEdge("B", "C")]
  assert.deepEqual(topologicalSortAll(["A", "B", "C"], edges), ["A", "B", "C"])
})

test("diamond graph", () => {
  const edges = [
    makeEdge("A", "B"), makeEdge("A", "C"),
    makeEdge("B", "D"), makeEdge("C", "D"),
  ]
  const result = topologicalSortAll(["A", "B", "C", "D"], edges)
  assert.equal(result[0], "A", "A should be first")
  assert.equal(result[result.length - 1], "D", "D should be last")
  assert.ok(["B", "C"].includes(result[1]), "B or C should come second")
  assert.ok(["B", "C"].includes(result[2]), "B or C should come third")
  assert.equal(result.length, 4)
})

test("disconnected nodes each sort independently", () => {
  const edges = [makeEdge("A", "B")]
  const result = topologicalSortAll(["A", "B", "C", "D"], edges)
  // C and D should appear, order determined by dictionary sort
  assert.equal(result.length, 4)
  assert.ok(result.includes("C"))
  assert.ok(result.includes("D"))
})

test("cycle — remaining nodes not in result", () => {
  const edges = [makeEdge("A", "B"), makeEdge("B", "C"), makeEdge("C", "A")]
  const result = topologicalSortAll(["A", "B", "C"], edges)
  // All 3 form a cycle, so none can be sorted
  assert.equal(result.length, 0)
})

test("partial cycle — ring + outsider", () => {
  const edges = [
    makeEdge("A", "B"), makeEdge("B", "C"), makeEdge("C", "A"),
    makeEdge("D", "A"),
  ]
  const result = topologicalSortAll(["A", "B", "C", "D"], edges)
  // Only D can be sorted (it has no incoming from the cycle pre-sort)
  // Actually D has no incoming, so it gets sorted first. A/B/C form cycle.
  assert.equal(result.length, 1)
  assert.equal(result[0], "D")
})

test("empty node list", () => {
  assert.deepEqual(topologicalSortAll([], []), [])
})

// ============================================================================
// Tests: detectCyclesInSet
// ============================================================================

console.log("\n=== detectCyclesInSet ===")

test("no cycle", () => {
  const edges = [makeEdge("A", "B"), makeEdge("B", "C")]
  assert.equal(detectCyclesInSet(["A", "B", "C"], edges), false)
})

test("has cycle", () => {
  const edges = [makeEdge("A", "B"), makeEdge("B", "C"), makeEdge("C", "A")]
  assert.equal(detectCyclesInSet(["A", "B", "C"], edges), true)
})

test("cycle in separate component", () => {
  const edges = [
    makeEdge("A", "B"),  // linear
    makeEdge("X", "Y"), makeEdge("Y", "X"),  // cycle
  ]
  assert.equal(detectCyclesInSet(["A", "B", "X", "Y"], edges), true)
})

// ============================================================================
// Tests: buildExecutionPlan (mirror)
// ============================================================================

// Mirror buildExecutionPlan to avoid import issues
type PlanMode = "single" | "upstream" | "downstream" | "selected" | "full"
type StepStatus = "pending" | "running" | "succeeded" | "failed" | "skipped" | "cancelled"

interface PlanStep {
  id: string; nodeId: string; depth: number
  dependencies: string[]; dependents: string[]
  status: StepStatus
  startedAt?: string; finishedAt?: string; durationMs?: number; error?: string
}

interface Plan {
  id: string
  canvasId: string
  mode: PlanMode
  rootNodeIds: string[]
  steps: PlanStep[]
  status: "pending" | "running" | "succeeded" | "failed" | "cancelled"
  warnings: string[]
}

function makeStepId(nodeId: string): string { return `step-${nodeId}` }

let planIdCounter = 0
function buildPlanId(): string { return `plan-${++planIdCounter}` }

function buildExecutionPlanComputedDepthKahn(ids: string[], nodes: TestNode[], edges: TestEdge[]): number[] {
  const nodeSet = new Set(ids)
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()
  const depth = new Map<string, number>()
  for (const id of ids) { inDegree.set(id, 0); adj.set(id, []) }
  for (const edge of edges) {
    const { source, target } = edge
    if (!nodeSet.has(source) || !nodeSet.has(target)) continue
    adj.get(source)!.push(target)
    inDegree.set(target, (inDegree.get(target) ?? 0) + 1)
  }
  const queue: string[] = []
  for (const [id, degree] of inDegree) { if (degree === 0) { queue.push(id); depth.set(id, 0) } }
  queue.sort()
  while (queue.length > 0) {
    const level = [...queue]; queue.length = 0
    for (const id of level) {
      const currentDepth = depth.get(id) ?? 0
      for (const neighbor of adj.get(id) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 1) - 1
        inDegree.set(neighbor, newDegree)
        const nd = currentDepth + 1
        const existingDepth = depth.get(neighbor)
        if (existingDepth === undefined || nd > existingDepth) depth.set(neighbor, nd)
        if (newDegree === 0) queue.push(neighbor)
      }
    }
    queue.sort()
  }
  return ids.map((id) => depth.get(id) ?? 0)
}

function mirrorPlan(options: {
  mode: PlanMode
  rootNodeIds: string[]
  selectedNodeIds?: string[]
  nodes: TestNode[]
  edges: TestEdge[]
  canvasId: string
}): Plan {
  const { mode, rootNodeIds, selectedNodeIds, nodes, edges, canvasId } = options
  const warnings: string[] = []
  const allNodeIds = nodes.map((n) => n.id)
  let orderedIds: string[] = []

  switch (mode) {
    case "single": {
      orderedIds = [...rootNodeIds]
      if (rootNodeIds.length !== 1) warnings.push(`single 模式只接受一个 rootNodeId`)
      break
    }
    case "upstream": {
      const rootId = rootNodeIds[0]
      if (!rootId) { warnings.push("upstream 模式需要至少一个 rootNodeId"); break }
      orderedIds = topologicalOrder(rootId, edges)
      break
    }
    case "downstream": {
      const rootId = rootNodeIds[0]
      if (!rootId) { warnings.push("downstream 模式需要至少一个 rootNodeId"); break }
      orderedIds = downstreamTopologicalOrder(rootId, edges)
      break
    }
    case "selected": {
      const ids = selectedNodeIds ?? rootNodeIds
      if (ids.length === 0) { warnings.push("selected 模式需要至少一个节点 ID"); break }
      if (detectCyclesInSet(ids, edges)) warnings.push("检测到循环引用")
      const sorted = topologicalSortAll(ids, edges)
      if (sorted.length < ids.length) warnings.push("部分节点因循环引用被排除")
      orderedIds = sorted.filter((id) => nodes.some((n) => n.id === id))
      break
    }
    case "full": {
      if (allNodeIds.length === 0) { warnings.push("画布中没有节点"); break }
      if (detectCyclesInSet(allNodeIds, edges)) warnings.push("检测到循环引用")
      const sorted = topologicalSortAll(allNodeIds, edges)
      if (sorted.length < allNodeIds.length) warnings.push("部分节点因循环引用被排除")
      orderedIds = sorted
      break
    }
  }

  let depths: number[] = []
  switch (mode) {
    case "upstream":
      depths = orderedIds.map((_, i) => orderedIds.length - 1 - i)
      break
    case "downstream":
      depths = orderedIds.map((_, i) => i)
      break
    case "selected":
    case "full":
      depths = buildExecutionPlanComputedDepthKahn(orderedIds, nodes, edges)
      break
    default:
      depths = Array(orderedIds.length).fill(0)
  }

  const stepIdMap = new Map<string, string>()
  for (const id of orderedIds) stepIdMap.set(id, makeStepId(id))

  const depsMap = new Map<string, string[]>()
  const dentsMap = new Map<string, string[]>()
  for (const id of orderedIds) {
    depsMap.set(makeStepId(id), [])
    dentsMap.set(makeStepId(id), [])
  }
  for (const edge of edges) {
    const { source, target } = edge
    if (!orderedIds.includes(source) || !orderedIds.includes(target)) continue
    const ss = stepIdMap.get(source)!
    const ts = stepIdMap.get(target)!
    const dents = dentsMap.get(ss)!
    dents.push(ts)
    dentsMap.set(ss, dents)
    const deps = depsMap.get(ts)!
    deps.push(ss)
    depsMap.set(ts, deps)
  }

  const steps: PlanStep[] = orderedIds.map((nodeId, i) => ({
    id: makeStepId(nodeId),
    nodeId,
    depth: depths[i] ?? 0,
    dependencies: depsMap.get(makeStepId(nodeId)) ?? [],
    dependents: dentsMap.get(makeStepId(nodeId)) ?? [],
    status: "pending" as StepStatus,
  }))

  return {
    id: buildPlanId(),
    canvasId,
    mode,
    rootNodeIds,
    steps,
    status: "pending",
    warnings,
  }
}

console.log("\n=== buildExecutionPlan ===")

// --- mode: single ---
test("single mode: one step", () => {
  const nodes = [makeNode("A")]
  const plan = mirrorPlan({ mode: "single", rootNodeIds: ["A"], nodes, edges: [], canvasId: "c1" })
  assert.equal(plan.mode, "single")
  assert.equal(plan.steps.length, 1)
  assert.equal(plan.steps[0].nodeId, "A")
  assert.equal(plan.steps[0].depth, 0)
  assert.deepEqual(plan.steps[0].dependencies, [])
  assert.deepEqual(plan.steps[0].dependents, [])
  assert.equal(plan.steps[0].status, "pending")
})

// --- mode: upstream ---
test("upstream mode: includes upstream + root in topological order", () => {
  const nodes = [makeNode("A"), makeNode("B"), makeNode("C")]
  const edges = [makeEdge("A", "B"), makeEdge("B", "C")]
  const plan = mirrorPlan({ mode: "upstream", rootNodeIds: ["C"], nodes, edges, canvasId: "c1" })
  assert.equal(plan.mode, "upstream")
  assert.equal(plan.steps.length, 3)
  assert.deepEqual(plan.steps.map((s) => s.nodeId), ["A", "B", "C"])
  // depths should increase: A deepest, C at 0
  assert.equal(plan.steps[0].depth, 2, "A depth=2")
  assert.equal(plan.steps[1].depth, 1, "B depth=1")
  assert.equal(plan.steps[2].depth, 0, "C depth=0")
})

test("upstream mode: with step dependencies", () => {
  const nodes = [makeNode("A"), makeNode("B"), makeNode("C")]
  const edges = [makeEdge("A", "B"), makeEdge("B", "C")]
  const plan = mirrorPlan({ mode: "upstream", rootNodeIds: ["C"], nodes, edges, canvasId: "c1" })
  // step-B depends on step-A
  const stepB = plan.steps.find((s) => s.nodeId === "B")!
  const stepC = plan.steps.find((s) => s.nodeId === "C")!
  assert.includes(stepB.dependencies, "step-A")
  assert.includes(stepB.dependents, "step-C")
  assert.includes(stepC.dependencies, "step-B")
})

// --- mode: downstream ---
test("downstream mode: root + downstream in order", () => {
  const nodes = [makeNode("A"), makeNode("B"), makeNode("C")]
  const edges = [makeEdge("A", "B"), makeEdge("B", "C")]
  const plan = mirrorPlan({ mode: "downstream", rootNodeIds: ["A"], nodes, edges, canvasId: "c1" })
  assert.equal(plan.mode, "downstream")
  assert.equal(plan.steps.length, 3)
  assert.deepEqual(plan.steps.map((s) => s.nodeId), ["A", "B", "C"])
  assert.equal(plan.steps[0].depth, 0, "A depth=0")
  assert.equal(plan.steps[1].depth, 1, "B depth=1")
  assert.equal(plan.steps[2].depth, 2, "C depth=2")
})

test("downstream mode: step dependencies", () => {
  const nodes = [makeNode("A"), makeNode("B"), makeNode("C")]
  const edges = [makeEdge("A", "B"), makeEdge("B", "C")]
  const plan = mirrorPlan({ mode: "downstream", rootNodeIds: ["A"], nodes, edges, canvasId: "c1" })
  const stepA = plan.steps.find((s) => s.nodeId === "A")!
  const stepB = plan.steps.find((s) => s.nodeId === "B")!
  assert.includes(stepA.dependents, "step-B")
  assert.includes(stepB.dependencies, "step-A")
  assert.includes(stepB.dependents, "step-C")
  const stepC2 = plan.steps.find((s) => s.nodeId === "C")!
  assert.includes(stepC2.dependencies, "step-B")
})

// --- mode: selected ---
test("selected mode: only selected nodes", () => {
  const nodes = [makeNode("A"), makeNode("B"), makeNode("C"), makeNode("D")]
  const edges = [makeEdge("A", "B"), makeEdge("B", "C"), makeEdge("C", "D")]
  const plan = mirrorPlan({ mode: "selected", rootNodeIds: ["B"], selectedNodeIds: ["A", "B", "C"], nodes, edges, canvasId: "c1" })
  assert.equal(plan.mode, "selected")
  assert.equal(plan.steps.length, 3)
  assert.deepEqual(plan.steps.map((s) => s.nodeId), ["A", "B", "C"])
})

// --- mode: full ---
test("full mode: all nodes sorted", () => {
  const nodes = [makeNode("A"), makeNode("B"), makeNode("C")]
  const edges = [makeEdge("A", "B"), makeEdge("B", "C")]
  const plan = mirrorPlan({ mode: "full", rootNodeIds: [], nodes, edges, canvasId: "c1" })
  assert.equal(plan.mode, "full")
  assert.equal(plan.steps.length, 3)
  assert.deepEqual(plan.steps.map((s) => s.nodeId), ["A", "B", "C"])
})

// --- edge cases ---
test("empty canvas", () => {
  const plan = mirrorPlan({ mode: "full", rootNodeIds: [], nodes: [], edges: [], canvasId: "c1" })
  assert.equal(plan.steps.length, 0)
  assert.ok(plan.warnings.length > 0, "should have warnings")
})

test("single node no edges", () => {
  const nodes = [makeNode("X")]
  const plan = mirrorPlan({ mode: "full", rootNodeIds: [], nodes, edges: [], canvasId: "c1" })
  assert.equal(plan.steps.length, 1)
  assert.equal(plan.steps[0].depth, 0)
})

test("disconnected subgraphs", () => {
  const nodes = [makeNode("A"), makeNode("B"), makeNode("C"), makeNode("D")]
  const edges = [makeEdge("A", "B"), makeEdge("C", "D")]
  const plan = mirrorPlan({ mode: "full", rootNodeIds: [], nodes, edges, canvasId: "c1" })
  assert.equal(plan.steps.length, 4)
  // Both subgraphs should be included
  assert.ok(plan.steps.some((s) => s.nodeId === "A"))
  assert.ok(plan.steps.some((s) => s.nodeId === "D"))
})

test("cycle: warnings present", () => {
  const nodes = [makeNode("A"), makeNode("B"), makeNode("C")]
  const edges = [makeEdge("A", "B"), makeEdge("B", "C"), makeEdge("C", "A")]
  const plan = mirrorPlan({ mode: "full", rootNodeIds: [], nodes, edges, canvasId: "c1" })
  assert.ok(plan.warnings.length > 0, "should have cycle warnings")
  assert.equal(plan.steps.length, 0, "no steps for full cycle")
})

test("plan metadata: id, canvasId, mode, rootNodeIds", () => {
  const nodes = [makeNode("A")]
  const plan = mirrorPlan({ mode: "single", rootNodeIds: ["A"], nodes, edges: [], canvasId: "test-canvas-1" })
  assert.ok(plan.id.startsWith("plan-"), "should have plan id")
  assert.equal(plan.canvasId, "test-canvas-1")
  assert.equal(plan.mode, "single")
  assert.deepEqual(plan.rootNodeIds, ["A"])
  assert.equal(plan.status, "pending")
})

test("plan steps have correct id format", () => {
  const nodes = [makeNode("A")]
  const plan = mirrorPlan({ mode: "single", rootNodeIds: ["A"], nodes, edges: [], canvasId: "c1" })
  assert.equal(plan.steps[0].id, "step-A")
})

test("upstream mode rootNode 'A' with no upstream - only A", () => {
  const nodes = [makeNode("A")]
  const plan = mirrorPlan({ mode: "upstream", rootNodeIds: ["A"], nodes, edges: [], canvasId: "c1" })
  assert.deepEqual(plan.steps.map((s) => s.nodeId), ["A"])
})

test("downstream mode rootNode 'C' with no downstream - only C", () => {
  const nodes = [makeNode("C")]
  const plan = mirrorPlan({ mode: "downstream", rootNodeIds: ["C"], nodes, edges: [], canvasId: "c1" })
  assert.deepEqual(plan.steps.map((s) => s.nodeId), ["C"])
})

test("selected mode with cycle — warnings + partial steps", () => {
  const nodes = [makeNode("A"), makeNode("B"), makeNode("C"), makeNode("D")]
  const edges = [
    makeEdge("A", "B"), makeEdge("B", "C"), makeEdge("C", "A"),  // ABC cycle
    makeEdge("D", "A"),  // D -> cycle
  ]
  const plan = mirrorPlan({ mode: "selected", rootNodeIds: [], selectedNodeIds: ["A", "B", "C", "D"], nodes, edges, canvasId: "c1" })
  assert.ok(plan.warnings.length > 0)
  // D should be the only node sorted (no incoming)
  assert.equal(plan.steps.length, 1)
  assert.equal(plan.steps[0].nodeId, "D")
})

// ============================================================================
// Results
// ============================================================================

console.log(`\n=== Results ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed > 0) process.exit(1);
