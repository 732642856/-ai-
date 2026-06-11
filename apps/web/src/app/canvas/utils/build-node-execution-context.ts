// ============================================================================
// buildNodeExecutionContext (P1-4) — 节点运行上下文构建器
// ============================================================================
// 纯函数，不依赖 DOM / React hooks / global state。
// 参照 smart-canvas 的 buildPromptRequest 思路，
// 但完全数据驱动，基于 PromptPart 结构化 prompt 而非 HTML 解析。
// ============================================================================

import type {
  NodeExecutionContext,
  ContextTextInput,
  ContextImageRef,
  ContextVideoRef,
  ContextUpstreamNode,
  ContextMediaRole,
  MentionRef,
  PromptPart,
  BuildContextOptions,
} from "../types/execution-context"
import type { CanvasNodeData, AssetItem, CanvasNodeKind } from "../components/canvas/types"
import {
  getUpstreamNodes,
  getDirectUpstreamNodes,
  type AppNode,
  type AppEdge,
} from "./graph-traversal"
import {
  getIncomingEdgeRoleMap,
  type EdgeRoleInfo,
} from "./handle-role-resolver"

// ============================================================================
// 主入口
// ============================================================================

/**
 * 构建节点的完整运行上下文。
 *
 * @param nodeId     目标节点 ID
 * @param nodes      画布所有节点
 * @param edges      画布所有边
 * @param options    构建选项
 * @returns 统一运行上下文
 */
export function buildNodeExecutionContext(
  nodeId: string,
  nodes: AppNode[],
  edges: AppEdge[],
  options: BuildContextOptions = {},
): NodeExecutionContext {
  const errors: string[] = []
  const warnings: string[] = []

  // 1. 定位目标节点
  const targetNode = nodes.find((n) => n.id === nodeId)
  if (!targetNode) {
    return emptyContext(nodeId, "unknown", [`节点 ${nodeId} 不存在`])
  }

  const data = (targetNode.data ?? {}) as CanvasNodeData
  const nodeType = targetNode.type ?? "unknown"

  // 2. 获取上游节点（递归，拓扑排序）
  const maxDepth = options.maxDepth ?? 10
  const upstreamNodes = getUpstreamNodes(nodeId, nodes, edges, maxDepth)
  const directUpstream = getDirectUpstreamNodes(nodeId, nodes, edges)

  // 2b. 构建入边角色映射（P2-1 handle-aware context）
  const edgeRoleMap = getIncomingEdgeRoleMap(nodeId, edges)

  // 3. 收集输入文本
  const inputTexts = extractTextInputs(upstreamNodes, edgeRoleMap)

  // 4. 收集上游媒体（图片 + 视频）
  const { images: upstreamImages, videos: upstreamVideos } =
    extractUpstreamMedia(upstreamNodes, edgeRoleMap)

  // 5. 解析当前节点 prompt
  const promptParts = options.promptParts ?? parsePromptParts(data, options)
  const displayPrompt = composeDisplayPrompt(promptParts)

  // 6. 解析 mentions
  const mentions = extractMentions(promptParts, errors, warnings)

  // 7. 解析 mention 中的图片（@node-output → upstreamImages, @asset → 资产库, @image-url → 直接 URL）
  const mentionedImages = resolveMentionImages(
    mentions,
    upstreamNodes,
    options.assets ?? [],
    errors,
    warnings,
  )

  // 8. 处理自身图片作为默认参考（如果启用）
  //    默认按节点类型差异化：image/edit 节点 true，generator/text/prompt 节点 false
  const selfImages = shouldIncludeSelfImages(data, options)
    ? extractSelfImages(data)
    : []

  // 8b. 处理自身视频作为默认参考（V1-6）
  const selfVideos = shouldIncludeSelfVideos(data, options)
    ? extractSelfVideos(data)
    : []

  // 9. 合并、去重、排序：upstream → self → mentioned（图片）
  const allImages = dedupeImageRefs([
    ...mapToImageRefs(upstreamImages, "upstream"),
    ...mapToImageRefs(selfImages, "self"),
    ...mentionedImages,
  ])

  // 9b. 合并、去重、排序：upstream → self（视频，V1-6）
  const allVideos = dedupeVideoRefs([
    ...mapToVideoRefs(upstreamVideos, "upstream"),
    ...mapToVideoRefs(selfVideos, "self"),
  ])

  // 10. 分配 role：image_1, image_2... / video_1, video_2...
  assignImageRoles(allImages)
  assignVideoRoles(allVideos)

  // 11. 生成模型 prompt
  const modelPrompt = composeModelPrompt(displayPrompt, allImages)

  // 12. 构建上游节点摘要
  const upstreamSummaries = buildUpstreamSummaries(upstreamNodes)

  return {
    nodeId,
    nodeType,
    prompt: modelPrompt,
    displayPrompt,
    promptParts,
    inputTexts,
    referenceImages: allImages,
    referenceVideos: allVideos,
    upstreamNodes: upstreamSummaries,
    mentions,
    settingsSnapshot: options.settingsSnapshot,
    errors,
    warnings,
  }
}

// ============================================================================
// Prompt 解析
// ============================================================================

/**
 * 从节点数据中解析 PromptPart 数组。
 * 当前策略：
 * 1. 如果 data 中有 prompt 字段，解析其中的 @引用
 * 2. 如果 data 中有 content 字段（text 类型节点），取 content
 * 3. 如果没有文本，返回空
 *
 * 未来可以扩展为从 rich text / structured parts 读取。
 */
function parsePromptParts(
  data: CanvasNodeData,
  _options: BuildContextOptions,
): PromptPart[] {
  const raw = data.prompt ?? data.content ?? ""
  if (!raw.trim()) return []

  return parseAtMentionsFromText(raw, data)
}

/**
 * 解析文本中的 @node-id、@asset-id、@http 引用
 * 示例：
 *   "把 @node_abc123 改成赛博朋克风格，参考 @asset_xyz"
 *   → [{ type: "text", text: "把 " }, { type: "node-output", nodeId: "node_abc123" },
 *      { type: "text", text: " 改成赛博朋克风格，参考 " }, { type: "asset", assetId: "asset_xyz" }]
 */
function parseAtMentionsFromText(
  text: string,
  _data: CanvasNodeData,
): PromptPart[] {
  const parts: PromptPart[] = []
  // 匹配 @node_xxx, @asset_xxx, @http(s)://...
  const mentionRegex = /@(node_[a-zA-Z0-9_-]+|asset_[a-zA-Z0-9_-]+|https?:\/\/\S+)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = mentionRegex.exec(text)) !== null) {
    // 前面的普通文本
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        text: text.slice(lastIndex, match.index),
      })
    }

    const token = match[1]
    if (token.startsWith("node_")) {
      parts.push({ type: "node-output", nodeId: token, label: token })
    } else if (token.startsWith("asset_")) {
      parts.push({ type: "asset", assetId: token, label: token })
    } else if (token.startsWith("http")) {
      parts.push({
        type: "image-url",
        url: token,
        label: "图片链接",
      })
    }

    lastIndex = match.index + match[0].length
  }

  // 末尾文本
  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      text: text.slice(lastIndex),
    })
  }

  return parts.length > 0 ? parts : [{ type: "text", text }]
}

/**
 * 从 PromptPart 数组生成用户可见的显示文本。
 * 保留 @引用 表达，方便用户理解节点间的关系。
 */
function composeDisplayPrompt(parts: PromptPart[]): string {
  return parts
    .map((part) => {
      switch (part.type) {
        case "text":
          return part.text
        case "node-output":
          return `@${part.label ?? part.nodeId}`
        case "asset":
          return `@${part.label ?? part.assetId}`
        case "image-url":
          return `@${part.label ?? "图片链接"}`
      }
    })
    .join("")
}

// ============================================================================
// Mention 提取
// ============================================================================

function extractMentions(
  parts: PromptPart[],
  _errors: string[],
  _warnings: string[],
): MentionRef[] {
  return parts
    .filter(
      (part): part is PromptPart & { type: "node-output" | "asset" | "image-url" } =>
        part.type !== "text",
    )
    .map((part) => {
      switch (part.type) {
        case "node-output":
          return createMention("node-output", part)
        case "asset":
          return createMention("asset", part)
        case "image-url":
          return createMention("image-url", part)
      }
    })
}

function createMention(
  type: MentionRef["type"],
  part: PromptPart & { type: typeof type },
): MentionRef {
  return {
    type,
    label: part.label ?? "",
    nodeId: "nodeId" in part ? part.nodeId : undefined,
    outputIndex: "outputIndex" in part ? part.outputIndex : undefined,
    assetId: "assetId" in part ? part.assetId : undefined,
    url: "url" in part ? part.url : undefined,
    name: "name" in part ? part.name : undefined,
  }
}

// ============================================================================
// 文本输入收集
// ============================================================================

/**
 * 从上游节点中收集所有文本类型的输入。
 * 按拓扑顺序排列。
 * P2-1: 通过 edgeRoleMap 标记每个文本输入的语义角色和来源 handle。
 */
function extractTextInputs(
  upstreamNodes: AppNode[],
  edgeRoleMap: Map<string, EdgeRoleInfo>,
): ContextTextInput[] {
  return upstreamNodes
    .filter((node) => {
      const d = node.data as CanvasNodeData | undefined
      const text = d?.prompt ?? d?.content ?? ""
      return text.trim().length > 0
    })
    .map((node) => {
      const d = node.data as CanvasNodeData | undefined
      const edgeInfo = edgeRoleMap.get(node.id)
      return {
        nodeId: node.id,
        nodeType: node.type ?? "unknown",
        text: (d?.prompt ?? d?.content ?? "").trim(),
        title: d?.title,
        role: edgeInfo?.role ?? "unknown",
        targetHandle: edgeInfo?.targetHandle,
      }
    })
}

// ============================================================================
// 上游媒体收集
// ============================================================================

interface RawMedia {
  id: string
  url: string
  name?: string
  nodeId: string
  outputIndex: number
  /** 语义角色（P2-1） */
  mediaRole: ContextMediaRole
  /** 来源 targetHandle */
  targetHandle?: string
  // --- 视频元数据（V1-6 新增，全部可选） ---
  durationMs?: number
  width?: number
  height?: number
  fps?: number
  mimeType?: string
  sizeBytes?: number
  thumbnailUrl?: string
}

function extractUpstreamMedia(
  upstreamNodes: AppNode[],
  edgeRoleMap: Map<string, EdgeRoleInfo>,
): {
  images: RawMedia[]
  videos: RawMedia[]
} {
  const images: RawMedia[] = []
  const videos: RawMedia[] = []

  for (const node of upstreamNodes) {
    const d = node.data as CanvasNodeData | undefined
    if (!d) continue

    // P2-1: 从 edgeRoleMap 获取此上游节点的角色
    const edgeInfo = edgeRoleMap.get(node.id)
    const mediaRole = edgeInfo?.role ?? "unknown"
    const targetHandle = edgeInfo?.targetHandle

    const kind = d.nodeKind ?? ""
    const isUploadedVideo = kind.includes("video")
    const isUploadedImage = kind.includes("image") || kind.includes("uploaded-image")

    // 优先从 generationOutput / outputs 获取结果
    const outputImages = extractOutputUrls(d, "image")
    const outputVideos = extractOutputUrls(d, "video")

    outputImages.forEach((url, idx) => {
      images.push({
        id: `${node.id}-out-${idx}`,
        url,
        name: d.title ?? `${node.type} 输出`,
        nodeId: node.id,
        outputIndex: idx,
        mediaRole,
        targetHandle,
      })
    })

    outputVideos.forEach((url, idx) => {
      videos.push({
        id: `${node.id}-out-${idx}`,
        url,
        name: d.title ?? `${node.type} 输出`,
        nodeId: node.id,
        outputIndex: idx,
        mediaRole,
        targetHandle,
        // V1-6: 传递视频元数据
        durationMs: d.videoDurationMs,
        width: d.videoWidth,
        height: d.videoHeight,
        fps: d.videoFps,
        mimeType: d.mimeType,
        sizeBytes: d.fileSize,
        thumbnailUrl: d.thumbnailUrl ?? d.imageUrl,
      })
    })

    // 兜底：单字段 URL；SketchNode 的 sketchImageDataUrl 是手绘草图参考图
    const singleUrl = d.sketchImageDataUrl ?? d.imageUrl ?? d.resultUrl ?? d.assetUrl
    if (singleUrl && outputImages.length === 0 && outputVideos.length === 0) {
      if (isUploadedVideo) {
        videos.push({
          id: `${node.id}-single`,
          url: singleUrl,
          name: d.title ?? d.fileName,
          nodeId: node.id,
          outputIndex: 0,
          mediaRole,
          targetHandle,
          // V1-6: 传递视频元数据
          durationMs: d.videoDurationMs,
          width: d.videoWidth,
          height: d.videoHeight,
          thumbnailUrl: d.thumbnailUrl ?? d.imageUrl,
        })
      } else {
        images.push({
          id: `${node.id}-single`,
          url: singleUrl,
          name: d.title ?? d.fileName,
          nodeId: node.id,
          outputIndex: 0,
          mediaRole,
          targetHandle,
        })
      }
    }
  }

  return { images, videos }
}

/**
 * 从节点 data 中提取 output URL 列表。
 * generationOutput 可能是 { images: string[] } 或 { videos: string[] }。
 */
function extractOutputUrls(
  data: CanvasNodeData,
  kind: "image" | "video",
): string[] {
  // generationOutput
  if (data.generationOutput) {
    const go = data.generationOutput as Record<string, unknown>
    const key = kind === "image" ? "images" : "videos"
    const arr = go[key]
    if (Array.isArray(arr)) {
      return arr.filter((u): u is string => typeof u === "string" && u.length > 0)
    }
  }

  // outputs 数组
  if (Array.isArray(data.outputs)) {
    return data.outputs
      .filter((o) => (kind === "video" ? o.type?.includes("video") : !o.type?.includes("video")))
      .map((o) => o.url)
      .filter((u): u is string => typeof u === "string" && u.length > 0)
  }

  return []
}

// ============================================================================
// Mention 图片解析
// ============================================================================

function resolveMentionImages(
  mentions: MentionRef[],
  upstreamNodes: AppNode[],
  assets: AssetItem[],
  errors: string[],
  warnings: string[],
): ContextImageRef[] {
  const result: ContextImageRef[] = []

  for (const mention of mentions) {
    if (mention.type === "node-output") {
      const ref = resolveNodeOutputMention(mention, upstreamNodes, warnings)
      if (ref) result.push(ref)
    } else if (mention.type === "asset") {
      const ref = resolveAssetMention(mention, assets, warnings)
      if (ref) result.push(ref)
    } else if (mention.type === "image-url") {
      if (mention.url) {
        result.push({
          id: `mention-url-${mention.url.slice(-20)}`,
          url: mention.url,
          name: mention.name ?? mention.label,
          role: "",
          mediaRole: "unknown",
          source: "mention",
        })
      } else {
        warnings.push(`@引用 ${mention.label} 缺少 URL`)
      }
    }
  }

  return result
}

function resolveNodeOutputMention(
  mention: MentionRef,
  upstreamNodes: AppNode[],
  warnings: string[],
): ContextImageRef | null {
  const mentionedNode = upstreamNodes.find((n) => n.id === mention.nodeId)
  if (!mentionedNode) {
    warnings.push(`@节点 ${mention.label} 不在上游节点中`)
    return null
  }

  const d = mentionedNode.data as CanvasNodeData | undefined
  const outputs = extractOutputUrls(d ?? {}, "image")
  const idx = mention.outputIndex ?? 0

  if (outputs.length > 0 && idx < outputs.length) {
    return {
      id: `mention-${mention.nodeId}-${idx}`,
      url: outputs[idx],
      name: mention.label,
      role: "",
      mediaRole: "unknown",
      source: "mention",
      nodeId: mention.nodeId,
      outputIndex: idx,
    }
  }

  // 兜底：单字段；SketchNode 的 sketchImageDataUrl 可作为 @node-output 参考图
  const singleUrl = d?.sketchImageDataUrl ?? d?.imageUrl ?? d?.resultUrl
  if (singleUrl) {
    return {
      id: `mention-${mention.nodeId}-0`,
      url: singleUrl,
      name: mention.label,
      role: "",
      mediaRole: "unknown",
      source: "mention",
      nodeId: mention.nodeId,
      outputIndex: 0,
    }
  }

  warnings.push(`@节点 ${mention.label} 没有可用的图片输出`)
  return null
}

function resolveAssetMention(
  mention: MentionRef,
  assets: AssetItem[],
  warnings: string[],
): ContextImageRef | null {
  const asset = assets.find((a) => a.id === mention.assetId)
  if (!asset) {
    warnings.push(`@资产 ${mention.label} 未在资产库中找到`)
    return null
  }

  const url = asset.src ?? asset.thumbnail
  if (!url) {
    warnings.push(`@资产 ${mention.label} 没有可用的图片 URL`)
    return null
  }

  return {
    id: `mention-asset-${asset.id}`,
    url,
    name: mention.name ?? asset.name,
    role: "",
    mediaRole: "unknown",
    source: "asset",
    assetId: asset.id,
  }
}

// ============================================================================
// 自身图片收集
// ============================================================================

/**
 * 判断是否应将当前节点自身的图片作为默认参考图。
 * 默认策略：
 *   image / edit 类型 → true（图生图默认用自身）
 *   generator / text / prompt 类型 → false（文生图不需要）
 * 可通过 options.includeSelfImages 显式覆盖。
 */
function shouldIncludeSelfImages(
  data: CanvasNodeData,
  options: BuildContextOptions,
): boolean {
  if (options.includeSelfImages !== undefined) return options.includeSelfImages
  const kind = data.nodeKind ?? ""
  // image / edit / uploaded-image 类节点默认包含自身图片
  if (kind.includes("image") || kind.includes("edit")) return true
  return false
}

function extractSelfImages(data: CanvasNodeData): RawMedia[] {
  const images: RawMedia[] = []

  const singleUrl = data.sketchImageDataUrl ?? data.imageUrl ?? data.resultUrl
  if (singleUrl) {
    images.push({
      id: "self-0",
      url: singleUrl,
      name: data.title ?? "当前节点图片",
      nodeId: "self",
      outputIndex: 0,
      mediaRole: "generated",
    })
  }

  // generationOutput 中的图片
  if (data.generationOutput) {
    const go = data.generationOutput as Record<string, unknown>
    const arr = go["images"]
    if (Array.isArray(arr)) {
      arr.forEach((url, idx) => {
        if (typeof url === "string" && url.length > 0) {
          images.push({
            id: `self-gen-${idx}`,
            url,
            name: data.title ?? "生成图片",
            nodeId: "self",
            outputIndex: idx,
            mediaRole: "generated",
          })
        }
      })
    }
  }

  return images
}

// ============================================================================
// 自身视频收集（V1-6）
// ============================================================================

/**
 * 判断是否应将当前节点自身的视频作为默认参考。
 * 默认：video-sample-frames / video-analyze 类型节点包含自身视频。
 */
function shouldIncludeSelfVideos(
  data: CanvasNodeData,
  options: BuildContextOptions,
): boolean {
  if (options.includeSelfImages !== undefined) return options.includeSelfImages
  const kind = data.nodeKind ?? ""
  // 视频抽帧/分析/生成 类节点默认包含自身视频
  if (kind.includes("video")) return true
  return false
}

function extractSelfVideos(data: CanvasNodeData): RawMedia[] {
  const videos: RawMedia[] = []

  const singleUrl = data.assetUrl ?? data.resultUrl
  if (singleUrl) {
    videos.push({
      id: "self-video-0",
      url: singleUrl,
      name: data.title ?? "当前节点视频",
      nodeId: "self",
      outputIndex: 0,
      mediaRole: "generated",
      durationMs: (data as CanvasNodeData).videoDurationMs,
      width: (data as CanvasNodeData).videoWidth,
      height: (data as CanvasNodeData).videoHeight,
      fps: (data as CanvasNodeData).videoFps,
      mimeType: (data as CanvasNodeData).mimeType,
      sizeBytes: (data as CanvasNodeData).fileSize,
      thumbnailUrl: (data as CanvasNodeData).thumbnailUrl ?? (data as CanvasNodeData).imageUrl,
    })
  }

  // generationOutput 中的视频
  if (data.generationOutput) {
    const go = data.generationOutput as Record<string, unknown>
    const arr = go["videos"]
    if (Array.isArray(arr)) {
      arr.forEach((url, idx) => {
        if (typeof url === "string" && url.length > 0) {
          videos.push({
            id: `self-video-gen-${idx}`,
            url,
            name: data.title ?? "生成视频",
            nodeId: "self",
            outputIndex: idx,
            mediaRole: "generated",
          })
        }
      })
    }
  }

  return videos
}

// ============================================================================
// 视频去重 + Role 分配（V1-6）
// ============================================================================

function dedupeVideoRefs(refs: ContextVideoRef[]): ContextVideoRef[] {
  const seen = new Set<string>()
  return refs.filter((ref) => {
    if (seen.has(ref.url)) return false
    seen.add(ref.url)
    return true
  })
}

function assignVideoRoles(refs: ContextVideoRef[]): void {
  refs.forEach((ref, idx) => {
    ref.role = `video_${idx + 1}`
  })
}

// ============================================================================
// 图片去重 + Role 分配
// ============================================================================

function dedupeImageRefs(refs: ContextImageRef[]): ContextImageRef[] {
  const seen = new Set<string>()
  return refs.filter((ref) => {
    if (seen.has(ref.url)) return false
    seen.add(ref.url)
    return true
  })
}

function mapToImageRefs(
  media: RawMedia[],
  source: ContextImageRef["source"],
): ContextImageRef[] {
  return media.map((m) => ({
    id: m.id,
    url: m.url,
    name: m.name,
    role: "",
    mediaRole: m.mediaRole,
    source,
    nodeId: m.nodeId,
    outputIndex: m.outputIndex,
    targetHandle: m.targetHandle,
  }))
}

function mapToVideoRefs(
  media: RawMedia[],
  source: ContextVideoRef["source"],
): ContextVideoRef[] {
  return media.map((m) => ({
    id: m.id,
    url: m.url,
    name: m.name,
    role: "",
    mediaRole: m.mediaRole,
    source,
    nodeId: m.nodeId,
    outputIndex: m.outputIndex,
    targetHandle: m.targetHandle,
    // V1-6: 传递视频元数据
    durationMs: m.durationMs,
    width: m.width,
    height: m.height,
    fps: m.fps,
    mimeType: m.mimeType,
    sizeBytes: m.sizeBytes,
    thumbnailUrl: m.thumbnailUrl,
  }))
}

function assignImageRoles(refs: ContextImageRef[]): void {
  refs.forEach((ref, idx) => {
    ref.role = `image_${idx + 1}`
  })
}

// ============================================================================
// Model Prompt 生成
// ============================================================================

/**
 * 生成模型实际收到的 prompt。
 * 参考 smart-canvas 的做法：把图片引用列表 + 用户需求组合成结构化 prompt。
 */
function composeModelPrompt(
  displayPrompt: string,
  imageRefs: ContextImageRef[],
): string {
  if (imageRefs.length === 0) return displayPrompt

  const mapLines = imageRefs.map(
    (ref) => `图${ref.role.replace("image_", "")}：${ref.name ?? ref.role}`,
  )

  return [
    "参考图：",
    ...mapLines,
    "",
    "用户需求：",
    displayPrompt,
  ].join("\n")
}

// ============================================================================
// 上游节点摘要
// ============================================================================

function buildUpstreamSummaries(
  upstreamNodes: AppNode[],
): ContextUpstreamNode[] {
  // 从远到近（topological order）
  return upstreamNodes.map((node, index) => {
    const d = (node.data ?? {}) as CanvasNodeData
    const hasText = ((d.prompt ?? d.content ?? "").trim().length > 0)
    const imageUrls = extractOutputUrls(d, "image")
    const videoUrls = extractOutputUrls(d, "video")

    // 兜底单字段；手绘草图优先作为图片输出摘要
    if (imageUrls.length === 0) {
      const u = d.sketchImageDataUrl ?? d.imageUrl ?? d.resultUrl
      if (u) imageUrls.push(u)
    }
    if (videoUrls.length === 0) {
      const u = d.assetUrl
      if (u && d.nodeKind?.includes("video")) videoUrls.push(u)
    }

    return {
      nodeId: node.id,
      nodeType: node.type ?? "unknown",
      nodeKind: d.nodeKind,
      title: d.title,
      depth: index + 1,
      hasText,
      imageUrls,
      videoUrls,
    }
  })
}

// ============================================================================
// 兜底空上下文
// ============================================================================

function emptyContext(
  nodeId: string,
  nodeType: string,
  errors: string[] = [],
): NodeExecutionContext {
  return {
    nodeId,
    nodeType,
    prompt: "",
    displayPrompt: "",
    promptParts: [],
    inputTexts: [],
    referenceImages: [],
    referenceVideos: [],
    upstreamNodes: [],
    mentions: [],
    errors,
    warnings: [],
  }
}
