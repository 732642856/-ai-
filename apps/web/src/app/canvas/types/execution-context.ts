// ============================================================================
// Execution Context Types (P1-4)
// ============================================================================
// 节点运行前，通过 buildNodeExecutionContext() 构建的统一上下文。
// 不依赖 DOM，纯数据驱动。
// ============================================================================

import type { CanvasNodeKind, AssetItem } from "../components/canvas/types"

// ============================================================================
// Prompt Part — 结构化 prompt 片段
// ============================================================================
export type PromptPart =
  | {
      type: "text"
      text: string
    }
  | {
      type: "node-output"
      nodeId: string
      outputIndex?: number
      label?: string
    }
  | {
      type: "asset"
      assetId: string
      url?: string
      name?: string
      label?: string
    }
  | {
      type: "image-url"
      url: string
      name?: string
      label?: string
    }

// ============================================================================
// MentionRef — @引用解析后的结构化数据
// ============================================================================
export interface MentionRef {
  type: "node-output" | "asset" | "image-url"
  label: string

  // 按类型关联到具体源
  nodeId?: string
  outputIndex?: number

  assetId?: string
  url?: string
  name?: string
}

// ============================================================================
// ContextMediaRole — 语义角色（P2-1 Handle-aware Context）
// ============================================================================

/**
 * 输入端口语义角色。
 * 对应 React Flow edge.targetHandle 的命名约定：
 *   {role}-{direction}  → 例如 "image-in" → "reference", "mask-in" → "mask"
 *
 * 对标 ComfyUI 的强类型输入口 + Node-RED 的端口语义。
 */
export type ContextMediaRole =
  | "reference"        // 通用参考图（默认 image-in）
  | "source"           // 源图/源视频
  | "mask"             // 蒙版
  | "style"            // 风格参考
  | "control"          // ControlNet 控制图
  | "first_frame"      // 首帧
  | "last_frame"       // 尾帧
  | "extracted_frame"  // 从视频抽取的帧
  | "thumbnail"        // 缩略图
  | "generated"        // AI 生成结果
  | "background"       // 背景
  | "prompt"           // 文本 prompt 输入
  | "audio"            // 音频
  | "subtitle"         // 字幕
  | "depth"            // 深度图
  | "pose"             // 姿态
  | "segmentation"     // 分割图
  | "unknown"          // 无 handle 或未识别（后向兼容）

// ============================================================================
// Handle → Role 映射表（P2-1）
// ============================================================================

/** handle 名 → ContextMediaRole 的约定映射 */
export const HANDLE_TO_ROLE_MAP: Readonly<Record<string, ContextMediaRole>> = {
  "prompt-in": "prompt",
  "image-in": "reference",
  "source-image-in": "source",
  "mask-in": "mask",
  "video-in": "source",
  "audio-in": "audio",
  "first-frame-in": "first_frame",
  "last-frame-in": "last_frame",
  "control-in": "control",
  "style-in": "style",
  "depth-in": "depth",
  "pose-in": "pose",
  "segmentation-in": "segmentation",
  "subtitle-in": "subtitle",
  "reference-in": "reference",
  "background-in": "background",
  "thumbnail-in": "thumbnail",
  "generated-in": "generated",
  "extracted-frame-in": "extracted_frame",
  "frames-out": "extracted_frame",
}

// ============================================================================
// ContextImageRef — 图片引用
// ============================================================================
export interface ContextImageRef {
  id: string
  url: string
  name?: string
  /** 模型上下文中的角色：image_1, image_2... */
  role: string
  /** 语义角色（P2-1）：reference / source / mask / style / control... */
  mediaRole: ContextMediaRole
  /** 来源类型 */
  source: "upstream" | "mention" | "asset" | "self"
  /** 来源节点 ID */
  nodeId?: string
  /** 来源节点的第几个 output */
  outputIndex?: number
  /** 资产库资产 ID */
  assetId?: string
  /** 通过哪个 targetHandle 连接到此节点 */
  targetHandle?: string
}

// ============================================================================
// ContextVideoRef — 视频引用
// ============================================================================
export interface ContextVideoRef {
  id: string
  url: string
  name?: string
  /** 模型上下文中的角色：video_1, video_2...（对标 ContextImageRef.role） */
  role?: string
  /** 语义角色（P2-1）：source / reference / generated / background... */
  mediaRole: ContextMediaRole
  source: "upstream" | "mention" | "asset" | "self"
  nodeId?: string
  outputIndex?: number
  assetId?: string
  /** 通过哪个 targetHandle 连接到此节点 */
  targetHandle?: string
  // --- 视频元数据（V1-1 新增，全部可选） ---
  durationMs?: number
  width?: number
  height?: number
  fps?: number
  frameCount?: number
  mimeType?: string
  sizeBytes?: number
  thumbnailUrl?: string
}

// ============================================================================
// VideoMetadata — 视频元数据（V1-1）
// ============================================================================
export interface VideoMetadata {
  durationMs: number
  width: number
  height: number
  fps?: number
  frameCount?: number
  mimeType?: string
  sizeBytes?: number
}

// ============================================================================
// ContextTextInput — 上游文本输入
// ============================================================================
export interface ContextTextInput {
  nodeId: string
  nodeType: string
  text: string
  title?: string
  /** 语义角色（P2-1）：prompt / subtitle / unknown */
  role?: ContextMediaRole
  /** 通过哪个 targetHandle 连接到此节点 */
  targetHandle?: string
}

// ============================================================================
// ContextUpstreamNode — 上游节点摘要
// ============================================================================
export interface ContextUpstreamNode {
  nodeId: string
  nodeType: string
  nodeKind?: CanvasNodeKind
  title?: string
  /** 拓扑层级，0 为直接上游 */
  depth: number
  /** 是否有文本输出 */
  hasText: boolean
  /** 图片 URL 列表 */
  imageUrls: string[]
  /** 视频 URL 列表 */
  videoUrls: string[]
}

// ============================================================================
// NodeExecutionContext — 统一运行上下文
// ============================================================================
export interface NodeExecutionContext {
  /** 目标节点 ID */
  nodeId: string
  /** 目标节点类型 */
  nodeType: string

  /** 模型实际收到的 prompt */
  prompt: string
  /** 用户可见的原始 prompt（保留 @引用 等表达） */
  displayPrompt: string

  /** 上游文本输入列表 */
  inputTexts: ContextTextInput[]
  /** 图片引用列表（含 role） */
  referenceImages: ContextImageRef[]
  /** 视频引用列表 */
  referenceVideos: ContextVideoRef[]
  /** 上游节点摘要（按拓扑顺序） */
  upstreamNodes: ContextUpstreamNode[]

  /** 解析出的结构化 prompt 片段（用于 P1-5 历史恢复） */
  promptParts: PromptPart[]

  /** 解析出的 @引用 */
  mentions: MentionRef[]

  /** 运行时的 snapshot（从当前 node 的 config / 全局 settings 提取） */
  settingsSnapshot?: Record<string, unknown>

  /** 构建过程中发现的错误（非致命） */
  errors: string[]
  /** 构建过程中发现的警告 */
  warnings: string[]
}

// ============================================================================
// Build Options
// ============================================================================
export interface BuildContextOptions {
  /**
   * 资产库（用于解析 @asset 引用）
   */
  assets?: AssetItem[]

  /**
   * 是否将当前节点自身的图片作为默认参考图
   * @default true
   */
  includeSelfImages?: boolean

  /**
   * 上游递归最大深度
   * @default 10
   */
  maxDepth?: number

  /**
   * 运行时 settings snapshot
   */
  settingsSnapshot?: Record<string, unknown>

  /**
   * 节点 prompt 的原始来源
   * 默认从 node.data.prompt 读取，可通过此参数覆盖
   */
  promptOverride?: string

  /**
   * 自定义 prompt parts（替代从节点数据解析）
   */
  promptParts?: PromptPart[]
}
