/**
 * 生成唯一 ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * 截断文件名
 */
export function truncateFileName(name: string, maxLength: number = 20): string {
  if (name.length <= maxLength) return name
  const ext = name.split(".").pop() || ""
  const baseName = name.slice(0, name.length - ext.length - 1)
  const truncatedBase = baseName.slice(0, maxLength - ext.length - 4)
  return `${truncatedBase}...${ext}`
}
