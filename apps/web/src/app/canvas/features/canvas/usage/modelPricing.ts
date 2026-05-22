// ============================================================================
// Model Pricing Table — 按 provider + model 维护定价，用于成本估算
// ============================================================================

import type { AITaskType } from "./aiUsageTypes"

export interface ModelPricing {
  provider: string
  model: string
  taskType: AITaskType

  // Text: per 1M tokens
  inputPer1MTokensUsd?: number
  outputPer1MTokensUsd?: number

  // Image: per generation
  imagePerUnitUsd?: number

  // Video: per second
  videoPerSecondUsd?: number

  updatedAt: string
}

/**
 * 模型定价表 — 按需手动维护
 * 数据来源：
 *   - OpenAI: https://openai.com/api/pricing/
 *   - Zhipu: https://open.bigmodel.cn/pricing
 *   - 其他：官方定价页
 *
 * 注意：中转站价格可能与官方不同，请根据实际价格调整。
 */
export const MODEL_PRICING: ModelPricing[] = [
  // ── OpenAI ──────────────────────────────────────────────────────
  {
    provider: "openai",
    model: "gpt-4o-mini",
    taskType: "text",
    inputPer1MTokensUsd: 0.15,
    outputPer1MTokensUsd: 0.60,
    updatedAt: "2025-01-01",
  },
  {
    provider: "openai",
    model: "gpt-4o",
    taskType: "text",
    inputPer1MTokensUsd: 2.50,
    outputPer1MTokensUsd: 10.00,
    updatedAt: "2025-01-01",
  },
  {
    provider: "openai",
    model: "gpt-5",
    taskType: "text",
    inputPer1MTokensUsd: 1.25,
    outputPer1MTokensUsd: 5.00,
    updatedAt: "2025-01-01",
  },
  {
    provider: "openai",
    model: "gpt-5.5",
    taskType: "text",
    inputPer1MTokensUsd: 3.75,
    outputPer1MTokensUsd: 15.00,
    updatedAt: "2025-01-01",
  },
  {
    provider: "openai",
    model: "dall-e-3",
    taskType: "image",
    imagePerUnitUsd: 0.04,
    updatedAt: "2025-01-01",
  },
  {
    provider: "openai",
    model: "gpt-image-2",
    taskType: "image",
    imagePerUnitUsd: 0.05,
    updatedAt: "2025-01-01",
  },

  // ── anthropic ───────────────────────────────────────────────────
  {
    provider: "anthropic",
    model: "claude-3-haiku",
    taskType: "text",
    inputPer1MTokensUsd: 0.25,
    outputPer1MTokensUsd: 1.25,
    updatedAt: "2025-01-01",
  },
  {
    provider: "anthropic",
    model: "claude-3.5-sonnet",
    taskType: "text",
    inputPer1MTokensUsd: 3.00,
    outputPer1MTokensUsd: 15.00,
    updatedAt: "2025-01-01",
  },

  // ── 智谱 ────────────────────────────────────────────────────────
  {
    provider: "zhipu",
    model: "glm-4-flash",
    taskType: "text",
    inputPer1MTokensUsd: 0,
    outputPer1MTokensUsd: 0,
    updatedAt: "2025-01-01",
  },
  {
    provider: "zhipu",
    model: "glm-4-plus",
    taskType: "text",
    inputPer1MTokensUsd: 0.7,
    outputPer1MTokensUsd: 0.7,
    updatedAt: "2025-01-01",
  },

  // ── 中转站通用 ──────────────────────────────────────────────────
  {
    provider: "copse",
    model: "gpt-5.5",
    taskType: "text",
    inputPer1MTokensUsd: 3.75,
    outputPer1MTokensUsd: 15.00,
    updatedAt: "2025-01-01",
  },
  {
    provider: "copse",
    model: "gpt-image-2",
    taskType: "image",
    imagePerUnitUsd: 0.05,
    updatedAt: "2025-01-01",
  },
  {
    provider: "copse",
    model: "text-video-1",
    taskType: "video",
    videoPerSecondUsd: 0.10,
    updatedAt: "2025-01-01",
  },
]

/**
 * 查找定价
 */
export function findPricing(provider: string, model: string, taskType: AITaskType): ModelPricing | undefined {
  return MODEL_PRICING.find(
    (p) =>
      p.provider.toLowerCase() === provider.toLowerCase() &&
      p.model.toLowerCase() === model.toLowerCase() &&
      p.taskType === taskType
  )
}
