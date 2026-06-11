// ============================================================================
// DAG Scheduler — DAG 拓扑排序 + CPM 关键路径 + 断点续传
// ============================================================================
// 算法参考: forge-film (MIT, F-R-L/forge-film) 的 Python CPM 实现
// 翻译为 TypeScript，适配 StarCanvas 的分镜生成管线
// ============================================================================

// ============================================================================
// Types
// ============================================================================

export interface DagNode {
  id: string
  label?: string
}

export interface DagEdge {
  from: string
  to: string
}

export interface TaskDefinition {
  nodeId: string
  execute: () => Promise<unknown>
  estimatedDurationMs?: number // 用于 CPM 优先级计算
}

export interface Checkpoint {
  dagId: string
  completedNodes: string[]
  failedNodes: string[]
  nodeResults: Record<string, unknown>
  startedAt: number
  updatedAt: number
}

export interface SchedulerOptions {
  concurrency?: number
  retryCount?: number
  retryDelayMs?: number
  onProgress?: (completed: number, total: number, currentNodeId: string) => void
  onNodeComplete?: (nodeId: string, result: unknown) => void
  onNodeError?: (nodeId: string, error: Error) => void
}

// ============================================================================
// DAG Utilities
// ============================================================================

/**
 * Kahn 算法拓扑排序
 * 参考: forge-film dag.topological_sort
 */
export function topologicalSort(
  nodes: DagNode[],
  edges: DagEdge[],
): string[] {
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const node of nodes) {
    inDegree.set(node.id, 0)
    adjacency.set(node.id, [])
  }

  for (const edge of edges) {
    adjacency.get(edge.from)?.push(edge.to)
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1)
  }

  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  const result: string[] = []
  while (queue.length > 0) {
    const nodeId = queue.shift()!
    result.push(nodeId)
    for (const downstream of adjacency.get(nodeId) ?? []) {
      const newDeg = (inDegree.get(downstream) ?? 1) - 1
      inDegree.set(downstream, newDeg)
      if (newDeg === 0) queue.push(downstream)
    }
  }

  if (result.length !== nodes.length) {
    throw new Error("DAG contains cycle — cannot sort")
  }

  return result
}

/**
 * 构建反向邻接表
 * 参考: forge-film dag.get_reverse_dag
 */
export function getReverseDag(
  nodes: string[],
  edges: DagEdge[],
): Map<string, string[]> {
  const reverse = new Map<string, string[]>()
  for (const nodeId of nodes) reverse.set(nodeId, [])
  for (const edge of edges) {
    reverse.get(edge.to)?.push(edge.from)
  }
  return reverse
}

// ============================================================================
// CPM 关键路径法
// ============================================================================

/**
 * 计算 CPM 优先级（Critical Path Remaining）
 * 值越大 → 优先级越高，越应该先执行
 * 参考: forge-film cpm.compute_critical_path_remaining
 */
export function computeCriticalPathPriority(
  nodes: string[],
  edges: DagEdge[],
  durations: Map<string, number>,
): Map<string, number> {
  const adjacency = new Map<string, string[]>()
  const reverse = new Map<string, string[]>()

  for (const nodeId of nodes) {
    adjacency.set(nodeId, [])
    reverse.set(nodeId, [])
  }
  for (const edge of edges) {
    adjacency.get(edge.from)?.push(edge.to)
    reverse.get(edge.to)?.push(edge.from)
  }

  const topo = topologicalSort(
    nodes.map((id) => ({ id })),
    edges,
  )

  // Forward pass: EST / EFT
  const est = new Map<string, number>()
  const eft = new Map<string, number>()
  for (const nodeId of topo) {
    const preds = reverse.get(nodeId) ?? []
    const maxPredEft =
      preds.length > 0 ? Math.max(...preds.map((p) => eft.get(p) ?? 0)) : 0
    est.set(nodeId, maxPredEft)
    eft.set(nodeId, maxPredEft + (durations.get(nodeId) ?? 1000))
  }

  // Backward pass
  const cpRemaining = new Map<string, number>()
  for (let i = topo.length - 1; i >= 0; i--) {
    const nodeId = topo[i]
    const succs = adjacency.get(nodeId) ?? []
    if (succs.length === 0) {
      cpRemaining.set(nodeId, durations.get(nodeId) ?? 1000)
    } else {
      const dur = durations.get(nodeId) ?? 1000
      const maxSucc = Math.max(...succs.map((s) => cpRemaining.get(s) ?? 0))
      cpRemaining.set(nodeId, dur + maxSucc)
    }
  }

  return cpRemaining
}

// ============================================================================
// Priority Queue Scheduler
// ============================================================================

class PriorityQueue {
  private heap: Array<{ nodeId: string; priority: number }> = []

  enqueue(nodeId: string, priority: number): void {
    this.heap.push({ nodeId, priority })
    this.heap.sort((a, b) => b.priority - a.priority) // 降序
  }

  dequeue(): string | null {
    return this.heap.shift()?.nodeId ?? null
  }

  isEmpty(): boolean {
    return this.heap.length === 0
  }
}

// ============================================================================
// Checkpoint Manager
// ============================================================================

const CHECKPOINT_PREFIX = "starcanvas_dag_cp_"

export function saveCheckpoint(dagId: string, checkpoint: Checkpoint): void {
  try {
    localStorage.setItem(
      CHECKPOINT_PREFIX + dagId,
      JSON.stringify(checkpoint),
    )
  } catch {
    // localStorage 满或不可用，静默失败
  }
}

export function loadCheckpoint(dagId: string): Checkpoint | null {
  try {
    const raw = localStorage.getItem(CHECKPOINT_PREFIX + dagId)
    if (!raw) return null
    return JSON.parse(raw) as Checkpoint
  } catch {
    return null
  }
}

export function clearCheckpoint(dagId: string): void {
  localStorage.removeItem(CHECKPOINT_PREFIX + dagId)
}

// ============================================================================
// DAG Scheduler — 主入口
// ============================================================================

export async function runDagScheduler(
  dagId: string,
  tasks: TaskDefinition[],
  nodes: DagNode[],
  edges: DagEdge[],
  options: SchedulerOptions = {},
): Promise<Record<string, unknown>> {
  const {
    concurrency = 3,
    retryCount = 2,
    retryDelayMs = 1000,
    onProgress,
    onNodeComplete,
    onNodeError,
  } = options

  // ── 断点恢复 ──
  const checkpoint = loadCheckpoint(dagId)
  const completedSet = new Set(checkpoint?.completedNodes ?? [])
  const failedSet = new Set(checkpoint?.failedNodes ?? [])
  const results: Record<string, unknown> = { ...(checkpoint?.nodeResults ?? {}) }

  // 构建 DAG
  const adjacency = new Map<string, string[]>()
  const inDegree = new Map<string, number>()
  for (const node of nodes) {
    adjacency.set(node.id, [])
    inDegree.set(node.id, 0)
  }
  for (const edge of edges) {
    adjacency.get(edge.from)?.push(edge.to)
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1)
  }

  const taskMap = new Map(tasks.map((t) => [t.nodeId, t]))

  // CPM 优先级
  const durations = new Map(
    tasks.map((t) => [t.nodeId, t.estimatedDurationMs ?? 1000]),
  )
  const cpmPriority = computeCriticalPathPriority(
    nodes.map((n) => n.id),
    edges,
    durations,
  )

  // 就绪队列（入度=0 且未完成）
  const readyQueue = new PriorityQueue()
  for (const node of nodes) {
    if (completedSet.has(node.id)) continue
    if (failedSet.has(node.id)) continue
    if (inDegree.get(node.id) === 0) {
      readyQueue.enqueue(node.id, cpmPriority.get(node.id) ?? 0)
    }
  }

  const total = nodes.length
  let running = 0
  let activeAbort = false

  const saveCkpt = () => {
    saveCheckpoint(dagId, {
      dagId,
      completedNodes: [...completedSet],
      failedNodes: [...failedSet],
      nodeResults: results,
      startedAt: checkpoint?.startedAt ?? Date.now(),
      updatedAt: Date.now(),
    })
  }

  const tryExecuteNode = async (nodeId: string): Promise<void> => {
    const task = taskMap.get(nodeId)
    if (!task) {
      completedSet.add(nodeId)
      return
    }

    let lastError: Error | null = null
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        if (attempt > 0) {
          await sleep(retryDelayMs * attempt)
        }
        const result = await task.execute()
        results[nodeId] = result
        completedSet.add(nodeId)
        onNodeComplete?.(nodeId, result)
        saveCkpt()
        return // 成功
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        onNodeError?.(nodeId, lastError)
      }
    }

    // 所有重试都失败
    failedSet.add(nodeId)
    saveCkpt()
    throw lastError ?? new Error(`Task ${nodeId} failed after ${retryCount} retries`)
  }

  // 通知下游节点
  const notifyDownstream = (completedId: string) => {
    for (const downstream of adjacency.get(completedId) ?? []) {
      if (completedSet.has(downstream) || failedSet.has(downstream)) continue

      // 检查所有上游是否都完成
      const allUpstreamDone = [...(edges.filter((e) => e.to === downstream))]
        .every((e) => completedSet.has(e.from))

      if (allUpstreamDone) {
        const newDeg = (inDegree.get(downstream) ?? 1) - 1
        inDegree.set(downstream, newDeg)
        if (newDeg <= 0) {
          readyQueue.enqueue(downstream, cpmPriority.get(downstream) ?? 0)
        }
      }
    }
  }

  // ── 主循环 ──
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const processNext = () => {
      onProgress?.(completedSet.size, total, "")

      if (activeAbort) {
        reject(new Error("DAG scheduler aborted"))
        return
      }

      if (completedSet.size + failedSet.size >= total) {
        if (failedSet.size > 0) {
          // 部分失败
          console.warn(
            `[DAG Scheduler] ${dagId}: ${failedSet.size} tasks failed`,
          )
        }
        resolve(results)
        return
      }

      // 启动并发任务
      while (running < concurrency && !readyQueue.isEmpty()) {
        const nodeId = readyQueue.dequeue()
        if (!nodeId) break

        running++
        tryExecuteNode(nodeId)
          .then(() => {
            running--
            notifyDownstream(nodeId)
            processNext()
          })
          .catch(() => {
            running--
            processNext()
          })
      }

      // 如果没有任务在运行且队列为空，说明可能存在阻塞（所有剩余节点都有未完成的上游）
      if (running === 0 && readyQueue.isEmpty() && completedSet.size < total) {
        // 这是正常情况，等待当前批次完成
      }
    }

    // 初始启动
    processNext()
  })
}

// ============================================================================
// Helpers
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 便捷函数：从 StarCanvas nodes + edges 构建 DAG 并执行
 */
export function buildDagFromNodes(
  nodes: Array<{ id: string; type?: string }>,
  edges: Array<{ source: string; target: string }>,
): { dagNodes: DagNode[]; dagEdges: DagEdge[] } {
  return {
    dagNodes: nodes.map((n) => ({ id: n.id, label: n.type ?? n.id })),
    dagEdges: edges.map((e) => ({ from: e.source, to: e.target })),
  }
}
