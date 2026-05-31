// ============================================================================
// Agent Node Component — DirectorAgent
// Phase 1: 剧本 → 结构化分镜 JSON（流式输出到节点内）
// Phase 2: 自动编排 — JSON → 画布节点链
// Phase 2.5: 桥接画布回调 — 运行按钮直连 useWorkflowRunner
// ============================================================================
"use client";

import { memo, useCallback } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { CanvasNodeData } from "../canvas/types";

export interface AgentNodeProps extends NodeProps {
  data: CanvasNodeData;
  onRunAgent?: (nodeId: string) => void;
  onBatchGenerate?: (nodeIds: string[]) => void;
}

const STATUS_UI: Record<string, { dot: string; label: string; bg: string; text: string }> = {
  idle: { dot: "bg-gray-400", label: "待命", bg: "#f3f4f6", text: "#6b7280" },
  running: { dot: "bg-blue-500 animate-pulse", label: "分析中", bg: "#fef3c7", text: "#92400e" },
  done: { dot: "bg-green-500", label: "完成", bg: "#d1fae5", text: "#065f46" },
  error: { dot: "bg-red-500", label: "错误", bg: "#fee2e2", text: "#991b1b" },
};

const AgentNode = memo(function AgentNode({ id, data, selected, onRunAgent, onBatchGenerate }: AgentNodeProps) {
  const content = data.content ?? "";
  const agentStatus = (data as Record<string, unknown>).agentStatus as string | undefined;
  const agentOutput = (data as Record<string, unknown>).agentOutput as string | undefined;
  const childNodeIds = (data as Record<string, unknown>)._childNodeIds as string[] | undefined;
  const batchProgress = (data as Record<string, unknown>)._batchProgress as string | undefined;
  const isRunning = agentStatus === "running";
  const status = STATUS_UI[agentStatus ?? "idle"] ?? STATUS_UI.idle;

  const handleRun = useCallback(() => {
    onRunAgent?.(id);
  }, [id, onRunAgent]);

  return (
    <div
      className={`
        min-w-[320px] max-w-[420px] rounded-xl border-2 bg-white shadow-lg
        ${selected ? "border-purple-500" : "border-purple-200"}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-purple-50 rounded-t-xl">
        <div className="flex items-center gap-2">
          <span className="text-lg">&#x1F3AC;</span>
          <span className="font-semibold text-sm text-purple-900">Director Agent</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status.dot}`} />
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: status.bg, color: status.text }}
          >
            {status.label}
          </span>
        </div>
      </div>

      {/* Input */}
      <div className="px-3 py-2">
        <label className="text-xs font-medium text-gray-500 mb-1 block">
          剧本 / 故事文本
        </label>
        <textarea
          className="w-full h-24 text-sm p-2 border rounded-lg resize-none
                     focus:outline-none focus:ring-2 focus:ring-purple-300
                     bg-gray-50"
          placeholder="粘贴剧本或故事文本..."
          defaultValue={content}
          disabled={isRunning}
        />
      </div>

      {/* Run button */}
      <div className="px-3 py-2">
        <button
          onClick={handleRun}
          disabled={isRunning || !content.trim()}
          className="w-full py-1.5 rounded-lg text-sm font-medium transition-all
                     bg-purple-600 text-white hover:bg-purple-700
                     disabled:bg-gray-300 disabled:cursor-not-allowed disabled:text-gray-500"
        >
          {isRunning ? "⏳ 分析中..." : "🚀 运行分析"}
        </button>
      </div>

      {/* Output */}
      {agentOutput && (
        <div className="px-3 py-2 border-t border-purple-100">
          <label className="text-xs font-medium text-gray-500 mb-1 block">
            分析结果
          </label>
          <pre className="text-xs bg-purple-50 p-2 rounded-lg overflow-auto max-h-60
                          whitespace-pre-wrap break-words text-purple-900">
            {agentOutput}
          </pre>
        </div>
      )}

      {/* Batch generate — appears after analysis completes and child nodes exist */}
      {agentStatus === "done" && childNodeIds && childNodeIds.length > 0 && (
        <div className="px-3 pt-1 pb-2">
          {/* Mini progress bar + fraction */}
          {batchProgress && (
            <div className="mb-2 bg-gray-100 rounded-lg p-1.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600">
                  🖼️ {batchProgress}
                </span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      (parseInt(batchProgress.split("/")[0] || "0") /
                        parseInt(batchProgress.split("/")[1] || "1")) * 100,
                      100,
                    )}%`,
                    background:
                      "linear-gradient(90deg, #3b82f6, #8b5cf6)",
                  }}
                />
              </div>
            </div>
          )}
          <button
            onClick={() => onBatchGenerate?.(childNodeIds)}
            disabled={!!batchProgress}
            className="w-full rounded-lg px-3 py-2 text-xs font-medium transition-all
                       bg-gradient-to-r from-purple-500 to-indigo-500 text-white
                       hover:from-purple-600 hover:to-indigo-600
                       disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed"
          >
            {batchProgress ? `正在生成... ${batchProgress}` : `批量生图 (${childNodeIds.length} 个分镜)`}
          </button>
        </div>
      )}

      {/* Handles */}
      <Handle type="target" position={Position.Top} className="!bg-purple-400" />
      <Handle type="source" position={Position.Bottom} className="!bg-purple-400" />
    </div>
  );
});

export default AgentNode;
