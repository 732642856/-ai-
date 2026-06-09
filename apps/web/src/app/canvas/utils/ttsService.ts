// ============================================================================
// ttsService — 文本转语音 API 客户端
//
// 封装 VoxCPM / Mock 等 TTS 后端。
// 支持 SSE 流式进度回调与 mock 本地开发模式。
// ============================================================================

import * as Sentry from "@sentry/nextjs";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const TTS_TIMEOUT_MS = 120_000 // 2 minutes

/** Supported TTS backends */
export type TtsBackend = "voxcpm" | "mock"

/** TTS generation parameters */
export interface TtsInput {
  /** Text to synthesize */
  text: string
  /** VoxCPM2 Voice Design: "(温柔的年轻女声)..." */
  voiceDescription?: string
  /** Preset voice name */
  voice?: string
  /** Clone reference audio URL */
  referenceWavUrl?: string
  /** Speech speed 0.5-2.0 */
  speed?: number
  /** Backend to use */
  backend?: TtsBackend
}

/** TTS generation result */
export interface TtsResult {
  /** Base64-encoded audio data */
  audioBase64: string
  /** Audio format (e.g. "wav") */
  format: string
  /** Audio duration in milliseconds */
  durationMs: number
  /** Backend used */
  backend: TtsBackend
  /** Generation metadata */
  metadata?: { model?: string }
}

/** Progress callback type */
export type TtsProgressCallback = (progress: {
  stage: "connecting" | "synthesizing" | "done" | "failed"
  percent: number
  message: string
}) => void

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export type TtsErrorCode =
  | "NETWORK_ERROR"
  | "API_ERROR"
  | "BACKEND_UNAVAILABLE"
  | "TEXT_EMPTY"
  | "TIMEOUT"

export class TtsError extends Error {
  code: TtsErrorCode
  retryable: boolean

  constructor(params: {
    message: string
    code: TtsErrorCode
    retryable?: boolean
  }) {
    super(params.message)
    this.name = "TtsError"
    this.code = params.code
    this.retryable = params.retryable ?? true
  }
}

// ---------------------------------------------------------------------------
// Backend implementations
// ---------------------------------------------------------------------------

/**
 * Mock TTS generator — produces placeholder audio for development.
 */
async function mockGenerateTts(
  input: TtsInput,
  onProgress?: TtsProgressCallback,
): Promise<TtsResult> {
  // Simulate connecting phase
  onProgress?.({
    stage: "connecting",
    percent: 10,
    message: "正在连接语音合成服务...",
  })
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // Simulate synthesizing phase
  onProgress?.({
    stage: "synthesizing",
    percent: 50,
    message: "正在合成语音...",
  })
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // Simulate done phase
  onProgress?.({
    stage: "done",
    percent: 100,
    message: "语音合成完成",
  })

  // Placeholder base64 WAV data (silent audio)
  const placeholderAudioBase64 =
    "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="

  return {
    audioBase64: placeholderAudioBase64,
    format: "wav",
    durationMs: Math.max(500, Math.round(input.text.length * 80)),
    backend: "mock",
    metadata: { model: "mock-tts-1.0" },
  }
}

/**
 * VoxCPM TTS API client.
 *
 * Calls /api/ai/tts via SSE streaming.
 * Supports voice description, voice cloning, and speed control.
 */
async function voxcpmGenerateTts(
  input: TtsInput,
  onProgress?: TtsProgressCallback,
): Promise<TtsResult> {
  return Sentry.startSpan(
    { op: "tts.generate", name: "VoxCPM SSE Call" },
    async (span) => {
      // Validate input
      if (!input.text || !input.text.trim()) {
        throw new TtsError({
          message: "合成文本不能为空",
          code: "TEXT_EMPTY",
          retryable: false,
        })
      }

      const res = await fetch("/api/ai/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: input.text,
          voiceDescription: input.voiceDescription,
          voice: input.voice,
          referenceWavUrl: input.referenceWavUrl,
          speed: input.speed ?? 1.0,
        }),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => "Unknown error")
        throw new TtsError({
          message: `TTS API 错误: ${text}`,
          code: "API_ERROR",
          retryable: res.status >= 500,
        })
      }

      if (!res.body) {
        throw new TtsError({
          message: "TTS API 返回空响应体",
          code: "NETWORK_ERROR",
          retryable: true,
        })
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let audioBase64 = ""
      let format = "wav"
      let durationMs = 0
      let model = ""

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""

          let eventName = ""
          let eventData = ""

          for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed.startsWith("event:")) {
              eventName = trimmed.slice(6).trim()
            } else if (trimmed.startsWith("data:")) {
              eventData = trimmed.slice(5).trim()
            } else if (trimmed === "" && eventName && eventData) {
              try {
                const data = JSON.parse(eventData)
                if (eventName === "progress") {
                  onProgress?.({
                    stage: data.stage as "connecting" | "synthesizing" | "done" | "failed",
                    percent: data.percent,
                    message: data.message,
                  })
                } else if (eventName === "result") {
                  audioBase64 = data.audioBase64
                  format = data.format || "wav"
                  durationMs = data.durationMs || 0
                  model = data.model || ""
                } else if (eventName === "error") {
                  throw new TtsError({
                    message: data.message || "语音合成失败",
                    code: data.code || "API_ERROR",
                    retryable: false,
                  })
                }
              } catch (e) {
                // Ignore malformed events or our own thrown errors
                if (e instanceof TtsError) throw e
              }
              eventName = ""
              eventData = ""
            }
          }
        }

        if (!audioBase64) {
          throw new TtsError({
            message: "TTS API 未返回音频数据",
            code: "API_ERROR",
            retryable: true,
          })
        }

        return {
          audioBase64,
          format,
          durationMs,
          backend: "voxcpm",
          metadata: { model: model || undefined },
        }
      } finally {
        reader.releaseLock()
      }
    },
  )
}

// ---------------------------------------------------------------------------
// Backend registry
// ---------------------------------------------------------------------------

const BACKENDS: Record<
  TtsBackend,
  (input: TtsInput, onProgress?: TtsProgressCallback) => Promise<TtsResult>
> = {
  mock: mockGenerateTts,
  voxcpm: voxcpmGenerateTts,
}

/** Resolve which backend to use */
function pickTtsBackend(input: TtsInput): TtsBackend {
  if (input.backend) return input.backend

  // Auto-detect: prefer voxcpm if env var exists, fallback to mock
  if (process.env.VOXCPM_BASE_URL) {
    return "voxcpm"
  }
  return "mock"
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate speech from text.
 *
 * @param input - Text, voice settings, and backend selection
 * @param onProgress - Optional progress callback
 * @returns TtsResult with base64 audio and metadata
 */
export async function generateTts(
  input: TtsInput,
  onProgress?: TtsProgressCallback,
): Promise<TtsResult> {
  // Validate input
  if (!input.text || !input.text.trim()) {
    throw new TtsError({
      message: "请提供合成文本",
      code: "TEXT_EMPTY",
      retryable: false,
    })
  }

  const backend = pickTtsBackend(input)
  const generator = BACKENDS[backend]

  if (!generator) {
    throw new TtsError({
      message: `不支持的语音合成后端: ${backend}`,
      code: "BACKEND_UNAVAILABLE",
      retryable: false,
    })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS)

  try {
    const result = await generator(input, onProgress)
    return { ...result, backend }
  } catch (error: any) {
    Sentry.captureException(error)
    if (error?.name === "AbortError") {
      throw new TtsError({
        message: "语音合成超时，请稍后重试",
        code: "TIMEOUT",
        retryable: true,
      })
    }
    if (error instanceof TtsError) throw error
    throw new TtsError({
      message: `语音合成失败：${error?.message || "未知错误"}`,
      code: "NETWORK_ERROR",
      retryable: true,
    })
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Convert a TtsResult to data suitable for node persistence.
 */
export function ttsResultToNodeData(result: TtsResult): {
  audioBase64: string
  durationMs: number
  model: string
  status: "done"
  summary: string
} {
  return {
    audioBase64: result.audioBase64,
    durationMs: result.durationMs,
    model: result.backend === "mock" ? "Mock (Dev)" : result.metadata?.model || result.backend,
    status: "done",
    summary: `语音已合成 (${(result.durationMs / 1000).toFixed(1)}s, ${result.backend})`,
  }
}

// ============================================================================
// VoicePanel 依赖 — 向下兼容 API 层
// ============================================================================

/** Voice Panel — Quick tag type */
export type VoiceQuickTag = {
  value: string
  label: string
}

/** Voice Panel — Quick tag presets */
export const VOICE_QUICK_TAGS: VoiceQuickTag[] = [
  { value: "年轻女声", label: "年轻女声" },
  { value: "沉稳男声", label: "沉稳男声" },
  { value: "活泼", label: "活泼" },
  { value: "低沉", label: "低沉" },
  { value: "温柔", label: "温柔" },
  { value: "稍快语速", label: "稍快语速" },
  { value: "缓慢", label: "缓慢" },
  { value: "有磁性", label: "有磁性" },
  { value: "沙哑", label: "沙哑" },
  { value: "带口音", label: "带口音" },
  { value: "老年声", label: "老年声" },
  { value: "童声", label: "童声" },
]

/** Voice Panel — Legacy error class */
export class TtsGenerationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TtsGenerationError"
  }
}

/**
 * Voice Panel — Convert natural language voice description to instruct string.
 */
export function voiceDescriptionToInstruct(desc: string): string {
  return desc.trim()
}

/**
 * Voice Panel — Infer voice description from shot context.
 */
export function inferVoiceDescriptionFromShot(shot?: any): { description: string; reason: string } {
  if (!shot) return { description: "", reason: "" }
  // Heuristic: derive from shot mood / characters
  const mood = shot?.sceneAnalysis?.mood || ""
  if (mood.includes("悲伤") || mood.includes("感人")) {
    return { description: "温柔、缓慢、略带悲伤", reason: `根据场景氛围「${mood}」推荐` }
  }
  if (mood.includes("紧张") || mood.includes("激烈")) {
    return { description: "语速稍快、有力度", reason: `根据场景氛围「${mood}」推荐` }
  }
  return { description: "自然、清晰", reason: "默认推荐" }
}

/**
 * Voice Panel — Look up character voice profile from character identities.
 */
export function lookupCharacterVoiceProfile(characterIdentities?: any[]): { profileId: string } | null {
  if (!characterIdentities || characterIdentities.length === 0) return null
  const first = characterIdentities[0]
  if (first?.voiceProfileId) {
    return { profileId: first.voiceProfileId }
  }
  return null
}

/**
 * Voice Panel — Register a voice clone from reference audio.
 */
export async function registerVoiceClone(params: {
  audioFile: File
  characterId: string
  characterName: string
  refText?: string
  tags?: string[]
}): Promise<{ profileId: string }> {
  // Stub: return a mock profile ID
  await new Promise((resolve) => setTimeout(resolve, 1500))
  return { profileId: `vc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }
}

/**
 * Voice Panel — Invalidate profile cache.
 */
export function invalidateProfileCache(): void {
  // stub: no-op
}

/**
 * Voice Panel — TTS generation (bridged to VoxCPM2 via generateTts).
 * If VOXCPM_BASE_URL is configured, calls the real backend;
 * otherwise returns mock silent WAV for development.
 */
export async function generateTtsAudio(params: {
  text: string
  voiceConfig?: { instruct?: string; refAudioId?: string; refText?: string; speed?: number }
}): Promise<{ audioBlob: Blob }> {
  const { text, voiceConfig } = params
  if (!text?.trim()) {
    throw new TtsGenerationError("请输入要合成的台词")
  }

  // Check if VoxCPM2 is available
  const hasVoxCpm = Boolean(
    (typeof process !== "undefined" && (process as any).env?.VOXCPM_BASE_URL) ||
    (typeof window !== "undefined" && (window as any).__ENV?.NEXT_PUBLIC_VOXCPM_URL)
  )

  if (!hasVoxCpm) {
    // Fallback: return silent WAV for development
    const sampleRate = 16000
    const numSamples = Math.max(1600, Math.round(text.length * 80))
    const buffer = new ArrayBuffer(44 + numSamples * 2)
    const view = new DataView(buffer)
    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
    }
    writeStr(0, "RIFF")
    view.setUint32(4, 36 + numSamples * 2, true)
    writeStr(8, "WAVE")
    writeStr(12, "fmt ")
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    writeStr(36, "data")
    view.setUint32(40, numSamples * 2, true)
    const blob = new Blob([buffer], { type: "audio/wav" })
    return { audioBlob: blob }
  }

  // Real backend: call VoxCPM2 via /api/ai/tts
  const voiceDescription = voiceConfig?.instruct || ""
  const refAudioId = voiceConfig?.refAudioId

  const res = await fetch("/api/ai/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: text.trim(),
      voiceDescription: voiceDescription || undefined,
      referenceWav: refAudioId ? `/api/voice-clone/profiles/${refAudioId}/audio` : undefined,
      streaming: false,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => "Unknown error")
    throw new TtsGenerationError(`语音合成失败：${errText}`)
  }

  // Parse SSE response
  const reader = res.body?.getReader()
  if (!reader) throw new TtsGenerationError("服务端未返回数据")

  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // Look for result event with audio data
    const lines = buffer.split("\n")
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6))
          if (data.audioBase64) {
            const binaryStr = atob(data.audioBase64)
            const bytes = new Uint8Array(binaryStr.length)
            for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
            const blob = new Blob([bytes], { type: "audio/wav" })
            return { audioBlob: blob }
          }
          if (data.message) {
            throw new TtsGenerationError(data.message)
          }
        } catch { /* skip non-JSON lines */ }
      }
    }
    // Clear processed lines
    const lastNewline = buffer.lastIndexOf("\n")
    if (lastNewline >= 0) buffer = buffer.slice(lastNewline + 1)
  }

  throw new TtsGenerationError("语音合成未返回音频数据")
}

/**
 * Voice Panel — Persist TTS audio blob to local storage.
 */
export async function persistTtsAudio(
  _blob: Blob,
  _options: { fileName: string },
): Promise<{ objectUrl: string; assetId: string }> {
  const objectUrl = URL.createObjectURL(_blob)
  const assetId = `tts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return { objectUrl, assetId }
}
