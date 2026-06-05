// ============================================================================
// useRunHistoryStore — Zustand 管理节点运行历史 (P1-5 / P1-6)
// ============================================================================
// 持久化到 localStorage（key: startrails_node_run_history:${canvasId}）。
// P1-6: canvasId 隔离、安全裁剪兜底。
// ============================================================================

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { NodeRunHistoryItem, NodeRunHistoryMap } from "../types/node-run-history";
import {
  appendNodeRunHistory as appendHistory,
  getNodeRunHistory as getHistory,
  findRunHistoryItem as findHistory,
  clearNodeRunHistory as clearHistory,
  getHistoryCount,
} from "../utils/node-run-history";
import type { HistoryTrimOptions } from "../types/node-run-history";
import {
  loadPersistedState,
  persistState,
} from "../../../lib/localStoragePersist.ts";

const STORAGE_VERSION = 2;
// v1 → v2: 增加 canvasId 隔离，key 改为 startrails_node_run_history:${canvasId}

interface HistoryStorage {
  version: number;
  canvasId: string;
  histories: NodeRunHistoryMap;
}

function getStorageKey(canvasId: string): string {
  return `startrails_node_run_history:${canvasId}`;
}

function loadHistories(canvasId: string): NodeRunHistoryMap {
  try {
    if (typeof window === "undefined") return {};
    return loadPersistedState<HistoryStorage>(
      { key: getStorageKey(canvasId), version: STORAGE_VERSION },
      { version: STORAGE_VERSION, canvasId, histories: {} },
    ).histories;
  } catch {
    return {};
  }
}

function saveHistories(canvasId: string, histories: NodeRunHistoryMap): void {
  try {
    if (typeof window === "undefined") return;
    const json = JSON.stringify({ version: STORAGE_VERSION, canvasId, histories });
    // 兜底：检查大小（理论上不会超过 quota，但兜底）
    if (json.length > 4 * 1024 * 1024) {
      console.warn("[RunHistoryStore] History data approaching quota, skipping save.", json.length);
      return;
    }
    persistState(
      { key: getStorageKey(canvasId), version: STORAGE_VERSION },
      { version: STORAGE_VERSION, canvasId, histories },
    );
  } catch (err) {
    console.warn("[RunHistoryStore] Failed to save history:", err);
  }
}

interface RunHistoryStoreState {
  /** 当前画布 ID */
  canvasId: string;

  /** 按 nodeId 分组的历史记录 */
  histories: NodeRunHistoryMap;

  /** 设置画布 ID，自动加载对应画布的历史 */
  setCanvasId: (canvasId: string) => void;

  /** 追加一条历史记录（自动裁剪 + 安全保存） */
  append: (item: NodeRunHistoryItem, options?: HistoryTrimOptions) => void;

  /** 获取指定节点的所有历史（时间升序） */
  getByNode: (nodeId: string) => NodeRunHistoryItem[];

  /** 查找指定 historyId 的记录 */
  findById: (historyId: string) => NodeRunHistoryItem | undefined;

  /** 清除指定节点的历史 */
  clearNode: (nodeId: string) => void;

  /** 历史记录总数 */
  get count(): number;

  /** 从 localStorage 重新加载 */
  reload: () => void;
}

const DEFAULT_CANVAS_ID = "default";

export const useRunHistoryStore = create<RunHistoryStoreState>()(
  devtools(
    (set, get) => ({
      canvasId: DEFAULT_CANVAS_ID,
      histories: loadHistories(DEFAULT_CANVAS_ID),

      setCanvasId: (canvasId: string) => {
        if (canvasId === get().canvasId) return;
        set(
          {
            canvasId,
            histories: loadHistories(canvasId),
          },
          false,
          "setCanvasId",
        );
      },

      append: (item: NodeRunHistoryItem, options?: HistoryTrimOptions) => {
        const { histories: current, canvasId } = get();
        const updated = appendHistory(current, item, options);
        saveHistories(canvasId, updated);
        set({ histories: updated }, false, "appendRunHistory");
      },

      getByNode: (nodeId: string) => {
        return getHistory(get().histories, nodeId);
      },

      findById: (historyId: string) => {
        return findHistory(get().histories, historyId);
      },

      clearNode: (nodeId: string) => {
        const { histories: current, canvasId } = get();
        const updated = clearHistory(current, nodeId);
        saveHistories(canvasId, updated);
        set({ histories: updated }, false, "clearNodeHistory");
      },

      get count(): number {
        return getHistoryCount(get().histories);
      },

      reload: () => {
        set({ histories: loadHistories(get().canvasId) }, false, "reloadRunHistory");
      },
    }),
    { name: "runHistory" },
  ),
);
