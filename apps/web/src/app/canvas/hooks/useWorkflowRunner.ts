// ============================================================================
// useWorkflowRunner - Execute video workflow nodes sequentially via AI
// ============================================================================
"use client"

import { useCallback, useRef, useState } from "react"
import { useReactFlow } from "@xyflow/react"
import type { Node, Edge } from "@xyflow/react"
import type { CanvasNodeData, CanvasNodeKind, NodeRunMeta, NodeRunSource } from "../components/canvas/types"
import { useAIUsageStore } from "../features/canvas/usage/useAIUsageStore"
import { estimateCostUsd } from "../features/canvas/usage/estimateCost"
import type { AIUsageRecord, AITaskType } from "../features/canvas/usage/aiUsageTypes"
import {
  createRunningRunMeta,
  createSucceededRunMeta,
  createFailedRunMeta,
  createIdleRunMeta,
} from "../utils/nodeRunMeta"
import { createRunHistoryItem } from "../utils/node-run-history"
import { useRunHistoryStore } from "../stores/useRunHistoryStore"
import type { NodeRunHistoryInput } from "../types/node-run-history"
import { buildRestorePromptPatch, sanitizeHistoryRawOutput } from "../utils/history-safety"
import { VIDEO_ANALYSIS_RAW_KIND, VIDEO_ANALYSIS_RAW_VERSION } from "../types/video-analysis"
import type { ExecutionPlan } from "../utils/execution-plan"
import { generateMockFrameUrls, runMockVideoAnalyze } from "../utils/mock-video-analyzer"
import { quickLayout } from "../utils/dagre-layout"
import type { WorkflowRunEvent } from "../types/workflow-run"
import { enhancePromptWithCinematicContext } from "@/lib/cinematic/context"
import { getDefaultModel, getDefaultImageModel, getLocalProviderOverrides } from "@/lib/ai/client"
import { buildRunRequest } from "@/lib/ai/run-request"
import { normalizeGenerationError, formatGenerationErrorForDisplay } from "@/lib/ai/normalizeGenerationError"
import { persistImageDataUrl } from "@/lib/assets/localImageStore"

interface RunContext {
  runId: string
  source: NodeRunSource
}

export type WorkflowStepStatus = "pending" | "running" | "done" | "error"

interface WorkflowRunnerState {
  isRunning: boolean
  currentStep: string | null
  stepStatuses: Record<string, WorkflowStepStatus>
  error: string | null
  progress: number
}

const WORKFLOW_ORDER: CanvasNodeKind[] = [
  "text",
  "script",
  "storyboard",
  "image-generation",
  "image-result",
  "video-sample-frames",
  "video-analyze",
  "video-generation",
  "audio",
  "subtitle",
  "composition",
  "video-result",
]

function getStepIndex(kind: CanvasNodeKind): number {
  return WORKFLOW_ORDER.indexOf(kind)
}

/**
 * 从当前节点和上游数据构建最小历史输入快照。
 * 用于在 buildNodeExecutionContext 完整接入前捕获运行上下文。
 */
function buildHistoryInputFromNode(
  node: Node<CanvasNodeData>,
  allNodes: Node<CanvasNodeData>[],
  edges: Edge[],
  overridePrompt?: string,
): NodeRunHistoryInput {
  const d = node.data as CanvasNodeData
  const rawPrompt = overridePrompt ?? d.prompt ?? d.content ?? ""

  // 上游内容
  const upstreamEdges = edges.filter((e) => e.target === node.id)
  const inputTexts = upstreamEdges
    .map((edge) => {
      const upstream = allNodes.find((n) => n.id === edge.source)
      if (!upstream) return null
      const ud = upstream.data as CanvasNodeData | undefined
      const text = ((ud?.prompt ?? ud?.content ?? "").trim())
      if (!text) return null
      return {
        nodeId: upstream.id,
        nodeType: upstream.type ?? "unknown",
        text,
        title: ud?.title,
      }
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)

  return {
    prompt: rawPrompt,
    displayPrompt: rawPrompt,
    promptParts: rawPrompt ? [{ type: "text", text: rawPrompt }] : [],
    mentions: [],
    inputTexts,
    referenceImages: [],
    referenceVideos: [],
    settingsSnapshot: { nodeKind: d.nodeKind },
  }
}

function isTextModelStep(kind: CanvasNodeKind): boolean {
  return ["text", "script", "storyboard", "subtitle"].includes(kind)
}

function isImageModelStep(kind: CanvasNodeKind): boolean {
  return ["image-generation", "image-result"].includes(kind)
}

function isVideoSampleFramesStep(kind: CanvasNodeKind): boolean {
  return kind === "video-sample-frames"
}

function isVideoAnalyzeStep(kind: CanvasNodeKind): boolean {
  return kind === "video-analyze"
}

// Build system prompts for each step
function getSystemPrompt(kind: CanvasNodeKind): string {
  switch (kind) {
    case "script":
      return "你是一个专业的故事开发顾问。用户会提供新闻链接、文章摘录、资料片段或随手想法。你的任务不是直接写分镜，而是把杂乱输入提炼成可继续创作的故事种子。请输出：1. 核心事件；2. 可改编主题；3. 主角可能性；4. 主要冲突；5. 类型方向；6. 情绪基调；7. 可继续发展成完整故事的 3 个创意角度。内容要具体、可拍、避免空泛。"
    case "storyboard":
      return "你是一个专业的分镜师。根据脚本内容，生成分镜描述列表。每个分镜包括：镜头编号、景别、画面描述、运镜方式、时长。用JSON数组格式输出。"
    case "image-generation":
      return "你是一个专业的AI图像提示词工程师。将分镜描述转换为详细的英文图像生成提示词（prompt）。只输出提示词，不要解释。"
    case "subtitle":
      return "你是一个专业的字幕编辑。根据脚本和画面内容，生成带时间轴的字幕文本。"
    case "composition":
      return "你是一个专业的视频后期编辑。描述如何将各元素合成为最终视频。包括转场、节奏、色调。"
    default:
      return "你是一个专业的AI创作助手。"
  }
}

// Usage info extracted from SSE stream
export interface StreamUsage {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

// Read SSE stream and collect all text content + usage metadata
async function readSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onDelta?: (delta: string) => void,
  onImageGenerated?: (data: { imageUrl: string; prompt: string; model: string }) => void,
): Promise<{ text: string; usage: StreamUsage | null }> {
  const decoder = new TextDecoder()
  let result = ""
  let usage: StreamUsage | null = null
  let buffer = ""

  const processDataLine = (data: string) => {
    if (!data || data === "[DONE]") return

    let parsed: any
    try {
      parsed = JSON.parse(data)
    } catch {
      // Ignore malformed complete lines; incomplete lines are preserved by buffer.
      return
    }

    if (parsed.done) return

    // Error in stream
    if (parsed.error) {
      const normalized = typeof parsed.error === "object"
        ? parsed.error
        : normalizeGenerationError({ body: parsed.error })
      throw Object.assign(new Error(formatGenerationErrorForDisplay(normalized)), { generationError: normalized })
    }

    // Text content
    if (parsed.content) {
      // Detect inline [USAGE] markers
      const usageMatch = parsed.content.match(/\[USAGE\](.+?)\[\/USAGE\]/)
      if (usageMatch) {
        try {
          const raw = JSON.parse(usageMatch[1])
          usage = {
            promptTokens: raw.prompt_tokens,
            completionTokens: raw.completion_tokens,
            totalTokens: raw.total_tokens,
          }
        } catch {}
        // Strip usage markers from content
        const cleanContent = parsed.content.replace(/\[USAGE\].+?\[\/USAGE\]/g, "")
        if (cleanContent.trim()) {
          result += cleanContent
          onDelta?.(cleanContent)
        }
      } else {
        result += parsed.content
        onDelta?.(parsed.content)
      }
    }

    // Image generated event
    if (parsed.type === "image_generated" && parsed.imageUrl) {
      onImageGenerated?.({
        imageUrl: parsed.imageUrl,
        prompt: parsed.prompt || "",
        model: parsed.model || "",
      })
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      if (!line.trim() || !line.startsWith("data: ")) continue
      processDataLine(line.slice(6))
    }
  }

  buffer += decoder.decode()
  const finalLine = buffer.trim()
  if (finalLine.startsWith("data: ")) {
    processDataLine(finalLine.slice(6))
  }

  return { text: result, usage }
}

function resolveLocalModelOverrides(): { textModel?: string; imageModel?: string } {
  const overrides = getLocalProviderOverrides()
  return {
    textModel: overrides?.defaultModel,
    imageModel: overrides?.imageModel,
  }
}

export function useWorkflowRunner(options?: { onRunEvent?: (event: WorkflowRunEvent) => void }) {
  const onRunEvent = options?.onRunEvent
  const { getNodes, setNodes, setEdges, getEdges } = useReactFlow()
  const [state, setState] = useState<WorkflowRunnerState>({
    isRunning: false,
    currentStep: null,
    stepStatuses: {},
    error: null,
    progress: 0,
  })
  const abortRef = useRef(false)
  const runningNodeIdsRef = useRef<Set<string>>(new Set())

  const updateNodeData = useCallback((nodeId: string, updates: Partial<CanvasNodeData>) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id !== nodeId) return node
        return { ...node, data: { ...node.data, ...updates } }
      })
    )
  }, [setNodes])

  // ==========================================================================
  // EXECUTE SINGLE STEP
  // ==========================================================================
  const executeStep = useCallback(async (
    node: Node<CanvasNodeData>,
    allNodes: Node<CanvasNodeData>[],
    edges: Edge[],
    runContext?: RunContext,
    overridePrompt?: string,
  ): Promise<string> => {
    const kind = (node.data.nodeKind || "script") as CanvasNodeKind
    const stepLabel: string = node.data.title || String(kind)

    // Get upstream content from connected nodes
    const upstreamEdges = edges.filter((e) => e.target === node.id)
    const upstreamContent: string[] = []

    for (const edge of upstreamEdges) {
      const upstreamNode = allNodes.find((n) => n.id === edge.source)
      if (upstreamNode) {
        const d = upstreamNode.data
        upstreamContent.push(
          d.content || d.prompt || d.summary || d.instruction || ""
        )
      }
    }

    const upstreamText = upstreamContent.join("\n\n")
    const currentContent = overridePrompt ?? (node.data.content || node.data.prompt || "")

    // Resolve model names from config (respects .env.local + Local Override)
    const localModels = resolveLocalModelOverrides()
    const [resolvedTextModel, resolvedImageModel] = await Promise.all([
      localModels.textModel ? Promise.resolve(localModels.textModel) : getDefaultModel(),
      localModels.imageModel ? Promise.resolve(localModels.imageModel) : getDefaultImageModel(),
    ])
    // 'provider' is only used for usage-tracking labels; not an API credential
    const provider = "copse"

    // ------------------------------------------------------------------
    // TEXT MODEL STEP
    // ------------------------------------------------------------------
    if (isTextModelStep(kind)) {
      const startedAt = new Date().toISOString()
      const providerOverrides = getLocalProviderOverrides()

      const runRequest = buildRunRequest({
        nodeKind: kind,
        taskType: "text",
        prompt: currentContent,
        upstreamContent: upstreamText || undefined,
        localDefaultModel: localModels.textModel,
        envDefaultModel: resolvedTextModel,
        providerOverrides: providerOverrides ? { ...providerOverrides } as Record<string, unknown> : undefined,
        systemOverride: getSystemPrompt(kind),
      })

      const model = runRequest.model
      const res = await fetch("/api/ai/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(runRequest),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => "")
        const normalized = normalizeGenerationError({ status: res.status, body: text, provider })
        throw Object.assign(new Error(formatGenerationErrorForDisplay(normalized)), { generationError: normalized })
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error("No response stream")

      let streamedText = ""
      const { text, usage } = await readSSEStream(
        reader,
        (delta) => {
          streamedText += delta
          updateNodeData(node.id, {
            content: streamedText,
            runMeta: createRunningRunMeta({ runId: runContext?.runId, source: runContext?.source, message: "AI 生成中..." }),
            summary: streamedText.slice(0, 200) + (streamedText.length > 200 ? "..." : ""),
          })
        }
      )
      const finalResult = text || streamedText

      if (!finalResult.trim()) throw new Error("AI returned empty response")

      // ── Record AI usage ──────────────────────────────────
      const costUsd = estimateCostUsd({
        provider,
        model,
        taskType: "text",
        inputTokens: usage?.promptTokens,
        outputTokens: usage?.completionTokens,
      })

      const usageRecord: AIUsageRecord = {
        id: `usage-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        nodeId: node.id,
        runId: runContext?.runId,
        provider,
        model,
        taskType: "text",
        inputTokens: usage?.promptTokens,
        outputTokens: usage?.completionTokens,
        totalTokens: usage?.totalTokens,
        estimatedCostUsd: costUsd,
        currency: "USD",
        startedAt,
        finishedAt: new Date().toISOString(),
        status: "success",
      }
      useAIUsageStore.getState().addUsageRecord(usageRecord)

      updateNodeData(node.id, {
        content: finalResult.trim(),
        prompt: finalResult.trim(),
        summary: finalResult.trim().slice(0, 200) + (finalResult.length > 200 ? "..." : ""),
        runMeta: createSucceededRunMeta({ runId: runContext?.runId, message: "文本生成完成" }),
      })

      return finalResult.trim()
    }

    // ------------------------------------------------------------------
    // IMAGE MODEL STEP
    // ------------------------------------------------------------------
    if (isImageModelStep(kind)) {
      const startedAt = new Date().toISOString()
      const providerOverrides = getLocalProviderOverrides()

      // Cinematic enhancement (still needed as async call for upstream node walk)
      const baseImagePrompt = upstreamText || currentContent || "A cinematic scene"
      const cinematicPrompt = enhancePromptWithCinematicContext(baseImagePrompt, node.id, allNodes, edges)

      const runRequest = buildRunRequest({
        nodeKind: kind,
        taskType: "image",
        prompt: currentContent,
        upstreamContent: upstreamText || undefined,
        localImageModel: localModels.imageModel,
        envDefaultImageModel: resolvedImageModel,
        cinematicPrompt,
        providerOverrides: providerOverrides ? { ...providerOverrides } as Record<string, unknown> : undefined,
      })

      const model = runRequest.model
      const res = await fetch("/api/ai/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(runRequest),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => "")
        const normalized = normalizeGenerationError({ status: res.status, body: text, provider })
        throw Object.assign(new Error(formatGenerationErrorForDisplay(normalized)), { generationError: normalized })
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error("No response stream")

      let generatedImageUrl: string | null = null

      await readSSEStream(
        reader,
        undefined,
        (imgData) => {
          generatedImageUrl = imgData.imageUrl
        }
      )

      if (!generatedImageUrl) {
        throw new Error("No image generated")
      }

      const imageUrl: string = generatedImageUrl

      // Persist base64 image to IndexedDB before storing in node data
      let displayUrl = imageUrl
      let assetId: string | undefined
      if (imageUrl.startsWith("data:image")) {
        try {
          const persisted = await persistImageDataUrl(imageUrl, {
            fileName: `workflow-${Date.now()}.png`,
          })
          displayUrl = persisted.objectUrl
          assetId = persisted.assetId
        } catch (err) {
          console.error("[WorkflowRunner] Failed to persist generated image:", err)
        }
      }

      // ── Record AI usage ──────────────────────────────────
      const costUsd = estimateCostUsd({
        provider,
        model,
        taskType: "image",
        imageCount: 1,
      })

      const usageRecord: AIUsageRecord = {
        id: `usage-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        nodeId: node.id,
        runId: runContext?.runId,
        provider,
        model,
        taskType: "image",
        imageCount: 1,
        estimatedCostUsd: costUsd,
        currency: "USD",
        startedAt,
        finishedAt: new Date().toISOString(),
        status: "success",
      }
      useAIUsageStore.getState().addUsageRecord(usageRecord)

      // For image-generation node, create/update the image-result node
      if (kind === "image-generation") {
        const downstreamEdges = edges.filter((e) => e.source === node.id)
        const resultNodeId = downstreamEdges[0]?.target

        if (resultNodeId) {
          updateNodeData(resultNodeId, {
            imageUrl: displayUrl,
            assetId,
            nodeKind: "ai-generated-image" as CanvasNodeKind,
            source: "generated" as const,
            persistence: assetId ? "indexeddb" as const : undefined,
            displayWidth: 280,
            displayHeight: 200,
            runMeta: createSucceededRunMeta({ runId: runContext?.runId, message: "图片已生成" }),
            summary: `已生成图片 (${runRequest.message.slice(0, 50)}...)`,
          })
        } else {
          // Create a new image-result node
          const newNode = {
            id: `node-${Date.now()}`,
            type: "image" as const,
            position: { x: node.position.x + 340, y: node.position.y },
            data: {
              title: "生成结果",
              imageUrl: displayUrl,
              assetId,
              nodeKind: "ai-generated-image" as CanvasNodeKind,
              source: "generated" as const,
              persistence: assetId ? "indexeddb" as const : undefined,
              displayWidth: 280,
              displayHeight: 200,
              status: "done" as const,
              runMeta: createSucceededRunMeta({ runId: runContext?.runId, message: "图片已生成" }),
              createdAt: Date.now(),
            },
          }
          setNodes((nds) => [...nds, newNode])
          setEdges((eds) => [...eds, {
            id: `edge-${node.id}-${newNode.id}`,
            source: node.id,
            target: newNode.id,
            type: "creative",
            animated: true,
          }])
        }
      }

      updateNodeData(node.id, {
        status: "done",
        runMeta: createSucceededRunMeta({ runId: runContext?.runId, message: "图片已生成" }),
        summary: `图片已生成`,
      })

      return imageUrl
    }

    // ------------------------------------------------------------------
    // VIDEO SAMPLE FRAMES (V1-4 Mock)
    // ------------------------------------------------------------------
    if (isVideoSampleFramesStep(kind)) {
      const sourceVideoId = node.id
      const hasUpstreamImage = upstreamContent.some(c => c.length > 0)

      if (!hasUpstreamImage) {
        updateNodeData(node.id, {
          runMeta: createSucceededRunMeta({ runId: runContext?.runId, message: "无上游视频，跳过" }),
          summary: "请先连接视频素材节点。",
        })
        return "无上游视频输入"
      }

      const frames = generateMockFrameUrls(sourceVideoId, 4)

      updateNodeData(node.id, {
        runMeta: createSucceededRunMeta({ runId: runContext?.runId, message: `已抽取 ${frames.length} 帧（Mock）` }),
        summary: `已抽取 ${frames.length} 个关键帧（Mock 模式）`,
        generationOutput: {
          frames,
          images: frames.map(f => f.imageUrl),
        },
        outputs: [{ label: "抽帧结果", type: "image" }],
      })

      return `抽取了 ${frames.length} 个帧`
    }

    // ------------------------------------------------------------------
    // VIDEO ANALYZE (V1-5 Mock)
    // ------------------------------------------------------------------
    if (isVideoAnalyzeStep(kind)) {
      // 从上一步的 generationOutput 中提取关键帧
      const upstreamNodes = allNodes.filter(n =>
        upstreamEdges.some(e => e.source === n.id),
      )

      let keyframes: Array<{ sourceVideoId: string; timestampMs: number; frameIndex: number; imageUrl: string }> = []

      for (const upNode of upstreamNodes) {
        const genOut = upNode.data.generationOutput as any
        if (genOut?.frames && Array.isArray(genOut.frames) && genOut.frames.length > 0) {
          keyframes = genOut.frames
          break
        }
      }

      const hasFrames = keyframes.length > 0
      const result = runMockVideoAnalyze(hasFrames ? keyframes : [])

      updateNodeData(node.id, {
        runMeta: createSucceededRunMeta({ runId: runContext?.runId, message: "分析完成（Mock）" }),
        content: result.summary,
        prompt: result.summary,
        summary: result.summary.slice(0, 200),
        generationOutput: result,
        outputs: [{ label: "分析结果", type: "text" }],
      })

      return result.summary
    }

    // ------------------------------------------------------------------
    // AGENT STEP (Phase 1: DirectorAgent — story breakdown)
    // ------------------------------------------------------------------
    if (kind === "agent") {
      const input = node.data.content ?? ""
      if (!input.trim()) {
        updateNodeData(node.id, {
          runMeta: createFailedRunMeta({ runId: runContext?.runId, error: "Agent 输入为空", message: "请先在 Agent 节点粘贴剧本文本" }),
          summary: "请输入剧本后重新运行",
        })
        return ""
      }

      updateNodeData(node.id, {
        runMeta: createRunningRunMeta({ runId: runContext?.runId, source: runContext?.source, message: "Agent 分析中..." }),
        summary: "正在分析剧本...",
      })

      const _providerOverrides = getLocalProviderOverrides()

      const agentPrompt = `你是一个专业的影视前期导演 AI（DirectorAgent）。

用户会给你一段剧本或故事文本，你需要将其拆解为结构化的分镜脚本。

请按以下 JSON 格式输出：

{
  "title": "作品标题",
  "characters": [
    { "name": "角色名", "description": "外观描述", "role": "主角/配角/群演" }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "location": "场景地点",
      "timeOfDay": "日/夜/黄昏",
      "mood": "氛围描述",
      "shots": [
        {
          "shotNumber": 1,
          "shotType": "远景/全景/中景/近景/特写",
          "cameraMovement": "固定/推/拉/摇/移/跟",
          "description": "画面描述",
          "dialogue": "对白（如有）",
          "action": "角色动作描述",
          "duration": "预估秒数"
        }
      ]
    }
  ]
}

规则：
1. 每个场景至少 2 个分镜
2. 角色描述要具体到可用于 AI 生图
3. 只输出 JSON，不要其他文字`

      const runRequest = buildRunRequest({
        nodeKind: kind,
        taskType: "text",
        prompt: input,
        upstreamContent: upstreamText || undefined,
        localDefaultModel: localModels.textModel,
        envDefaultModel: resolvedTextModel,
        providerOverrides: _providerOverrides ? { ..._providerOverrides } as Record<string, unknown> : undefined,
        systemOverride: agentPrompt,
      })

      const res = await fetch("/api/ai/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(runRequest),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => "")
        const normalized = normalizeGenerationError({ status: res.status, body: text, provider })
        throw Object.assign(new Error(formatGenerationErrorForDisplay(normalized)), { generationError: normalized })
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error("Agent 无响应流")

      let fullOutput = ""
      const { text: resultText, usage } = await readSSEStream(reader, (delta) => {
        fullOutput += delta
        updateNodeData(node.id, {
          agentOutput: fullOutput,
          summary: fullOutput.slice(0, 200) + (fullOutput.length > 200 ? "..." : ""),
          runMeta: createRunningRunMeta({ runId: runContext?.runId, source: runContext?.source, message: "Agent 分析中..." }),
        })
      })

      const finalOutput = resultText || fullOutput
      if (!finalOutput.trim()) throw new Error("Agent 返回空结果")

      // Store structured output and mark done
      updateNodeData(node.id, {
        agentOutput: finalOutput,
        agentStatus: "done",
        runMeta: createSucceededRunMeta({ runId: runContext?.runId, message: "剧本分析完成" }),
        summary: `已生成 ${(finalOutput.match(/"sceneNumber"/g) || []).length} 个场景`,
        content: finalOutput,
      })

      // ── Record AI usage ──
      const agentEndedAt = new Date().toISOString()
      const usageRecord: AIUsageRecord = {
        id: `usage-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        nodeId: node.id,
        runId: runContext?.runId,
        provider,
        model: runRequest.model,
        taskType: "text",
        inputTokens: usage?.promptTokens,
        outputTokens: usage?.completionTokens,
        totalTokens: usage?.totalTokens,
        estimatedCostUsd: estimateCostUsd({ provider, model: runRequest.model, taskType: "text", inputTokens: usage?.promptTokens, outputTokens: usage?.completionTokens }),
        currency: "USD",
        startedAt: agentEndedAt,
        finishedAt: agentEndedAt,
        status: "success",
      }
      useAIUsageStore.getState().addUsageRecord(usageRecord)

      // ── Phase 2: auto-orchestrate — parse Agent JSON → create node chain ──
      try {
        const plan = JSON.parse(finalOutput)

        const newNodes: Node<CanvasNodeData>[] = []
        const newEdges: Edge[] = []

        // For each character → ContentNode
        if (Array.isArray(plan.characters)) {
          plan.characters.forEach((char: Record<string, unknown>, i: number) => {
            const charId = `agent-char-${node.id}-${i}`
            newNodes.push({
              id: charId,
              type: "content",
              position: { x: 0, y: 0 },
              data: {
                nodeKind: "text" as CanvasNodeKind,
                title: `角色: ${char.name ?? ""}`,
                content: `【${char.role ?? ""}】${char.name ?? ""}\n\n${char.description ?? ""}`,
                createdAt: Date.now(),
              },
            })
            newEdges.push({
              id: `e-${node.id}-${charId}`,
              source: node.id,
              target: charId,
              type: "creative",
              animated: false,
              style: { stroke: "rgba(168, 85, 247, 0.3)", strokeWidth: 1.5 },
            })
          })
        }

        // For each scene.shot → ContentNode (shot details)
        if (Array.isArray(plan.scenes)) {
          plan.scenes.forEach((scene: Record<string, unknown>) => {
            const shots = scene.shots as Array<Record<string, unknown>> ?? []
            shots.forEach((shot: Record<string, unknown>, j: number) => {
              const shotId = `agent-shot-${node.id}-${String(scene.sceneNumber ?? "")}-${j}`
              const shotLabel = `S${scene.sceneNumber ?? "?"}_SHOT${shot.shotNumber ?? j + 1}`
              const shotDesc = [
                `【分镜 ${shotLabel}】`,
                shot.description ?? "",
                shot.dialogue ? `对白: ${shot.dialogue}` : "",
                shot.action ? `动作: ${shot.action}` : "",
                `景别: ${shot.shotType ?? ""}  运镜: ${shot.cameraMovement ?? ""}  时长: ${shot.duration ?? ""}s`,
                `氛围: ${scene.mood ?? ""}  时段: ${scene.timeOfDay ?? ""}`,
              ].filter(Boolean).join("\n")

              newNodes.push({
                id: shotId,
                type: "content",
                position: { x: 0, y: 0 },
                data: {
                  nodeKind: "shot" as CanvasNodeKind,
                  title: shotLabel,
                  content: shotDesc,
                  prompt: `Generate a storyboard image for: ${shot.description ?? ""}. ${shot.shotType ?? ""} shot, ${shot.cameraMovement ?? ""} camera movement.`,
                  createdAt: Date.now(),
                },
              })
              newEdges.push({
                id: `e-${node.id}-${shotId}`,
                source: node.id,
                target: shotId,
                type: "creative",
                animated: false,
                style: { stroke: "rgba(168, 85, 247, 0.3)", strokeWidth: 1.5 },
              })
            })
          })
        }

        if (newNodes.length > 0) {
          const currentNodes = getNodes()
          const currentEdges = getEdges()
          const combinedNodes = [...currentNodes, ...newNodes]
          const combinedEdges = [...currentEdges, ...newEdges]

          // Auto-layout with dagre
          const layoutedNodes = quickLayout(combinedNodes, combinedEdges, 3)

          // Mark agent-created nodes as selected (visual highlight for batch ops)
          const newIds = new Set(newNodes.map((n) => n.id))
          const layoutedWithSelection = layoutedNodes.map((n) =>
            newIds.has(n.id) ? { ...n, selected: true as const } : { ...n, selected: false as const },
          )
          setNodes(layoutedWithSelection)
          setEdges(combinedEdges)

          // Write child node IDs back to the agent node (for batch-generate button)
          const childIds = newNodes.map((nn) => nn.id)
          setNodes((nds) =>
            nds.map((n) =>
              n.id === node.id
                ? { ...n, data: { ...n.data, _childNodeIds: childIds } }
                : n,
            ),
          )
        }
      } catch (parseErr) {
        console.warn("[Agent] auto-orchestrate failed (JSON parse), Agent output still displayed:", parseErr)
      }

      return finalOutput
    }

    // ------------------------------------------------------------------
    // PASS-THROUGH STEP (audio, video-generation, composition, etc.)
    // ------------------------------------------------------------------
    updateNodeData(node.id, {
      runMeta: createSucceededRunMeta({ runId: runContext?.runId, message: "已接收" }),
      summary: upstreamText
        ? `已接收上游数据 (${upstreamText.slice(0, 100)}...)`
        : "等待上游输入",
    })
    return upstreamText
  }, [updateNodeData, setNodes, setEdges])

  // ==========================================================================
  // RUN SINGLE NODE
  // ==========================================================================
  const runNode = useCallback(async (nodeId: string, overridePrompt?: string) => {
    if (runningNodeIdsRef.current.has(nodeId)) return

    runningNodeIdsRef.current.add(nodeId)
    const allNodes = getNodes()
    const allEdges = getEdges()
    const node = allNodes.find((n) => n.id === nodeId)

    if (!node) {
      runningNodeIdsRef.current.delete(nodeId)
      return
    }

    const kind = (node.data.nodeKind || "script") as CanvasNodeKind
    const stepLabel: string = (node.data.title || String(kind)) as string
    const runId = crypto.randomUUID()
    const source: NodeRunSource = "manual"

    // ── Capture history input before execution ──────────
    const historyInput = buildHistoryInputFromNode(node, allNodes, allEdges, overridePrompt)
    const startedAt = new Date().toISOString()

    // Resolve model names once for this run (used in catch for usage recording)
    const localModels = resolveLocalModelOverrides()
    const [resolvedTextModel, resolvedImageModel] = await Promise.all([
      localModels.textModel ? Promise.resolve(localModels.textModel) : getDefaultModel(),
      localModels.imageModel ? Promise.resolve(localModels.imageModel) : getDefaultImageModel(),
    ])

    // ── Inject resolved model info into historyInput.settingsSnapshot ──
    const activeModel = isImageModelStep(kind) ? resolvedImageModel : resolvedTextModel
    historyInput.settingsSnapshot = {
      ...historyInput.settingsSnapshot,
      model: activeModel,
      provider: (localModels.textModel || localModels.imageModel) ? "local" : "default",
    }

    setState((prev) => ({
      ...prev,
      isRunning: true,
      currentStep: stepLabel,
      stepStatuses: { ...prev.stepStatuses, [nodeId]: "running" },
    }))

    updateNodeData(nodeId, { runMeta: createRunningRunMeta({ runId, source, message: "手动运行" }) })

    // ── P0-2 fix: 单节点运行也发射 WorkflowRunEvent ─────
    onRunEvent?.({
      type: "run-started",
      runId,
      startedAt,
      nodes: [{
        nodeId,
        nodeType: node.type ?? "unknown",
        title: stepLabel,
        depth: 0,
      }],
      mode: "single-node",
    })
    onRunEvent?.({
      type: "node-started",
      runId,
      nodeId,
      startedAt,
    })

    try {
      const outputText = await executeStep(node, allNodes, allEdges, { runId, source }, overridePrompt)

      // ── Record succeeded history ──────────────────────
      const finishedAt = new Date().toISOString()
      const latestNodes = getNodes()
      const updatedNode = latestNodes.find((n) => n.id === nodeId)
      const updatedData = (updatedNode?.data ?? {}) as CanvasNodeData
      const resultUrl = updatedData.resultUrl ?? updatedData.imageUrl

      // Sanitize: don't store base64/blob URLs in run history (localStorage)
      const safeResultUrl = resultUrl && !resultUrl.startsWith("data:") && !resultUrl.startsWith("blob:")
        ? resultUrl
        : undefined

      // ── 视频分析节点：用 TypedRawOutput 包装完整结构化结果 ──
      //   格式 { kind: VIDEO_ANALYSIS_RAW_KIND, version: VIDEO_ANALYSIS_RAW_VERSION, data: VideoAnalysisResult }
      //   未来其他节点（图片分析、字幕分析等）通过 kind 区分
      const rawOutput =
        kind === "video-analyze" && updatedData.generationOutput
          ? sanitizeHistoryRawOutput({
              kind: VIDEO_ANALYSIS_RAW_KIND,
              version: VIDEO_ANALYSIS_RAW_VERSION,
              data: updatedData.generationOutput,
            })
          : undefined

      const historyItem = createRunHistoryItem({
        runId,
        nodeId,
        nodeType: node.type ?? "unknown",
        status: "succeeded",
        input: historyInput,
        output: {
          text: outputText || undefined,
          imageUrls: safeResultUrl ? [safeResultUrl] : undefined,
          raw: rawOutput,
        },
        message: stepLabel + " 执行成功",
        startedAt,
        finishedAt,
        source: "manual",
      })
      useRunHistoryStore.getState().append(historyItem)

      // Set currentHistoryId on runMeta
      const currentRunMeta = updatedData.runMeta
      if (currentRunMeta) {
        updateNodeData(nodeId, {
          runMeta: { ...currentRunMeta, currentHistoryId: historyItem.id } as NodeRunMeta,
        })
      }

      setState((prev) => ({
        ...prev,
        stepStatuses: { ...prev.stepStatuses, [nodeId]: "done" },
        isRunning: false,
        currentStep: null,
      }))

      // ── P0-2 fix: emit node-succeeded + run-finished ──
      const runEndedAt = new Date().toISOString()
      onRunEvent?.({
        type: "node-succeeded",
        runId,
        nodeId,
        endedAt: runEndedAt,
        outputSummary: outputText?.slice(0, 100) || undefined,
      })
      onRunEvent?.({
        type: "run-finished",
        runId,
        endedAt: runEndedAt,
        status: "success",
      })
    } catch (err: any) {
      const finishedAt = new Date().toISOString()
      const normalized = err?.generationError || normalizeGenerationError({ error: err, provider: "copse" })
      const safeError = formatGenerationErrorForDisplay(normalized)
      console.debug("[WorkflowRunner] runNode failed raw:", normalized.raw)

      const failedRunMeta = createFailedRunMeta({
        error: safeError,
        runId,
        message: safeError,
      })

      updateNodeData(nodeId, {
        runMeta: failedRunMeta,
      })

      const latestNodesAfterFailure = getNodes()
      const failedNodeData = (latestNodesAfterFailure.find((n) => n.id === nodeId)?.data ?? {}) as CanvasNodeData
      const partialText =
        typeof err?.partialText === "string" && err.partialText.trim()
          ? err.partialText.trim()
          : typeof failedNodeData.content === "string" && failedNodeData.content.trim()
            ? failedNodeData.content.trim()
            : typeof failedNodeData.summary === "string" && failedNodeData.summary.trim()
              ? failedNodeData.summary.trim()
              : ""

      // ── Record failed history ──────────────────────────
      const historyItem = createRunHistoryItem({
        runId,
        nodeId,
        nodeType: node.type ?? "unknown",
        status: "failed",
        input: historyInput,
        output: partialText ? { text: partialText } : undefined,
        error: safeError,
        message: stepLabel + " 执行失败",
        startedAt,
        finishedAt: new Date().toISOString(),
        source: "manual",
      })
      useRunHistoryStore.getState().append(historyItem)

      // Set currentHistoryId without losing failed status/error metadata
      updateNodeData(nodeId, {
        runMeta: { ...failedRunMeta, currentHistoryId: historyItem.id } as NodeRunMeta,
      })

      // ── Record failed usage ─────────────────────────────
      const isImg = isImageModelStep(kind)
      const taskType: AITaskType = isImg ? "image" : "text"
      useAIUsageStore.getState().addUsageRecord({
        id: `usage-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        nodeId,
        provider: "copse",
      model: isImg ? resolvedImageModel : resolvedTextModel,
        taskType,
        currency: "USD",
        startedAt,
        finishedAt: new Date().toISOString(),
        status: "failed",
        error: safeError,
      })

      setState((prev) => ({
        ...prev,
        stepStatuses: { ...prev.stepStatuses, [nodeId]: "error" },
        error: safeError,
        isRunning: false,
        currentStep: null,
      }))

      // ── P0-2 fix: emit node-failed + run-finished ─────
      const failEndedAt = new Date().toISOString()
      onRunEvent?.({
        type: "node-failed",
        runId,
        nodeId,
        endedAt: failEndedAt,
        error: safeError,
      })
      onRunEvent?.({
        type: "run-finished",
        runId,
        endedAt: failEndedAt,
        status: "failed",
        error: safeError,
      })
    } finally {
      runningNodeIdsRef.current.delete(nodeId)
    }
  }, [getNodes, getEdges, executeStep, updateNodeData, onRunEvent])

  // ==========================================================================
  // RUN FULL WORKFLOW
  // ==========================================================================
  const runWorkflow = useCallback(async () => {
    if (state.isRunning) return

    abortRef.current = false
    const allNodes = getNodes()
    const allEdges = getEdges()

    // Find all workflow nodes
    const workflowNodes = allNodes.filter(
      (n) => n.type === "workflow" || n.type === "agent" || (n.type === "content" && n.data.nodeKind === "text")
    )

    if (workflowNodes.length === 0) return

    // Sort by workflow order
    const sortedNodes = [...workflowNodes].sort((a, b) => {
      const aIdx = getStepIndex((a.data.nodeKind || "script") as CanvasNodeKind)
      const bIdx = getStepIndex((b.data.nodeKind || "script") as CanvasNodeKind)
      return aIdx - bIdx
    })

    // Initialize statuses
    const initialStatuses: Record<string, WorkflowStepStatus> = {}
    sortedNodes.forEach((n) => {
      initialStatuses[n.id] = "pending"
    })

    setState({
      isRunning: true,
      currentStep: null,
      stepStatuses: initialStatuses,
      error: null,
      progress: 0,
    })

    // ── P2-3A: emit run-started ──────────────────────────
    const planRunId = crypto.randomUUID()
    const planStartedAt = new Date().toISOString()
    onRunEvent?.({
      type: "run-started",
      runId: planRunId,
      startedAt: planStartedAt,
      nodes: sortedNodes.map((n, i) => ({
        nodeId: n.id,
        nodeType: n.type ?? "unknown",
        title: (n.data.title as string) || (n.data.nodeKind as string) || "节点",
        depth: i,
      })),
      mode: "full",
    })

    let failingNodeId: string | undefined

    try {
      for (let i = 0; i < sortedNodes.length; i++) {
        if (abortRef.current) break

        const node = sortedNodes[i]
        const kind = (node.data.nodeKind || "script") as CanvasNodeKind
        const stepLabel: string = (node.data.title || String(kind)) as string

        // ── P2-3A: emit node-started ─────────────────────
        const nodeStartedAt = new Date().toISOString()
        onRunEvent?.({
          type: "node-started",
          runId: planRunId,
          nodeId: node.id,
          startedAt: nodeStartedAt,
        })

        // Mark as running
        setState((prev) => ({
          ...prev,
          currentStep: stepLabel,
          stepStatuses: { ...prev.stepStatuses, [node.id]: "running" },
          progress: Math.round(((i) / sortedNodes.length) * 100),
        }))

        const runId = crypto.randomUUID()
        const source: NodeRunSource = "workflow"

        updateNodeData(node.id, { runMeta: createRunningRunMeta({ runId, source, message: "工作流 " + (i + 1) + "/" + sortedNodes.length }) })

        failingNodeId = node.id

        // Execute
        await executeStep(node, allNodes, allEdges, { runId, source })

        // ── P2-3A: emit node-succeeded ────────────────────
        const nodeEndedAt = new Date().toISOString()
        onRunEvent?.({
          type: "node-succeeded",
          runId: planRunId,
          nodeId: node.id,
          endedAt: nodeEndedAt,
          outputSummary: (node.data.summary as string) || undefined,
        })

        // Mark as done
        setState((prev) => ({
          ...prev,
          stepStatuses: { ...prev.stepStatuses, [node.id]: "done" },
          progress: Math.round(((i + 1) / sortedNodes.length) * 100),
        }))
      }

      // ── P2-3A: emit run-finished (success) ──────────────
      onRunEvent?.({
        type: "run-finished",
        runId: planRunId,
        endedAt: new Date().toISOString(),
        status: "success",
      })
    } catch (err: any) {
      const normalized = err?.generationError || normalizeGenerationError({ error: err, provider: "copse" })
      const safeError = formatGenerationErrorForDisplay(normalized)
      console.debug("[WorkflowRunner] workflow failed raw:", normalized.raw)
      // ── P2-3A: emit run-finished (failed) ───────────────
      onRunEvent?.({
        type: "run-finished",
        runId: planRunId,
        endedAt: new Date().toISOString(),
        status: "failed",
        error: safeError,
      })

      // Mark the failing node as failed (otherwise it stays "running")
      if (failingNodeId) {
        updateNodeData(failingNodeId, {
          runMeta: createFailedRunMeta({
            runId: planRunId,
            error: safeError,
            message: safeError,
          }),
        })
      }

      setState((prev) => ({
        ...prev,
        error: safeError,
        isRunning: false,
        stepStatuses: failingNodeId
          ? { ...prev.stepStatuses, [failingNodeId]: "error" as const }
          : prev.stepStatuses,
      }))
      return
    }

    setState((prev) => ({
      ...prev,
      isRunning: false,
      currentStep: null,
      progress: 100,
    }))
  }, [state.isRunning, getNodes, getEdges, executeStep, updateNodeData, onRunEvent])

  const stopWorkflow = useCallback(() => {
    abortRef.current = true
    setState((prev) => ({
      ...prev,
      isRunning: false,
      currentStep: null,
    }))
  }, [])

  // ==========================================================================
  // P1-6.3: RESTORE PROMPT FROM HISTORY
  // ==========================================================================

  /**
   * 从历史记录中恢复 prompt 到当前节点。
   * 纯数据操作，不触发运行。
   */
  const restorePromptFromHistory = useCallback(
    (nodeId: string, historyId: string) => {
      const historyItem = useRunHistoryStore.getState().findById(historyId)
      if (!historyItem) {
        console.warn("[WorkflowRunner] History item not found:", historyId)
        return
      }

      const patch = buildRestorePromptPatch(historyItem.input)
      updateNodeData(nodeId, patch as Partial<CanvasNodeData>)
    },
    [updateNodeData],
  )

  // ==========================================================================
  // P1-6.4: RETRY FROM HISTORY (简化版)
  // ==========================================================================

  /**
   * 从历史记录中重试节点运行。
   * 简化策略：恢复 prompt → 调用当前 runNode。
   * 完整重试（复用历史 context/settings）放 P2。
   */
  const retryFromHistory = useCallback(
    (nodeId: string, historyId: string) => {
      const historyItem = useRunHistoryStore.getState().findById(historyId)
      if (!historyItem) {
        console.warn("[WorkflowRunner] History item not found:", historyId)
        return
      }

      // 确保节点未被占用
      if (runningNodeIdsRef.current.has(nodeId)) {
        console.warn("[WorkflowRunner] Node is busy, cannot retry:", nodeId)
        return
      }

      // 1. 恢复 prompt
      const patch = buildRestorePromptPatch(historyItem.input)
      updateNodeData(nodeId, patch as Partial<CanvasNodeData>)

      // 2. 异步调用 runNode（不 await，避免阻塞 UI）
      //    runNode 内部会读取最新的节点数据（即刚恢复的 prompt）
      //    source 标记为 "retry" 由 runNode 自动处理
      setTimeout(() => {
        runNode(nodeId)
      }, 0)
    },
    [updateNodeData, runNode],
  )

  // ==========================================================================
  // P1-7: RUN AGENT FROM CANVAS — AgentNode 运行的公开入口
  // ==========================================================================

  const runAgentFromCanvas = useCallback(async (nodeId: string) => {
    const node = getNodes().find((n) => n.id === nodeId)
    if (!node) return
    const content = (node.data as Record<string, unknown>)?.content as string ?? ""
    if (!content.trim()) {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, agentStatus: "error" as const, agentOutput: "请先输入剧本内容" } }
            : n,
        ),
      )
      return
    }
    // Execute via runNode which handles history/stats/error/usage
    await runNode(nodeId)
  }, [getNodes, setNodes, runNode])

  // ==========================================================================
  // P2-2: RUN EXECUTION PLAN — 级联执行
  // ==========================================================================

  /**
   * 串行执行整个 ExecutionPlan。
   * 每个 step 复用 runNode（history/stats/error/usage 全部保留）。
   * 一个 step 失败则标记后续为 skipped，并停止执行。
   */
  const runExecutionPlan = useCallback(async (
    plan: ExecutionPlan,
  ): Promise<ExecutionPlan> => {
    if (state.isRunning) return plan

    abortRef.current = false
    const stepsToRun = plan.steps.filter((s) => s.status === "pending")

    // 深拷贝 plan（避免修改原始对象）
    const planCopy: ExecutionPlan = {
      ...plan,
      status: "running",
      startedAt: new Date().toISOString(),
      steps: plan.steps.map((s) => ({ ...s })),
    }

    // 初始化 step statuses
    const initialStatuses: Record<string, WorkflowStepStatus> = {}
    for (const step of planCopy.steps) {
      initialStatuses[step.nodeId] = "pending"
    }

    setState({
      isRunning: true,
      currentStep: null,
      stepStatuses: initialStatuses,
      error: null,
      progress: 0,
    })

    // ── P2-3A: emit run-started ──────────────────────────
    const planRunId = planCopy.id
    const planStartedAt = planCopy.startedAt!
    const nodesForPanel = planCopy.steps.map((s) => {
      const n = getNodes().find((nd) => nd.id === s.nodeId)
      return {
        nodeId: s.nodeId,
        nodeType: n?.type ?? "unknown",
        title: (n?.data?.title as string) || s.nodeId,
        depth: s.depth,
      }
    })
    onRunEvent?.({
      type: "run-started",
      runId: planRunId,
      startedAt: planStartedAt,
      nodes: nodesForPanel,
      mode: planCopy.mode,
    })

    try {
      for (let i = 0; i < planCopy.steps.length; i++) {
        // 检查取消
        if (abortRef.current) {
          planCopy.status = "cancelled"
          planCopy.finishedAt = new Date().toISOString()
          for (let j = i; j < planCopy.steps.length; j++) {
            planCopy.steps[j].status = "cancelled"
          }
          // ── P2-3A: emit node-skipped + run-finished ─────
          for (let j = i; j < planCopy.steps.length; j++) {
            onRunEvent?.({ type: "node-skipped", runId: planRunId, nodeId: planCopy.steps[j].nodeId, reason: "流程已取消" })
          }
          onRunEvent?.({ type: "run-finished", runId: planRunId, endedAt: new Date().toISOString(), status: "cancelled" })
          break
        }

        const step = planCopy.steps[i]

        // 并发保护：节点已在运行时跳过
        if (runningNodeIdsRef.current.has(step.nodeId)) {
          step.status = "skipped"
          onRunEvent?.({ type: "node-skipped", runId: planRunId, nodeId: step.nodeId, reason: "节点正在运行中" })
          continue
        }

        // 标记运行中
        step.status = "running"
        step.startedAt = new Date().toISOString()
        const node = getNodes().find((n) => n.id === step.nodeId)
        const stepLabel: string = (node?.data?.title as string) || step.nodeId

        // ── P2-3A: emit node-started ─────────────────────
        onRunEvent?.({
          type: "node-started",
          runId: planRunId,
          nodeId: step.nodeId,
          startedAt: step.startedAt,
        })

        setState((prev) => ({
          ...prev,
          currentStep: stepLabel,
          stepStatuses: { ...prev.stepStatuses, [step.nodeId]: "running" },
          progress: Math.round((i / planCopy.steps.length) * 100),
        }))

        try {
          // 核心调用：复用已存在的 runNode
          await runNode(step.nodeId)

          step.status = "succeeded"
          step.finishedAt = new Date().toISOString()
          step.durationMs = step.startedAt
            ? Date.now() - new Date(step.startedAt).getTime()
            : undefined

          // ── P2-3A: emit node-succeeded ──────────────────
          onRunEvent?.({
            type: "node-succeeded",
            runId: planRunId,
            nodeId: step.nodeId,
            endedAt: step.finishedAt,
            outputSummary: (node?.data?.summary as string) || undefined,
          })

          setState((prev) => ({
            ...prev,
            stepStatuses: { ...prev.stepStatuses, [step.nodeId]: "done" },
            progress: Math.round(((i + 1) / planCopy.steps.length) * 100),
          }))
        } catch (err: any) {
          step.status = "failed"
          step.error = err.message || "执行失败"
          step.finishedAt = new Date().toISOString()
          step.durationMs = step.startedAt
            ? Date.now() - new Date(step.startedAt).getTime()
            : undefined

          // ── P2-3A: emit node-failed ─────────────────────
          onRunEvent?.({
            type: "node-failed",
            runId: planRunId,
            nodeId: step.nodeId,
            endedAt: step.finishedAt,
            error: step.error!,
          })

          // 剩余步骤标记 skipped
          for (let j = i + 1; j < planCopy.steps.length; j++) {
            planCopy.steps[j].status = "skipped"
            onRunEvent?.({ type: "node-skipped", runId: planRunId, nodeId: planCopy.steps[j].nodeId, reason: "上游节点失败" })
          }

          planCopy.status = "failed"
          planCopy.finishedAt = new Date().toISOString()

          // ── P2-3A: emit run-finished (failed) ───────────
          onRunEvent?.({
            type: "run-finished",
            runId: planRunId,
            endedAt: planCopy.finishedAt,
            status: "failed",
            error: step.error!,
          })

          setState((prev) => ({
            ...prev,
            stepStatuses: { ...prev.stepStatuses, [step.nodeId]: "error" },
            error: step.error!,
            isRunning: false,
            currentStep: null,
          }))
          break
        }
      }

      // 全部成功
      if (planCopy.status === "running") {
        planCopy.status = "succeeded"
        planCopy.finishedAt = new Date().toISOString()

        // ── P2-3A: emit run-finished (success) ────────────
        onRunEvent?.({
          type: "run-finished",
          runId: planRunId,
          endedAt: planCopy.finishedAt,
          status: "success",
        })

        setState((prev) => ({
          ...prev,
          isRunning: false,
          currentStep: null,
          progress: 100,
        }))
      }
    } catch (err: any) {
      planCopy.status = "failed"
      planCopy.finishedAt = new Date().toISOString()

      // ── P2-3A: emit run-finished (failed) ───────────────
      onRunEvent?.({
        type: "run-finished",
        runId: planRunId,
        endedAt: planCopy.finishedAt,
        status: "failed",
        error: err.message || "执行计划异常",
      })

      setState((prev) => ({
        ...prev,
        error: err.message || "执行计划异常",
        isRunning: false,
        currentStep: null,
      }))
    }

    return planCopy
  }, [state.isRunning, runNode, getNodes, setState, onRunEvent])

  return {
    state,
    runWorkflow,
    runNode,
    runAgentFromCanvas,
    runExecutionPlan,
    stopWorkflow,
    restorePromptFromHistory,
    retryFromHistory,
  }
}
