/**
 * useChatAttachments - Chat 输入框附件管理
 */

import { useCallback, useState, type ChangeEvent } from "react"
import { generateId } from "../utils/generateId"

const DEBUG_CHAT = typeof window !== "undefined" && window.localStorage.getItem("DEBUG_CHAT_ATTACHMENTS") === "1"

export interface ChatAttachment {
  id: string
  type: "image" | "video" | "audio" | "file"
  file?: File // Optional for AI-generated images that don't have a File object
  src: string
  name: string
  size: number
  mimeType: string
  width?: number
  height?: number
}

const MAX_FILE_SIZE = 80 * 1024 * 1024 // 80MB

function getAttachmentType(file: File): ChatAttachment["type"] {
  if (file.type.startsWith("image/")) return "image"
  if (file.type.startsWith("video/")) return "video"
  if (file.type.startsWith("audio/")) return "audio"
  return "file"
}

export function useChatAttachments() {
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [error, setError] = useState<string | null>(null)

  // 添加附件
  const addAttachments = useCallback((files: File[]) => {
    setError(null)

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        setError("文件过大，请控制在 80MB 以内")
        continue
      }

      const src = URL.createObjectURL(file)
      const type = getAttachmentType(file)

      if (type !== "image") {
        const attachment: ChatAttachment = {
          id: generateId(),
          type,
          file,
          src,
          name: file.name,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
        }

        setAttachments((prev) => [...prev, attachment])

        if (DEBUG_CHAT) {
          console.debug("[DEBUG_CHAT_ATTACHMENTS] Added attachment:", {
            id: attachment.id,
            type: attachment.type,
            name: attachment.name,
          })
        }
        continue
      }

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
          console.debug("[DEBUG_CHAT_ATTACHMENTS] Added attachment:", {
            id: attachment.id,
            type: attachment.type,
            name: attachment.name,
            dimensions: `${attachment.width}x${attachment.height}`,
          })
        }
      }

      img.onerror = () => {
        URL.revokeObjectURL(src)
        setError("图片读取失败，请换一张再试")
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

      const files = Array.from(e.dataTransfer.files)

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
