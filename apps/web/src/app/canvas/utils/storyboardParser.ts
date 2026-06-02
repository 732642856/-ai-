import type { CharacterIdentityAsset, StoryboardShotData } from "../components/canvas/types"
import type { CinematicShot, ContinuityWarning, SceneAnalysis } from "@/types/cinematic"

const FIELD_ALIASES = {
  title: ["标题", "镜头标题", "title"],
  shotType: ["景别", "shot type", "shotType"],
  cameraMovement: ["镜头运动", "运镜", "运镜方式", "camera movement", "cameraMovement"],
  duration: ["时长", "duration"],
  description: ["画面内容", "画面描述", "描述", "description", "visual"],
  visualPrompt: ["用于后续生图的英文 prompt", "英文 prompt", "生图提示词", "提示词", "prompt", "visual prompt", "visualPrompt"],
  negativePrompt: ["负面提示词", "negative prompt", "negativePrompt"],
  dialogue: ["对白", "台词", "dialogue"],
  notes: ["备注", "说明", "notes", "visual continuity notes"],
} as const

function cleanMarkdownFence(text: string) {
  return text
    .replace(/^```(?:json|JSON|md|markdown)?\s*/g, "")
    .replace(/```$/g, "")
    .trim()
}

function normalizeOrder(value: unknown, fallback: number) {
  const raw = String(value ?? "").match(/\d+/)?.[0]
  return raw ? Number(raw) : fallback
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number") return String(value)
  }
  return ""
}

function pickByAliases(item: Record<string, unknown>, aliases: readonly string[]) {
  const entries = Object.entries(item)
  for (const alias of aliases) {
    const found = entries.find(([key]) => key.trim().toLowerCase() === alias.toLowerCase())
    if (found) return found[1]
  }
  return undefined
}

function shotFromObject(item: Record<string, unknown>, index: number, sourceStoryboardNodeId?: string): StoryboardShotData {
  const order = normalizeOrder(item.order ?? item.index ?? item["镜头编号"] ?? item["编号"], index + 1)
  const description = firstString(
    pickByAliases(item, FIELD_ALIASES.description),
    item.content,
    item.summary,
    item.text
  )
  const visualPrompt = firstString(
    pickByAliases(item, FIELD_ALIASES.visualPrompt),
    item.prompt,
    description
  )
  const title = firstString(
    pickByAliases(item, FIELD_ALIASES.title),
    item.title,
    `镜头 ${String(order).padStart(2, "0")}`
  )

  return {
    id: `shot-${Date.now()}-${index}`,
    order,
    title,
    shotType: firstString(pickByAliases(item, FIELD_ALIASES.shotType)),
    cameraMovement: firstString(pickByAliases(item, FIELD_ALIASES.cameraMovement)),
    duration: firstString(pickByAliases(item, FIELD_ALIASES.duration)),
    description,
    visualPrompt,
    negativePrompt: firstString(pickByAliases(item, FIELD_ALIASES.negativePrompt)),
    dialogue: firstString(pickByAliases(item, FIELD_ALIASES.dialogue)),
    notes: firstString(pickByAliases(item, FIELD_ALIASES.notes)),
    sourceStoryboardNodeId,
    status: "ready",
  }
}

function parseJsonShots(text: string, sourceStoryboardNodeId?: string): StoryboardShotData[] {
  const cleaned = cleanMarkdownFence(text)
  const start = cleaned.indexOf("[")
  const end = cleaned.lastIndexOf("]")
  if (start === -1 || end === -1 || end <= start) return []

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1))
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
      .map((item, index) => shotFromObject(item, index, sourceStoryboardNodeId))
      .filter((shot) => shot.description || shot.visualPrompt)
  } catch {
    return []
  }
}

function readField(block: string, aliases: readonly string[]) {
  for (const alias of aliases) {
    const pattern = new RegExp(`(?:^|\\n)\\s*${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[：:]\\s*([^\\n]+)`, "i")
    const match = block.match(pattern)
    if (match?.[1]?.trim()) return match[1].trim()
  }
  return ""
}

function parseDirectorMeta(notes: string): Pick<StoryboardShotData, "cinematicShot" | "sceneAnalysis" | "continuityWarnings" | "characterIdentities"> {
  const marker = "DirectorMeta："
  const start = notes.indexOf(marker)
  if (start < 0) return {}

  const jsonText = notes.slice(start + marker.length).trim()
  try {
    const parsed = JSON.parse(jsonText) as {
      cinematicShot?: CinematicShot
      sceneAnalysis?: SceneAnalysis
      continuityWarnings?: ContinuityWarning[]
      characterIdentities?: CharacterIdentityAsset[]
    }
    return {
      cinematicShot: parsed.cinematicShot,
      sceneAnalysis: parsed.sceneAnalysis,
      continuityWarnings: Array.isArray(parsed.continuityWarnings) ? parsed.continuityWarnings : undefined,
      characterIdentities: Array.isArray(parsed.characterIdentities) ? parsed.characterIdentities : undefined,
    }
  } catch {
    return {}
  }
}

function stripDirectorMeta(notes: string) {
  return notes.replace(/\n?DirectorMeta：\{[\s\S]*$/u, "").trim()
}

function parseStructuredShots(text: string, sourceStoryboardNodeId?: string): StoryboardShotData[] {
  const pattern = /(?:^|\n)\s*(?:【\s*)?(?:镜头|Shot)\s*(?:第)?\s*(\d+)\s*(?:】|[：:.)、-])?/gi
  const matches = Array.from(text.matchAll(pattern))
  if (matches.length === 0) return []

  return matches.map((match, index) => {
    const start = match.index ?? 0
    const end = matches[index + 1]?.index ?? text.length
    const block = text.slice(start, end).trim()
    const order = normalizeOrder(match[1], index + 1)
    const description = readField(block, FIELD_ALIASES.description) || block.replace(match[0], "").trim().slice(0, 500)
    const visualPrompt = readField(block, FIELD_ALIASES.visualPrompt) || description
    const rawNotes = readField(block, FIELD_ALIASES.notes)
    const directorMeta = parseDirectorMeta(rawNotes)

    return {
      id: `shot-${Date.now()}-${index}`,
      order,
      title: readField(block, FIELD_ALIASES.title) || `镜头 ${String(order).padStart(2, "0")}`,
      shotType: readField(block, FIELD_ALIASES.shotType),
      cameraMovement: readField(block, FIELD_ALIASES.cameraMovement),
      duration: readField(block, FIELD_ALIASES.duration),
      description,
      visualPrompt,
      negativePrompt: readField(block, FIELD_ALIASES.negativePrompt),
      dialogue: readField(block, FIELD_ALIASES.dialogue),
      notes: stripDirectorMeta(rawNotes),
      ...directorMeta,
      sourceStoryboardNodeId,
      status: "ready" as const,
    }
  }).filter((shot) => shot.description || shot.visualPrompt)
}

function parseMarkdownTableShots(text: string, sourceStoryboardNodeId?: string): StoryboardShotData[] {
  const lines = text.split("\n")
  const rows: string[][] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith("|") || !trimmed.includes("|")) continue
    if (/^\|?\s*[-:|\s]+\|?\s*$/.test(trimmed)) continue

    const cells = trimmed
      .split("|")
      .map((cell) => cell.trim())
      .filter(Boolean)

    if (cells.length >= 2) rows.push(cells)
  }

  if (rows.length === 0) return []

  const header = rows[0].some((cell) => /镜头|编号|序号|prompt|提示词|画面|描述|景别|运镜/i.test(cell))
    ? rows[0]
    : []
  const bodyRows = header.length > 0 ? rows.slice(1) : rows
  const normalizedHeader = header.map((cell) => cell.trim().toLowerCase())

  const findColumn = (aliases: string[], fallback: number) => {
    const found = normalizedHeader.findIndex((cell) => aliases.some((alias) => cell.includes(alias.toLowerCase())))
    return found >= 0 ? found : fallback
  }

  const orderIndex = findColumn(["镜头", "编号", "序号", "no", "index"], 0)
  const titleIndex = findColumn(["标题", "镜头标题", "title"], 1)
  const shotTypeIndex = findColumn(["景别", "shot type"], -1)
  const movementIndex = findColumn(["运镜", "镜头运动", "camera"], -1)
  const descriptionIndex = findColumn(["画面内容", "画面描述", "描述", "visual", "description"], Math.min(2, Math.max(1, (bodyRows[0]?.length || 2) - 1)))
  const promptIndex = findColumn(["英文 prompt", "prompt", "提示词", "生图"], -1)

  const shots: StoryboardShotData[] = []
  const seenOrders = new Set<number>()

  for (const cells of bodyRows) {
    const orderText = cells[orderIndex] || ""
    const orderMatch = orderText.match(/\d+/)?.[0]
    const order = orderMatch ? Number(orderMatch) : Number.NaN
    if (!Number.isFinite(order) || order < 1) continue
    if (seenOrders.has(order)) continue
    seenOrders.add(order)

    const title = firstString(cells[titleIndex], `镜头 ${String(order).padStart(2, "0")}`)
    const description = firstString(cells[descriptionIndex], cells.filter(Boolean).slice(1).join(" | "))
    const visualPrompt = firstString(
      promptIndex >= 0 ? cells[promptIndex] : undefined,
      [...cells].reverse().find((cell) => /[a-zA-Z]{3,}/.test(cell)),
      description
    )

    shots.push({
      id: `shot-${Date.now()}-${shots.length}`,
      order,
      title,
      shotType: shotTypeIndex >= 0 ? cells[shotTypeIndex] : undefined,
      cameraMovement: movementIndex >= 0 ? cells[movementIndex] : undefined,
      description,
      visualPrompt,
      notes: cells.filter((_, index) => ![orderIndex, titleIndex, shotTypeIndex, movementIndex, descriptionIndex, promptIndex].includes(index)).join(" | "),
      sourceStoryboardNodeId,
      status: "ready",
    })
  }

  return shots
}

function parseNumberedShots(text: string, sourceStoryboardNodeId?: string): StoryboardShotData[] {
  const parts = text
    .split(/(?:^|\n)\s*(\d+)[.)、]\s+/)
    .filter((part) => part.trim())
  const shots: StoryboardShotData[] = []

  for (let i = 0; i < parts.length; i += 2) {
    const order = normalizeOrder(parts[i], shots.length + 1)
    const body = (parts[i + 1] || "").trim()
    if (!body) continue
    shots.push({
      id: `shot-${Date.now()}-${shots.length}`,
      order,
      title: `镜头 ${String(order).padStart(2, "0")}`,
      description: body,
      visualPrompt: body,
      sourceStoryboardNodeId,
      status: "ready",
    })
  }

  return shots
}

function splitPlainTextIntoStoryBeats(text: string): string[] {
  return text
    .split(/(?<=[。！？!?；;])\s*|\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
}

const MIN_STORY_LENGTH_FOR_SPLIT = 30

function parsePlainTextStoryToShots(text: string, sourceStoryboardNodeId?: string): StoryboardShotData[] {
  const normalized = text.replace(/\r\n/g, "\n").trim()
  if (!normalized) return []

  const paragraphs = normalized
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean)

  const beats = splitPlainTextIntoStoryBeats(normalized)
  const sourceParts = beats.length >= 2 ? beats : paragraphs
  if (sourceParts.length === 0) return []

  // 超短文本（如"小兔子吃草"）：只有一个 beat 且总字数不足，不拆分
  if (sourceParts.length === 1 && normalized.length < MIN_STORY_LENGTH_FOR_SPLIT) {
    return [{
      id: `shot-${Date.now()}-0`,
      order: 1,
      title: "镜头 01",
      description: normalized,
      visualPrompt: normalized,
      sourceStoryboardNodeId,
      status: "ready",
    }]
  }

  const targetCount = Math.min(9, Math.max(2, sourceParts.length))
  const chunkSize = Math.ceil(sourceParts.length / targetCount)
  const shots: StoryboardShotData[] = []

  for (let index = 0; index < sourceParts.length && shots.length < 9; index += chunkSize) {
    const chunk = sourceParts.slice(index, index + chunkSize).join(" ").trim()
    if (!chunk) continue
    const order = shots.length + 1
    const description = chunk.slice(0, 500)
    shots.push({
      id: `shot-${Date.now()}-${shots.length}`,
      order,
      title: `镜头 ${String(order).padStart(2, "0")}`,
      description,
      visualPrompt: description,
      sourceStoryboardNodeId,
      status: "ready",
    })
  }

  return shots
}

function normalizeParsedShots(shots: StoryboardShotData[]) {
  const byOrder = new Map<number, StoryboardShotData>()

  for (const shot of shots) {
    if (!Number.isFinite(shot.order) || shot.order < 1) continue
    if (byOrder.has(shot.order)) continue
    byOrder.set(shot.order, shot)
  }

  return Array.from(byOrder.values()).sort((a, b) => a.order - b.order)
}

export function parseStoryboardTextToShots(text: string, sourceStoryboardNodeId?: string): StoryboardShotData[] {
  const source = text.trim()
  if (!source) return []

  const tableShots = parseMarkdownTableShots(source, sourceStoryboardNodeId)
  if (tableShots.length > 0) return normalizeParsedShots(tableShots)

  const jsonShots = parseJsonShots(source, sourceStoryboardNodeId)
  if (jsonShots.length > 0) return normalizeParsedShots(jsonShots)

  const structuredShots = parseStructuredShots(source, sourceStoryboardNodeId)
  if (structuredShots.length > 0) return normalizeParsedShots(structuredShots)

  const numberedShots = parseNumberedShots(source, sourceStoryboardNodeId)
  if (numberedShots.length > 0) return normalizeParsedShots(numberedShots)

  return normalizeParsedShots(parsePlainTextStoryToShots(source, sourceStoryboardNodeId))
}
