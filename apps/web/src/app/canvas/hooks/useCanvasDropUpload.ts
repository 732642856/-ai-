/**
 * useCanvasDropUpload - 拖拽图片到画布
 * 支持：
 * - 从桌面拖拽图片到画布
 * - 多图同时拖入
 * - 视觉反馈 overlay
 */

import { useCallback, useState, type DragEvent } from "react"
import { useReactFlow } from "@xyflow/react"
import type { Node } from "@xyflow/react"
import { generateId } from "../utils/generateId"

const DEBUG_DROP = typeof window !== "undefined" && window.localStorage.getItem("DEBUG_DROP_UPLOAD") === "1"

export interface ImageFileMeta {
  id: string
  file: File
  src: string
  name: string
  size: number
  mimeType: string
  width: number
  height: number
  aspectRatio: number
}

export interface DropPosition {
  x: number
  y: number
}

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
const IMAGE_NODE_TITLE_HEIGHT = 22
const IMAGE_NODE_SIZE = {
  minWidth: 120,
  minHeight: 96,
  maxWidth: 220,
  maxHeight: 180,
}

export function useCanvasDropUpload(
  setNodes: (updater: (nodes: Node[]) => Node[]) => void,
  dismissCanvasHint?: () => void
) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [dragError, setDragError] = useState<string | null>(null)
  const reactFlow = useReactFlow()

  // 读取图片文件元数据。注意：这里只控制画布展示尺寸，不压缩、不改写用户原图。
  const readImageFile = useCallback(async (file: File): Promise<ImageFileMeta> => {
    if (!file.type.startsWith("image/")) {
      throw new Error("不是图片文件")
    }

    const src = URL.createObjectURL(file)
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image()
      image.onload = () => {
        resolve({ width: image.naturalWidth, height: image.naturalHeight })
      }
      image.onerror = () => {
        URL.revokeObjectURL(src)
        reject(new Error("图片加载失败"))
      }
      image.src = src
    })

    const meta: ImageFileMeta = {
      id: generateId(),
      file,
      src,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      width: dimensions.width,
      height: dimensions.height,
      aspectRatio: dimensions.width / dimensions.height,
    }

    if (DEBUG_DROP) {
      console.log("[DEBUG_DROP_UPLOAD] Image loaded:", {
        id: meta.id,
        name: meta.name,
        imageSize: `${meta.width}x${meta.height}`,
        fileSize: meta.size,
        mimeType: meta.mimeType,
      })
    }

    return meta
  }, [])

  // 计算节点尺寸
  const calculateNodeSize = useCallback(
    (width: number, height: number) => {
      let nodeWidth = width
      let nodeHeight = height

      // 按比例缩放，限制上传图在画布上的默认展示尺寸，避免大图撑爆节点。
      if (nodeWidth > IMAGE_NODE_SIZE.maxWidth) {
        const ratio = IMAGE_NODE_SIZE.maxWidth / nodeWidth
        nodeWidth = IMAGE_NODE_SIZE.maxWidth
        nodeHeight = nodeHeight * ratio
      }

      if (nodeHeight > IMAGE_NODE_SIZE.maxHeight) {
        const ratio = IMAGE_NODE_SIZE.maxHeight / nodeHeight
        nodeHeight = IMAGE_NODE_SIZE.maxHeight
        nodeWidth = nodeWidth * ratio
      }

      return {
        width: Math.max(nodeWidth, IMAGE_NODE_SIZE.minWidth),
        height: Math.max(nodeHeight, IMAGE_NODE_SIZE.minHeight),
      }
    },
    []
  )

  // 从文件创建 ImageNode
  const createImageNodeFromFile = useCallback(
    (fileMeta: ImageFileMeta, position: { x: number; y: number }): Node => {
      const { width, height } = calculateNodeSize(fileMeta.width, fileMeta.height)

      const node: Node = {
        id: fileMeta.id,
        type: "image",
        position,
        data: {
          title: fileMeta.name,
          imageUrl: fileMeta.src,
          fileName: fileMeta.name,
          fileSize: fileMeta.size,
          mimeType: fileMeta.mimeType,
          imageWidth: fileMeta.width,
          imageHeight: fileMeta.height,
          displayWidth: width,
          displayHeight: height,
          aspectRatio: fileMeta.aspectRatio,
          nodeKind: "uploaded-image",
          createdAt: Date.now(),
        },
            measured: {
              width,
              height: height + IMAGE_NODE_TITLE_HEIGHT,
            },
      }

      if (DEBUG_DROP) {
        console.log("[DEBUG_DROP_UPLOAD] Created node:", {
          id: node.id,
          position,
          displaySize: `${width}x${height}`,
        })
      }

      return node
    },
    [calculateNodeSize]
  )

  // 从多个文件创建节点
  const createImageNodesFromFiles = useCallback(
    (files: ImageFileMeta[], basePosition: { x: number; y: number }): Node[] => {
      const nodes: Node[] = []
      const OFFSET = 40

      files.forEach((fileMeta, index) => {
        const position = {
          x: basePosition.x + index * OFFSET,
          y: basePosition.y + index * OFFSET,
        }
        nodes.push(createImageNodeFromFile(fileMeta, position))
      })

      return nodes
    },
    [createImageNodeFromFile]
  )

  // 处理拖拽进入
  const handleDragEnter = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (DEBUG_DROP) {
        console.log("[DEBUG_DROP_UPLOAD] Drag enter")
      }

      // 检查是否有图片文件
      const hasImages = Array.from(e.dataTransfer.items).some(
        (item) => item.kind === "file" && item.type.startsWith("image/")
      )

      if (hasImages) {
        setIsDragOver(true)
        setDragError(null)
        e.dataTransfer.dropEffect = "copy"
      }
    },
    []
  )

  // 处理拖拽悬停
  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = "copy"
  }, [])

  // 处理拖拽离开
  const handleDragLeave = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      // 只有当真正离开画布时才隐藏 overlay
      const relatedTarget = e.relatedTarget as HTMLElement
      const canvas = e.currentTarget as HTMLElement

      if (!canvas.contains(relatedTarget)) {
        setIsDragOver(false)
        setDragError(null)

        if (DEBUG_DROP) {
          console.log("[DEBUG_DROP_UPLOAD] Drag leave")
        }
      }
    },
    []
  )

  // 处理放置
  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      setIsDragOver(false)
      setDragError(null)

      if (DEBUG_DROP) {
        console.log("[DEBUG_DROP_UPLOAD] Drop event:", {
          screenX: e.clientX,
          screenY: e.clientY,
        })
      }

      // 获取放置位置（画布坐标）
      const canvasPosition = reactFlow.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      })

      if (DEBUG_DROP) {
        console.log("[DEBUG_DROP_UPLOAD] Canvas position:", canvasPosition)
      }

      // 获取文件列表
      const files = Array.from(e.dataTransfer.files)
      const imageFiles = files.filter((f) => f.type.startsWith("image/"))

      if (DEBUG_DROP) {
        console.log("[DEBUG_DROP_UPLOAD] Files:", {
          total: files.length,
          images: imageFiles.length,
          names: imageFiles.map((f) => f.name),
        })
      }

      if (imageFiles.length === 0) {
        setDragError("请拖入图片文件（jpg/png/webp/gif）")
        return
      }

      // 检查文件大小
      const oversizedFiles = imageFiles.filter((f) => f.size > MAX_FILE_SIZE)
      if (oversizedFiles.length > 0) {
        setDragError(`图片过大，请压缩后再试（最大 20MB）`)
        console.warn("[DEBUG_DROP_UPLOAD] Oversized files:", oversizedFiles.map((f) => f.name))
        return
      }

      // 读取图片元数据
      try {
        const imageMetas = await Promise.all(imageFiles.map(readImageFile))

        // 创建节点
        const nodes = createImageNodesFromFiles(imageMetas, canvasPosition)

        // 添加到画布
        setNodes((nds) => [...nds, ...nodes])

        // 关闭提示
        dismissCanvasHint?.()

        if (DEBUG_DROP) {
          console.log("[DEBUG_DROP_UPLOAD] Created nodes:", nodes.map((n) => n.id))
        }
      } catch (error) {
        console.error("[DEBUG_DROP_UPLOAD] Error processing images:", error)
        setDragError("图片处理失败，请重试")
      }
    },
    [reactFlow, readImageFile, createImageNodesFromFiles, setNodes, dismissCanvasHint]
  )

  // 清除错误
  const clearError = useCallback(() => {
    setDragError(null)
  }, [])

  return {
    isDragOver,
    dragError,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    clearError,
  }
}
