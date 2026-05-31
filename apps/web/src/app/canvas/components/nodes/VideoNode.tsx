// ============================================================================
// VideoNode — 视频节点组件
// 支持视频预览、状态展示、AI 视频生成（预留接口）
// ============================================================================
"use client";

import { memo, useState, useRef, useCallback } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Play, Pause, Loader2, AlertTriangle } from "lucide-react";
import type { CanvasNodeData } from "../canvas/types";
import { nodeToneStyles } from "../canvas/types";

interface VideoNodeProps extends NodeProps {
  data: CanvasNodeData;
}

const VideoNode = memo(function VideoNode({ id, data, selected }: VideoNodeProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const tone = nodeToneStyles["video"] ?? { eyebrow: "#f59e0b", body: "#f59e0b/75", meta: "#f59e0b/60", border: "1px solid rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.1)" };
  const videoUrl = data.imageUrl ?? data.resultUrl ?? "";
  const status = data.status ?? "idle";
  const isGenerating = status === "running";
  const hasVideo = Boolean(videoUrl);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  return (
    <div
      className={`rounded-xl border shadow-lg min-w-[280px] max-w-[380px] overflow-hidden
        ${selected ? "ring-2 ring-purple-500/50" : ""}`}
      style={{
        background: "rgba(21, 21, 27, 0.95)",
        borderColor: isGenerating ? "#3b82f6" : status === "error" ? "#ef4444" : tone.border,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: tone.border }}>
        <div className="flex items-center gap-2">
          <span className="text-base">🎬</span>
          <span className="font-semibold text-xs" style={{ color: tone.eyebrow }}>
            {data.title || "视频节点"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {isGenerating && <Loader2 size={12} className="animate-spin" style={{ color: "#3b82f6" }} />}
          {status === "error" && <AlertTriangle size={12} style={{ color: "#ef4444" }} />}
          <span
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: status === "done" ? "rgba(34,197,94,0.15)" : "rgba(148,163,184,0.15)",
              color: status === "done" ? "#22c55e" : "#94a3b8",
            }}
          >
            {status === "done" ? "完成" : status === "error" ? "失败" : isGenerating ? "生成中" : "就绪"}
          </span>
        </div>
      </div>

      {/* Video area */}
      <div className="relative bg-black/60" style={{ aspectRatio: data.aspectRatio ?? "16/9" }}>
        {hasVideo ? (
          <>
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-contain"
              onEnded={() => setIsPlaying(false)}
              onPause={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              preload="metadata"
            />
            {/* Play overlay */}
            {!isPlaying && (
              <button
                onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center bg-black/30
                           hover:bg-black/40 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-purple-600/80 flex items-center justify-center">
                  <Play size={20} className="text-white ml-0.5" />
                </div>
              </button>
            )}
            {/* Play/Pause controls bar */}
            <div className="absolute bottom-0 left-0 right-0 px-3 py-1.5 bg-gradient-to-t from-black/70 to-transparent">
              <button
                onClick={togglePlay}
                className="text-white/80 hover:text-white transition-colors"
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              </button>
            </div>
          </>
        ) : isGenerating ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Loader2 size={24} className="animate-spin" style={{ color: "#3b82f6" }} />
            <span className="text-xs text-gray-400">正在生成视频...</span>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl mb-2">🎬</div>
              <span className="text-xs text-gray-500">暂无视频</span>
            </div>
          </div>
        )}
      </div>

      {/* Info footer */}
      <div className="px-3 py-1.5 flex items-center gap-2 text-[10px]" style={{ color: tone.meta }}>
        {data.model && <span>模型: {data.model}</span>}
        {data.duration && <span>时长: {data.duration}s</span>}
      </div>

      {/* Handles */}
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-purple-400" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-purple-400" />
    </div>
  );
});

export default VideoNode;
