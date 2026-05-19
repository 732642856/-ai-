// ============================================================================
// Image Node Component - Display uploaded/generated images
// ============================================================================
"use client"

import { memo, useState, useEffect, useCallback } from "react"
import { AlertTriangle } from "lucide-react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import type { CanvasNodeData } from "../canvas/types"

// Global registry for hover events
type ImageHoverHandlers = {
  onMouseEnter: (nodeId: string, event: MouseEvent) => void
  onMouseLeave: () => void
}

const imageHoverRegistry: Record<string, ImageHoverHandlers> = {}

export function registerImageHoverHandlers(nodeId: string, handlers: ImageHoverHandlers) {
  imageHoverRegistry[nodeId] = handlers
}

export function unregisterImageHoverHandlers(nodeId: string) {
  delete imageHoverRegistry[nodeId]
}

interface ImageNodeProps extends NodeProps {
  data: CanvasNodeData & {
    imageUrl?: string
    assetUrl?: string
    fileName?: string
    fileSize?: number
    title?: string
  }
}

export const ImageNode = memo(function ImageNode({ id, data, selected }: ImageNodeProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const imageUrl = data.imageUrl || data.assetUrl || ""
  const fileName = data.fileName || data.title || "图片"
  const displayWidth = data.displayWidth ?? 280
  const displayHeight = data.displayHeight ?? 200

  // Cleanup registry on unmount
  useEffect(() => {
    return () => {
      unregisterImageHoverHandlers(id)
    }
  }, [id])

  // Handle image load
  const handleImageLoad = () => {
    setIsLoading(false)
  }

  const handleImageError = () => {
    setIsLoading(false)
    setHasError(true)
  }

  // Hover handlers
  const hoverHandlers = imageHoverRegistry[id]

  const handleMouseEnter = useCallback(
    (event: React.MouseEvent) => {
      if (hoverHandlers) {
        hoverHandlers.onMouseEnter(id, event.nativeEvent)
      }
    },
    [hoverHandlers, id]
  )

  const handleMouseLeave = useCallback(
    (event: React.MouseEvent) => {
      if (hoverHandlers) {
        hoverHandlers.onMouseLeave()
      }
    },
    [hoverHandlers]
  )

  return (
    <>
      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-slate-400 !h-3 !w-3 !rounded-sm !border-2 !border-white/50"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-slate-400 !h-3 !w-3 !rounded-sm !border-2 !border-white/50"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-slate-500 !h-3 !w-3 !rounded-sm !border-2 !border-white/50"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-slate-500 !h-3 !w-3 !rounded-sm !border-2 !border-white/50"
      />

      {/* Node Content */}
      <div
        className="relative rounded-[18px] transition-all"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ width: displayWidth }}
      >
        <div className="mb-1.5 max-w-full truncate px-1 text-[11px] leading-4 text-white/55 drop-shadow-sm">
          {fileName}
        </div>

        <div
          className={`relative flex items-center justify-center overflow-hidden rounded-[16px] bg-white transition-all ${
            selected
              ? "ring-2 ring-slate-200/80 shadow-xl shadow-black/30"
              : "ring-1 ring-white/12 shadow-lg shadow-black/20 hover:ring-white/24"
          }`}
          style={{ width: displayWidth, height: displayHeight }}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/12">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/25 border-t-white/75" />
            </div>
          )}

          {hasError ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-black/20 text-white/45">
              <AlertTriangle size={34} strokeWidth={1.5} />
              <span className="text-xs">图片加载失败</span>
            </div>
          ) : (
            <img
              src={imageUrl}
              alt={fileName}
              className={`h-full w-full object-contain transition-opacity ${isLoading ? "opacity-0" : "opacity-100"}`}
              draggable={false}
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          )}
        </div>
      </div>
    </>
  )
})

export default ImageNode
