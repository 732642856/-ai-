// ============================================================================
// videoGenerationService — 图生视频 API 客户端
//
// 封装 Seedance / Kling / Runway 等图生视频 API。
// 支持 mock 模式用于本地开发测试。
// ============================================================================

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const VIDEO_GENERATION_TIMEOUT_MS = 300_000  // 5 minutes (video gen is slow)

/** Supported video generation backends */
export type VideoGenBackend = "seedance" | "kling" | "runway" | "mock"

/** Video generation parameters */
export interface VideoGenInput {
  /** Input image URL or base64 data URL */
  imageUrl: string
  /** Motion prompt (e.g. "camera slowly pushes in, subject turns head") */
  motionPrompt?: string
  /** Target duration in seconds */
  durationSeconds?: number
  /** Backend to use */
  backend?: VideoGenBackend
  /** Aspect ratio */
  aspectRatio?: "16:9" | "9:16" | "1:1" | "4:3"
  /** Resolution */
  resolution?: "720p" | "1080p"
}

/** Video generation result */
export interface VideoGenResult {
  /** Video URL */
  videoUrl: string
  /** Duration in seconds */
  durationSeconds: number
  /** Backend used */
  backend: VideoGenBackend
  /** Generation metadata */
  metadata?: {
    seed?: number
    framesGenerated?: number
    fps?: number
    modelVersion?: string
  }
}

/** Progress callback type */
export type VideoGenProgressCallback = (progress: {
  stage: "queued" | "processing" | "rendering" | "done" | "failed"
  percent: number
  message: string
  estimatedSecondsRemaining?: number
}) => void

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export type VideoGenerationErrorCode =
  | "CLIENT_TIMEOUT"
  | "NETWORK_ERROR"
  | "API_ERROR"
  | "INVALID_IMAGE"
  | "UNSUPPORTED_RESOLUTION"
  | "BACKEND_UNAVAILABLE"
  | "SAFETY_FILTER"
  | string

export class VideoGenerationError extends Error {
  code: VideoGenerationErrorCode
  status?: number
  retryable: boolean
  detail?: string

  constructor(params: {
    message: string
    code: VideoGenerationErrorCode
    status?: number
    retryable?: boolean
    detail?: string
  }) {
    super(params.message)
    this.name = "VideoGenerationError"
    this.code = params.code
    this.status = params.status
    this.retryable = params.retryable ?? true
    this.detail = params.detail
  }
}

// ---------------------------------------------------------------------------
// Backend implementations
// ---------------------------------------------------------------------------

/**
 * Mock video generator — produces placeholder output for development.
 * Generates a colored canvas animation as a data URL GIF.
 */
async function mockGenerateVideo(
  input: VideoGenInput,
  onProgress?: VideoGenProgressCallback,
): Promise<VideoGenResult> {
  const durationSeconds = input.durationSeconds ?? 5

  // Simulate progress stages
  const stages: Array<{ stage: "queued" | "processing" | "rendering" | "done"; pct: number; delay: number }> = [
    { stage: "queued", pct: 5, delay: 500 },
    { stage: "processing", pct: 20, delay: 800 },
    { stage: "processing", pct: 40, delay: 800 },
    { stage: "processing", pct: 65, delay: 800 },
    { stage: "rendering", pct: 80, delay: 1000 },
    { stage: "rendering", pct: 95, delay: 800 },
    { stage: "done", pct: 100, delay: 300 },
  ]

  for (const s of stages) {
    onProgress?.({
      stage: s.stage as "queued" | "processing" | "rendering" | "done" | "failed",
      percent: s.pct,
      message: s.stage === "done" ? "生成完成" : `正在${s.stage === "queued" ? "排队" : s.stage === "processing" ? "处理" : "渲染"}...`,
      estimatedSecondsRemaining: s.stage !== "done" ? Math.round((100 - s.pct) / 10) : undefined,
    })
    await new Promise((resolve) => setTimeout(resolve, s.delay))
  }

  // Generate a simple animated placeholder (colored gradient text)
  const width = input.aspectRatio === "9:16" ? 720 : 1280
  const height = input.aspectRatio === "9:16" ? 1280 : 720

  // Create a simple animated SVG as a data URL
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#1a1a2e"/>
        <stop offset="50%" style="stop-color:#16213e"/>
        <stop offset="100%" style="stop-color:#0f3460"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <text x="${width/2}" y="${height/2 - 40}" text-anchor="middle" fill="#e94560" font-size="28" font-family="system-ui, sans-serif" font-weight="bold">
      StarCanvas Video
    </text>
    <text x="${width/2}" y="${height/2}" text-anchor="middle" fill="#a0a0b0" font-size="14" font-family="system-ui, sans-serif">
      Motion: ${input.motionPrompt ? input.motionPrompt.slice(0, 40) + "..." : "(auto)"}
    </text>
    <text x="${width/2}" y="${height/2 + 30}" text-anchor="middle" fill="#666680" font-size="11" font-family="system-ui, sans-serif">
      Duration: ${durationSeconds}s | Mock Backend
    </text>
    <rect x="${width/2 - 62}" y="${height/2 + 50}" width="124" height="6" rx="3" fill="#333355">
      <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite"/>
    </rect>
  </svg>`

  const svgDataUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`

  return {
    videoUrl: svgDataUrl,
    durationSeconds,
    backend: "mock",
    metadata: {
      seed: Math.floor(Math.random() * 1000000),
      framesGenerated: durationSeconds * 24,
      fps: 24,
      modelVersion: "mock-1.0",
    },
  }
}

/**
 * Seedance API client stub — ready for real API integration.
 *
 * Seedance (ByteDance) image-to-video API:
 *   POST https://api.seedance.com/v1/image-to-video
 *   Headers: Authorization: Bearer <token>
 */
async function seedanceGenerateVideo(
  input: VideoGenInput,
  onProgress?: VideoGenProgressCallback,
): Promise<VideoGenResult> {
  const apiKey = process.env.NEXT_PUBLIC_SEEDANCE_API_KEY || process.env.SEEDANCE_API_KEY

  if (!apiKey) {
    throw new VideoGenerationError({
      message: "Seedance API key not configured",
      code: "BACKEND_UNAVAILABLE",
      retryable: false,
      detail: "Set NEXT_PUBLIC_SEEDANCE_API_KEY environment variable.",
    })
  }

  // TODO: Replace with real API call when API key is configured
  // For now, fallback to mock
  return mockGenerateVideo(input, onProgress)
}

/**
 * Kling API client stub.
 *
 * Kling (Kuaishou) image-to-video API.
 */
async function klingGenerateVideo(
  input: VideoGenInput,
  onProgress?: VideoGenProgressCallback,
): Promise<VideoGenResult> {
  const apiKey = process.env.NEXT_PUBLIC_KLING_API_KEY || process.env.KLING_API_KEY

  if (!apiKey) {
    throw new VideoGenerationError({
      message: "Kling API key not configured",
      code: "BACKEND_UNAVAILABLE",
      retryable: false,
      detail: "Set NEXT_PUBLIC_KLING_API_KEY environment variable.",
    })
  }

  return mockGenerateVideo(input, onProgress)
}

// ---------------------------------------------------------------------------
// Backend registry
// ---------------------------------------------------------------------------

const BACKENDS: Record<VideoGenBackend, (input: VideoGenInput, onProgress?: VideoGenProgressCallback) => Promise<VideoGenResult>> = {
  mock: mockGenerateVideo,
  seedance: seedanceGenerateVideo,
  kling: klingGenerateVideo,
  runway: mockGenerateVideo, // Runway stub
}

/** Resolve which backend to use */
function resolveBackend(input: VideoGenInput): VideoGenBackend {
  if (input.backend) return input.backend

  // Auto-detect: prefer seedance if key exists, fallback to mock
  if (process.env.NEXT_PUBLIC_SEEDANCE_API_KEY || process.env.SEEDANCE_API_KEY) {
    return "seedance"
  }
  if (process.env.NEXT_PUBLIC_KLING_API_KEY || process.env.KLING_API_KEY) {
    return "kling"
  }
  return "mock"
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a video from an image.
 *
 * @param input - Image URL, motion prompt, duration, backend selection
 * @param onProgress - Optional progress callback
 * @returns VideoGenResult with video URL and metadata
 */
export async function generateVideoFromImage(
  input: VideoGenInput,
  onProgress?: VideoGenProgressCallback,
): Promise<VideoGenResult> {
  // Validate input
  if (!input.imageUrl) {
    throw new VideoGenerationError({
      message: "请提供输入图片",
      code: "INVALID_IMAGE",
      retryable: false,
    })
  }

  const backend = resolveBackend(input)
  const generator = BACKENDS[backend]

  if (!generator) {
    throw new VideoGenerationError({
      message: `不支持的视频生成后端: ${backend}`,
      code: "BACKEND_UNAVAILABLE",
      retryable: false,
    })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), VIDEO_GENERATION_TIMEOUT_MS)

  try {
    const result = await generator(input, onProgress)
    return { ...result, backend }
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new VideoGenerationError({
        message: "视频生成超时，请稍后重试",
        code: "CLIENT_TIMEOUT",
        retryable: true,
      })
    }
    if (error instanceof VideoGenerationError) throw error
    throw new VideoGenerationError({
      message: `视频生成失败：${error?.message || "未知错误"}`,
      code: "NETWORK_ERROR",
      retryable: true,
    })
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Convert a VideoGenResult to data suitable for node persistence.
 */
export function videoResultToNodeData(result: VideoGenResult): {
  resultUrl: string
  duration: string
  model: string
  status: "done"
  summary: string
} {
  return {
    resultUrl: result.videoUrl,
    duration: `${result.durationSeconds}s`,
    model: result.backend === "mock" ? "Mock (Dev)" : result.backend,
    status: "done",
    summary: `视频已生成 (${result.durationSeconds}s, ${result.backend})`,
  }
}
