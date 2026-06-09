// ============================================================================
// New Workflow Services — 为新增节点类型提供前端 API 调用封装
// ============================================================================
// 涵盖：camera-control、remix-analysis、generate-poster、upscale、talking-photo
// BGM 为纯前端实现，不经过此文件。
// ============================================================================

import { normalizeGenerationError } from "@/lib/ai/normalizeGenerationError"

// ── Camera Control ──────────────────────────────────────────────────────────

export interface CameraControlPlan {
  sceneMood: string
  movements: Array<{
    name: string
    type: string
    description: string
    duration: string
    intensity: string
    params: Record<string, number | string>
  }>
  notes: string
}

export async function generateCameraControl(
  sceneDescription: string,
  opts?: { preset?: string; useLLM?: boolean },
): Promise<{ plan: CameraControlPlan; source: string }> {
  const res = await fetch("/api/ai/camera-control", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sceneDescription,
      preset: opts?.preset,
      useLLM: opts?.useLLM,
    }),
  })

  const data = await res.json()

  if (!res.ok || data.error) {
    throw normalizeGenerationError(data.error?.message || "摄影机控制生成失败")
  }

  return { plan: data.plan, source: data.source }
}

// ── Remix Analysis ──────────────────────────────────────────────────────────

export interface RemixAnalysisResult {
  sourceDescription: string
  template: {
    id: string
    name: string
    category: string
    totalDuration: string
    hookPattern: string
    structure: Array<{
      timestamp: string
      duration: string
      type: string
      description: string
      visualNotes: string
      audioNotes: string
      emotionalValence: number
    }>
    keyTechniques: string[]
    reusableElements: string[]
    adaptationNotes: string
  }
  emotionalCurve: Array<{ phase: string; valence: number; intensity: number }>
  keyMetrics: {
    hookTime: string
    conflictDensity: string
    twistCount: number
    pacing: string
  }
  source: string
}

export async function analyzeRemix(
  videoDescription: string,
  opts?: { templateId?: string; category?: string; useLLM?: boolean },
): Promise<RemixAnalysisResult> {
  const res = await fetch("/api/ai/remix-analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      videoDescription,
      templateId: opts?.templateId,
      category: opts?.category,
      useLLM: opts?.useLLM,
    }),
  })

  const data = await res.json()

  if (!res.ok || data.error) {
    throw normalizeGenerationError(data.error?.message || "爆款拆解分析失败")
  }

  return data as RemixAnalysisResult
}

// ── Poster Generation ───────────────────────────────────────────────────────

export interface PosterGenerationResult {
  image: string // base64
  posterType: string
  prompt: string
  revisedPrompt?: string
  aspectRatio: string
  size: string
}

export async function generatePoster(params: {
  subject: string
  posterType?: "character-card" | "concept-art" | "promo-poster" | "social-cover" | "story-poster"
  style?: string
  extras?: string
}): Promise<PosterGenerationResult> {
  const res = await fetch("/api/ai/generate-poster", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: params.subject,
      posterType: params.posterType || "promo-poster",
      style: params.style || "cinematic",
      extras: params.extras || "",
    }),
  })

  const data = await res.json()

  if (!res.ok || data.error) {
    throw normalizeGenerationError(data.error?.message || "海报生成失败")
  }

  return data as PosterGenerationResult
}

// ── Upscale ─────────────────────────────────────────────────────────────────

export interface UpscaleResult {
  status: string
  message: string
  options: {
    scale: number
    denoise: number
    faceEnhance: boolean
    model: string
  }
  guide: string
  recommendedNextSteps: string[]
  clientFallback: {
    available: boolean
    method: string
    note: string
  }
}

export async function upscaleImage(params: {
  image: string
  scale?: 2 | 4 | 8
  denoise?: number
  faceEnhance?: boolean
  model?: "realesrgan" | "esrgan" | "sd-upscale"
}): Promise<UpscaleResult> {
  const res = await fetch("/api/ai/upscale", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image: params.image,
      scale: params.scale || 4,
      denoise: params.denoise ?? 0.5,
      faceEnhance: params.faceEnhance ?? false,
      model: params.model || "realesrgan",
    }),
  })

  const data = await res.json()

  if (!res.ok || data.error) {
    throw normalizeGenerationError(data.error?.message || "高清放大请求失败")
  }

  return data as UpscaleResult
}

// ── Talking Photo ───────────────────────────────────────────────────────────

export interface TalkingPhotoResult {
  status: string
  message: string
  options: {
    mode: string
    audioSource: string
    voiceId?: string
    language: string
    emotion: string
    headMovement: boolean
    eyeContact: boolean
    background: string
  }
  guide: string
  recommendedNextSteps: string[]
  clientFallback: {
    available: boolean
    note: string
  }
}

export async function generateTalkingPhoto(params: {
  image: string
  audio?: string
  text?: string
  mode?: "lip-sync" | "full-head" | "avatar"
  audioSource?: "text-to-speech" | "upload" | "clone"
  voiceId?: string
  language?: string
  emotion?: "neutral" | "happy" | "sad" | "angry" | "surprised"
  headMovement?: boolean
  eyeContact?: boolean
  background?: "transparent" | "blur" | "original"
}): Promise<TalkingPhotoResult> {
  const res = await fetch("/api/ai/talking-photo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image: params.image,
      audio: params.audio,
      text: params.text,
      mode: params.mode || "lip-sync",
      audioSource: params.audioSource || "text-to-speech",
      voiceId: params.voiceId,
      language: params.language || "zh",
      emotion: params.emotion || "neutral",
      headMovement: params.headMovement !== false,
      eyeContact: params.eyeContact !== false,
      background: params.background || "original",
    }),
  })

  const data = await res.json()

  if (!res.ok || data.error) {
    throw normalizeGenerationError(data.error?.message || "数字人生成请求失败")
  }

  return data as TalkingPhotoResult
}
