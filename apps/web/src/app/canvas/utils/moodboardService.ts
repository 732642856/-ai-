// ============================================================================
// Moodboard 客户端服务
// 调用 /api/ai/generate-moodboard SSE 流，解析进度，返回生成的图片数组
// ============================================================================

export interface MoodboardProgress {
  /** 当前阶段：generating_prompts | generating_images | complete */
  phase: string
  /** 当前生成的第几张（从 0 开始） */
  currentIndex?: number
  /** 总数 */
  totalCount?: number
  /** 当前维度名称 */
  dimension?: string
  /** 友好进度消息 */
  message: string
}

export interface MoodboardImageResult {
  index: number
  dimension: string
  dimension_en: string
  imageUrl: string
  prompt: string
}

export interface MoodboardResult {
  images: MoodboardImageResult[]
  totalCount: number
  failedCount: number
  message: string
}

type SseEventType =
  | "phase"
  | "prompts"
  | "image_start"
  | "image_done"
  | "image_error"
  | "complete"
  | "error"

/**
 * 调用 moodboard 生成 API，通过 SSE 流接收进度。
 *
 * @param description - 用户输入的风格描述
 * @param onProgress - 进度回调，接收阶段和消息
 * @returns 生成的图片信息数组
 */
export async function generateMoodboard(
  description: string,
  onProgress?: (progress: MoodboardProgress) => void,
): Promise<MoodboardResult> {
  const res = await fetch("/api/ai/generate-moodboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  })

  if (!res.ok) {
    throw new Error(`Moodboard 请求失败 (${res.status})`)
  }

  const reader = res.body?.getReader()
  if (!reader) {
    throw new Error("无响应流")
  }

  const decoder = new TextDecoder()
  let buffer = ""
  let result: MoodboardResult = {
    images: [],
    totalCount: 0,
    failedCount: 0,
    message: "",
  }

  const parseEvent = (eventType: string, dataStr: string) => {
    try {
      const data = JSON.parse(dataStr)

      switch (eventType) {
        case "phase":
          onProgress?.({
            phase: data.phase,
            message: data.message ?? "",
          })
          break

        case "image_start":
          onProgress?.({
            phase: "generating_images",
            currentIndex: data.index,
            totalCount: data.total,
            dimension: data.dimension,
            message: data.message ?? "",
          })
          break

        case "image_done":
          result.images.push({
            index: data.index,
            dimension: data.dimension,
            dimension_en: data.dimension_en,
            imageUrl: data.imageUrl,
            prompt: data.prompt,
          })
          onProgress?.({
            phase: "generating_images",
            currentIndex: data.index,
            totalCount: data.total,
            dimension: data.dimension,
            message: data.message ?? "",
          })
          break

        case "image_error":
          result.failedCount++
          onProgress?.({
            phase: "generating_images",
            currentIndex: data.index,
            totalCount: data.total,
            dimension: data.dimension,
            message: data.message ?? "",
          })
          break

        case "complete":
          result.totalCount = data.totalCount
          result.failedCount = data.failedCount
          result.message = data.message ?? ""
          onProgress?.({
            phase: "complete",
            totalCount: data.totalCount,
            message: data.message ?? "",
          })
          break

        case "error":
          throw new Error(data.error ?? "未知错误")
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        // Ignore malformed data
        return
      }
      throw err
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ""

    let currentEvent = ""
    for (const line of lines) {
      if (!line.trim()) continue

      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim() as SseEventType
      } else if (line.startsWith("data: ")) {
        const dataStr = line.slice(6)
        if (currentEvent) {
          parseEvent(currentEvent, dataStr)
        }
      }
    }
  }

  // Process remaining buffer
  if (buffer.trim()) {
    if (buffer.startsWith("event: ")) {
      // Incomplete event at end, ignore
    } else if (buffer.startsWith("data: ")) {
      // This shouldn't normally happen, but handle gracefully
    }
  }

  return result
}
