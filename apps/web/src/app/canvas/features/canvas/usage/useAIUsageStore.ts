// ============================================================================
// AI Usage Store — Zustand 管理 AI 用量记录（仅记录，不扣费）
// ============================================================================

import { create } from "zustand"
import type { AIUsageRecord } from "./aiUsageTypes"
import { computeUsageStats, getNodeCostUsd, getNodeLastCostUsd } from "./aiUsageTypes"
import type { UsageStats } from "./aiUsageTypes"

const STORAGE_KEY = "startrails_ai_usage_records"
const STORAGE_VERSION = 1

interface AIUsageStorage {
  version: number
  records: AIUsageRecord[]
}

function loadRecords(): AIUsageRecord[] {
  try {
    if (typeof window === "undefined") return []
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data: AIUsageStorage = JSON.parse(raw)
    if (data.version !== STORAGE_VERSION) return []
    return data.records ?? []
  } catch {
    return []
  }
}

function saveRecords(records: AIUsageRecord[]) {
  try {
    if (typeof window === "undefined") return
    const data: AIUsageStorage = { version: STORAGE_VERSION, records }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Storage full — silently drop
  }
}

interface AIUsageStoreState {
  usageRecords: AIUsageRecord[]
  stats: UsageStats // cached for React 19 useSyncExternalStore ref stability

  // Mutations
  addUsageRecord: (record: AIUsageRecord) => void
  clearUsageRecords: () => void

  // Queries (kept for backward compat; prefer `stats` in selectors)
  getStats: () => UsageStats
  getNodeCostUsd: (nodeId: string) => number
  getNodeLastCostUsd: (nodeId: string) => number | undefined
}

const initialRecords = loadRecords()

export const useAIUsageStore = create<AIUsageStoreState>((set, get) => ({
  usageRecords: initialRecords,
  stats: computeUsageStats(initialRecords),

  addUsageRecord: (record) => {
    set((state) => {
      const newRecords = [...state.usageRecords, record]
      // Persist to localStorage (fire-and-forget)
      saveRecords(newRecords)
      return { usageRecords: newRecords, stats: computeUsageStats(newRecords) }
    })
  },

  clearUsageRecords: () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {}
    set({ usageRecords: [], stats: computeUsageStats([]) })
  },

  getStats: () => {
    return get().stats
  },

  getNodeCostUsd: (nodeId: string) => {
    return getNodeCostUsd(get().usageRecords, nodeId)
  },

  getNodeLastCostUsd: (nodeId: string) => {
    return getNodeLastCostUsd(get().usageRecords, nodeId)
  },
}))
