import type {
  CameraAngle,
  CameraMovement,
  CinematicShot,
  ContinuityWarning,
  EmotionalState,
  SceneAnalysis,
  SceneFunction,
  ShotSize,
  StoryboardPlan,
} from "@/types/cinematic"
import type { CharacterIdentityAsset, StoryboardShotData } from "@/app/canvas/components/canvas/types"
import { EMOTION_SHOT_STRATEGY, createCinematicShotId, runAllChecks } from "./cinematic-rules.ts"
import { validateStoryboardPlan, formatSchemaErrors } from "./ai/agent-output-schema.ts"

export const STORYBOARD_DIRECTOR_SYSTEM_PROMPT = `你是一位专业影视分镜导演 AI。你的职责是将剧本文本转化为专业的、有导演意图的分镜方案。

## 工作流程

### 步骤 1：场景分析
- 识别场景边界：地点变化、时间跳跃、人物关系变化、叙事功能变化都可能形成新场景。
- 为每个场景标注地点、时间、出场角色、场景功能和情绪弧线。
- 场景功能只能使用：establishing / confrontation / turning-point / climax / resolution / transition / exposition / montage。

### 步骤 2：人物关系与权力结构
- 提取角色列表，判断谁主动、谁被动、谁掌握信息。
- 权力更高的角色可使用 low-angle、稳定构图、占据画面中心。
- 权力更低或脆弱的角色可使用 high-angle、边缘构图、被空间压缩。

### 步骤 3：情绪曲线设计
- 每个场景必须有 start → peak → end 的情绪变化。
- 情绪类型只能使用：calm / tense / fear / anger / joy / sadness / intimacy / isolation / suspense / revelation / confusion / hope / despair / power / vulnerability。
- 避免连续多个镜头情绪完全不变，除非是在刻意制造压抑停滞。

### 步骤 4：镜头方案生成
请严格遵守以下镜头语言规则：
1. 场景开场通常使用 extreme-wide 或 wide 建立空间，除非用局部细节制造悬念。
2. 相邻镜头景别要有节奏变化，避免连续同景别。必要时使用 wide → medium → close-up 的推进。
3. 情绪决定镜头策略：
   - calm：平视、固定、中远景、平衡构图。
   - tense：缓慢推近、倾斜或压迫构图、留出危险的 off-screen space。
   - fear：近景/特写、手持、遮挡、浅景深。
   - anger：低角度、推近、压迫性近景。
   - intimacy：近景、平视、柔和静态、视线匹配。
   - isolation：大远景/远景、高角度、巨大留白。
   - suspense：局部信息、阴影、背影、遮挡、慢推。
   - revelation：推近或特写，清楚揭示关键细节。
4. 对话场景必须维持 180 度轴线，正反打 screenDirection 应相反。
5. 不要过早暴露关键信息，用遮挡、局部、反应镜头控制信息释放。
6. 每个镜头必须有 shotPurpose，不允许为了凑数。
7. 潜台词比台词更重要，镜头应该拍出没有说出来的东西。

## 输出格式
只输出 JSON，不要前言、解释、Markdown 代码块。JSON 结构：
{
  "scenes": SceneAnalysis[],
  "shots": CinematicShot[],
  "emotionalCurve": number[],
  "overallDuration": number
}

每个 shot 必须包含 CinematicShot 的核心字段：order、sceneId、shotId、dramaticBeat、shotPurpose、emotionalState、dramaticWeight、shotSize、cameraAngle、cameraMovement、composition、blocking、durationEstimate、visualPrompt。

特别注意：
- visualPrompt 必须是英文，可直接用于图像/视频模型。
- negativePrompt 应列出要避免的错误画面。
- voiceIntent 必须写出语气、语速、情感和潜台词。
- durationEstimate 要合理：远景 4-6 秒，中景 2-4 秒，近景/特写 1-3 秒。
- dramaticWeight 为 1-10，越关键越高。`

export type DirectorAgentInput = {
  script: string
  characterRelations?: string
  genre: string
  style: string
  targetPlatform: "short-drama" | "film" | "interactive" | "commercial"
  shotDensity: "sparse" | "normal" | "dense"
  additionalNotes?: string
  title?: string
}

export type RawStoryboardDirectorOutput = {
  scenes?: SceneAnalysis[]
  shots?: CinematicShot[]
  emotionalCurve?: number[]
  overallDuration?: number
}

export function buildDirectorPrompt(input: DirectorAgentInput): string {
  return `${STORYBOARD_DIRECTOR_SYSTEM_PROMPT}

---

## 当前任务

### 剧本正文
${input.script.trim()}

### 类型
${input.genre}

### 视觉风格
${input.style}

### 目标平台
${input.targetPlatform}

### 镜头密度
${input.shotDensity}
${input.characterRelations ? `\n### 人物关系\n${input.characterRelations}` : ""}
${input.additionalNotes ? `\n### 补充要求\n${input.additionalNotes}` : ""}

请输出完整的专业分镜方案 JSON。`
}

export function postProcessStoryboard(
  raw: RawStoryboardDirectorOutput,
  meta: Partial<Pick<StoryboardPlan, "title" | "genre" | "style" | "targetPlatform" | "shotDensity">> = {},
): StoryboardPlan {
  // ── P0-3: Zod Schema 校验 ──
  // 在弱校验（normalize）之前先做强校验，以便上层决定是否重试
  const validation = validateStoryboardPlan(raw)
  if (!validation.valid) {
    // 校验失败时仍用弱校验兜底（保证不崩溃），但记录警告
    const warnMsg = formatSchemaErrors(validation.errors)
    console.warn("[StoryboardDirector] Schema validation warning:", warnMsg)
  }

  const scenes = normalizeScenes(raw.scenes ?? [])
  const fallbackSceneId = scenes[0]?.sceneId || "scene-1"
  const shots = normalizeShots(raw.shots ?? [], fallbackSceneId)
  const continuityReport = runAllChecks(shots)
  const finalShots = attachRiskFlags(shots, continuityReport)
  const overallDuration = raw.overallDuration ?? finalShots.reduce((sum, shot) => sum + shot.durationEstimate, 0)

  return {
    projectId: `storyboard-${Date.now()}`,
    title: meta.title ?? "",
    genre: meta.genre ?? "",
    style: meta.style ?? "",
    targetPlatform: meta.targetPlatform ?? "short-drama",
    shotDensity: meta.shotDensity ?? "normal",
    scenes,
    shots: finalShots,
    emotionalCurve: raw.emotionalCurve ?? scenes.map((scene) => scene.dramaticTension),
    continuityReport,
    overallDuration,
  }
}

/**
 * 带 Schema 校验的 postProcess，返回校验状态供调用方决定是否重试。
 * 校验通过 → { valid: true, plan }
 * 校验失败 → { valid: false, plan, errors }  (plan 仍用弱校验兜底返回)
 */
export function validateAndPostProcessStoryboard(
  raw: RawStoryboardDirectorOutput,
  meta: Partial<Pick<StoryboardPlan, "title" | "genre" | "style" | "targetPlatform" | "shotDensity">> = {},
): { valid: boolean; plan: StoryboardPlan; errors?: string[] } {
  const validation = validateStoryboardPlan(raw)
  const plan = postProcessStoryboard(raw, meta)

  if (validation.valid) {
    return { valid: true, plan }
  }

  return { valid: false, plan, errors: validation.errors }
}

export function cinematicShotToStoryboardShot(
  shot: CinematicShot,
  sourceStoryboardNodeId?: string,
  scene?: SceneAnalysis,
): StoryboardShotData {
  return {
    id: shot.shotId,
    order: shot.order,
    title: `镜头 ${String(shot.order).padStart(2, "0")} · ${shot.dramaticBeat}`,
    shotType: shot.shotSize,
    cameraMovement: shot.cameraMovement,
    duration: `${shot.durationEstimate}s`,
    description: [
      shot.shotPurpose,
      shot.blocking,
      shot.composition,
      shot.subtext ? `潜台词：${shot.subtext}` : "",
    ].filter(Boolean).join("\n"),
    visualPrompt: shot.visualPrompt,
    negativePrompt: shot.negativePrompt,
    dialogue: shot.dialogue,
    characterIdentities: inferCharacterIdentitiesForShot(shot, scene),
    notes: [
      `剧情节拍：${shot.dramaticBeat}`,
      `情绪：${shot.emotionalState}`,
      `机位：${shot.cameraAngle}`,
      `构图：${shot.composition}`,
      `调度：${shot.blocking}`,
      shot.voiceIntent ? `配音意图：${shot.voiceIntent}` : "",
      shot.soundCue ? `声音提示：${shot.soundCue}` : "",
      shot.riskFlags?.length ? `连续性提示：${shot.riskFlags.join("；")}` : "",
    ].filter(Boolean).join("\n"),
    sourceStoryboardNodeId,
    status: shot.riskFlags?.some((flag) => flag.includes("[critical]")) ? "draft" : "ready",
  }
}

export function storyboardPlanToShotData(plan: StoryboardPlan, sourceStoryboardNodeId?: string): StoryboardShotData[] {
  const sceneById = new Map(plan.scenes.map((scene) => [scene.sceneId, scene]))
  return plan.shots.map((shot) => cinematicShotToStoryboardShot(shot, sourceStoryboardNodeId, sceneById.get(shot.sceneId)))
}

function cleanIdentityText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""
}

function uniqueCleanStrings(values: unknown[]): string[] {
  return [...new Set(values.map(cleanIdentityText).filter(Boolean))]
}

function createCharacterIdentityId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
  return `character-${slug || "unknown"}`
}

function inferCharacterRole(name: string, index: number): string | undefined {
  if (/女主|男主|主角|protagonist|hero|heroine/i.test(name)) return "protagonist"
  if (/反派|敌人|villain|antagonist/i.test(name)) return "antagonist"
  return index === 0 ? "primary-character" : undefined
}

function collectIdentityHints(shot: CinematicShot, characterName: string): string[] {
  const sources = [
    shot.visualPrompt,
    shot.blocking,
    shot.composition,
    shot.shotPurpose,
    ...(shot.referenceTags ?? []),
    ...(shot.riskFlags ?? []),
  ]
  return uniqueCleanStrings(sources.filter((value) => cleanIdentityText(value).includes(characterName)))
}

export function inferCharacterIdentitiesForShot(
  shot: CinematicShot,
  scene?: SceneAnalysis,
): CharacterIdentityAsset[] | undefined {
  const sceneCharacters = scene?.characters ?? []
  const fallbackCharacters = [shot.dialogue, shot.blocking, shot.visualPrompt]
    .map(cleanIdentityText)
    .flatMap((text) => Array.from(text.matchAll(/(?:女主|男主|主角|反派|老人|孩子|少年|少女|女人|男人|mother|father|boy|girl|woman|man|protagonist|antagonist)/gi)).map((match) => match[0]))
  const names = uniqueCleanStrings([...sceneCharacters, ...fallbackCharacters])

  if (names.length === 0) return undefined

  return names.map((name, index) => {
    const hints = collectIdentityHints(shot, name)
    const asset: CharacterIdentityAsset = {
      id: createCharacterIdentityId(name),
      name,
      role: inferCharacterRole(name, index),
      visualSignature: hints.length > 0 ? hints.join("; ") : `${name} must remain the same recognizable actor-like identity across panels`,
      costume: "preserve the same wardrobe and styling cues when this character reappears",
      props: uniqueCleanStrings([...(shot.referenceTags ?? []), ...(shot.riskFlags ?? [])]).slice(0, 4),
      notes: "Auto-inferred from DirectorAgent scene characters and cinematic shot metadata",
    }

    if (!asset.props?.length) delete asset.props
    return asset
  })
}

export function stripJsonFences(text: string): string {
  return text.replace(/^```(?:json|JSON)?\s*/g, "").replace(/```$/g, "").trim()
}

export function parseDirectorJson(text: string): RawStoryboardDirectorOutput {
  const cleaned = stripJsonFences(text)
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  const json = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned
  return JSON.parse(json) as RawStoryboardDirectorOutput
}

function normalizeScenes(scenes: SceneAnalysis[]): SceneAnalysis[] {
  if (scenes.length === 0) {
    return [{
      sceneId: "scene-1",
      sceneNumber: 1,
      location: "未指定场景",
      timeOfDay: "未指定时间",
      characters: [],
      sceneFunction: "establishing",
      emotionalArc: { start: "calm", peak: "tense", end: "calm" },
      dramaticTension: 5,
      summary: "默认场景",
    }]
  }

  return scenes.map((scene, index) => ({
    ...scene,
    sceneId: scene.sceneId || `scene-${index + 1}`,
    sceneNumber: scene.sceneNumber || index + 1,
    location: scene.location || "未指定场景",
    timeOfDay: scene.timeOfDay || "未指定时间",
    characters: Array.isArray(scene.characters) ? scene.characters : [],
    sceneFunction: normalizeSceneFunction(scene.sceneFunction),
    emotionalArc: {
      start: normalizeEmotion(scene.emotionalArc?.start),
      peak: normalizeEmotion(scene.emotionalArc?.peak),
      end: normalizeEmotion(scene.emotionalArc?.end),
    },
    dramaticTension: clampNumber(scene.dramaticTension, 1, 10, 5),
    summary: scene.summary || "",
  }))
}

function normalizeShots(shots: CinematicShot[], fallbackSceneId: string): CinematicShot[] {
  return shots.map((shot, index) => {
    const sceneId = shot.sceneId || fallbackSceneId
    const order = Number.isFinite(shot.order) ? shot.order : index + 1
    const emotionalState = normalizeEmotion(shot.emotionalState)
    const strategy = EMOTION_SHOT_STRATEGY[emotionalState]

    return {
      ...shot,
      order,
      sceneId,
      shotId: shot.shotId || createCinematicShotId(sceneId, order),
      dramaticBeat: shot.dramaticBeat || `剧情节拍 ${order}`,
      shotPurpose: shot.shotPurpose || "推进剧情或情绪",
      emotionalState,
      dramaticWeight: clampNumber(shot.dramaticWeight, 1, 10, 5),
      shotSize: normalizeShotSize(shot.shotSize, strategy.preferredSizes[0]),
      cameraAngle: normalizeCameraAngle(shot.cameraAngle, strategy.preferredAngle),
      cameraMovement: normalizeCameraMovement(shot.cameraMovement, strategy.preferredMovement),
      lens: shot.lens || strategy.lens,
      composition: shot.composition || strategy.composition,
      blocking: shot.blocking || "人物调度未指定，保持与场景动作一致",
      durationEstimate: clampNumber(shot.durationEstimate, 1, 12, 3),
      visualPrompt: shot.visualPrompt || buildFallbackVisualPrompt(shot, strategy),
      negativePrompt: shot.negativePrompt || "avoid low quality, inconsistent characters, confusing geography, broken anatomy",
      referenceTags: Array.isArray(shot.referenceTags) ? shot.referenceTags : [],
      riskFlags: Array.isArray(shot.riskFlags) ? shot.riskFlags : [],
    }
  }).sort((a, b) => a.sceneId.localeCompare(b.sceneId) || a.order - b.order)
}

function attachRiskFlags(shots: CinematicShot[], warnings: ContinuityWarning[]): CinematicShot[] {
  const warningsByShot = new Map<string, ContinuityWarning[]>()
  for (const warning of warnings) {
    for (const shotId of warning.shotIds) {
      const current = warningsByShot.get(shotId) ?? []
      current.push(warning)
      warningsByShot.set(shotId, current)
    }
  }

  return shots.map((shot) => ({
    ...shot,
    riskFlags: [
      ...(shot.riskFlags ?? []),
      ...(warningsByShot.get(shot.shotId)?.map((warning) => `[${warning.severity}] ${warning.message}`) ?? []),
    ],
  }))
}

function buildFallbackVisualPrompt(shot: CinematicShot, strategy: { composition: string; lens: string }): string {
  return [
    `${shot.shotSize} cinematic storyboard frame`,
    `${shot.cameraAngle} camera angle`,
    `${shot.cameraMovement} camera movement`,
    strategy.composition,
    shot.blocking,
    "professional film storyboard, coherent visual geography",
  ].filter(Boolean).join(", ")
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === "number" && Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, num))
}

function normalizeEmotion(value: unknown): EmotionalState {
  const allowed: EmotionalState[] = ["calm", "tense", "fear", "anger", "joy", "sadness", "intimacy", "isolation", "suspense", "revelation", "confusion", "hope", "despair", "power", "vulnerability"]
  return allowed.includes(value as EmotionalState) ? value as EmotionalState : "tense"
}

function normalizeSceneFunction(value: unknown): SceneFunction {
  const allowed: SceneFunction[] = ["establishing", "confrontation", "turning-point", "climax", "resolution", "transition", "exposition", "montage"]
  return allowed.includes(value as SceneFunction) ? value as SceneFunction : "establishing"
}

function normalizeShotSize(value: unknown, fallback: ShotSize): ShotSize {
  const allowed: ShotSize[] = ["extreme-wide", "wide", "medium", "close-up", "extreme-close-up"]
  return allowed.includes(value as ShotSize) ? value as ShotSize : fallback
}

function normalizeCameraAngle(value: unknown, fallback: CameraAngle): CameraAngle {
  const allowed: CameraAngle[] = ["eye-level", "low-angle", "high-angle", "over-shoulder", "top-shot", "dutch-angle"]
  return allowed.includes(value as CameraAngle) ? value as CameraAngle : fallback
}

function normalizeCameraMovement(value: unknown, fallback: CameraMovement): CameraMovement {
  const allowed: CameraMovement[] = ["static", "push-in", "pull-out", "pan", "tilt", "tracking", "handheld", "dolly", "crane", "zoom"]
  return allowed.includes(value as CameraMovement) ? value as CameraMovement : fallback
}
