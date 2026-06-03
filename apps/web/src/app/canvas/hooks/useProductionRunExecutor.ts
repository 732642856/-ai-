"use client";

import { useState, useCallback, useRef } from "react";
import type { ProductionRunQueue, ProductionRunQueueTask } from "@/lib/storyboard/productionRunQueue";

// ============================================================================
// TYPES
// ============================================================================

export type ProductionTaskExecutor = (
  task: ProductionRunQueueTask,
  signal: AbortSignal,
) => Promise<void>;

export type TaskExecState = {
  status: "queued" | "preparing" | "running" | "completed" | "failed";
  error?: string;
};

export type ProductionRunExecutorOptions = {
  /** 队列实例 */
  queue: ProductionRunQueue | null;
  /** 任务执行回调 — Step 3: 映射到真实执行器 */
  onExecuteTask: ProductionTaskExecutor;
  /** 每个任务完成后的回调（用于更新 UI 状态） */
  onTaskCompleted?: (taskId: string) => void;
  /** 每个任务失败后的回调 */
  onTaskFailed?: (taskId: string, error: Error) => void;
  /** 全部完成后回调 */
  onAllCompleted?: () => void;
};

export type UseProductionRunExecutorReturn = {
  /** 是否正在执行 */
  isRunning: boolean;
  /** 开始执行队列 */
  start: () => void;
  /** 中止执行 */
  abort: () => void;
  /** 重试单个失败任务 */
  retryTask: (taskId: string) => void;
  /** 跳过单个失败任务（标记为 completed，继续后续） */
  skipTask: (taskId: string) => void;
  /** 当前错误 */
  error: string | null;
  /** 实时任务执行状态（Step 4 新增） */
  execState: Record<string, TaskExecState>;
};

// ============================================================================
// HOOK
// ============================================================================

/**
 * 生产运行队列执行器。
 *
 * 职责：
 * - 管理执行状态（idle / running）
 * - 串行遍历队列任务，逐个调用 onExecuteTask
 * - 支持中止
 * - 失败后继续执行（不中断整个队列）
 * - 记录每个任务的执行状态（execState），供 Panel 展示
 *
 * Step 4 新增：
 * - execState 实时追踪每个任务状态
 * - retryTask / skipTask 支持失败后恢复
 */
export function useProductionRunExecutor({
  queue,
  onExecuteTask,
  onTaskCompleted,
  onTaskFailed,
  onAllCompleted,
}: ProductionRunExecutorOptions): UseProductionRunExecutorReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [execState, setExecState] = useState<Record<string, TaskExecState>>({});
  const abortRef = useRef<AbortController | null>(null);
  const execStateRef = useRef(execState);
  execStateRef.current = execState;

  // 重置 execState（开始执行时）
  const resetExecState = useCallback((tasks: ProductionRunQueueTask[]) => {
    const initial: Record<string, TaskExecState> = {};
    for (const t of tasks) {
      initial[t.id] = { status: t.status === "completed" ? "completed" : "queued" };
    }
    setExecState(initial);
    execStateRef.current = initial;
  }, []);

  // 更新单个任务状态
  const updateTaskState = useCallback(
    (taskId: string, patch: Partial<TaskExecState>) => {
      setExecState((prev) => ({
        ...prev,
        [taskId]: { ...(prev[taskId] ?? { status: "queued" }), ...patch },
      }));
    },
    [],
  );

  const start = useCallback(async () => {
    if (!queue || !queue.tasks.length) return;

    const runnableTasks = queue.tasks.filter(
      (t) => t.status === "queued" || t.status === "preparing" || t.status === "failed",
    );

    if (!runnableTasks.length) {
      setError("没有可执行的任务");
      return;
    }

    setIsRunning(true);
    setError(null);
    resetExecState(queue.tasks);
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    for (let i = 0; i < runnableTasks.length; i++) {
      if (signal.aborted) break;

      const task = runnableTasks[i]!;

      // 跳过已完成的任务
      if (execStateRef.current[task.id]?.status === "completed") continue;

      updateTaskState(task.id, { status: "running", error: undefined });

      try {
        await onExecuteTask(task, signal);
        updateTaskState(task.id, { status: "completed", error: undefined });
        onTaskCompleted?.(task.id);
      } catch (err: any) {
        if (err?.name === "AbortError") {
          updateTaskState(task.id, { status: "queued" }); // 中止的任务回到 queued
          break;
        }
        const errMsg = err instanceof Error ? err.message : String(err);
        updateTaskState(task.id, { status: "failed", error: errMsg });
        onTaskFailed?.(task.id, err instanceof Error ? err : new Error(errMsg));
        // 继续执行下一个任务（不中断）
      }
    }

    setIsRunning(false);
    onAllCompleted?.();
  }, [queue, onExecuteTask, onTaskCompleted, onTaskFailed, onAllCompleted, resetExecState, updateTaskState]);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setIsRunning(false);
  }, []);

  const retryTask = useCallback(
    async (taskId: string) => {
      if (!queue) return;
      const task = queue.tasks.find((t) => t.id === taskId);
      if (!task) return;

      updateTaskState(taskId, { status: "running", error: undefined });

      try {
        // 创建新的 abort controller（单次重试）
        const controller = new AbortController();
        await onExecuteTask(task, controller.signal);
        updateTaskState(taskId, { status: "completed", error: undefined });
        onTaskCompleted?.(taskId);
      } catch (err: any) {
        const errMsg = err instanceof Error ? err.message : String(err);
        updateTaskState(taskId, { status: "failed", error: errMsg });
        onTaskFailed?.(taskId, err instanceof Error ? err : new Error(errMsg));
      }
    },
    [queue, onExecuteTask, onTaskCompleted, onTaskFailed, updateTaskState],
  );

  const skipTask = useCallback(
    (taskId: string) => {
      updateTaskState(taskId, { status: "completed", error: undefined });
      onTaskCompleted?.(taskId);
    },
    [onTaskCompleted, updateTaskState],
  );

  return { isRunning, start, abort, retryTask, skipTask, error, execState };
}
