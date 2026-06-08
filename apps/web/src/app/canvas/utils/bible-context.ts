// ============================================================================
// bible-context.ts — 从 canvasStore 读取 Bible 数据并构建 AI context
// 用于注入到 workflow runner 和 chat panel 的 system prompt 中
// ============================================================================
import { useCanvasStore } from "../stores/canvasStore"
import type { CharacterBibleData, SceneBibleData, VisualStyleBibleData } from "../components/canvas/types"

/**
 * 构建完整的 Bible 上下文字符串
 * 可直接追加到 system prompt 末尾
 */
export function buildBibleContext(): string {
  const state = useCanvasStore.getState()
  const { bibleCharacters, bibleScenes, bibleStyles } = state

  const parts: string[] = []

  // 角色上下文
  if (bibleCharacters.length > 0) {
    const charLines = bibleCharacters.map((c) => {
      const details: string[] = [c.name]
      if (c.role) details.push(`定位：${c.role}`)
      if (c.visualSignature) details.push(`外貌：${c.visualSignature}`)
      if (c.costume) details.push(`服装：${c.costume}`)
      if (c.props?.length) details.push(`道具：${c.props.join("、")}`)
      if (c.colorPalette?.length) details.push(`色调：${c.colorPalette.join("、")}`)
      if (c.backstory) details.push(`背景：${c.backstory.slice(0, 80)}`)
      return `  - ${details.join(" | ")}`
    })
    parts.push(`【角色设定】\n${charLines.join("\n")}\n`)
  }

  // 场景上下文
  if (bibleScenes.length > 0) {
    const sceneLines = bibleScenes.map((s) => {
      const details: string[] = [`S${s.sceneNumber} ${s.location}`]
      if (s.timeOfDay) details.push(`时间：${s.timeOfDay}`)
      if (s.weather) details.push(`天气：${s.weather}`)
      if (s.atmosphere) details.push(`氛围：${s.atmosphere}`)
      if (s.lightingStyle) details.push(`光影：${s.lightingStyle}`)
      if (s.colorPalette?.length) details.push(`色调：${s.colorPalette.join("、")}`)
      return `  - ${details.join(" | ")}`
    })
    parts.push(`【场景设定】\n${sceneLines.join("\n")}\n`)
  }

  // 风格上下文
  if (bibleStyles.length > 0) {
    const styleLines = bibleStyles.map((s) => {
      const details: string[] = [s.name]
      if (s.description) details.push(`描述：${s.description.slice(0, 80)}`)
      if (s.colorPalette?.length) details.push(`色调：${s.colorPalette.join("、")}`)
      if (s.lightingStyle) details.push(`光影：${s.lightingStyle}`)
      return `  - ${details.join(" | ")}`
    })
    parts.push(`【视觉风格】\n${styleLines.join("\n")}\n`)
  }

  if (parts.length === 0) return ""

  const header = "## 一致性设定（以下为当前项目的角色/场景/风格设定，生成分镜时必须严格遵循）\n"
  const footer = "\n注意：所有分镜中的角色外貌、服装、道具必须与角色设定一致。场景氛围必须与场景设定一致。整体风格必须与视觉风格一致。"
  return `\n\n${header}${parts.join("")}${footer}`
}

/**
 * 获取指定角色的完整描述字符串（用于图片生成提示词）
 */
export function getCharacterPromptContext(characterId: string): string {
  const state = useCanvasStore.getState()
  const char = state.bibleCharacters.find((c) => c.id === characterId)
  if (!char) return ""

  const parts: string[] = [char.name]
  if (char.visualSignature) parts.push(char.visualSignature)
  if (char.costume) parts.push(`wearing ${char.costume}`)
  if (char.props?.length) parts.push(`with ${char.props.join(", ")}`)
  if (char.colorPalette?.length) parts.push(`color palette: ${char.colorPalette.join(", ")}`)

  return parts.join(", ")
}

/**
 * 获取所有角色名称列表（用于 AI 识别人物）
 */
export function getCharacterNameList(): string {
  const state = useCanvasStore.getState()
  return state.bibleCharacters
    .map((c) => `${c.name}${c.role ? `（${c.role}）` : ""}`)
    .join("、")
}
