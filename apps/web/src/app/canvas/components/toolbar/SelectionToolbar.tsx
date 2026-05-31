// ============================================================================
// SelectionToolbar — 多节点框选后浮动批量操作面板
// 当 ≥2 个节点被选中时，在选区上方显示操作气泡
// ============================================================================
"use client";

import { Image, FileText, LayoutGrid } from "lucide-react";

interface SelectionToolbarProps {
  selectedCount: number;
  onBatchGenerate: () => void;
  onMergeText: () => void;
  onAutoLayout: () => void;
}

export default function SelectionToolbar({
  selectedCount,
  onBatchGenerate,
  onMergeText,
  onAutoLayout,
}: SelectionToolbarProps) {
  if (selectedCount < 2) return null;

  return (
    <div
      className="absolute top-16 left-1/2 -translate-x-1/2 z-40"
      style={{ pointerEvents: "auto" }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-xl border shadow-xl backdrop-blur-xl"
        style={{
          backgroundColor: "rgba(21, 21, 27, 0.95)",
          borderColor: "rgba(168, 85, 247, 0.3)",
        }}
      >
        <span className="text-xs text-purple-400 font-medium mr-1">
          已选 {selectedCount} 个
        </span>
        <div className="w-px h-4 bg-purple-500/20" />
        <button
          onClick={onBatchGenerate}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
                     transition-colors hover:bg-white/10"
          style={{ color: "#e2e8f0" }}
        >
          <Image size={12} />
          批量生图
        </button>
        <button
          onClick={onMergeText}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
                     transition-colors hover:bg-white/10"
          style={{ color: "#e2e8f0" }}
        >
          <FileText size={12} />
          合并文本
        </button>
        <button
          onClick={onAutoLayout}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
                     transition-colors hover:bg-white/10"
          style={{ color: "#e2e8f0" }}
        >
          <LayoutGrid size={12} />
          自动布局
        </button>
      </div>
    </div>
  );
}
