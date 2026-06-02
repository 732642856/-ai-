// ============================================================================
// ttsService — OmniVoice TTS via HuggingFace Gradio Space API
// Phase 1: Voice Design mode via HF Space HTTP API
// Phase 2: Self-hosted FastAPI service (clone + design + auto)
// ============================================================================

import type { StoryboardShotData, VoiceConfig } from "../components/canvas/types"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HF_SPACE_URL = "https://k2-fsa-omnivoice.hf.space"
const TTS_TIMEOUT_MS = 120_000

// ---------------------------------------------------------------------------
// Natural Language → OmniVoice instruct parser
// ---------------------------------------------------------------------------

/**
 * 中文自然语言配音描述 → OmniVoice instruct 格式
 *
 * 用户输入示例：
 * - "温柔的年轻女声"
 * - "沙哑的中年大叔"
 * - "惊恐的少年"
 * - "东北话老爷爷"
 * - "英式男声，低沉"
 * - "小女孩，清脆"
 *
 * OmniVoice instruct 格式：逗号分隔的属性描述
 * 结构化部分：Gender, Age, Pitch, Style, Accent, Dialect
 * 情感部分：作为自然语言描述直接附加
 */

interface ParsedVoiceAttributes {
  gender?: string
  age?: string
  pitch?: string
  style?: string
  englishAccent?: string
  chineseDialect?: string
  /** 情感/语气描述，无法映射到结构化属性的 */
  emotional?: string
  /** 原始描述文本 */
  raw: string
}

// ---- 关键词 → 属性映射表 ----

const GENDER_MAP: Record<string, string> = {
  "男": "Male", "男性": "Male", "男人": "Male", "先生": "Male", "大哥": "Male",
  "男声": "Male", "男性声音": "Male", "男生": "Male",
  "女": "Female", "女性": "Female", "女人": "Female", "女士": "Female", "大姐": "Female",
  "女声": "Female", "女性声音": "Female", "女生": "Female", "姑娘": "Female",
}

const AGE_MAP: Record<string, string> = {
  "小孩": "Child", "儿童": "Child", "宝宝": "Child", "小女孩": "Child", "小男孩": "Child",
  "少年": "Teenager", "少女": "Teenager", "少年声音": "Teenager",
  "青年": "Young Adult", "年轻": "Young Adult", "小哥": "Young Adult",
  "中年": "Middle-aged", "大叔": "Middle-aged", "阿姨": "Middle-aged",
  "老年": "Elderly", "老人": "Elderly", "老爷爷": "Elderly", "老奶奶": "Elderly",
  "大爷": "Elderly", "奶奶": "Elderly", "爷爷": "Elderly",
}

const PITCH_MAP: Record<string, string> = {
  "低沉": "Low Pitch", "沙哑": "Low Pitch", "粗犷": "Low Pitch", "浑厚": "Low Pitch",
  "沉稳": "Low Pitch", "厚重": "Low Pitch", "粗": "Low Pitch",
  "极低": "Very Low Pitch",
  "清脆": "High Pitch", "尖锐": "High Pitch", "高亢": "High Pitch",
  "细": "High Pitch", "尖": "High Pitch",
  "极高": "Very High Pitch",
}

const STYLE_MAP: Record<string, string> = {
  "耳语": "Whisper", "轻声": "Whisper", "悄悄话": "Whisper", "低语": "Whisper",
  "气声": "Whisper",
}

const ENGLISH_ACCENT_MAP: Record<string, string> = {
  "美式": "American Accent", "美音": "American Accent", "美式英语": "American Accent",
  "英式": "British Accent", "英音": "British Accent", "英式英语": "British Accent",
  "澳式": "Australian Accent", "澳音": "Australian Accent",
  "加拿大": "Canadian Accent",
}

const CHINESE_DIALECT_MAP: Record<string, string> = {
  "东北话": "东北话", "东北口音": "东北话", "东北": "东北话",
  "四川话": "四川话", "四川口音": "四川话", "川话": "四川话",
  "陕西话": "陕西话", "陕西口音": "陕西话",
  "河南话": "河南话", "河南口音": "河南话",
  "贵州话": "贵州话",
  "云南话": "云南话",
  "桂林话": "桂林话",
  "济南话": "济南话",
  "石家庄话": "石家庄话",
  "甘肃话": "甘肃话",
  "宁夏话": "宁夏话",
  "青岛话": "青岛话",
}

/** 情感/语气关键词 → 无法直接映射到结构化属性，保留为自然语言描述 */
const EMOTIONAL_KEYWORDS = [
  "温柔", "激动", "惊恐", "害怕", "愤怒", "悲伤", "开心", "兴奋",
  "冷漠", "犹豫", "紧张", "哭腔", "颤抖", "嘶吼", "咆哮",
  "冷静", "严肃", "调皮", "可爱", "慵懒", "疲惫", "虚弱",
  "坚定", "自信", "傲慢", "嘲讽", "宠溺", "心疼",
  "悲伤地", "愤怒地", "激动地", "温柔地", "冷静地",
]

/**
 * 从自然语言描述解析出结构化声音属性。
 *
 * 策略：
 * 1. 优先匹配结构化属性（性别/年龄/音调/风格/口音/方言）
 * 2. 无法映射的情感/语气词保留为自然语言描述
 * 3. 如果整个描述无法解析任何属性，原样返回（让 OmniVoice 模型自己理解）
 */
export function parseVoiceDescription(description: string): ParsedVoiceAttributes {
  const result: ParsedVoiceAttributes = { raw: description }
  const remaining = description

  // 匹配结构化属性
  for (const [keyword, value] of Object.entries(GENDER_MAP)) {
    if (remaining.includes(keyword)) {
      result.gender = value
      break
    }
  }

  for (const [keyword, value] of Object.entries(AGE_MAP)) {
    if (remaining.includes(keyword)) {
      result.age = value
      break
    }
  }

  for (const [keyword, value] of Object.entries(PITCH_MAP)) {
    if (remaining.includes(keyword)) {
      result.pitch = value
      break
    }
  }

  for (const [keyword, value] of Object.entries(STYLE_MAP)) {
    if (remaining.includes(keyword)) {
      result.style = value
      break
    }
  }

  for (const [keyword, value] of Object.entries(ENGLISH_ACCENT_MAP)) {
    if (remaining.includes(keyword)) {
      result.englishAccent = value
      break
    }
  }

  for (const [keyword, value] of Object.entries(CHINESE_DIALECT_MAP)) {
    if (remaining.includes(keyword)) {
      result.chineseDialect = value
      break
    }
  }

  // 提取情感关键词
  const foundEmotions: string[] = []
  for (const keyword of EMOTIONAL_KEYWORDS) {
    if (remaining.includes(keyword)) {
      foundEmotions.push(keyword)
    }
  }
  if (foundEmotions.length > 0) {
    result.emotional = foundEmotions.join("、")
  }

  return result
}

/**
 * 从解析后的属性构建 OmniVoice instruct 字符串。
 *
 * 格式：结构化属性在前，情感描述在后（英文翻译）
 * 示例："Female, Young Adult, speaking gently"
 * 示例："Male, Middle-aged, Low Pitch, hoarse voice, frightened"
 */
export function buildInstructFromParsed(parsed: ParsedVoiceAttributes): string {
  const parts: string[] = []

  // 结构化属性（OmniVoice 格式）
  if (parsed.gender) parts.push(parsed.gender)
  if (parsed.age) parts.push(parsed.age)
  if (parsed.pitch) parts.push(parsed.pitch)
  if (parsed.style) parts.push(parsed.style)
  if (parsed.englishAccent) parts.push(parsed.englishAccent)
  if (parsed.chineseDialect) parts.push(parsed.chineseDialect)

  // 情感描述：翻译为英文追加
  if (parsed.emotional) {
    const emotionMap: Record<string, string> = {
      "温柔": "speaking gently", "温柔地": "speaking gently",
      "激动": "excited", "激动地": "excitedly",
      "惊恐": "frightened", "害怕": "scared",
      "愤怒": "angry", "愤怒地": "angrily",
      "悲伤": "sad", "悲伤地": "sadly",
      "开心": "happy", "兴奋": "excited",
      "冷漠": "cold and indifferent", "犹豫": "hesitant",
      "紧张": "nervous", "哭腔": "crying voice",
      "颤抖": "trembling voice", "嘶吼": "roaring",
      "咆哮": "roaring", "冷静": "calm", "冷静地": "calmly",
      "严肃": "serious", "调皮": "playful",
      "可爱": "cute and playful", "慵懒": "lazy and relaxed",
      "疲惫": "exhausted", "虚弱": "weak voice",
      "坚定": "firm and resolute", "自信": "confident",
      "傲慢": "arrogant", "嘲讽": "sarcastic",
      "宠溺": "affectionate", "心疼": "heartbroken",
    }
    const emotions = parsed.emotional.split("、")
    for (const emotion of emotions) {
      const mapped = emotionMap[emotion]
      if (mapped) parts.push(mapped)
    }
  }

  // 如果没解析出任何属性，用原始描述作为 instruct
  if (parts.length === 0 && parsed.raw.trim()) {
    return parsed.raw.trim()
  }

  return parts.join(", ")
}

/**
 * 一步到位：自然语言描述 → OmniVoice instruct
 */
export function voiceDescriptionToInstruct(description: string): string {
  if (!description.trim()) return ""
  const parsed = parseVoiceDescription(description)
  return buildInstructFromParsed(parsed)
}

// ---------------------------------------------------------------------------
// Quick tag definitions for UI
// ---------------------------------------------------------------------------

export type VoiceQuickTag = {
  label: string
  /** 追加到描述文本的值 */
  value: string
  /** 标签分类 */
  category: "gender" | "age" | "emotion" | "dialect"
}

export const VOICE_QUICK_TAGS: VoiceQuickTag[] = [
  // 性别 + 年龄组合
  { label: "青年男", value: "年轻男声", category: "gender" },
  { label: "青年女", value: "年轻女声", category: "gender" },
  { label: "中年男", value: "中年大叔", category: "age" },
  { label: "中年女", value: "中年阿姨", category: "age" },
  { label: "老人", value: "老年老人", category: "age" },
  { label: "小孩", value: "小孩", category: "age" },
  { label: "少年", value: "少年", category: "age" },
  { label: "少女", value: "少女", category: "age" },
  // 情感/语气
  { label: "温柔", value: "温柔", category: "emotion" },
  { label: "愤怒", value: "愤怒", category: "emotion" },
  { label: "悲伤", value: "悲伤", category: "emotion" },
  { label: "惊恐", value: "惊恐", category: "emotion" },
  { label: "耳语", value: "耳语", category: "emotion" },
  { label: "激动", value: "激动", category: "emotion" },
  { label: "冷静", value: "冷静", category: "emotion" },
  { label: "低沉", value: "低沉", category: "emotion" },
  // 方言/口音
  { label: "东北话", value: "东北话", category: "dialect" },
  { label: "四川话", value: "四川话", category: "dialect" },
  { label: "陕西话", value: "陕西话", category: "dialect" },
  { label: "美式", value: "美式", category: "dialect" },
  { label: "英式", value: "英式", category: "dialect" },
]

// ---------------------------------------------------------------------------
// Smart defaults from dialogue
// ---------------------------------------------------------------------------

/**
 * 从台词内容推断默认声音描述。
 * 策略：
 * - 感叹号多 → 可能激动
 * - 省略号多 → 可能犹豫/耳语
 * - 问号多 → 可能紧张/疑惑
 * - 默认：不返回（让用户自己填）
 */
export function inferVoiceHintFromDialogue(dialogue: string): string | null {
  const exclamationCount = (dialogue.match(/[！!]/g) || []).length
  const ellipsisCount = (dialogue.match(/…|。。。|\.\.\./g) || []).length
  const questionCount = (dialogue.match(/[？?]/g) || []).length

  if (exclamationCount >= 2) return "激动"
  if (ellipsisCount >= 2) return "耳语"
  if (questionCount >= 2) return "紧张"
  return null
}

export type VoiceIntentSuggestion = {
  description: string
  reason: string
  source: "shot-context" | "dialogue" | "auto"
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword))
}

/**
 * 根据分镜上下文自动推荐声音描述。
 * 这是 Voice Director 的轻量规则版：
 * 台词 + 镜头画面 + 生图 prompt + 景别/运镜 → 推荐表演声线。
 */
export function inferVoiceDescriptionFromShot(shot?: StoryboardShotData): VoiceIntentSuggestion {
  if (!shot) {
    return { description: "自然、贴合剧情", reason: "未读取到镜头信息，使用自动模式。", source: "auto" }
  }

  const dialogue = shot.dialogue || ""
  const description = shot.description || ""
  const visualPrompt = shot.visualPrompt || ""
  const shotType = shot.shotType || ""
  const cameraMovement = shot.cameraMovement || ""
  const title = shot.title || ""
  const allText = `${title}\n${dialogue}\n${description}\n${visualPrompt}\n${shotType}\n${cameraMovement}`

  const parts: string[] = []
  const reasons: string[] = []

  // 角色基础声线：目前没有角色 profile，先从文本线索弱推断；之后接 CharacterVoiceProfile。
  if (includesAny(allText, ["女孩", "少女", "女人", "母亲", "她", "女声"])) {
    parts.push("年轻女声")
    reasons.push("画面/台词里出现女性角色线索")
  } else if (includesAny(allText, ["男孩", "少年", "男人", "父亲", "他", "男声"])) {
    parts.push("年轻男声")
    reasons.push("画面/台词里出现男性角色线索")
  }

  if (includesAny(allText, ["老人", "老爷爷", "老奶奶", "大爷", "奶奶", "爷爷"])) {
    parts.push("老年")
    reasons.push("角色有老年线索")
  } else if (includesAny(allText, ["孩子", "儿童", "小孩", "小女孩", "小男孩"])) {
    parts.push("小孩")
    reasons.push("角色有儿童线索")
  }

  // 情绪与剧情状态
  if (includesAny(allText, ["恐惧", "害怕", "惊恐", "发抖", "颤抖", "逃", "躲", "脚步声", "危险", "威胁"])) {
    parts.push("紧张、害怕、轻微颤抖")
    reasons.push("镜头呈现危险或恐惧状态")
  }
  if (includesAny(allText, ["哭", "泪", "哽咽", "崩溃", "心碎", "失去", "告别"])) {
    parts.push("悲伤、带一点哭腔")
    reasons.push("剧情有悲伤/崩溃线索")
  }
  if (includesAny(allText, ["怒", "吼", "争吵", "爆发", "质问", "愤怒"])) {
    parts.push("愤怒、压着火气")
    reasons.push("台词或场景有冲突爆发")
  }
  if (includesAny(allText, ["温柔", "安慰", "拥抱", "轻轻", "守护", "抚摸"])) {
    parts.push("温柔、放慢一点")
    reasons.push("场景氛围偏安慰或亲密")
  }
  if (includesAny(allText, ["悬疑", "夜", "黑暗", "薄雾", "巷", "阴影", "秘密", "低声"])) {
    parts.push("低声、克制、带悬疑感")
    reasons.push("场景氛围偏悬疑压抑")
  }

  // 镜头语言影响声音距离
  if (includesAny(shotType, ["特写", "近景", "近距"])) {
    parts.push("细腻、气息更近")
    reasons.push("近景/特写适合更细微的表演")
  } else if (includesAny(shotType, ["远景", "全景", "大全景"])) {
    parts.push("声音更稳，不要过度贴脸")
    reasons.push("远景/全景需要更稳的声音距离")
  }

  const dialogueHint = dialogue ? inferVoiceHintFromDialogue(dialogue) : null
  if (dialogueHint && !parts.some((part) => part.includes(dialogueHint))) {
    parts.push(dialogueHint)
    reasons.push("台词标点暗示情绪")
  }

  if (parts.length === 0) {
    return {
      description: "自然、贴合剧情、清晰表达台词",
      reason: "未发现强情绪线索，使用自然剧情声线。",
      source: dialogue ? "dialogue" : "auto",
    }
  }

  return {
    description: Array.from(new Set(parts)).join("，"),
    reason: reasons.slice(0, 2).join("；") || "根据镜头上下文自动推荐。",
    source: "shot-context",
  }
}

// ---------------------------------------------------------------------------
// Legacy exports (kept for backward compatibility, not used in new UI)
// ---------------------------------------------------------------------------

export const VOICE_GENDER_OPTIONS = [
  { label: "自动", value: "" },
  { label: "男", value: "Male" },
  { label: "女", value: "Female" },
] as const

export const VOICE_AGE_OPTIONS = [
  { label: "自动", value: "" },
  { label: "儿童", value: "Child" },
  { label: "少年", value: "Teenager" },
  { label: "青年", value: "Young Adult" },
  { label: "中年", value: "Middle-aged" },
  { label: "老年", value: "Elderly" },
] as const

export const VOICE_PITCH_OPTIONS = [
  { label: "自动", value: "" },
  { label: "极低", value: "Very Low Pitch" },
  { label: "低", value: "Low Pitch" },
  { label: "中", value: "Moderate Pitch" },
  { label: "高", value: "High Pitch" },
  { label: "极高", value: "Very High Pitch" },
] as const

export const VOICE_STYLE_OPTIONS = [
  { label: "自动", value: "" },
  { label: "耳语", value: "Whisper" },
] as const

export const VOICE_ENGLISH_ACCENT_OPTIONS = [
  { label: "自动", value: "" },
  { label: "美式", value: "American Accent" },
  { label: "英式", value: "British Accent" },
  { label: "澳式", value: "Australian Accent" },
  { label: "加拿大", value: "Canadian Accent" },
  { label: "中国口音", value: "Chinese Accent" },
  { label: "印度", value: "Indian Accent" },
  { label: "韩国口音", value: "Korean Accent" },
  { label: "日本口音", value: "Japanese Accent" },
  { label: "俄罗斯口音", value: "Russian Accent" },
  { label: "葡萄牙口音", value: "Portuguese Accent" },
] as const

export const VOICE_CHINESE_DIALECT_OPTIONS = [
  { label: "自动", value: "" },
  { label: "四川话", value: "四川话" },
  { label: "东北话", value: "东北话" },
  { label: "陕西话", value: "陕西话" },
  { label: "河南话", value: "河南话" },
  { label: "贵州话", value: "贵州话" },
  { label: "云南话", value: "云南话" },
  { label: "桂林话", value: "桂林话" },
  { label: "济南话", value: "济南话" },
  { label: "石家庄话", value: "石家庄话" },
  { label: "甘肃话", value: "甘肃话" },
  { label: "宁夏话", value: "宁夏话" },
  { label: "青岛话", value: "青岛话" },
] as const

/** 从 Voice Design UI 选项构建 instruct 字符串 (legacy) */
export function buildInstructFromDesign(params: {
  gender?: string
  age?: string
  pitch?: string
  style?: string
  englishAccent?: string
  chineseDialect?: string
}): string {
  const parts: string[] = []
  if (params.gender) parts.push(params.gender)
  if (params.age) parts.push(params.age)
  if (params.pitch) parts.push(params.pitch)
  if (params.style) parts.push(params.style)
  if (params.englishAccent) parts.push(params.englishAccent)
  if (params.chineseDialect) parts.push(params.chineseDialect)
  return parts.join(", ")
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class TtsGenerationError extends Error {
  code: string
  retryable: boolean

  constructor(params: { message: string; code: string; retryable?: boolean }) {
    super(params.message)
    this.name = "TtsGenerationError"
    this.code = params.code
    this.retryable = params.retryable ?? true
  }
}

// ---------------------------------------------------------------------------
// Gradio Space API client
// ---------------------------------------------------------------------------

async function callGradioSpaceApi(params: {
  text: string
  instruct?: string
  speed?: number
  numStep?: number
  language?: string
}): Promise<ArrayBuffer> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS)

  try {
    // Step 1: POST to initiate the call
    const callRes = await fetch(`${HF_SPACE_URL}/call/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        data: [
          params.text,           // text to synthesize
          params.language || "Auto",  // language
          params.numStep || 32,  // inference steps
          2.0,                   // guidance scale
          true,                  // denoise
          params.speed || 1.0,   // speed
          null,                  // duration (null = use speed)
          true,                  // preprocess prompt
          true,                  // postprocess output
          // Voice Design dropdowns (6 categories, all auto = no instruct override)
          ...(params.instruct ? [] : [
            "Auto", "Auto", "Auto", "Auto", "Auto", "Auto"
          ]),
        ],
      }),
    })

    if (!callRes.ok) {
      throw new TtsGenerationError({
        message: `TTS 服务请求失败 (${callRes.status})`,
        code: "API_ERROR",
        retryable: callRes.status >= 500 || callRes.status === 429,
      })
    }

    const callData = await callRes.json()
    const eventId = callData.event_id

    if (!eventId) {
      throw new TtsGenerationError({
        message: "TTS 服务未返回事件 ID",
        code: "INVALID_RESPONSE",
        retryable: true,
      })
    }

    // Step 2: GET the result via SSE
    const resultRes = await fetch(`${HF_SPACE_URL}/call/generate/${eventId}`, {
      signal: controller.signal,
    })

    if (!resultRes.ok) {
      throw new TtsGenerationError({
        message: `TTS 服务结果获取失败 (${resultRes.status})`,
        code: "API_ERROR",
        retryable: true,
      })
    }

    const resultText = await resultRes.text()

    // Parse SSE response
    const lines = resultText.split("\n")
    let dataLine = ""

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        dataLine = line.slice(6)
      }
    }

    if (!dataLine) {
      throw new TtsGenerationError({
        message: "TTS 服务未返回有效数据",
        code: "INVALID_RESPONSE",
        retryable: true,
      })
    }

    const parsed = JSON.parse(dataLine)

    if (!parsed || !parsed[0]) {
      const errorMsg = parsed?.[1] || "TTS 合成失败"
      throw new TtsGenerationError({
        message: typeof errorMsg === "string" ? errorMsg : "TTS 合成失败",
        code: "GENERATION_FAILED",
        retryable: true,
      })
    }

    const audioInfo = parsed[0]

    if (audioInfo.url) {
      const audioUrl = audioInfo.url.startsWith("/")
        ? `${HF_SPACE_URL}${audioInfo.url}`
        : audioInfo.url

      const audioRes = await fetch(audioUrl, { signal: controller.signal })
      if (!audioRes.ok) {
        throw new TtsGenerationError({
          message: "音频下载失败",
          code: "DOWNLOAD_ERROR",
          retryable: true,
        })
      }
      return await audioRes.arrayBuffer()
    }

    if (audioInfo.data) {
      const binaryString = atob(audioInfo.data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      return bytes.buffer
    }

    throw new TtsGenerationError({
      message: "TTS 服务返回了无法解析的音频格式",
      code: "INVALID_AUDIO_FORMAT",
      retryable: true,
    })
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new TtsGenerationError({
        message: "语音合成超时，请稍后重试",
        code: "CLIENT_TIMEOUT",
        retryable: true,
      })
    }
    if (error instanceof TtsGenerationError) throw error
    throw new TtsGenerationError({
      message: `语音合成请求失败：${error?.message || "未知错误"}`,
      code: "NETWORK_ERROR",
      retryable: true,
    })
  } finally {
    clearTimeout(timeout)
  }
}

// ---------------------------------------------------------------------------
// Main public API
// ---------------------------------------------------------------------------

export type TtsGenerateInput = {
  text: string
  voiceConfig: VoiceConfig
  language?: string
}

export type TtsGenerateResult = {
  audioBlob: Blob
  audioUrl: string
  durationSeconds: number
}

/**
 * Generate speech audio via OmniVoice TTS.
 * Phase 1: Voice Design mode only via HF Space API.
 */
export async function generateTtsAudio(input: TtsGenerateInput): Promise<TtsGenerateResult> {
  const { text, voiceConfig, language } = input

  if (!text.trim()) {
    throw new TtsGenerationError({
      message: "请输入要合成的文本",
      code: "EMPTY_TEXT",
      retryable: false,
    })
  }

  // Build instruct based on mode
  let instruct: string | undefined

  if (voiceConfig.mode === "design") {
    instruct = voiceConfig.instruct
    // 不再强制要求 instruct——空描述 = auto 模式
  } else if (voiceConfig.mode === "clone") {
    throw new TtsGenerationError({
      message: "语音克隆模式需要自建服务（Phase 2）",
      code: "UNSUPPORTED_MODE",
      retryable: false,
    })
  }
  // auto mode: no instruct needed

  // Call the Gradio Space API
  const arrayBuffer = await callGradioSpaceApi({
    text: text.trim(),
    instruct,
    speed: voiceConfig.speed,
    numStep: voiceConfig.numStep,
    language,
  })

  // Create blob and object URL
  const audioBlob = new Blob([arrayBuffer], { type: "audio/wav" })
  const audioUrl = URL.createObjectURL(audioBlob)

  // Estimate duration from WAV data size
  const dataSize = arrayBuffer.byteLength - 44
  const durationSeconds = dataSize > 0 ? dataSize / 48000 : 0

  return { audioBlob, audioUrl, durationSeconds }
}

/**
 * Persist TTS audio to IndexedDB and return a stable object URL.
 */
export async function persistTtsAudio(
  audioBlob: Blob,
  options?: { fileName?: string },
): Promise<{ assetId: string; objectUrl: string }> {
  const assetId = crypto.randomUUID()

  const { saveLocalImageAsset } = await import("../../../lib/assets/localImageStore")

  await saveLocalImageAsset({
    id: assetId,
    blob: audioBlob,
    mimeType: audioBlob.type || "audio/wav",
    size: audioBlob.size,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })

  const objectUrl = URL.createObjectURL(audioBlob)

  return { assetId, objectUrl }
}
