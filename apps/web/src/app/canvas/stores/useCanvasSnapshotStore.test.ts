import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { CanvasSnapshot } from "../types/canvas-snapshot";
import { CANVAS_SNAPSHOT_SCHEMA_VERSION } from "../utils/canvasSnapshotSanitizer.ts";

const STORAGE_KEY = "startrails_canvas_snapshots:current";

class LocalStorageMock {
  private store = new Map<string, string>();

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

function createSnapshot(index: number): CanvasSnapshot {
  return {
    id: `snapshot-${index}`,
    title: `Snapshot ${index}`,
    createdAt: new Date(Date.UTC(2026, 4, 25, 0, index)).toISOString(),
    schemaVersion: CANVAS_SNAPSHOT_SCHEMA_VERSION,
    nodeCount: 1,
    edgeCount: 0,
    nodes: [
      {
        id: `node-${index}`,
        type: "content",
        position: { x: index, y: index },
        data: { title: `Node ${index}`, content: "safe text" },
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

async function loadFreshStore() {
  const modulePath = `./useCanvasSnapshotStore.ts?case=${Date.now()}-${Math.random()}`;
  return import(modulePath);
}

beforeEach(() => {
  Object.defineProperty(globalThis, "window", {
    value: { localStorage: new LocalStorageMock() },
    configurable: true,
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: (globalThis.window as any).localStorage,
    configurable: true,
  });
});

describe("useCanvasSnapshotStore", () => {
  it("loads corrupted localStorage without crashing", async () => {
    localStorage.setItem(STORAGE_KEY, "not-json");
    const { useCanvasSnapshotStore } = await loadFreshStore();

    assert.deepEqual(useCanvasSnapshotStore.getState().snapshots, []);
  });

  it("adds sanitized snapshots and removes runtime image urls before writing localStorage", async () => {
    const { useCanvasSnapshotStore } = await loadFreshStore();
    const snapshot = createSnapshot(1);
    snapshot.nodes[0].data.imageUrl = "blob:http://localhost/image";
    snapshot.nodes[0].data.assetId = "asset-kept";

    useCanvasSnapshotStore.getState().addSnapshot(snapshot);

    const raw = localStorage.getItem(STORAGE_KEY) ?? "";
    assert.equal(raw.includes("blob:"), false);
    assert.equal(raw.includes("data:image"), false);
    assert.equal(raw.includes("asset-kept"), true);
    assert.equal(useCanvasSnapshotStore.getState().snapshots.length, 1);
  });

  it("keeps at most 30 snapshots", async () => {
    const { useCanvasSnapshotStore } = await loadFreshStore();

    for (let i = 0; i < 35; i++) {
      useCanvasSnapshotStore.getState().addSnapshot(createSnapshot(i));
    }

    const snapshots = useCanvasSnapshotStore.getState().snapshots;
    assert.equal(snapshots.length, 30);
    assert.equal(snapshots[0].id, "snapshot-34");
    assert.equal(snapshots.at(-1)?.id, "snapshot-5");
  });

  it("removes snapshots and persists deletion", async () => {
    const { useCanvasSnapshotStore } = await loadFreshStore();
    useCanvasSnapshotStore.getState().addSnapshot(createSnapshot(1));
    useCanvasSnapshotStore.getState().addSnapshot(createSnapshot(2));

    useCanvasSnapshotStore.getState().removeSnapshot("snapshot-2");

    const snapshots = useCanvasSnapshotStore.getState().snapshots;
    const raw = localStorage.getItem(STORAGE_KEY) ?? "";
    assert.deepEqual(snapshots.map((snapshot) => snapshot.id), ["snapshot-1"]);
    assert.equal(raw.includes("snapshot-2"), false);
  });

  it("rejects oversized snapshots and keeps previous safe snapshots", async () => {
    const { useCanvasSnapshotStore } = await loadFreshStore();
    useCanvasSnapshotStore.getState().addSnapshot(createSnapshot(1));

    const oversized = createSnapshot(99);
    oversized.nodes[0].data.content = "x".repeat(5 * 1024 * 1024);
    useCanvasSnapshotStore.getState().addSnapshot(oversized);

    const snapshots = useCanvasSnapshotStore.getState().snapshots;
    assert.deepEqual(snapshots.map((snapshot) => snapshot.id), ["snapshot-1"]);
  });
});
