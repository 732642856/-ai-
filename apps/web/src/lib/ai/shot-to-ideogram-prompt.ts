/**
 * shot-to-ideogram-prompt.ts — 分镜数据 → Ideogram 4 JSON 结构化提示翻译引擎
 *
 * 核心逻辑：
 * 1. 景别(ShotSize) → 宽高比 + 构图指导
 * 2. 机位(CameraAngle) → 视角/透视描述
 * 3. 运镜(CameraMovement) → 动感/模糊效果
 * 4. 情绪(EmotionalState) → 调色板 + 光照氛围
 * 5. 画面描述 → JSON compositional_deconstruction
 * 6. 边界框自动生成（基于景别和构图规则）
 */

export interface IdeogramStoryboardShot {
  shotIndex: number
  shotDescription: string
  shotSize: string
  cameraAngle: string
  cameraMovement: string
  emotionalState: string
}

// ============================================================================
// 映射表
// ============================================================================

/** 景别 → 宽高比 */
const SHOT_SIZE_ASPECT_RATIO: Record<string, { width: number; height: number; desc: string }> = {
  EXTREME_WIDE: { width: 2048, height: 768, desc: "ultra-wide cinematic landscape" },
  WIDE: { width: 1920, height: 1088, desc: "wide cinematic frame" },
  MEDIUM: { width: 1536, height: 1024, desc: "medium framing" },
  CLOSE_UP: { width: 1024, height: 1024, desc: "intimate close framing" },
  EXTREME_CLOSE_UP: { width: 1024, height: 1024, desc: "extreme detail macro framing" },
}

/** 机位 → 视角描述 */
const CAMERA_ANGLE_DESCRIPTIONS: Record<string, string> = {
  EYE_LEVEL: "eye-level perspective, neutral and natural viewpoint",
  LOW_ANGLE: "low-angle shot looking upward, heroic and imposing perspective",
  HIGH_ANGLE: "high-angle shot looking downward, vulnerable or diminished subject",
  OVER_SHOULDER: "over-the-shoulder perspective, intimate subjective viewpoint",
  TOP_SHOT: "top-down overhead perspective, bird's eye view",
  DUTCH_ANGLE: "Dutch angle tilted composition, disorienting and dramatic",
}

/** 运镜 → 动感描述 */
const CAMERA_MOVEMENT_DESCRIPTIONS: Record<string, string> = {
  STATIC: "static composition, perfectly still frame",
  PUSH_IN: "subtle forward push-in motion, intensifying focus",
  PULL_OUT: "gradual pull-out revealing wider context",
  PAN: "horizontal panning motion, sweeping gaze",
  TILT: "vertical tilting motion, rising or falling gaze",
  TRACKING: "tracking shot following the subject in motion",
  HANDHELD: "handheld camera shake, raw documentary feel",
  DOLLY: "smooth dolly movement, professional cinematic",
  CRANE: "sweeping crane shot, grand elevated perspective",
  ZOOM: "zoom lens compression, dramatic focal change",
}

/** 情绪 → 调色板 + 光照 */
interface EmotionConfig {
  aesthetics: string
  lighting: string
  colorPalette: string[]
  mood: string
  medium: string
}

const EMOTION_CONFIGS: Record<string, EmotionConfig> = {
  CALM: {
    aesthetics: "serene, peaceful, contemplative",
    lighting: "soft diffused daylight, gentle shadows",
    colorPalette: ["#A8DADC", "#457B9D", "#F1FAEE", "#E8F1F2"],
    mood: "tranquil and meditative",
    medium: "photograph",
  },
  TENSE: {
    aesthetics: "high-stakes, suspenseful, pressure",
    lighting: "sharp directional light with deep shadows",
    colorPalette: ["#2B2D42", "#8D99AE", "#EF233C", "#1A1A2E"],
    mood: "tense and on-edge",
    medium: "cinematic photograph",
  },
  FEAR: {
    aesthetics: "oppressive, ominous, threatening",
    lighting: "low-key chiaroscuro, dramatic side-lighting",
    colorPalette: ["#0B0C10", "#1F2833", "#C5C6C7", "#45A29E"],
    mood: "frightening and suffocating",
    medium: "dark cinematic photograph",
  },
  ANGER: {
    aesthetics: "explosive, aggressive, confrontational",
    lighting: "harsh high-contrast lighting, burning highlights",
    colorPalette: ["#8B0000", "#FF4500", "#DC143C", "#2F0000"],
    mood: "furious and heated",
    medium: "intense photograph",
  },
  JOY: {
    aesthetics: "uplifting, vibrant, celebratory",
    lighting: "bright golden hour sunlight, warm glow",
    colorPalette: ["#FFD700", "#FFA07A", "#FFE4B5", "#FFF8DC"],
    mood: "joyful and exuberant",
    medium: "bright photograph",
  },
  SADNESS: {
    aesthetics: "melancholic, somber, reflective",
    lighting: "overcast diffused light, muted atmosphere",
    colorPalette: ["#708090", "#B0C4DE", "#D3D3D3", "#2F4F4F"],
    mood: "sad and sorrowful",
    medium: "moody photograph",
  },
  INTIMACY: {
    aesthetics: "close, tender, vulnerable",
    lighting: "soft warm candlelight, shallow depth of field",
    colorPalette: ["#D2691E", "#DEB887", "#F5DEB3", "#BC8F8F"],
    mood: "intimate and personal",
    medium: "photograph with shallow depth of field",
  },
  SUSPENSE: {
    aesthetics: "mysterious, uncertain, foreboding",
    lighting: "dramatic rim lighting, deep shadows",
    colorPalette: ["#1C1C1C", "#36454F", "#4B0082", "#191970"],
    mood: "suspenseful and mysterious",
    medium: "noir-style photograph",
  },
  REVELATION: {
    aesthetics: "awe-inspiring, transformative, breakthrough",
    lighting: "dramatic divine light breaking through darkness",
    colorPalette: ["#FFFFFF", "#FFFACD", "#E6E6FA", "#F0E68C"],
    mood: "revelatory and awe-struck",
    medium: "cinematic photograph",
  },
  HOPE: {
    aesthetics: "optimistic, forward-looking, warm",
    lighting: "golden backlighting, lens flare, sunrise glow",
    colorPalette: ["#FFD700", "#FFA500", "#FF6347", "#FFF5EE"],
    mood: "hopeful and inspiring",
    medium: "photograph with golden backlight",
  },
  DESPAIR: {
    aesthetics: "bleak, desolate, empty",
    lighting: "flat grey light, fog or haze",
    colorPalette: ["#696969", "#808080", "#A9A9A9", "#2F2F2F"],
    mood: "desperate and empty",
    medium: "desaturated photograph",
  },
}

// ============================================================================
// 边界框生成算法
// ============================================================================

interface BBox { yMin: number; xMin: number; yMax: number; xMax: number }

/**
 * 根据景别生成主体边界框（归一化 0-1000）
 * 景别越小（从远到近），主体在画面中占比越大
 */
function generateSubjectBBox(shotSize: string): BBox {
  switch (shotSize) {
    case "EXTREME_WIDE":
      // 大远景：主体只占画面下方中部一小部分
      return { yMin: 550, xMin: 420, yMax: 750, xMax: 580 }
    case "WIDE":
      // 远景：主体占画面中下部
      return { yMin: 450, xMin: 350, yMax: 800, xMax: 650 }
    case "MEDIUM":
      // 中景：主体占画面中央偏下
      return { yMin: 280, xMin: 250, yMax: 820, xMax: 750 }
    case "CLOSE_UP":
      // 近景：主体占画面大部分
      return { yMin: 150, xMin: 150, yMax: 850, xMax: 850 }
    case "EXTREME_CLOSE_UP":
      // 特写：主体几乎填满画面
      return { yMin: 200, xMin: 200, yMax: 800, xMax: 800 }
    default:
      return { yMin: 300, xMin: 300, yMax: 700, xMax: 700 }
  }
}

/**
 * 根据机位调整边界框位置
 */
function adjustBBoxForAngle(bbox: BBox, cameraAngle: string): BBox {
  switch (cameraAngle) {
    case "LOW_ANGLE":
      // 仰拍：主体偏上，显得高大
      return {
        yMin: Math.max(50, bbox.yMin - 100),
        xMin: bbox.xMin,
        yMax: Math.min(700, bbox.yMax + 50),
        xMax: bbox.xMax,
      }
    case "HIGH_ANGLE":
      // 俯拍：主体偏下，显得渺小
      return {
        yMin: Math.min(400, bbox.yMin + 100),
        xMin: bbox.xMin,
        yMax: Math.min(950, bbox.yMax + 100),
        xMax: bbox.xMax,
      }
    case "OVER_SHOULDER":
      // 越肩：主体偏右（画面右侧）
      return {
        yMin: bbox.yMin,
        xMin: Math.min(600, bbox.xMin + 150),
        yMax: bbox.yMax,
        xMax: Math.min(980, bbox.xMax + 100),
      }
    case "TOP_SHOT":
      // 顶视：主体居中且偏下（俯视视角的构图）
      return {
        yMin: 300,
        xMin: 300,
        yMax: 700,
        xMax: 700,
      }
    default:
      return bbox
  }
}

// ============================================================================
// 主翻译函数
// ============================================================================

export interface IdeogramJsonPrompt {
  high_level_description: string
  style_description: {
    aesthetics: string
    lighting: string
    photo?: string
    medium: string
    art_style?: string
    color_palette?: string[]
  }
  compositional_deconstruction: {
    background: string
    elements: Array<
      | { type: "obj"; bbox: number[]; desc: string }
      | { type: "text"; bbox: number[]; text: string; desc: string }
    >
  }
}

export interface IdeogramGenerationPayload {
  json_prompt: string        // JSON.stringify(IdeogramJsonPrompt)
  width: number
  height: number
  sampler_preset?: string    // "V4_QUALITY_48" | "V4_DEFAULT_20" | "V4_TURBO_12"
  seed?: number
}

/**
 * 将单个分镜镜头翻译成 Ideogram 4 JSON 结构化提示
 *
 * @param shot 可编辑的分镜镜头数据
 * @param extraElements 额外画面元素列表（可选，如 "霓虹灯招牌", "飘落的树叶"）
 * @param textElements 文本元素列表（可选，如 [{text: "NEON CITY", desc: "霓虹灯牌"}]）
 * @returns IdeogramGenerationPayload（可直接传给 Ideogram API）
 */
export function translateShotToIdeogram(
  shot: IdeogramStoryboardShot,
  extraElements?: string[],
  textElements?: Array<{ text: string; desc?: string }>
): IdeogramGenerationPayload {
  // --- 1. 解析景别 → 宽高比 ---
  const aspect = SHOT_SIZE_ASPECT_RATIO[shot.shotSize] || SHOT_SIZE_ASPECT_RATIO.MEDIUM
  const width = aspect.width
  const height = aspect.height

  // --- 2. 解析机位 → 视角描述 ---
  const angleDesc = CAMERA_ANGLE_DESCRIPTIONS[shot.cameraAngle] || CAMERA_ANGLE_DESCRIPTIONS.EYE_LEVEL

  // --- 3. 解析运镜 → 动感描述 ---
  const movementDesc = CAMERA_MOVEMENT_DESCRIPTIONS[shot.cameraMovement] || CAMERA_MOVEMENT_DESCRIPTIONS.STATIC

  // --- 4. 解析情绪 → 调色板 + 光照 ---
  const emotion = EMOTION_CONFIGS[shot.emotionalState] || EMOTION_CONFIGS.CALM

  // --- 5. 构建 high_level_description ---
  const highLevelDesc = [
    shot.shotDescription,
    `Shot composition: ${aspect.desc}`,
    `Camera: ${angleDesc}`,
    movementDesc !== CAMERA_MOVEMENT_DESCRIPTIONS.STATIC ? `Motion: ${movementDesc}` : "",
    `Mood: ${emotion.mood}`,
  ]
    .filter(Boolean)
    .join(". ")

  // --- 6. 生成主体边界框 ---
  let subjectBBox = generateSubjectBBox(shot.shotSize)
  subjectBBox = adjustBBoxForAngle(subjectBBox, shot.cameraAngle)

  // --- 7. 构建 compositional_deconstruction ---
  const elements: IdeogramJsonPrompt["compositional_deconstruction"]["elements"] = []

  // 主体元素
  elements.push({
    type: "obj",
    bbox: [subjectBBox.yMin, subjectBBox.xMin, subjectBBox.yMax, subjectBBox.xMax],
    desc: `Main subject. ${shot.shotDescription}. Framed in ${aspect.desc}.`,
  })

  // 额外画面元素（自动分配边界框）
  if (extraElements && extraElements.length > 0) {
    extraElements.forEach((el, i) => {
      // 简单策略：额外元素分布在画面四周
      const positions: BBox[] = [
        { yMin: 50, xMin: 50, yMax: 250, xMax: 300 },    // 左上
        { yMin: 50, xMin: 700, yMax: 250, xMax: 950 },    // 右上
        { yMin: 750, xMin: 50, yMax: 950, xMax: 300 },    // 左下
        { yMin: 750, xMin: 700, yMax: 950, xMax: 950 },   // 右下
      ]
      const pos = positions[i % positions.length]
      elements.push({
        type: "obj",
        bbox: [pos.yMin, pos.xMin, pos.yMax, pos.xMax],
        desc: el,
      })
    })
  }

  // 文本元素（如招牌、标语）
  if (textElements && textElements.length > 0) {
    textElements.forEach((te, i) => {
      // 文本元素分布在画面上方或背景
      const yBase = 50 + i * 120
      elements.push({
        type: "text",
        bbox: [yBase, 200, yBase + 80, 800],
        text: te.text,
        desc: te.desc || `Text element: "${te.text}"`,
      })
    })
  }

  // --- 8. 构建背景描述 ---
  const backgroundDesc = [
    `Cinematic ${emotion.medium} background environment`,
    `Lighting: ${emotion.lighting}`,
    `Aesthetic: ${emotion.aesthetics}`,
  ].join(". ")

  // --- 9. 组装完整 JSON ---
  const jsonPrompt: IdeogramJsonPrompt = {
    high_level_description: highLevelDesc,
    style_description: {
      aesthetics: emotion.aesthetics,
      lighting: emotion.lighting,
      medium: emotion.medium,
      color_palette: emotion.colorPalette,
    },
    compositional_deconstruction: {
      background: backgroundDesc,
      elements,
    },
  }

  // --- 10. 构建 API payload ---
  return {
    json_prompt: JSON.stringify(jsonPrompt),
    width,
    height,
    sampler_preset: "V4_QUALITY_48",
  }
}

/**
 * 批量翻译多个分镜镜头
 */
export function translateShotsToIdeogram(
  shots: IdeogramStoryboardShot[],
  extraElementsMap?: Record<number, string[]>,
  textElementsMap?: Record<number, Array<{ text: string; desc?: string }>>
): IdeogramGenerationPayload[] {
  return shots.map((shot) =>
    translateShotToIdeogram(
      shot,
      extraElementsMap?.[shot.shotIndex],
      textElementsMap?.[shot.shotIndex]
    )
  )
}

/**
 * 将 visualPrompt（纯文本）增强为 Ideogram JSON 格式
 * 用于已有 visualPrompt 但缺少分镜参数的场景
 */
export function enhancePromptToIdeogram(
  visualPrompt: string,
  options?: {
    aspectRatio?: "1x1" | "16x9" | "9x16" | "4x3" | "21x9"
    lighting?: string
    colorPalette?: string[]
  }
): IdeogramGenerationPayload {
  const aspectMap: Record<string, { width: number; height: number }> = {
    "1x1": { width: 1024, height: 1024 },
    "16x9": { width: 1920, height: 1088 },
    "9x16": { width: 1024, height: 1792 },
    "4x3": { width: 1536, height: 1152 },
    "21x9": { width: 2048, height: 768 },
  }

  const aspect = aspectMap[options?.aspectRatio || "16x9"]

  const jsonPrompt: IdeogramJsonPrompt = {
    high_level_description: visualPrompt,
    style_description: {
      aesthetics: "cinematic, highly detailed, professional quality",
      lighting: options?.lighting || "dramatic cinematic lighting",
      medium: "photograph",
      color_palette: options?.colorPalette || ["#2B2D42", "#8D99AE", "#EF233C", "#1A1A2E"],
    },
    compositional_deconstruction: {
      background: `Cinematic environment matching: ${visualPrompt}`,
      elements: [
        {
          type: "obj",
          bbox: [200, 200, 800, 800],
          desc: "Main subject and focal point",
        },
      ],
    },
  }

  return {
    json_prompt: JSON.stringify(jsonPrompt),
    width: aspect.width,
    height: aspect.height,
    sampler_preset: "V4_QUALITY_48",
  }
}
