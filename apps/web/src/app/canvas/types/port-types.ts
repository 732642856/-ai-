// ============================================================================
// Port Types — TapNow 对标 11 种端口类型系统
// 扩展已有的 HANDLE_TO_ROLE_MAP (19 种语义角色) 为 TapNow 端口抽象
// ============================================================================

/**
 * TapNow 端口类型 — 对标 11 种端口抽象
 * 每个 Handle 映射到一个 PortType，用于连线校验和视觉指示
 */
export type PortType =
  | "image"
  | "text"
  | "script"
  | "storyboard"
  | "prompt"
  | "video"
  | "audio"
  | "subtitle"
  | "music"
  | "metadata"
  | "any"

/** 端口方向 */
export type PortDirection = "input" | "output"

/** 端口定义 */
export interface PortDefinition {
  id: string
  type: PortType
  direction: PortDirection
  label: string
  position: "top" | "bottom" | "left" | "right"
  /** 端口是否允许多条连线（默认 false，单输入限制） */
  multi?: boolean
  /** 端口是否必填（默认 false） */
  required?: boolean
  /** 端口描述 */
  description?: string
}

/** 端口类型 → 视觉配置 */
export const PORT_TYPE_COLORS: Record<PortType, { stroke: string; bg: string }> = {
  image: { stroke: "#94a3b8", bg: "rgba(148, 163, 184, 0.15)" },
  text: { stroke: "#cbd5e1", bg: "rgba(203, 213, 225, 0.15)" },
  script: { stroke: "#e2e8f0", bg: "rgba(226, 232, 240, 0.15)" },
  storyboard: { stroke: "#f1f5f9", bg: "rgba(241, 245, 249, 0.15)" },
  prompt: { stroke: "#f8fafc", bg: "rgba(248, 250, 252, 0.15)" },
  video: { stroke: "#64748b", bg: "rgba(100, 116, 139, 0.15)" },
  audio: { stroke: "#475569", bg: "rgba(71, 85, 105, 0.15)" },
  subtitle: { stroke: "#334155", bg: "rgba(51, 65, 85, 0.15)" },
  music: { stroke: "#1e293b", bg: "rgba(30, 41, 59, 0.15)" },
  metadata: { stroke: "#0f172a", bg: "rgba(15, 23, 42, 0.15)" },
  any: { stroke: "#64748b", bg: "rgba(100, 116, 139, 0.15)" },
}

/** 端口类型标签 */
export const PORT_TYPE_LABELS: Record<PortType, string> = {
  image: "图像",
  text: "文本",
  script: "剧本",
  storyboard: "分镜",
  prompt: "提示词",
  video: "视频",
  audio: "音频",
  subtitle: "字幕",
  music: "音乐",
  metadata: "元数据",
  any: "通用",
}

/**
 * TapNow 连线路由表 — 哪些输出可以连接到哪些输入
 * key = 输出端口类型, value = 可以连接到的输入端口类型集合
 */
export const PORT_CONNECTION_RULES: Record<PortType, ReadonlySet<PortType>> = {
  image: new Set(["image", "prompt", "storyboard", "video", "any"]),
  text: new Set(["text", "prompt", "script", "storyboard", "subtitle", "any"]),
  script: new Set(["script", "storyboard", "text", "any"]),
  storyboard: new Set(["storyboard", "prompt", "video", "any"]),
  prompt: new Set(["prompt", "video", "image", "any"]),
  video: new Set(["video", "metadata", "any"]),
  audio: new Set(["audio", "music", "any"]),
  subtitle: new Set(["subtitle", "any"]),
  music: new Set(["music", "audio", "any"]),
  metadata: new Set(["metadata", "any"]),
  any: new Set(["image", "text", "script", "storyboard", "prompt", "video", "audio", "subtitle", "music", "metadata", "any"] as PortType[]),
}

/**
 * 检查两个端口类型是否可以进行连线
 * @param sourceType 输出端口类型
 * @param targetType 输入端口类型
 * @returns 是否允许连线
 */
export function isValidPortConnection(
  sourceType: PortType,
  targetType: PortType,
): boolean {
  return PORT_CONNECTION_RULES[sourceType]?.has(targetType) ?? false
}

/**
 * 根据 nodeKind 推断节点的默认端口定义
 * 对标 TapNow 14 种节点类型的默认端口
 */
export function getDefaultPorts(nodeKind: string): PortDefinition[] {
  const ports: Record<string, PortDefinition[]> = {
    image_asset: [
      { id: "image-out", type: "image", direction: "output", label: "Image", position: "bottom" },
    ],
    text: [
      { id: "text-in", type: "text", direction: "input", label: "Text In", position: "top" },
      { id: "text-out", type: "text", direction: "output", label: "Text Out", position: "bottom" },
    ],
    script: [
      { id: "text-in", type: "text", direction: "input", label: "Text", position: "top" },
      { id: "script-out", type: "script", direction: "output", label: "Script", position: "bottom" },
    ],
    storyboard: [
      { id: "script-in", type: "script", direction: "input", label: "Script", position: "top" },
      { id: "storyboard-out", type: "storyboard", direction: "output", label: "Storyboard", position: "bottom", multi: true },
      { id: "prompt-out", type: "prompt", direction: "output", label: "Prompt", position: "bottom", multi: true },
    ],
    image_generation: [
      { id: "image-in", type: "image", direction: "input", label: "Reference", position: "top" },
      { id: "text-in", type: "text", direction: "input", label: "Text", position: "top" },
      { id: "prompt-in", type: "prompt", direction: "input", label: "Prompt", position: "top" },
      { id: "generated-image-out", type: "image", direction: "output", label: "Image", position: "bottom" },
    ],
    video_generation: [
      { id: "image-in", type: "image", direction: "input", label: "Image", position: "top" },
      { id: "prompt-in", type: "prompt", direction: "input", label: "Motion Prompt", position: "top" },
      { id: "generated-video-out", type: "video", direction: "output", label: "Video", position: "bottom" },
    ],
    audio_generation: [
      { id: "text-in", type: "text", direction: "input", label: "Text", position: "top" },
      { id: "audio-out", type: "audio", direction: "output", label: "Audio", position: "bottom" },
    ],
    subtitle: [
      { id: "text-in", type: "text", direction: "input", label: "Text", position: "top" },
      { id: "subtitle-out", type: "subtitle", direction: "output", label: "Subtitle", position: "bottom" },
    ],
    music: [
      { id: "music-out", type: "music", direction: "output", label: "Music", position: "bottom" },
    ],
    video_compose: [
      { id: "video-in", type: "video", direction: "input", label: "Video", position: "top", multi: true },
      { id: "audio-in", type: "audio", direction: "input", label: "Audio", position: "top" },
      { id: "subtitle-in", type: "subtitle", direction: "input", label: "Subtitle", position: "top" },
      { id: "music-in", type: "music", direction: "input", label: "Music", position: "top" },
      { id: "final-video-out", type: "video", direction: "output", label: "Final Video", position: "bottom" },
    ],
    agent: [
      { id: "text-in", type: "text", direction: "input", label: "Script", position: "top" },
      { id: "storyboard-out", type: "storyboard", direction: "output", label: "Plan", position: "bottom" },
    ],
  }
  return ports[nodeKind] ?? [
    { id: "default-in", type: "any", direction: "input", label: "In", position: "top" },
    { id: "default-out", type: "any", direction: "output", label: "Out", position: "bottom" },
  ]
}

/**
 * 将 handle 名称映射到端口类型
 * 基于现有的 HANDLE_TO_ROLE_MAP 语义角色做反向映射
 */
export function resolvePortType(handleName: string | null | undefined): PortType {
  if (!handleName) return "any"
  if (handleName.includes("image") || handleName.includes("picture")) return "image"
  if (handleName.includes("video")) return "video"
  if (handleName.includes("audio") || handleName.includes("music") || handleName.includes("voice")) return "audio"
  if (handleName.includes("subtitle")) return "subtitle"
  if (handleName.includes("prompt") || handleName.includes("visual")) return "prompt"
  if (handleName.includes("script") || handleName.includes("story")) return "storyboard"
  if (handleName.includes("text")) return "text"
  if (handleName.includes("metadata")) return "metadata"
  return "any"
}
