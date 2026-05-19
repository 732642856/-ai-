/**
 * ChatAttachmentPreview - Chat 附件预览
 */

import { X, Plus } from "lucide-react"
import type { ChatAttachment } from "../../hooks/useChatAttachments"
import { DESIGN_TOKENS } from "../../styles/designSystem"
import { formatFileSize, truncateFileName } from "../../utils/generateId"

interface ChatAttachmentPreviewProps {
  attachments: ChatAttachment[]
  onRemove: (id: string) => void
  onAddToCanvas?: (attachment: ChatAttachment) => void
  showAddToCanvas?: boolean
}

export function ChatAttachmentPreview({
  attachments,
  onRemove,
  onAddToCanvas,
  showAddToCanvas = true,
}: ChatAttachmentPreviewProps) {
  if (attachments.length === 0) return null

  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="group relative flex items-center gap-2 rounded-lg px-3 py-2"
          style={{
            backgroundColor: DESIGN_TOKENS.card,
            border: `1px solid ${DESIGN_TOKENS.border}`,
          }}
        >
          {/* 缩略图 */}
          <div
            className="h-10 w-10 flex-shrink-0 overflow-hidden rounded"
            style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
          >
            <img
              src={attachment.src}
              alt={attachment.name}
              className="h-full w-full object-cover"
            />
          </div>

          {/* 文件信息 */}
          <div className="flex flex-col">
            <span
              className="text-xs font-medium"
              style={{ color: DESIGN_TOKENS.text }}
            >
              {truncateFileName(attachment.name, 16)}
            </span>
            <span
              className="text-xs"
              style={{ color: DESIGN_TOKENS.textMuted }}
            >
              {formatFileSize(attachment.size)}
            </span>
          </div>

          {/* 添加到画布按钮 */}
          {showAddToCanvas && onAddToCanvas && (
            <button
              onClick={() => onAddToCanvas(attachment)}
              className="ml-1 flex h-6 w-6 items-center justify-center rounded transition-colors"
              style={{
                backgroundColor: DESIGN_TOKENS.accentSoft,
                color: DESIGN_TOKENS.accent,
              }}
              title="添加到画布"
            >
              <Plus size={14} strokeWidth={2} />
            </button>
          )}

          {/* 删除按钮 */}
          <button
            onClick={() => onRemove(attachment.id)}
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full transition-colors"
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.8)",
              color: "#fff",
            }}
            title="移除"
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        </div>
      ))}
    </div>
  )
}
