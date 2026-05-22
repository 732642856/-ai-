// ============================================================================
// Mock Video Analyzer (V1-4 / V1-5)
// ============================================================================
// 独立封装，方便后续替换为 geminiVideoAnalyzer / openaiVisionAnalyzer 等
// ============================================================================

import type { VideoAnalysisResult, VideoKeyframeRef } from "../types/video-analysis"

// ============================================================================
// V1-安全：数量限制
// ============================================================================

/** 单次抽帧最大数量 */
export const MAX_MOCK_FRAMES = 6

/** 历史记录中保存的最大帧数 */
export const MAX_HISTORY_FRAMES = 12

// ============================================================================
// 帧生成
// ============================================================================

/**
 * 生成 Mock 占位帧 URL（彩色 SVG data URL）。
 * 每个帧返回 VideoKeyframeRef，含 sourceVideoId + timestampMs + frameIndex。
 */
export function generateMockFrameUrls(
  sourceVideoId: string,
  count: number,
): VideoKeyframeRef[] {
  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]
  const safeCount = Math.min(count, MAX_MOCK_FRAMES)

  return Array.from({ length: safeCount }, (_, i) => {
    const color = colors[i % colors.length]
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">
      <rect width="320" height="180" fill="${color}" rx="8"/>
      <text x="160" y="96" text-anchor="middle" fill="white" font-size="14" font-family="sans-serif">Frame ${i + 1}</text>
    </svg>`
    return {
      sourceVideoId,
      sourceVideoUrl: undefined,
      timestampMs: i * 1000,
      frameIndex: i,
      imageUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
      width: 320,
      height: 180,
      description: undefined,
    }
  })
}

// ============================================================================
// Mock 分析
// ============================================================================

/**
 * 执行 Mock 视频分析。
 * V1: 基于上游帧数量生成摘要 + 关键帧列表。
 * V2: 替换为真实模型调用（Gemini / GPT-4o / Qwen-VL 等）。
 */
export function runMockVideoAnalyze(
  keyframes: VideoKeyframeRef[],
): VideoAnalysisResult {
  if (keyframes.length === 0) {
    return {
      summary: "未检测到上游帧数据，请先连接视频抽帧节点。",
      keyframes: [],
      captions: [],
      events: [],
      objects: [],
      raw: { mode: "mock", frameCount: 0 },
    }
  }

  const frameCount = keyframes.length
  const mockSummary = `视频包含 ${frameCount} 个关键帧。`
    + `画面内容概要：场景切换自然，包含人物和背景元素。`
    + `（Mock 分析结果 — V2 将接入真实多模态模型进行逐帧深度分析）`

  return {
    summary: mockSummary,
    keyframes,
    captions: [],
    events: [],
    objects: [],
    raw: { mode: "mock", frameCount, sourceVideoIds: [...new Set(keyframes.map(kf => kf.sourceVideoId))] },
  }
}
