import { create } from "zustand";
import type { CanvasSnapshot, CanvasSnapshotStorage } from "../types/canvas-snapshot";
import {
  sanitizeAndValidateCanvasSnapshot,
  trimSnapshotsForStorage,
} from "../utils/canvasSnapshotSanitizer.ts";

const STORAGE_KEY = "startrails_canvas_snapshots:current";
const STORAGE_VERSION = 1;
const MAX_SNAPSHOTS = 30;
const MAX_SIZE_BYTES = 4 * 1024 * 1024;

function loadSnapshots(): CanvasSnapshot[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as CanvasSnapshotStorage;
    if (data.version !== STORAGE_VERSION || !Array.isArray(data.snapshots)) {
      return [];
    }
    return trimSnapshotsForStorage(data.snapshots, {
      maxSnapshots: MAX_SNAPSHOTS,
      maxSizeBytes: MAX_SIZE_BYTES,
    });
  } catch {
    return [];
  }
}

function saveSnapshots(snapshots: CanvasSnapshot[]): CanvasSnapshot[] {
  const safeSnapshots = trimSnapshotsForStorage(snapshots, {
    maxSnapshots: MAX_SNAPSHOTS,
    maxSizeBytes: MAX_SIZE_BYTES,
  });
  try {
    if (typeof window === "undefined") return safeSnapshots;
    const data: CanvasSnapshotStorage = {
      version: STORAGE_VERSION,
      snapshots: safeSnapshots,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn("[CanvasSnapshots] Failed to save snapshots:", error);
  }
  return safeSnapshots;
}

interface CanvasSnapshotState {
  snapshots: CanvasSnapshot[];
  addSnapshot: (snapshot: CanvasSnapshot) => void;
  removeSnapshot: (snapshotId: string) => void;
  clear: () => void;
  reload: () => void;
}

export const useCanvasSnapshotStore = create<CanvasSnapshotState>()((set, get) => ({
  snapshots: loadSnapshots(),

  addSnapshot: (snapshot) => {
    const safeSnapshot = sanitizeAndValidateCanvasSnapshot(snapshot);
    if (!safeSnapshot) {
      console.warn("[CanvasSnapshots] Rejected invalid snapshot:", snapshot.id);
      return;
    }
    const next = saveSnapshots([safeSnapshot, ...get().snapshots]);
    set({ snapshots: next });
  },

  removeSnapshot: (snapshotId) => {
    const next = saveSnapshots(
      get().snapshots.filter((snapshot) => snapshot.id !== snapshotId),
    );
    set({ snapshots: next });
  },

  clear: () => {
    const next = saveSnapshots([]);
    set({ snapshots: next });
  },

  reload: () => {
    set({ snapshots: loadSnapshots() });
  },
}));
