import { BillingMode } from "@creative-canvas/shared"

export interface UsageMeterInput {
  organizationId: string
  userId: string
  projectId?: string
  providerId: string
  model: string
  billingMode: BillingMode
  inputTokens?: number
  outputTokens?: number
  requestId?: string
}

export interface UsageCostEstimate {
  currency: "CNY" | "USD"
  amount: number
  credits?: number
}

export function estimateTextUsageCost(input: UsageMeterInput): UsageCostEstimate {
  if (input.billingMode !== BillingMode.PLATFORM_CREDITS) {
    return { currency: "CNY", amount: 0, credits: 0 }
  }

  const totalTokens = (input.inputTokens ?? 0) + (input.outputTokens ?? 0)
  const credits = Math.ceil(totalTokens / 1000)
  return { currency: "CNY", amount: credits * 0.01, credits }
}
