// ============================================================================
// Video Metadata Utility (V1-2)
// ============================================================================
// 纯函数 + DOM 依赖函数（仅 captureVideoThumbnail 需要 canvas）
// V1 Mock 模式，V2 接入真实 video → canvas 帧抽取
// ============================================================================

import type { VideoMetadata } from "../types/execution-context"

/**
 * 从 File 或 URL 加载视频元数据。
 * 返回 durationMs, width, height，fps 仅在浏览器支持 requestVideoFrameCallback 时返回。
 */
export async function loadVideoMetadata(fileOrUrl: File | string): Promise<VideoMetadata> {
  const url = fileOrUrl instanceof File ? URL.createObjectURL(fileOrUrl) : fileOrUrl

  return new Promise<VideoMetadata>((resolve, reject) => {
    const video = document.createElement("video")
    video.preload = "metadata"

    video.onloadedmetadata = () => {
      const metadata: VideoMetadata = {
        durationMs: video.duration * 1000,
        width: video.videoWidth,
        height: video.videoHeight,
        fps: undefined,
      }

      // 尝试通过 requestVideoFrameCallback 获取 fps（仅浏览器支持）
      if (typeof (video as any).requestVideoFrameCallback === "function") {
        // V2: 可在此处统计帧率
      }

      if (fileOrUrl instanceof File) URL.revokeObjectURL(url)
      video.remove()
      resolve(metadata)
    }

    video.onerror = () => {
      if (fileOrUrl instanceof File) URL.revokeObjectURL(url)
      video.remove()
      reject(new Error(`无法加载视频: ${url}`))
    }

    video.src = url
  })
}

/**
 * 创建 ObjectURL 包装（调用方负责 revoke）。
 */
export function createVideoObjectUrl(file: File): string {
  return URL.createObjectURL(file)
}

/**
 * Canvas 截取视频指定时间点的帧缩略图。
 * 返回 data:image/jpeg;base64,... 的 Data URL。
 */
export async function captureVideoThumbnail(
  videoUrl: string,
  timestampMs: number = 1000,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const video = document.createElement("video")
    video.crossOrigin = "anonymous"
    video.src = videoUrl
    video.currentTime = timestampMs / 1000

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas")
        canvas.width = video.videoWidth || 320
        canvas.height = video.videoHeight || 180
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("无法创建 Canvas 2D 上下文"))
          return
        }
        ctx.drawImage(video, 0, 0)
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7)
        video.src = ""
        video.remove()
        resolve(dataUrl)
      } catch (err) {
        video.src = ""
        video.remove()
        reject(err)
      }
    }

    video.onerror = () => {
      video.src = ""
      video.remove()
      reject(new Error(`截取缩略图失败: ${videoUrl} at ${timestampMs}ms`))
    }
  })
}

/**
 * 从视频 URL 生成 N 帧均匀分布的缩略图 Data URL 列表。
 * V1 Mock 模式：返回纯色 SVG 占位图（轻量，不保存大 base64）。
 * V2 Real 模式：调用 captureVideoThumbnail 真实截帧。
 */
export async function extractVideoFrames(
  videoUrl: string,
  metadata: VideoMetadata,
  options: {
    mode?: "mock" | "real"
    maxFrames?: number
    timestampMs?: number[]
  } = {},
): Promise<Array<{ imageUrl: string; timestampMs: number; frameIndex: number }>> {
  const { mode = "mock", maxFrames = 4, timestampMs: customTimestamps } = options
  const safeMax = Math.min(maxFrames, 6)

  if (mode === "mock") {
    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]
    return Array.from({ length: safeMax }, (_, i) => {
      const color = colors[i % colors.length]
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">
        <rect width="320" height="180" fill="${color}" rx="8"/>
        <text x="160" y="96" text-anchor="middle" fill="white" font-size="14" font-family="sans-serif">Frame ${i + 1}</text>
      </svg>`
      return {
        imageUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
        timestampMs: i * (metadata.durationMs / Math.max(safeMax, 1)),
        frameIndex: i,
      }
    })
  }

  // V2 Real: 均匀采样或使用自定义时间戳
  const timestamps = customTimestamps && customTimestamps.length > 0
    ? customTimestamps
    : Array.from({ length: safeMax }, (_, i) =>
        (metadata.durationMs / (safeMax + 1)) * (i + 1)
      )

  return Promise.all(
    timestamps.map(async (ts, i) => ({
      imageUrl: await captureVideoThumbnail(videoUrl, ts),
      timestampMs: ts,
      frameIndex: i,
    })),
  )
}
