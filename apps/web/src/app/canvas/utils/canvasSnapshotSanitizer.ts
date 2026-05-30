import type { Edge, Node, Viewport } from "@xyflow/react";
import type { CanvasNodeData } from "../components/canvas/types";
import type { CanvasSnapshot } from "../types/canvas-snapshot";
import {
  findRuntimeUrlLeaks,
  sanitizeNodesForPersistence,
} from "../../../lib/storage/sanitizePersistedCanvas.ts";

export const CANVAS_SNAPSHOT_SCHEMA_VERSION = 1;

const MAX_STORAGE_SIZE_BYTES = 4 * 1024 * 1024;

function isPlainSerializableObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidViewport(viewport: unknown): viewport is Viewport {
  if (!isPlainSerializableObject(viewport)) return false;
  return (
    typeof viewport.x === "number" &&
    typeof viewport.y === "number" &&
    typeof viewport.zoom === "number" &&
    Number.isFinite(viewport.x) &&
    Number.isFinite(viewport.y) &&
    Number.isFinite(viewport.zoom) &&
    viewport.zoom > 0
  );
}

function sanitizeViewport(viewport: unknown): Viewport | undefined {
  if (!isValidViewport(viewport)) return undefined;
  return {
    x: viewport.x,
    y: viewport.y,
    zoom: viewport.zoom,
  };
}

function sanitizeSnapshotEdges(edges: Edge[]): Edge[] {
  const nodeFieldsToKeep = edges.map((edge) => ({
    ...edge,
    data: isPlainSerializableObject(edge.data) ? edge.data : edge.data,
  }));
  return nodeFieldsToKeep;
}

function sanitizeSnapshotNode(node: Node<CanvasNodeData>): Node<CanvasNodeData> {
  return sanitizeNodesForPersistence([node])[0];
}

export function sanitizeCanvasSnapshot(snapshot: CanvasSnapshot): CanvasSnapshot {
  const nodes = Array.isArray(snapshot.nodes)
    ? snapshot.nodes.map(sanitizeSnapshotNode)
    : [];
  const edges = Array.isArray(snapshot.edges)
    ? sanitizeSnapshotEdges(snapshot.edges)
    : [];

  return {
    ...snapshot,
    schemaVersion: snapshot.schemaVersion ?? CANVAS_SNAPSHOT_SCHEMA_VERSION,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes,
    edges,
    viewport: sanitizeViewport(snapshot.viewport),
  };
}

export function estimateSnapshotStorageSize(snapshot: CanvasSnapshot): number {
  try {
    return JSON.stringify(snapshot).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function validateCanvasSnapshot(snapshot: unknown): snapshot is CanvasSnapshot {
  if (!isPlainSerializableObject(snapshot)) return false;
  if (typeof snapshot.id !== "string" || snapshot.id.trim().length === 0) return false;
  if (typeof snapshot.title !== "string" || snapshot.title.trim().length === 0) return false;
  if (typeof snapshot.createdAt !== "string" || Number.isNaN(Date.parse(snapshot.createdAt))) {
    return false;
  }
  if (snapshot.schemaVersion !== CANVAS_SNAPSHOT_SCHEMA_VERSION) return false;
  if (!Array.isArray(snapshot.nodes) || !Array.isArray(snapshot.edges)) return false;
  if (snapshot.viewport !== undefined && !isValidViewport(snapshot.viewport)) return false;

  const nodeIds = new Set<string>();
  for (const node of snapshot.nodes) {
    if (!isPlainSerializableObject(node)) return false;
    if (typeof node.id !== "string" || node.id.trim().length === 0) return false;
    if (!isPlainSerializableObject(node.position)) return false;
    if (!Number.isFinite(node.position.x) || !Number.isFinite(node.position.y)) return false;
    nodeIds.add(node.id);
  }

  for (const edge of snapshot.edges) {
    if (!isPlainSerializableObject(edge)) return false;
    if (typeof edge.id !== "string" || edge.id.trim().length === 0) return false;
    if (typeof edge.source !== "string" || typeof edge.target !== "string") return false;
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return false;
  }

  const candidate = snapshot as unknown as CanvasSnapshot;
  if (findRuntimeUrlLeaks(candidate).length > 0) return false;
  if (estimateSnapshotStorageSize(candidate) > MAX_STORAGE_SIZE_BYTES) return false;

  return true;
}

export function sanitizeAndValidateCanvasSnapshot(snapshot: CanvasSnapshot): CanvasSnapshot | null {
  const sanitized = sanitizeCanvasSnapshot(snapshot);
  return validateCanvasSnapshot(sanitized) ? sanitized : null;
}

export function trimSnapshotsForStorage(
  snapshots: CanvasSnapshot[],
  options: { maxSnapshots: number; maxSizeBytes: number },
): CanvasSnapshot[] {
  const sanitized = snapshots
    .map((snapshot) => sanitizeAndValidateCanvasSnapshot(snapshot))
    .filter((snapshot): snapshot is CanvasSnapshot => Boolean(snapshot))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, options.maxSnapshots);

  const kept: CanvasSnapshot[] = [];
  for (const snapshot of sanitized) {
    const candidate = [...kept, snapshot];
    const size = JSON.stringify({ version: 1, snapshots: candidate }).length;
    if (size <= options.maxSizeBytes) {
      kept.push(snapshot);
    }
  }
  return kept;
}
