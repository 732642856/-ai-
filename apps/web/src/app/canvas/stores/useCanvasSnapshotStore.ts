import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { CanvasSnapshot, CanvasSnapshotStorage } from "../types/canvas-snapshot";
import {
  sanitizeAndValidateCanvasSnapshot,
  trimSnapshotsForStorage,
} from "../utils/canvasSnapshotSanitizer";
import {
  loadPersistedState,
  persistState,
} from "../../../lib/localStoragePersist";

const STORAGE_KEY = "startrails_canvas_snapshots:current";
const STORAGE_VERSION = 1;
const MAX_SNAPSHOTS = 30;
const MAX_SIZE_BYTES = 4 * 1024 * 1024;

function loadSnapshots(): CanvasSnapshot[] {
  const data = loadPersistedState<CanvasSnapshotStorage>(
    { key: STORAGE_KEY, version: STORAGE_VERSION },
    { version: STORAGE_VERSION, snapshots: [] },
  );
  return Array.isArray(data.snapshots)
    ? trimSnapshotsForStorage(data.snapshots, {
        maxSnapshots: MAX_SNAPSHOTS,
        maxSizeBytes: MAX_SIZE_BYTES,
      })
    : [];
}

function saveSnapshots(snapshots: CanvasSnapshot[]): CanvasSnapshot[] {
  const safeSnapshots = trimSnapshotsForStorage(snapshots, {
    maxSnapshots: MAX_SNAPSHOTS,
    maxSizeBytes: MAX_SIZE_BYTES,
  });
  persistState(
    { key: STORAGE_KEY, version: STORAGE_VERSION },
    { version: STORAGE_VERSION, snapshots: safeSnapshots },
  );
  return safeSnapshots;
}

interface CanvasSnapshotState {
  snapshots: CanvasSnapshot[];
  addSnapshot: (snapshot: CanvasSnapshot) => void;
  removeSnapshot: (snapshotId: string) => void;
  clear: () => void;
  reload: () => void;
}

export const useCanvasSnapshotStore = create<CanvasSnapshotState>()(
  devtools(
    (set, get) => ({
      snapshots: loadSnapshots(),

      addSnapshot: (snapshot) => {
        const safeSnapshot = sanitizeAndValidateCanvasSnapshot(snapshot);
        if (!safeSnapshot) {
          console.warn("[CanvasSnapshots] Rejected invalid snapshot:", snapshot.id);
          return;
        }
        const next = saveSnapshots([safeSnapshot, ...get().snapshots]);
        set({ snapshots: next }, false, "addSnapshot");
      },

      removeSnapshot: (snapshotId) => {
        const next = saveSnapshots(
          get().snapshots.filter((snapshot) => snapshot.id !== snapshotId),
        );
        set({ snapshots: next }, false, "removeSnapshot");
      },

      clear: () => {
        const next = saveSnapshots([]);
        set({ snapshots: next }, false, "clearSnapshots");
      },

      reload: () => {
        set({ snapshots: loadSnapshots() }, false, "reloadSnapshots");
      },
    }),
    { name: "canvasSnapshot" },
  ),
);
