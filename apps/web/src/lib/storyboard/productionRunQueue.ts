import type { ProjectPackageProductionRunManifest } from "./projectPackageManifest";

export type ProductionRunQueueStatus = "queued" | "preparing" | "running" | "completed" | "failed";

export type ProductionRunQueueTaskStatus =
  | "queued"
  | "preparing"
  | "running"
  | "completed"
  | "failed";

export type ProductionRunQueueAction =
  | "generate-storyboard-image"
  | "generate-voice-track"
  | "create-subtitle-track"
  | "review-handoff-warnings";

export type ProductionRunQueueBlockedAction = {
  shotId: string;
  order: number;
  title: string;
  action: string;
  reason: string;
};

export type ProductionRunQueueTask = {
  id: string;
  shotId: string;
  order: number;
  title: string;
  action: ProductionRunQueueAction;
  status: ProductionRunQueueTaskStatus;
  progress: number;
  error?: string;
};

export type ProductionRunQueue = {
  jobId: string;
  status: ProductionRunQueueStatus;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  progress: number;
  activeTaskId?: string;
  tasks: ProductionRunQueueTask[];
  blockedActions: ProductionRunQueueBlockedAction[];
};

export type BuildProductionRunQueueOptions = {
  jobId?: string;
};

const EXECUTABLE_ACTIONS = new Set<ProductionRunQueueAction>([
  "generate-storyboard-image",
  "generate-voice-track",
  "create-subtitle-track",
  "review-handoff-warnings",
]);

const BLOCKED_ACTION_REASONS: Record<string, string> = {
  "add-visual-prompt": "Shot needs a visual prompt before automatic production can run.",
};

function isExecutableAction(action: string): action is ProductionRunQueueAction {
  return EXECUTABLE_ACTIONS.has(action as ProductionRunQueueAction);
}

function normalizeProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function buildTaskId(shotId: string, action: string): string {
  return `${shotId}:${action}`;
}

function recomputeQueue(queue: ProductionRunQueue): ProductionRunQueue {
  const completedTasks = queue.tasks.filter((task) => task.status === "completed").length;
  const failedTasks = queue.tasks.filter((task) => task.status === "failed").length;
  const activeTask = queue.tasks.find((task) => task.status === "running" || task.status === "preparing");
  const totalProgress = queue.tasks.reduce((sum, task) => sum + normalizeProgress(task.progress), 0);
  const progress = queue.tasks.length > 0 ? totalProgress / queue.tasks.length : 1;
  const allSettled = queue.tasks.every((task) => task.status === "completed" || task.status === "failed");
  const status: ProductionRunQueueStatus = failedTasks > 0
    ? "failed"
    : activeTask?.status === "running"
      ? "running"
      : activeTask?.status === "preparing"
        ? "preparing"
        : allSettled
          ? "completed"
          : "queued";

  return {
    ...queue,
    status,
    completedTasks,
    failedTasks,
    progress,
    activeTaskId: activeTask?.id,
  };
}

function updateTask(
  queue: ProductionRunQueue,
  taskId: string,
  updater: (task: ProductionRunQueueTask) => ProductionRunQueueTask,
): ProductionRunQueue {
  return recomputeQueue({
    ...queue,
    tasks: queue.tasks.map((task) => (task.id === taskId ? updater(task) : task)),
  });
}

export function buildProductionRunQueue(
  manifest: ProjectPackageProductionRunManifest,
  options: BuildProductionRunQueueOptions = {},
): ProductionRunQueue {
  const tasks: ProductionRunQueueTask[] = [];
  const blockedActions: ProductionRunQueueBlockedAction[] = [];

  for (const plan of manifest.productionRunPlan) {
    for (const action of plan.nextActions) {
      if (isExecutableAction(action)) {
        tasks.push({
          id: buildTaskId(plan.shotId, action),
          shotId: plan.shotId,
          order: plan.order,
          title: plan.title,
          action,
          status: "queued",
          progress: 0,
        });
        continue;
      }

      blockedActions.push({
        shotId: plan.shotId,
        order: plan.order,
        title: plan.title,
        action,
        reason: BLOCKED_ACTION_REASONS[action] ?? "Action requires manual preparation before it can run automatically.",
      });
    }
  }

  return recomputeQueue({
    jobId: options.jobId ?? "production-run-queue",
    status: tasks.length > 0 ? "queued" : "completed",
    totalTasks: tasks.length,
    completedTasks: 0,
    failedTasks: 0,
    progress: tasks.length > 0 ? 0 : 1,
    tasks,
    blockedActions,
  });
}

export function getNextQueuedTask(queue: ProductionRunQueue): ProductionRunQueueTask | undefined {
  return queue.tasks.find((task) => task.status === "queued");
}

export function prepareProductionRunTask(queue: ProductionRunQueue, taskId = getNextQueuedTask(queue)?.id): ProductionRunQueue {
  if (!taskId) return recomputeQueue(queue);

  return updateTask(queue, taskId, (task) => ({
    ...task,
    status: task.status === "queued" ? "preparing" : task.status,
    progress: task.status === "queued" ? Math.max(task.progress, 0.05) : task.progress,
    error: undefined,
  }));
}

export function startProductionRunTask(queue: ProductionRunQueue, taskId = queue.activeTaskId ?? getNextQueuedTask(queue)?.id): ProductionRunQueue {
  if (!taskId) return recomputeQueue(queue);

  return updateTask(queue, taskId, (task) => ({
    ...task,
    status: task.status === "completed" || task.status === "failed" ? task.status : "running",
    progress: task.status === "completed" ? task.progress : Math.max(task.progress, 0.1),
    error: undefined,
  }));
}

export function updateProductionRunTaskProgress(
  queue: ProductionRunQueue,
  taskId: string,
  progress: number,
): ProductionRunQueue {
  return updateTask(queue, taskId, (task) => ({
    ...task,
    progress: task.status === "completed" ? 1 : normalizeProgress(progress),
  }));
}

export function completeProductionRunTask(queue: ProductionRunQueue, taskId: string): ProductionRunQueue {
  return updateTask(queue, taskId, (task) => ({
    ...task,
    status: "completed",
    progress: 1,
    error: undefined,
  }));
}

export function failProductionRunTask(queue: ProductionRunQueue, taskId: string, error: string): ProductionRunQueue {
  return updateTask(queue, taskId, (task) => ({
    ...task,
    status: "failed",
    progress: normalizeProgress(task.progress),
    error: error.trim() || "Production task failed.",
  }));
}
