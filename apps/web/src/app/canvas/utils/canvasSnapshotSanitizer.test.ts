import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Edge, Node } from "@xyflow/react";
import type { CanvasNodeData } from "../components/canvas/types";
import type { CanvasSnapshot } from "../types/canvas-snapshot";
import {
  CANVAS_SNAPSHOT_SCHEMA_VERSION,
  estimateSnapshotStorageSize,
  sanitizeAndValidateCanvasSnapshot,
  sanitizeCanvasSnapshot,
  trimSnapshotsForStorage,
  validateCanvasSnapshot,
} from "./canvasSnapshotSanitizer.ts";

function createSnapshot(overrides: Partial<CanvasSnapshot> = {}): CanvasSnapshot {
  const nodes: Node<CanvasNodeData>[] = [
    {
      id: "node-1",
      type: "image",
      position: { x: 10, y: 20 },
      data: {
        title: "Image Node",
        assetId: "asset-kept",
        imageUrl: "blob:http://localhost/image",
        generation: {
          raw: {
            b64_json: "data:image/png;base64,RAW",
          },
          referenceImage: {
            assetId: "reference-kept",
            dataUrl: "data:image/png;base64,REFERENCE",
          },
        },
      },
    },
    {
      id: "node-2",
      type: "content",
      position: { x: 200, y: 120 },
      data: {
        title: "Story",
        nodeKind: "document",
        content: "Once upon a time",
      },
    },
  ];
  const edges: Edge[] = [
    {
      id: "edge-1",
      source: "node-2",
      target: "node-1",
    },
  ];

  return {
    id: "snapshot-1",
    title: "Snapshot 1",
    createdAt: "2026-05-25T12:00:00.000Z",
    schemaVersion: CANVAS_SNAPSHOT_SCHEMA_VERSION,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes,
    edges,
    viewport: { x: 1, y: 2, zoom: 0.9 },
    ...overrides,
  };
}

describe("canvasSnapshotSanitizer", () => {
  it("keeps asset metadata and text fields while removing blob and data:image fields", () => {
    const clean = sanitizeCanvasSnapshot(createSnapshot());
    const imageNode = clean.nodes[0];

    assert.equal(imageNode.data.assetId, "asset-kept");
    assert.equal(imageNode.data.title, "Image Node");
    assert.equal(imageNode.data.imageUrl, undefined);
    assert.equal(imageNode.data.generation.referenceImage.assetId, "reference-kept");
    assert.equal(imageNode.data.generation.referenceImage.dataUrl, undefined);
    assert.equal(imageNode.data.generation.raw.b64_json, undefined);
    assert.equal(clean.nodes[1].data.content, "Once upon a time");
  });

  it("sets schemaVersion and recalculates node and edge counts", () => {
    const dirty = createSnapshot({
      schemaVersion: undefined as unknown as 1,
      nodeCount: 999,
      edgeCount: 999,
    });
    const clean = sanitizeCanvasSnapshot(dirty);

    assert.equal(clean.schemaVersion, CANVAS_SNAPSHOT_SCHEMA_VERSION);
    assert.equal(clean.nodeCount, 2);
    assert.equal(clean.edgeCount, 1);
  });

  it("validates safe snapshots", () => {
    const clean = sanitizeCanvasSnapshot(createSnapshot());

    assert.equal(validateCanvasSnapshot(clean), true);
    assert.ok(sanitizeAndValidateCanvasSnapshot(createSnapshot()));
  });

  it("rejects invalid viewport and edge references", () => {
    const invalidViewport = sanitizeCanvasSnapshot(
      createSnapshot({ viewport: { x: 0, y: 0, zoom: 0 } }),
    );
    assert.equal(validateCanvasSnapshot(invalidViewport), true);
    assert.equal(invalidViewport.viewport, undefined);

    const invalidEdge = sanitizeCanvasSnapshot(
      createSnapshot({
        edges: [{ id: "edge-bad", source: "missing", target: "node-1" }],
      }),
    );
    assert.equal(validateCanvasSnapshot(invalidEdge), false);
  });

  it("rejects snapshots that still contain runtime URL leaks", () => {
    const snapshot = createSnapshot();
    snapshot.nodes[0].data.unexpected = {
      url: "blob:http://localhost/unsafe",
    };

    assert.equal(validateCanvasSnapshot(snapshot), false);
    assert.equal(validateCanvasSnapshot(sanitizeCanvasSnapshot(snapshot)), true);
  });

  it("estimates snapshot storage size", () => {
    const clean = sanitizeCanvasSnapshot(createSnapshot());
    assert.equal(estimateSnapshotStorageSize(clean) > 0, true);
  });

  it("keeps at most configured snapshots and sorts newest first", () => {
    const snapshots = Array.from({ length: 35 }, (_, index) =>
      createSnapshot({
        id: `snapshot-${index}`,
        title: `Snapshot ${index}`,
        createdAt: new Date(Date.UTC(2026, 4, 25, 0, index)).toISOString(),
      }),
    );

    const trimmed = trimSnapshotsForStorage(snapshots, {
      maxSnapshots: 30,
      maxSizeBytes: 4 * 1024 * 1024,
    });

    assert.equal(trimmed.length, 30);
    assert.equal(trimmed[0].id, "snapshot-34");
    assert.equal(trimmed.at(-1)?.id, "snapshot-5");
  });

  it("drops oversized snapshots to keep localStorage safe", () => {
    const oversized = createSnapshot({
      id: "oversized",
      nodes: [
        {
          id: "big-node",
          type: "content",
          position: { x: 0, y: 0 },
          data: {
            title: "Big",
            content: "x".repeat(5 * 1024 * 1024),
          },
        },
      ],
      edges: [],
    });
    const small = createSnapshot({ id: "small", createdAt: "2026-05-25T13:00:00.000Z" });

    const trimmed = trimSnapshotsForStorage([oversized, small], {
      maxSnapshots: 30,
      maxSizeBytes: 4 * 1024 * 1024,
    });

    assert.deepEqual(trimmed.map((snapshot) => snapshot.id), ["small"]);
  });
});
