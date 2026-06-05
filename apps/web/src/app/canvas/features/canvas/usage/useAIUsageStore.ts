// ============================================================================
// AI Usage Store — Zustand 管理 AI 用量记录（仅记录，不扣费）
// ============================================================================

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { AIUsageRecord } from "./aiUsageTypes";
import { computeUsageStats, getNodeCostUsd, getNodeLastCostUsd } from "./aiUsageTypes";
import type { UsageStats } from "./aiUsageTypes";
import {
  loadPersistedState,
  persistState,
} from "../../../../../lib/localStoragePersist.ts";

const STORAGE_KEY = "startrails_ai_usage_records";
const STORAGE_VERSION = 1;

interface AIUsageStorage {
  version: number;
  records: AIUsageRecord[];
}

function loadRecords(): AIUsageRecord[] {
  const data = loadPersistedState<AIUsageStorage>(
    { key: STORAGE_KEY, version: STORAGE_VERSION },
    { version: STORAGE_VERSION, records: [] },
  );
  return data.records ?? [];
}

function saveRecords(records: AIUsageRecord[]): void {
  persistState(
    { key: STORAGE_KEY, version: STORAGE_VERSION },
    { version: STORAGE_VERSION, records },
  );
}

interface AIUsageStoreState {
  usageRecords: AIUsageRecord[];
  stats: UsageStats;

  addUsageRecord: (record: AIUsageRecord) => void;
  clearUsageRecords: () => void;

  getStats: () => UsageStats;
  getNodeCostUsd: (nodeId: string) => number;
  getNodeLastCostUsd: (nodeId: string) => number | undefined;
}

const initialRecords = loadRecords();

export const useAIUsageStore = create<AIUsageStoreState>()(
  devtools(
    (set, get) => ({
      usageRecords: initialRecords,
      stats: computeUsageStats(initialRecords),

      addUsageRecord: (record) => {
        set((state) => {
          const newRecords = [...state.usageRecords, record];
          saveRecords(newRecords);
          return {
            usageRecords: newRecords,
            stats: computeUsageStats(newRecords),
          };
        }, false, "addUsageRecord");
      },

      clearUsageRecords: () => {
        try {
          if (typeof window !== "undefined") {
            localStorage.removeItem(STORAGE_KEY);
          }
        } catch {}
        set(
          { usageRecords: [], stats: computeUsageStats([]) },
          false,
          "clearUsageRecords",
        );
      },

      getStats: () => {
        return get().stats;
      },

      getNodeCostUsd: (nodeId: string) => {
        return getNodeCostUsd(get().usageRecords, nodeId);
      },

      getNodeLastCostUsd: (nodeId: string) => {
        return getNodeLastCostUsd(get().usageRecords, nodeId);
      },
    }),
    { name: "aiUsage" },
  ),
);
