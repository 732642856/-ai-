"use client";

import { Play, CheckCircle2, XCircle, AlertTriangle, Clock, Loader2, X, GripVertical } from "lucide-react";
import type { ProductionRunQueue, ProductionRunQueueTask } from "@/lib/storyboard/productionRunQueue";

// ============================================================================
// DESIGN TOKENS (与 StarCanvas designSystem 对齐)
// ============================================================================
const PANEL = {
  bg: "rgba(18, 18, 24, 0.92)",
  border: "rgba(255, 255, 255, 0.08)",
  text: "rgba(255, 255, 255, 0.92)",
  textSecondary: "rgba(255, 255, 255, 0.62)",
  textMuted: "rgba(255, 255, 255, 0.38)",
  accent: "#64748b",
  accentSoft: "rgba(100, 116, 139, 0.12)",
  successSoft: "rgba(34, 197, 94, 0.12)",
  dangerSoft: "rgba(239, 68, 68, 0.12)",
  warningSoft: "rgba(234, 179, 8, 0.12)",
  runningSoft: "rgba(59, 130, 246, 0.12)",
  card: "rgba(255, 255, 255, 0.04)",
  shadow: "0 16px 48px rgba(0, 0, 0, 0.35)",
} as const;

// ============================================================================
// STATUS HELPERS
// ============================================================================
const STATUS_LABEL: Record<string, string> = {
  queued: "排队中",
  preparing: "准备中",
  running: "运行中",
  completed: "已完成",
  failed: "部分失败",
};

const STATUS_COLOR: Record<string, string> = {
  queued: "#94a3b8",
  preparing: "#60a5fa",
  running: "#3b82f6",
  completed: "#22c55e",
  failed: "#ef4444",
};

const TASK_ACTION_LABEL: Record<string, string> = {
  "generate-storyboard-image": "生成分镜图",
  "generate-voice-track": "生成配音",
  "create-subtitle-track": "创建字幕",
  "review-handoff-warnings": "检查交接警告",
};

const TASK_STATUS_LABEL: Record<string, string> = {
  queued: "等待",
  preparing: "准备",
  running: "执行中",
  completed: "完成",
  failed: "失败",
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function TaskStatusIcon({ status }: { status: ProductionRunQueueTask["status"] }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 size={14} strokeWidth={1.8} color="#22c55e" />;
    case "failed":
      return <XCircle size={14} strokeWidth={1.8} color="#ef4444" />;
    case "running":
      return <Loader2 size={14} strokeWidth={1.8} color="#3b82f6" className="animate-spin" />;
    case "preparing":
      return <Clock size={14} strokeWidth={1.8} color="#60a5fa" />;
    default:
      return <Clock size={14} strokeWidth={1.8} color="rgba(255,255,255,0.25)" />;
  }
}

function ProgressBar({ value, color }: { value: number; color?: string }) {
  const width = `${Math.max(0, Math.min(100, value * 100))}%`;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width, backgroundColor: color ?? PANEL.accent }}
      />
    </div>
  );
}

// ============================================================================
// MAIN PANEL
// ============================================================================

export type ProductionRunQueuePanelProps = {
  queue: ProductionRunQueue;
  onClose?: () => void;
  /** 是否正在执行中（Step 2 新增） */
  isRunning?: boolean;
  /** 点击"开始生产"回调（Step 2 新增） */
  onStart?: () => void;
};

export function ProductionRunQueuePanel({ queue, onClose, isRunning, onStart }: ProductionRunQueuePanelProps) {
  const statusLabel = STATUS_LABEL[queue.status] ?? queue.status;
  const statusColor = STATUS_COLOR[queue.status] ?? PANEL.accent;
  const hasContent = queue.tasks.length > 0 || queue.blockedActions.length > 0;

  if (!hasContent) {
    return (
      <div
        data-testid="production-run-queue-panel"
        className="fixed right-6 top-20 z-50 w-80 rounded-3xl border p-6 shadow-2xl backdrop-blur-xl"
        style={{
          backgroundColor: PANEL.bg,
          borderColor: PANEL.border,
          boxShadow: PANEL.shadow,
          color: PANEL.text,
        }}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-medium" data-testid="production-run-queue-status">
            <GripVertical size={14} strokeWidth={1.5} style={{ color: PANEL.textMuted }} />
            <span>生产队列</span>
          </h3>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 transition hover:bg-white/10"
              aria-label="关闭"
            >
              <X size={14} strokeWidth={1.5} style={{ color: PANEL.textSecondary }} />
            </button>
          )}
        </div>

        {/* Empty state */}
        <div
          className="rounded-2xl p-6 text-center text-xs"
          style={{ backgroundColor: PANEL.card, color: PANEL.textMuted }}
          data-testid="production-run-queue-empty"
        >
          当前画布没有可执行的生产任务。
          <br />
          请先在分镜节点中填入画面提示词、对白或音效信息。
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="production-run-queue-panel"
      className="fixed right-6 top-20 z-50 w-80 rounded-3xl border p-6 shadow-2xl backdrop-blur-xl"
      style={{
        backgroundColor: PANEL.bg,
        borderColor: PANEL.border,
        boxShadow: PANEL.shadow,
        color: PANEL.text,
      }}
    >
      {/* ── Header ── */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium" data-testid="production-run-queue-status">
          <GripVertical size={14} strokeWidth={1.5} style={{ color: PANEL.textMuted }} />
          <span>生产队列</span>
          <span
            className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ backgroundColor: `${statusColor}28`, color: statusColor }}
          >
            {statusLabel}
          </span>
        </h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 transition hover:bg-white/10"
            aria-label="关闭"
          >
            <X size={14} strokeWidth={1.5} style={{ color: PANEL.textSecondary }} />
          </button>
        )}
      </div>

      {/* ── Progress ── */}
      <div className="mb-2">
        <ProgressBar value={queue.progress} color={statusColor} />
      </div>
      <div
        className="mb-4 flex items-center gap-3 text-xs"
        style={{ color: PANEL.textSecondary }}
        data-testid="production-run-queue-progress"
      >
        <span>
          {queue.completedTasks}/{queue.totalTasks} 完成
        </span>
        {queue.failedTasks > 0 && (
          <span style={{ color: "#ef4444" }}>{queue.failedTasks} 失败</span>
        )}
        {queue.activeTaskId && (
          <span className="flex items-center gap-1" style={{ color: "#3b82f6" }}>
            <Loader2 size={10} strokeWidth={2} className="animate-spin" />
            执行中
          </span>
        )}
      </div>

      {/* ── Active Task ── */}
      {queue.activeTaskId && (
        <div
          className="mb-3 rounded-xl p-3 text-xs"
          style={{ backgroundColor: PANEL.runningSoft }}
          data-testid="production-run-queue-active-task"
        >
          <div className="mb-1" style={{ color: PANEL.textMuted }}>
            当前任务
          </div>
          <div style={{ color: PANEL.text }}>
            {(() => {
              const active = queue.tasks.find((task) => task.id === queue.activeTaskId);
              if (!active) return null;
              return (
                <>
                  <span className="font-medium">#{active.order}</span>{" "}
                  {active.title || "—"} · {TASK_ACTION_LABEL[active.action] ?? active.action}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Task List ── */}
      {queue.tasks.length > 0 && (
        <div className="mb-3 max-h-48 overflow-y-auto">
          <div className="mb-1.5 text-[11px] font-medium" style={{ color: PANEL.textMuted }}>
            任务列表
          </div>
          <div className="space-y-1">
            {queue.tasks.map((task) => (
              <div
                key={task.id}
                data-testid="production-run-queue-task"
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition"
                style={{
                  backgroundColor: task.status === "running" ? PANEL.runningSoft : "transparent",
                }}
              >
                <TaskStatusIcon status={task.status} />
                <span style={{ color: PANEL.textSecondary }}>#{task.order}</span>
                <span
                  className="flex-1 truncate"
                  style={{
                    color: task.status === "failed" ? "#ef4444" : PANEL.text,
                    textDecoration: task.status === "failed" ? "line-through" : undefined,
                  }}
                >
                  {task.title || "—"} · {TASK_ACTION_LABEL[task.action] ?? task.action}
                </span>
                <span
                  className="text-[10px]"
                  style={{
                    color:
                      task.status === "running"
                        ? "#3b82f6"
                        : task.status === "failed"
                          ? "#ef4444"
                          : task.status === "completed"
                            ? "#22c55e"
                            : PANEL.textMuted,
                  }}
                >
                  {TASK_STATUS_LABEL[task.status] ?? task.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Blocked Actions ── */}
      {queue.blockedActions.length > 0 && (
        <div className="rounded-2xl p-4" style={{ backgroundColor: PANEL.warningSoft }}>
          <div
            className="mb-2 flex items-center gap-1.5 text-[11px] font-medium"
            style={{ color: "#facc15" }}
          >
            <AlertTriangle size={12} strokeWidth={1.8} />
            需要手动处理
          </div>
          <div className="space-y-2">
            {queue.blockedActions.map((blocked, index) => (
              <div
                key={`${blocked.shotId}-${blocked.action}-${index}`}
                data-testid="production-run-queue-blocked-action"
                className="text-xs"
                style={{ color: PANEL.textSecondary }}
              >
                <span className="font-medium" style={{ color: PANEL.text }}>
                  #{blocked.order} {blocked.title || "—"}
                </span>
                <div className="mt-0.5" style={{ color: PANEL.textMuted }}>
                  {blocked.reason}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Summary Footer ── */}
      <div
        className="mt-4 border-t pt-3 text-[11px]"
        style={{ borderColor: PANEL.border, color: PANEL.textMuted }}
      >
        {queue.tasks.length > 0 && (
          <span>
            {queue.completedTasks}/{queue.totalTasks} 可执行任务
          </span>
        )}
        {queue.tasks.length > 0 && queue.blockedActions.length > 0 && (
          <span className="mx-1.5">·</span>
        )}
        {queue.blockedActions.length > 0 && (
          <span style={{ color: "#facc15" }}>
            {queue.blockedActions.length} 阻塞项
          </span>
        )}
        {queue.status === "completed" && (
          <span className="flex items-center gap-1" style={{ color: "#22c55e" }}>
            <CheckCircle2 size={12} strokeWidth={1.8} />
            全部完成
          </span>
        )}
      </div>

      {/* ── Execution Controls (Step 2) ── */}
      {onStart && (
        <div className="mt-3 border-t pt-3" style={{ borderColor: PANEL.border }}>
          {isRunning ? (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs"
              style={{ backgroundColor: PANEL.accentSoft, color: PANEL.textSecondary }}
            >
              <Loader2 size={13} strokeWidth={1.8} className="animate-spin" />
              生产任务执行中…
            </div>
          ) : (
            <button
              type="button"
              onClick={onStart}
              disabled={queue.status === "completed"}
              data-testid="production-run-queue-start"
              className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
              style={{
                backgroundColor: "#3b82f6",
                color: "#fff",
              }}
            >
              <Play size={13} strokeWidth={2} fill="currentColor" />
              一键开始生产
            </button>
          )}
        </div>
      )}
    </div>
  );
}
