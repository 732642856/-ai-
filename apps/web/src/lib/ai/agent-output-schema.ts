// ============================================================================
// Agent Output Schema — 结构化校验分镜导演 Agent 的输出
// ============================================================================
// 解决 P0-3: 当前使用弱校验（枚举白名单+默认值静默替换），
// Agent 输出格式异常时可能导致关键导演意图丢失。
// 使用纯 TS 类型守卫实现，零外部依赖。
// ============================================================================

// ── 常量枚举 ──
const EMOTIONAL_STATES = new Set([
  "calm", "tense", "fear", "anger", "joy", "sadness",
  "intimacy", "isolation", "suspense", "revelation",
  "confusion", "hope", "despair", "power", "vulnerability",
])

const SCENE_FUNCTIONS = new Set([
  "establishing", "confrontation", "turning-point", "climax",
  "resolution", "transition", "exposition", "montage",
])

const SHOT_SIZES = new Set([
  "extreme-wide", "wide", "medium", "close-up", "extreme-close-up",
])

const CAMERA_ANGLES = new Set([
  "eye-level", "low-angle", "high-angle", "over-shoulder",
  "top-shot", "dutch-angle",
])

const CAMERA_MOVEMENTS = new Set([
  "static", "push-in", "pull-out", "pan", "tilt",
  "tracking", "handheld", "dolly", "crane", "zoom",
])

// ── 类型 ──
export interface ValidatedStoryboardPlan {
  scenes?: ValidatedScene[]
  shots: ValidatedShot[]
  emotionalCurve?: number[]
  overallDuration?: number
}

export interface ValidatedScene {
  sceneId?: string
  sceneNumber?: number
  location?: string
  timeOfDay?: string
  characters?: string[]
  sceneFunction?: string
  emotionalArc?: { start: string; peak: string; end: string }
  dramaticTension?: number
  summary?: string
}

export interface ValidatedShot {
  order: number
  sceneId: string
  shotId?: string
  dramaticBeat?: string
  shotPurpose?: string
  emotionalState?: string
  dramaticWeight?: number
  shotSize?: string
  cameraAngle?: string
  cameraMovement?: string
  lens?: string
  composition?: string
  blocking?: string
  durationEstimate?: number
  visualPrompt?: string
  negativePrompt?: string
  dialogue?: string
  subtext?: string
  voiceIntent?: string
  soundCue?: string
  referenceTags?: string[]
  riskFlags?: string[]
}

export type SchemaValidationResult =
  | { valid: true; data: ValidatedStoryboardPlan }
  | { valid: false; errors: string[] }

// ── 类型守卫 ──

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isValidShot(obj: Record<string, unknown>, index: number): string[] {
  const errors: string[] = []

  // order: required, positive integer
  if (typeof obj.order !== "number" || !Number.isInteger(obj.order) || obj.order < 1) {
    errors.push(`shots[${index}].order: must be a positive integer, got ${JSON.stringify(obj.order)}`)
  }

  // sceneId: required, non-empty string
  if (typeof obj.sceneId !== "string" || obj.sceneId.trim().length === 0) {
    errors.push(`shots[${index}].sceneId: required non-empty string`)
  }

  // Optional fields — validate only if present
  if (obj.shotSize !== undefined && (typeof obj.shotSize !== "string" || !SHOT_SIZES.has(obj.shotSize))) {
    errors.push(`shots[${index}].shotSize: must be one of ${[...SHOT_SIZES].join("|")}, got "${obj.shotSize}"`)
  }
  if (obj.cameraAngle !== undefined && (typeof obj.cameraAngle !== "string" || !CAMERA_ANGLES.has(obj.cameraAngle))) {
    errors.push(`shots[${index}].cameraAngle: must be one of ${[...CAMERA_ANGLES].join("|")}, got "${obj.cameraAngle}"`)
  }
  if (obj.cameraMovement !== undefined && (typeof obj.cameraMovement !== "string" || !CAMERA_MOVEMENTS.has(obj.cameraMovement))) {
    errors.push(`shots[${index}].cameraMovement: must be one of ${[...CAMERA_MOVEMENTS].join("|")}, got "${obj.cameraMovement}"`)
  }
  if (obj.emotionalState !== undefined && (typeof obj.emotionalState !== "string" || !EMOTIONAL_STATES.has(obj.emotionalState))) {
    errors.push(`shots[${index}].emotionalState: must be one of ${[...EMOTIONAL_STATES].join("|")}, got "${obj.emotionalState}"`)
  }
  if (obj.dramaticWeight !== undefined && (typeof obj.dramaticWeight !== "number" || obj.dramaticWeight < 1 || obj.dramaticWeight > 10)) {
    errors.push(`shots[${index}].dramaticWeight: must be 1-10, got ${obj.dramaticWeight}`)
  }
  if (obj.durationEstimate !== undefined && (typeof obj.durationEstimate !== "number" || obj.durationEstimate < 1 || obj.durationEstimate > 12)) {
    errors.push(`shots[${index}].durationEstimate: must be 1-12, got ${obj.durationEstimate}`)
  }
  if (obj.order !== undefined && (typeof obj.order !== "number" || !Number.isInteger(obj.order))) {
    errors.push(`shots[${index}].order: must be an integer`)
  }

  return errors
}

function isValidScene(obj: Record<string, unknown>, index: number): string[] {
  const errors: string[] = []

  if (obj.sceneId !== undefined && typeof obj.sceneId !== "string") {
    errors.push(`scenes[${index}].sceneId: must be a string`)
  }
  if (obj.sceneFunction !== undefined && (typeof obj.sceneFunction !== "string" || !SCENE_FUNCTIONS.has(obj.sceneFunction))) {
    errors.push(`scenes[${index}].sceneFunction: must be one of ${[...SCENE_FUNCTIONS].join("|")}`)
  }
  if (obj.dramaticTension !== undefined && (typeof obj.dramaticTension !== "number" || obj.dramaticTension < 1 || obj.dramaticTension > 10)) {
    errors.push(`scenes[${index}].dramaticTension: must be 1-10`)
  }
  if (obj.characters !== undefined && !Array.isArray(obj.characters)) {
    errors.push(`scenes[${index}].characters: must be an array`)
  }

  return errors
}

/**
 * 校验 Agent 输出是否符合 StoryboardPlan 结构。
 * 返回类型安全的校验结果，用于决定是否需要重试。
 */
export function validateStoryboardPlan(raw: unknown): SchemaValidationResult {
  if (!isObject(raw)) {
    return { valid: false, errors: ["Root must be a JSON object"] }
  }

  const errors: string[] = []

  // shots: required array
  const shots = raw.shots
  if (!Array.isArray(shots)) {
    errors.push("shots: required array field is missing or not an array")
    return { valid: false, errors }
  }

  if (shots.length === 0) {
    errors.push("shots: array must contain at least 1 shot")
    return { valid: false, errors }
  }

  // Validate each shot
  for (let i = 0; i < shots.length; i++) {
    if (!isObject(shots[i])) {
      errors.push(`shots[${i}]: must be an object`)
      continue
    }
    errors.push(...isValidShot(shots[i], i))
  }

  // Optional scenes array
  const scenes = raw.scenes
  if (scenes !== undefined) {
    if (!Array.isArray(scenes)) {
      errors.push("scenes: must be an array if present")
    } else {
      for (let i = 0; i < scenes.length; i++) {
        if (isObject(scenes[i])) {
          errors.push(...isValidScene(scenes[i], i))
        } else {
          errors.push(`scenes[${i}]: must be an object`)
        }
      }
    }
  }

  // emotionalCurve: optional array of numbers
  if (raw.emotionalCurve !== undefined) {
    if (!Array.isArray(raw.emotionalCurve)) {
      errors.push("emotionalCurve: must be an array of numbers")
    }
  }

  // overallDuration: optional positive number
  if (raw.overallDuration !== undefined && (typeof raw.overallDuration !== "number" || raw.overallDuration <= 0)) {
    errors.push("overallDuration: must be a positive number")
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return { valid: true, data: raw as unknown as ValidatedStoryboardPlan }
}

/**
 * 检查校验失败是否可重试（结构性错误 vs 数据错误）。
 * 结构性错误（missing field, wrong type）可通过重试修复；
 * 数据错误（enum mismatch）可能无法通过重试修复。
 */
export function isSchemaRetryable(errors: string[]): boolean {
  return errors.some((e) =>
    e.includes("required") ||
    e.includes("must be") ||
    e.includes("missing") ||
    e.includes("not an array") ||
    e.includes("not an object"),
  )
}

/**
 * 构建友好的校验错误消息，用于日志和用户提示。
 */
export function formatSchemaErrors(errors: string[]): string {
  return `Agent 输出格式校验失败 (${errors.length} 项):\n${errors.map((e) => `  • ${e}`).join("\n")}`
}
