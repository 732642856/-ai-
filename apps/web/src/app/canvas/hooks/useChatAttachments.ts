/**
 * useChatAttachments - Chat 输入框附件管理
 */

import { useCallback, useState, type ChangeEvent } from "react"
import { generateId } from "../utils/generateId"

const DEBUG_CHAT = typeof window !== "undefined" && window.localStorage.getItem("DEBUG_CHAT_ATTACHMENTS") === "1"

export interface ChatAttachment {
  id: string
  type: "image"
  file: File
  src: string
  name: string
  size: number
  mimeType: string
  width?: number
  height?: number
}

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

export function useChatAttachments() {
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [error, setError] = useState<string | null>(null)

  // 添加附件
  const addAttachments = useCallback((files: File[]) => {
    const newAttachments: ChatAttachment[] = []

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        setError("仅支持图片文件")
        continue
      }

      if (file.size > MAX_FILE_SIZE) {
        setError("图片过大，请压缩后再试")
        continue
      }

      const src = URL.createObjectURL(file)
      const img = new Image()

      img.onload = () => {
        const attachment: ChatAttachment = {
          id: generateId(),
          type: "image",
          file,
          src,
          name: file.name,
          size: file.size,
          mimeType: file.type,
          width: img.naturalWidth,
          height: img.naturalHeight,
        }

        setAttachments((prev) => [...prev, attachment])

        if (DEBUG_CHAT) {
          console.log("[DEBUG_CHAT_ATTACHMENTS] Added attachment:", {
            id: attachment.id,
            name: attachment.name,
            dimensions: `${attachment.width}x${attachment.height}`,
          })
        }
      }

      img.src = src
    }
  }, [])

  // 删除附件
  const removeAttachment = useCallback(
    (id: string) => {
      setAttachments((prev) => {
        const removed = prev.find((a) => a.id === id)
        if (removed) {
          URL.revokeObjectURL(removed.src)
        }
        return prev.filter((a) => a.id !== id)
      })
    },
    []
  )

  // 清除所有附件
  const clearAttachments = useCallback(() => {
    attachments.forEach((a) => URL.revokeObjectURL(a.src))
    setAttachments([])
  }, [attachments])

  // 处理文件选择
  const handleFileSelect = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      if (files.length > 0) {
        addAttachments(files)
      }
      // 重置 input
      e.target.value = ""
    },
    [addAttachments]
  )

  // 处理拖拽到输入框
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = "copy"
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/")
      )

      if (files.length > 0) {
        addAttachments(files)
      }
    },
    [addAttachments]
  )

  return {
    attachments,
    error,
    addAttachments,
    removeAttachment,
    clearAttachments,
    handleFileSelect,
    handleDragOver,
    handleDrop,
    setError,
  }
}
