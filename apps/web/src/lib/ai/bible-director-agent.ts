// ============================================================================
// Bible Director Agent — 一致性导演 Agent
// 利用 Character/Scene/Style Bible 数据增强分镜生成
// ============================================================================

export interface BibleDirectorInput {
  /** 剧本/脚本内容 */
  script?: string
  /** 角色圣经数据 */
  characters?: Array<{
    id: string
    name: string
    role?: string
    visualSignature?: string
    costume?: string
    props?: string[]
    backstory?: string
    arcDescription?: string
    colorPalette?: string[]
    referenceImageUrl?: string
  }>
  /** 场景圣经数据 */
  scenes?: Array<{
    id: string
    sceneNumber: number
    location: string
    timeOfDay?: string
    weather?: string
    atmosphere?: string
    lightingStyle?: string
    colorPalette?: string[]
  }>
  /** 视觉风格数据 */
  styles?: Array<{
    id: string
    name: string
    description?: string
    colorPalette?: string[]
    lightingStyle?: string
    aspectRatio?: string
  }>
  /** 任务类型 */
  task: "generate-character" | "enhance-shots" | "check-continuity"
}

export interface BibleDirectorOutput {
  success: boolean
  systemPrompt: string
  userPrompt: string
}

/**
 * 构建 Bible Director 的 system prompt
 * 根据 task 类型和 bible 数据生成不同的 system prompt
 */
export function buildBibleDirectorSystemPrompt(input: BibleDirectorInput): string {
  const { characters = [], scenes = [], styles = [] } = input

  // 构建角色上下文
  const charContext = characters.length > 0
    ? characters.map((c) =>
      `- ${c.name}${c.role ? `（${c.role}）` : ""}${c.visualSignature ? `：${c.visualSignature}` : ""}${c.costume ? `，服装：${c.costume}` : ""}${c.props?.length ? `，道具：${c.props.join("、")}` : ""}${c.backstory ? `，背景：${c.backstory.slice(0, 100)}` : ""}`
    ).join("\n")
    : "（暂无角色设定）"

  // 构建场景上下文
  const sceneContext = scenes.length > 0
    ? scenes.map((s) =>
      `- S${s.sceneNumber} ${s.location}${s.timeOfDay ? `（${s.timeOfDay}）` : ""}${s.atmosphere ? `：${s.atmosphere}` : ""}${s.lightingStyle ? `，光影：${s.lightingStyle}` : ""}`
    ).join("\n")
    : "（暂无场景设定）"

  // 构建风格上下文
  const styleContext = styles.length > 0
    ? styles.map((s) => `- ${s.name}${s.description ? `：${s.description}` : ""}`).join("\n")
    : "（暂无视觉风格设定）"

  switch (input.task) {
    case "generate-character":
      return `你是一位专业的人物设定师。根据用户的简短描述，生成完整的角色圣经信息。

请严格按以下 JSON 格式输出：
{
  "name": "角色姓名",
  "role": "角色定位（主角/反派/配角等）",
  "aliases": ["别名1", "别名2"],
  "visualSignature": "外貌特征描述：身高、体型、脸型、发型、眼睛颜色、肤色、面部特征、年龄感，300字以内",
  "costume": "服装风格描述：常穿的颜色、款式、材质、配饰，200字以内",
  "props": ["常用道具1", "常用道具2"],
  "physicalTraits": ["身体特征1", "身体特征2"],
  "colorPalette": ["主色调1", "主色调2", "主色调3"],
  "backstory": "背景故事：角色的过去经历、形成性格的关键事件，300字以内",
  "arcDescription": "人物弧光：角色在故事中可能的成长变化轨迹，200字以内"
}

只输出 JSON，不要有任何其他文字。`

    case "enhance-shots":
      return `你是一位专业的分镜导演。你的任务是结合角色圣经、场景圣经和视觉风格圣经的数据，生成一致性极强的分镜描述。

现有角色设定：
${charContext}

现有场景设定：
${sceneContext}

现有视觉风格：
${styleContext}

要求：
1. 每个镜头中出现的角色必须符合其角色圣经设定（外貌、服装、道具）
2. 场景氛围必须符合场景圣经
3. 整体视觉风格必须符合风格圣经
4. 输出的 JSON 中需包含 characterConsistency 字段，标注镜头中引用的角色 Bible IDs
5. 保持角色服装、道具、色彩基调在连续镜头中的一致性

请按以下格式输出每个镜头：
{
  "shotDescription": "画面描述（含角色外貌和服装的一致性描述）",
  "shotSize": "wide/medium/close_up",
  "cameraAngle": "eye_level/low_angle/high_angle",
  "cameraMovement": "static/pan/tilt/dolly",
  "durationEstimate": 3.0,
  "characterConsistency": ["角色Bible_ID"],
  "sceneBibleId": "场景Bible_ID",
  "styleBibleId": "风格Bible_ID",
  "dramaticBeat": "戏剧节拍描述",
  "emotionalState": "CALM/TENSE/FEAR/ANGER/JOY/SADNESS",
  "visualPrompt": "含角色外貌、服装、道具、光影、色彩的一致描述，200字以内"
}`

    case "check-continuity":
      return `你是一位专业的镜头连续性检查员。分析以下分镜列表，检查连续性错误：

现有角色设定：
${charContext}

检查规则：
1. 角色外貌/服装在不同镜头中是否一致
2. 同一场景的时间/天气/光影是否一致
3. 相邻镜头的情绪跳跃是否合理（不应从CALM直接跳到ANGER）
4. 道具出现在不同镜头中时位置/状态是否合理

请输出 JSON 数组：
[{
  "shotIndex": 0,
  "type": "character|scene|emotion|props",
  "severity": "critical|warning|info",
  "description": "问题描述",
  "suggestion": "修复建议"
}]`

    default:
      return "请提供有效的任务类型。"
  }
}

/**
 * 构建 user prompt
 */
export function buildBibleDirectorUserPrompt(input: BibleDirectorInput): string {
  switch (input.task) {
    case "generate-character":
      return `请根据以下描述生成完整的角色圣经信息：\n\n${input.script || "请描述你想要创建的角色"}`
    case "enhance-shots":
      return `请根据以下剧本内容，结合圣经数据生成一致性增强的分镜：\n\n${input.script || ""}`
    case "check-continuity":
      return `请检查以下分镜的连续性问题：\n\n${input.script || ""}`
    default:
      return ""
  }
}
