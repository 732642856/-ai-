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

export type ProductionRunExecutorOptions = {
  /** 队列实例 */
  queue: ProductionRunQueue | null;
  /** 任务执行回调 — Step 2: placeholder 模式，Step 3: 映射到真实执行器 */
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
  /** 当前错误 */
  error: string | null;
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
 * - 报告进度给回调
 *
 * Step 2 使用 placeholder executor（直接标记完成），
 * Step 3 替换为真实 image/TTS/subtitle executor 映射。
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
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(async () => {
    if (!queue || !queue.tasks.length) return;

    const runnableTasks = queue.tasks.filter(
      (t) => t.status === "queued" || t.status === "preparing",
    );

    if (!runnableTasks.length) {
      setError("没有可执行的任务");
      return;
    }

    setIsRunning(true);
    setError(null);
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    for (let i = 0; i < runnableTasks.length; i++) {
      if (signal.aborted) break;

      const task = runnableTasks[i]!;

      try {
        await onExecuteTask(task, signal);
        onTaskCompleted?.(task.id);
      } catch (err: any) {
        if (err?.name === "AbortError") break;
        onTaskFailed?.(task.id, err instanceof Error ? err : new Error(String(err)));
      }
    }

    setIsRunning(false);
    onAllCompleted?.();
  }, [queue, onExecuteTask, onTaskCompleted, onTaskFailed, onAllCompleted]);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setIsRunning(false);
  }, []);

  return { isRunning, start, abort, error };
}
