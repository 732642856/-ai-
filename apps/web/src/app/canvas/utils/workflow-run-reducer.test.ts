// ============================================================================
// workflowRunReducer 单元测试 (P2-3A)
// ============================================================================
// 运行: node --experimental-strip-types utils/workflow-run-reducer.test.ts
// 参照 execution-plan.test.ts 的 inline 模式
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
  strictEqual(actual: unknown, expected: unknown, msg?: string) {
    if (actual !== expected) {
      throw new Error(`${msg ?? "strictEqual failed"}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`)
    }
  },
}

// ── Inline types + reducer (mirror from workflow-run-reducer.ts) ──────────

type WorkflowRunStatus = "idle" | "running" | "success" | "failed" | "cancelled"
type WorkflowNodeRunStatus = "pending" | "running" | "success" | "failed" | "skipped" | "cancelled"

interface WorkflowRunRecord {
  id: string
  status: WorkflowRunStatus
  startedAt: string
  endedAt?: string
  durationMs?: number
  nodes: WorkflowNodeRunRecord[]
  error?: string
  totalCount: number
  succeededCount: number
  failedCount: number
  mode?: string
}

interface WorkflowNodeRunRecord {
  nodeId: string
  nodeType: string
  title?: string
  status: WorkflowNodeRunStatus
  startedAt?: string
  endedAt?: string
  durationMs?: number
  inputSummary?: string
  outputSummary?: string
  error?: string
  depth?: number
}

type WorkflowRunEvent =
  | { type: "run-started"; runId: string; startedAt: string; nodes: Array<{ nodeId: string; nodeType: string; title?: string; depth?: number }>; mode?: string }
  | { type: "node-started"; runId: string; nodeId: string; startedAt: string; inputSummary?: string }
  | { type: "node-succeeded"; runId: string; nodeId: string; endedAt: string; outputSummary?: string }
  | { type: "node-failed"; runId: string; nodeId: string; endedAt: string; error: string }
  | { type: "node-skipped"; runId: string; nodeId: string; reason?: string }
  | { type: "run-finished"; runId: string; endedAt: string; status: "success" | "failed" | "cancelled"; error?: string }

function workflowRunReducer(
  state: WorkflowRunRecord | null,
  event: WorkflowRunEvent,
): WorkflowRunRecord | null {
  switch (event.type) {
    case "run-started": {
      const nodes: WorkflowNodeRunRecord[] = event.nodes.map((n) => ({
        nodeId: n.nodeId,
        nodeType: n.nodeType,
        title: n.title,
        status: "pending",
        depth: n.depth,
      }))
      return {
        id: event.runId,
        status: "running",
        startedAt: event.startedAt,
        nodes,
        totalCount: nodes.length,
        succeededCount: 0,
        failedCount: 0,
        mode: event.mode,
      }
    }
    case "node-started": {
      if (!state || state.id !== event.runId) return state
      const nodes = state.nodes.map((nr) =>
        nr.nodeId === event.nodeId
          ? { ...nr, status: "running" as const, startedAt: event.startedAt, inputSummary: event.inputSummary ?? nr.inputSummary }
          : nr,
      )
      return { ...state, nodes }
    }
    case "node-succeeded": {
      if (!state || state.id !== event.runId) return state
      const nodes = state.nodes.map((nr) => {
        if (nr.nodeId !== event.nodeId) return nr
        const startedAt = nr.startedAt ?? event.endedAt
        const durationMs = new Date(event.endedAt).getTime() - new Date(startedAt).getTime()
        return { ...nr, status: "success" as const, endedAt: event.endedAt, durationMs: Math.max(0, durationMs), outputSummary: event.outputSummary ?? nr.outputSummary }
      })
      return { ...state, nodes, succeededCount: nodes.filter((n) => n.status === "success").length }
    }
    case "node-failed": {
      if (!state || state.id !== event.runId) return state
      const nodes = state.nodes.map((nr) => {
        if (nr.nodeId !== event.nodeId) return nr
        const startedAt = nr.startedAt ?? event.endedAt
        const durationMs = new Date(event.endedAt).getTime() - new Date(startedAt).getTime()
        return { ...nr, status: "failed" as const, endedAt: event.endedAt, durationMs: Math.max(0, durationMs), error: event.error }
      })
      return { ...state, nodes, failedCount: nodes.filter((n) => n.status === "failed").length }
    }
    case "node-skipped": {
      if (!state || state.id !== event.runId) return state
      const nodes = state.nodes.map((nr) =>
        nr.nodeId === event.nodeId ? { ...nr, status: "skipped" as const, error: event.reason } : nr,
      )
      return { ...state, nodes }
    }
    case "run-finished": {
      if (!state || state.id !== event.runId) return state
      const durationMs = new Date(event.endedAt).getTime() - new Date(state.startedAt).getTime()
      return {
        ...state,
        status: event.status === "cancelled" ? "cancelled" : event.status === "failed" ? "failed" : "success",
        endedAt: event.endedAt,
        durationMs: Math.max(0, durationMs),
        error: event.error ?? state.error,
      }
    }
    default:
      return state
  }
}

function now(): string { return new Date().toISOString() }
function later(ms: number): string { return new Date(Date.now() + ms).toISOString() }

// ============================================================================

// 1 — run-started
{
  const t0 = now()
  const r = workflowRunReducer(null, {
    type: "run-started", runId: "run-1", startedAt: t0,
    nodes: [{ nodeId: "n1", nodeType: "content", title: "脚本" }, { nodeId: "n2", nodeType: "workflow", title: "分镜" }],
    mode: "downstream",
  })
  assert.ok(r, "应该返回记录")
  assert.strictEqual(r!.id, "run-1")
  assert.strictEqual(r!.status, "running")
  assert.strictEqual(r!.totalCount, 2)
  assert.strictEqual(r!.succeededCount, 0)
  assert.strictEqual(r!.failedCount, 0)
  assert.strictEqual(r!.mode, "downstream")
  assert.strictEqual(r!.nodes.length, 2)
  assert.strictEqual(r!.nodes[0].status, "pending")
  assert.strictEqual(r!.nodes[1].status, "pending")
}

// 2 — node-started → node-succeeded
{
  let r = workflowRunReducer(null, {
    type: "run-started", runId: "run-2", startedAt: now(),
    nodes: [{ nodeId: "n1", nodeType: "content", title: "脚本" }],
  })
  const t1 = now()
  r = workflowRunReducer(r, { type: "node-started", runId: "run-2", nodeId: "n1", startedAt: t1, inputSummary: "上游: 空" })
  assert.strictEqual(r!.nodes[0].status, "running")
  assert.strictEqual(r!.nodes[0].startedAt, t1)
  assert.strictEqual(r!.nodes[0].inputSummary, "上游: 空")

  const t2 = later(5000)
  r = workflowRunReducer(r, { type: "node-succeeded", runId: "run-2", nodeId: "n1", endedAt: t2, outputSummary: "生成完成" })
  assert.strictEqual(r!.nodes[0].status, "success")
  assert.strictEqual(r!.nodes[0].outputSummary, "生成完成")
  assert.ok(r!.nodes[0].durationMs! > 0, "durationMs 应为正数")
  assert.strictEqual(r!.succeededCount, 1)
}

// 3 — node-started → node-failed
{
  let r = workflowRunReducer(null, {
    type: "run-started", runId: "run-3", startedAt: now(),
    nodes: [{ nodeId: "n1", nodeType: "workflow", title: "分镜" }],
  })
  r = workflowRunReducer(r, { type: "node-started", runId: "run-3", nodeId: "n1", startedAt: now() })
  r = workflowRunReducer(r, { type: "node-failed", runId: "run-3", nodeId: "n1", endedAt: later(3000), error: "API error: 401" })
  assert.strictEqual(r!.nodes[0].status, "failed")
  assert.strictEqual(r!.nodes[0].error, "API error: 401")
  assert.ok(r!.nodes[0].durationMs! > 0)
  assert.strictEqual(r!.failedCount, 1)
  assert.strictEqual(r!.succeededCount, 0)
}

// 4 — node-skipped
{
  let r = workflowRunReducer(null, {
    type: "run-started", runId: "run-4", startedAt: now(),
    nodes: [{ nodeId: "n1", nodeType: "content", title: "脚本" }],
  })
  r = workflowRunReducer(r, { type: "node-skipped", runId: "run-4", nodeId: "n1", reason: "没有上游输入" })
  assert.strictEqual(r!.nodes[0].status, "skipped")
  assert.strictEqual(r!.nodes[0].error, "没有上游输入")
}

// 5 — run-finished (success)
{
  let r = workflowRunReducer(null, {
    type: "run-started", runId: "run-5", startedAt: now(),
    nodes: [{ nodeId: "n1", nodeType: "content", title: "脚本" }],
  })
  r = workflowRunReducer(r, { type: "node-started", runId: "run-5", nodeId: "n1", startedAt: now() })
  r = workflowRunReducer(r, { type: "node-succeeded", runId: "run-5", nodeId: "n1", endedAt: later(1000) })
  const tEnd = later(2000)
  r = workflowRunReducer(r, { type: "run-finished", runId: "run-5", endedAt: tEnd, status: "success" })
  assert.strictEqual(r!.status, "success")
  assert.strictEqual(r!.endedAt, tEnd)
  assert.ok(r!.durationMs! > 0)
}

// 6 — run-finished (failed)
{
  let r = workflowRunReducer(null, {
    type: "run-started", runId: "run-6", startedAt: now(),
    nodes: [{ nodeId: "n1", nodeType: "workflow", title: "视频生成" }],
  })
  r = workflowRunReducer(r, { type: "node-failed", runId: "run-6", nodeId: "n1", endedAt: later(5000), error: "Connection timeout" })
  r = workflowRunReducer(r, { type: "run-finished", runId: "run-6", endedAt: later(5000), status: "failed", error: "Connection timeout" })
  assert.strictEqual(r!.status, "failed")
  assert.strictEqual(r!.failedCount, 1)
}

// 7 — 多节点混合状态
{
  let r = workflowRunReducer(null, {
    type: "run-started", runId: "run-7", startedAt: now(),
    nodes: [
      { nodeId: "n1", nodeType: "content", title: "文本", depth: 0 },
      { nodeId: "n2", nodeType: "workflow", title: "图片", depth: 1 },
      { nodeId: "n3", nodeType: "workflow", title: "视频", depth: 2 },
    ],
  })
  r = workflowRunReducer(r, { type: "node-started", runId: "run-7", nodeId: "n1", startedAt: now() })
  r = workflowRunReducer(r, { type: "node-succeeded", runId: "run-7", nodeId: "n1", endedAt: now() })
  r = workflowRunReducer(r, { type: "node-started", runId: "run-7", nodeId: "n2", startedAt: now() })
  r = workflowRunReducer(r, { type: "node-failed", runId: "run-7", nodeId: "n2", endedAt: now(), error: "失败" })
  r = workflowRunReducer(r, { type: "node-skipped", runId: "run-7", nodeId: "n3", reason: "上游失败" })
  r = workflowRunReducer(r, { type: "run-finished", runId: "run-7", endedAt: now(), status: "failed" })
  assert.strictEqual(r!.nodes[0].status, "success")
  assert.strictEqual(r!.nodes[1].status, "failed")
  assert.strictEqual(r!.nodes[2].status, "skipped")
  assert.strictEqual(r!.succeededCount, 1)
  assert.strictEqual(r!.failedCount, 1)
  assert.strictEqual(r!.status, "failed")
}

// 8 — runId 不匹配忽略
{
  const r = workflowRunReducer(null, {
    type: "run-started", runId: "run-8", startedAt: now(),
    nodes: [{ nodeId: "n1", nodeType: "content", title: "A" }],
  })
  const r2 = workflowRunReducer(r, { type: "node-started", runId: "run-9", nodeId: "n1", startedAt: now() })
  assert.strictEqual(r2!.nodes[0].status, "pending")
}

// 9 — null state + 非 run-started 事件 → 保持 null
{
  const r = workflowRunReducer(null, { type: "node-started", runId: "x", nodeId: "n1", startedAt: now() })
  assert.strictEqual(r, null)
}

// 10 — run-finished cancelled
{
  let r = workflowRunReducer(null, {
    type: "run-started", runId: "run-10", startedAt: now(),
    nodes: [{ nodeId: "n1", nodeType: "content", title: "C" }],
  })
  r = workflowRunReducer(r, { type: "run-finished", runId: "run-10", endedAt: now(), status: "cancelled" })
  assert.strictEqual(r!.status, "cancelled")
}

// 11 — depth 字段透传
{
  const r = workflowRunReducer(null, {
    type: "run-started", runId: "run-11", startedAt: now(),
    nodes: [
      { nodeId: "root", nodeType: "content", title: "Root", depth: 0 },
      { nodeId: "child", nodeType: "workflow", title: "Child", depth: 1 },
    ],
  })
  assert.strictEqual(r!.nodes[0].depth, 0)
  assert.strictEqual(r!.nodes[1].depth, 1)
}

// 12 — startedAt 早于 endedAt → durationMs > 0
{
  let r = workflowRunReducer(null, {
    type: "run-started", runId: "run-12", startedAt: now(),
    nodes: [{ nodeId: "n1", nodeType: "content", title: "T" }],
  })
  r = workflowRunReducer(r, { type: "node-started", runId: "run-12", nodeId: "n1", startedAt: now() })
  // Wait a tiny bit to ensure positive duration
  const end = new Date(Date.now() + 100).toISOString()
  r = workflowRunReducer(r, { type: "node-succeeded", runId: "run-12", nodeId: "n1", endedAt: end })
  assert.ok(r!.nodes[0].durationMs! >= 0, "duration 应为非负数")
  // Should be around 100ms (might be slightly different due to test execution)
  assert.ok(r!.nodes[0].durationMs! > 0 || r!.nodes[0].endedAt === undefined, "如果有 endedAt 应有正 duration")
}

// 13 — P0-2: 单节点成功运行 (run-started → node-started → node-succeeded → run-finished)
{
  const t0 = now()
  let r = workflowRunReducer(null, {
    type: "run-started", runId: "single-1", startedAt: t0,
    nodes: [{ nodeId: "n-prompt", nodeType: "content", title: "Prompt 节点", depth: 0 }],
    mode: "single-node",
  })
  assert.strictEqual(r!.mode, "single-node")
  assert.strictEqual(r!.nodes.length, 1)
  assert.strictEqual(r!.nodes[0].status, "pending")

  const t1 = later(10)
  r = workflowRunReducer(r, { type: "node-started", runId: "single-1", nodeId: "n-prompt", startedAt: t1 })
  assert.strictEqual(r!.nodes[0].status, "running")

  const t2 = later(5000)
  r = workflowRunReducer(r, { type: "node-succeeded", runId: "single-1", nodeId: "n-prompt", endedAt: t2, outputSummary: "星轨画布中转站连接成功。" })
  assert.strictEqual(r!.nodes[0].status, "success")
  assert.strictEqual(r!.nodes[0].outputSummary, "星轨画布中转站连接成功。")
  assert.strictEqual(r!.succeededCount, 1)
  assert.ok(r!.nodes[0].durationMs! > 0, "durationMs 应为正数")

  const t3 = later(5001)
  r = workflowRunReducer(r, { type: "run-finished", runId: "single-1", endedAt: t3, status: "success" })
  assert.strictEqual(r!.status, "success")
  assert.ok(r!.durationMs! > 0, "run durationMs 应为正数")
}

// 14 — P0-2: 单节点失败运行 (run-started → node-started → node-failed → run-finished)
{
  let r = workflowRunReducer(null, {
    type: "run-started", runId: "single-2", startedAt: now(),
    nodes: [{ nodeId: "n-bad", nodeType: "content", title: "错误 Key 节点", depth: 0 }],
    mode: "single-node",
  })
  r = workflowRunReducer(r, { type: "node-started", runId: "single-2", nodeId: "n-bad", startedAt: now() })
  r = workflowRunReducer(r, { type: "node-failed", runId: "single-2", nodeId: "n-bad", endedAt: later(2000), error: "API error: 401 Unauthorized" })
  assert.strictEqual(r!.nodes[0].status, "failed")
  assert.strictEqual(r!.nodes[0].error, "API error: 401 Unauthorized")
  assert.strictEqual(r!.failedCount, 1)
  assert.strictEqual(r!.succeededCount, 0)

  r = workflowRunReducer(r, { type: "run-finished", runId: "single-2", endedAt: later(2000), status: "failed", error: "API error: 401 Unauthorized" })
  assert.strictEqual(r!.status, "failed")
  assert.strictEqual(r!.error, "API error: 401 Unauthorized")
}

console.log("✅ workflowRunReducer 测试全部通过 (14 tests)")
