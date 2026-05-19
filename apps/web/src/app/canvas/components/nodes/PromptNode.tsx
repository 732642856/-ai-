// ============================================================================
// Prompt Node Component - Display and edit prompts
// ============================================================================
"use client"

import { memo, useState, useEffect } from "react"
import { Sparkles } from "lucide-react"
import { Handle, Position, NodeResizer, type NodeProps, useReactFlow } from "@xyflow/react"
import { DESIGN_TOKENS, ICON_CONFIG } from "../../styles/designSystem"
import type { CanvasNodeData } from "../canvas/types"

interface PromptNodeProps extends NodeProps {
  data: CanvasNodeData & {
    title?: string
    prompt?: string
    negativePrompt?: string
  }
}

export const PromptNode = memo(function PromptNode({ id, data, selected }: PromptNodeProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(data.title || "")
  const [editPrompt, setEditPrompt] = useState(data.prompt || "")
  const { setNodes } = useReactFlow()

  const title = data.title || "Prompt"
  const prompt = data.prompt || ""
  const negativePrompt = data.negativePrompt

  // Sync local state when data changes externally
  useEffect(() => {
    if (!isEditing) {
      setEditTitle(data.title || "")
      setEditPrompt(data.prompt || "")
    }
  }, [data.title, data.prompt, isEditing])

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditing(true)
  }

  const handleSave = () => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id !== id) return node
        return {
          ...node,
          data: {
            ...node.data,
            title: editTitle,
            prompt: editPrompt,
          },
        }
      })
    )
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditTitle(data.title || "")
    setEditPrompt(data.prompt || "")
    setIsEditing(false)
  }

  return (
    <>
      {/* Resizer */}
      {selected && (
        <NodeResizer
          minWidth={200}
          minHeight={120}
          handleStyle={{ background: DESIGN_TOKENS.nodeHandle, border: "2px solid rgba(255,255,255,0.5)", borderRadius: "4px" }}
          lineStyle={{ stroke: DESIGN_TOKENS.nodeHandle, strokeWidth: 2, strokeDasharray: "6 3" }}
        />
      )}

      {/* Connection Handles */}
      <Handle type="target" position={Position.Top} className="!bg-slate-400 !h-3 !w-3 !rounded-sm !border-2 !border-white/50" />
      <Handle type="target" position={Position.Left} className="!bg-slate-400 !h-3 !w-3 !rounded-sm !border-2 !border-white/50" />
      <Handle type="source" position={Position.Right} className="!bg-slate-500 !h-3 !w-3 !rounded-sm !border-2 !border-white/50" />
      <Handle type="source" position={Position.Bottom} className="!bg-slate-500 !h-3 !w-3 !rounded-sm !border-2 !border-white/50" />

      {/* Node Content */}
        <div
          className={`overflow-hidden rounded-2xl border transition-all ${
            selected
              ? "border-slate-400/60 shadow-lg shadow-slate-500/20"
              : "border-white/10 hover:border-white/20"
          }`}
          onDoubleClick={handleDoubleClick}
          style={{
            width: 320,
            minHeight: 160,
            background: "linear-gradient(145deg, rgba(30,41,59,0.42) 0%, rgba(16,18,34,0.92) 100%)",
            boxShadow: selected ? DESIGN_TOKENS.shadowNode : "none",
          }}
        >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-white/10 bg-black/20 px-4 py-3">
          <Sparkles size={15} strokeWidth={ICON_CONFIG.strokeWidth} style={{ color: DESIGN_TOKENS.accentHover }} />
          <span className="truncate text-xs font-medium uppercase tracking-wider">
            {isEditing ? "编辑 Prompt" : title}
          </span>
        </div>

        {/* Content */}
        <div className="p-4">
          {isEditing ? (
            <div className="space-y-3">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="标题"
                className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-slate-400 focus:outline-none"
                autoFocus
              />
              <textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder="输入 Prompt..."
                className="w-full resize-none rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-slate-400 focus:outline-none"
                rows={4}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleCancel}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/20"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  className="rounded-lg bg-slate-500 px-3 py-1.5 text-xs text-white hover:bg-slate-400"
                >
                  保存
                </button>
              </div>
            </div>
          ) : (
            <div>
              {prompt ? (
                <p className="line-clamp-5 text-sm leading-relaxed text-white/80">{prompt}</p>
              ) : (
                <p className="text-sm text-white/30">双击编辑 Prompt</p>
              )}
              {negativePrompt && (
                <div className="mt-3 border-t border-white/10 pt-3">
                  <p className="text-[10px] uppercase tracking-wider text-white/30">Negative</p>
                  <p className="mt-1 line-clamp-2 text-xs text-white/50">{negativePrompt}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer hint */}
        {selected && !isEditing && (
          <div className="border-t border-white/10 bg-black/20 px-4 py-2">
            <p className="text-[9px] uppercase tracking-wider text-white/30">
              双击编辑 · 右键菜单
            </p>
          </div>
        )}
      </div>
    </>
  )
})

export default PromptNode
