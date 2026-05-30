// ============================================================================
// useCanvasPersistence — localStorage + IndexedDB canvas persistence
// Node structure (no image data) → localStorage
// Image blobs → IndexedDB (via localImageStore)
// ============================================================================
"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Node, Edge } from "@xyflow/react";
import type { CanvasNodeData } from "../components/canvas/types";
import {
  hydrateImageAsset,
  persistImageDataUrl,
} from "@/lib/assets/localImageStore";
import {
  findRuntimeUrlLeaks,
  sanitizeNodesForPersistence,
} from "@/lib/storage/sanitizePersistedCanvas";

const STORAGE_KEY = "startrails_canvas";
const MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4MB safeguard
const DEBOUNCE_MS = 400;
const EMPTY_CANVAS_SAVE_GRACE_MS = 1_500;

// Sanitization is centralized in src/lib/storage/sanitizePersistedCanvas.ts so
// nested fields like shot.generatedImageUrl and generation.referenceImage.dataUrl
// cannot leak runtime object URLs or base64 payloads into localStorage.

// ---------------------------------------------------------------------------
// Hydrate image nodes on restore
// Load image blobs from IndexedDB and create objectURLs.
// Migrate old base64 data URLs to IndexedDB.
// ---------------------------------------------------------------------------

async function hydrateImageNodes(
  nodes: Node<CanvasNodeData>[],
): Promise<Node<CanvasNodeData>[]> {
  const hydrated = await Promise.all(
    nodes.map(async (node) => {
      const data = node.data;
      if (!data) return node;

      const clean: CanvasNodeData = { ...data };

      // Remove deprecated marker
      delete clean._imageStripped;

      // --- Case 1: Modern IDB asset (has assetId + persistence = "indexeddb") ---
      if (clean.assetId && clean.persistence === "indexeddb") {
        const objectUrl = await hydrateImageAsset(clean.assetId);
        if (objectUrl) {
          clean.imageUrl = objectUrl;
          clean.persistence = "indexeddb";
          delete clean.loadError;
        } else {
          // Asset not found in IDB (manually deleted or corrupted)
          clean.imageUrl = undefined;
          clean.persistence = "missing";
          clean.loadError = "asset-not-found";
        }
        return { ...node, data: clean };
      }

      // --- Case 2: Remote URL (persistence = "remote" or imageUrl is http/https) ---
      if (
        clean.persistence === "remote" ||
        (clean.imageUrl && clean.imageUrl.startsWith("http"))
      ) {
        clean.persistence = "remote";
        return { ...node, data: clean };
      }

      // --- Case 3: Old base64 data URL (migration) ---
      // If imageUrl still contains base64, it's pre-IDB data that was somehow
      // persisted (rare, but handle gracefully)
      const imageUrl = clean.imageUrl;
      if (
        imageUrl &&
        typeof imageUrl === "string" &&
        imageUrl.startsWith("data:image")
      ) {
        try {
          const { assetId, objectUrl } = await persistImageDataUrl(imageUrl, {
            fileName: clean.fileName,
            width: clean.imageWidth,
            height: clean.imageHeight,
          });
          clean.assetId = assetId;
          clean.imageUrl = objectUrl;
          clean.persistence = "indexeddb";
          clean.source = clean.source ?? "upload";
          console.log(
            `[CanvasPersistence] Migrated base64 image to IndexedDB: ${assetId.slice(0, 8)}`,
          );
        } catch (err) {
          console.error(
            "[CanvasPersistence] Failed to migrate base64 image:",
            err,
          );
          clean.imageUrl = undefined;
          clean.persistence = "missing";
          clean.loadError = "migration-failed";
        }
        return { ...node, data: clean };
      }

      // --- Case 4: No imageUrl or empty — check if it was stripped (old flow) ---
      // Old data may have no imageUrl but had _imageStripped or is an image node type
      if (!clean.imageUrl && !clean.assetId) {
        const nodeType = node.type;
        const nodeKind = clean.nodeKind;
        const isImageNode =
          nodeType === "image" ||
          nodeKind === "uploaded-image" ||
          nodeKind === "ai-generated-image";

        if (isImageNode) {
          clean.persistence = "missing";
          clean.loadError = "asset-not-found";
        }
        return { ...node, data: clean };
      }

      return { ...node, data: clean };
    }),
  );

  return hydrated;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PersistedCanvas {
  version: 1;
  savedAt: number;
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
}

interface UseCanvasPersistenceOptions {
  /** Whether canvas restore has been attempted (prevents overwrite by initial mount) */
  isRestored: boolean;
  onRestored: () => void;
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
  setNodes: (
    nodes:
      | Node<CanvasNodeData>[]
      | ((nds: Node<CanvasNodeData>[]) => Node<CanvasNodeData>[]),
  ) => void;
  setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void;
  setFitViewOnce: (value: boolean) => void;
}

function isStoryboardProcessNode(node: Node<CanvasNodeData>) {
  const data = node.data;
  return Boolean(
    data.role === "storyboard-process" ||
      data.role === "shot-image" ||
      data.isStoryboardProcessNode === true ||
      data.hiddenByStoryboardProcessMode === true ||
      node.type === "shot" ||
      node.type === "storyboardGrid",
  );
}

function recoverHiddenCanvasNodes(nodes: Node<CanvasNodeData>[]) {
  const hasVisibleNode = nodes.some((node) => node.hidden !== true);
  if (hasVisibleNode) return nodes;

  const primaryRecoverableIds = nodes
    .filter((node) => node.hidden === true && !isStoryboardProcessNode(node))
    .map((node) => node.id);
  const fallbackRecoverableIds = nodes
    .filter((node) => node.hidden === true)
    .map((node) => node.id);
  const recoverableIds = new Set(
    primaryRecoverableIds.length > 0 ? primaryRecoverableIds : fallbackRecoverableIds,
  );

  if (recoverableIds.size === 0) return nodes;

  return nodes.map((node) =>
    recoverableIds.has(node.id)
      ? {
          ...node,
          hidden: false,
          data: {
            ...node.data,
            hiddenByStoryboardProcessMode: false,
          },
        }
      : node,
  );
}

function recoverInvalidCanvasPositions(nodes: Node<CanvasNodeData>[]) {
  return nodes.map((node, index) => {
    const hasValidPosition =
      node.position &&
      Number.isFinite(node.position.x) &&
      Number.isFinite(node.position.y);

    if (hasValidPosition) return node;

    return {
      ...node,
      position: {
        x: 120 + (index % 3) * 460,
        y: 120 + Math.floor(index / 3) * 360,
      },
    };
  });
}

function recoverCanvasVisibilityAndLayout(nodes: Node<CanvasNodeData>[]) {
  return recoverInvalidCanvasPositions(recoverHiddenCanvasNodes(nodes));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook that auto-persists nodes+edges to localStorage on change,
 * and restores them (including image hydration from IndexedDB) on mount.
 */
export function useCanvasPersistence({
  isRestored,
  onRestored,
  nodes,
  edges,
  setNodes,
  setEdges,
  setFitViewOnce,
}: UseCanvasPersistenceOptions) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredAtRef = useRef<number | null>(null);
  const hasRestoredRef = useRef(false);

  // ==========================================================================
  // RESTORE on mount (async because IndexedDB hydration)
  // ==========================================================================
  useEffect(() => {
    if (isRestored || hasRestoredRef.current || typeof window === "undefined")
      return;

    let cancelled = false;

    (async () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          if (!cancelled) onRestored();
          restoredAtRef.current = Date.now();
          hasRestoredRef.current = true;
          return;
        }

        const data: PersistedCanvas = JSON.parse(raw);

        if (
          !data ||
          data.version !== 1 ||
          !Array.isArray(data.nodes) ||
          !Array.isArray(data.edges)
        ) {
          console.warn("[CanvasPersistence] Invalid stored data, clearing");
          localStorage.removeItem(STORAGE_KEY);
          if (!cancelled) onRestored();
          restoredAtRef.current = Date.now();
          hasRestoredRef.current = true;
          return;
        }

        // Hydrate image nodes from IndexedDB
        const hydratedNodes = recoverCanvasVisibilityAndLayout(
          await hydrateImageNodes(data.nodes),
        );

        if (cancelled) return;

        if (hydratedNodes.length > 0) {
          setNodes(hydratedNodes);
          setEdges(data.edges);
          setFitViewOnce(true);
        }

        console.log(
          `[CanvasPersistence] Restored ${hydratedNodes.length} nodes, ${data.edges.length} edges (saved ${new Date(data.savedAt).toLocaleString()})`,
        );
      } catch (err) {
        console.error("[CanvasPersistence] Restore failed:", err);
        // If JSON is corrupted, clear it to prevent repeated failures
        localStorage.removeItem(STORAGE_KEY);
      }

      if (!cancelled) {
        onRestored();
        restoredAtRef.current = Date.now();
        hasRestoredRef.current = true;
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run only on mount
  }, []);

  // ==========================================================================
  // SAVE on change (debounced)
  // ==========================================================================
  useEffect(() => {
    if (!hasRestoredRef.current) return;

    if (nodes.length === 0 && edges.length === 0) {
      const restoredAt = restoredAtRef.current;
      if (!restoredAt || Date.now() - restoredAt < EMPTY_CANVAS_SAVE_GRACE_MS) {
        return;
      }
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      try {
        const sanitizedNodes = sanitizeNodesForPersistence(nodes);

        // Dev-only health check: warn if any runtime URL survived sanitization.
        if (process.env.NODE_ENV === "development") {
          for (const node of sanitizedNodes) {
            const leaks = findRuntimeUrlLeaks(
              node.data,
              `node:${node.id}.data`,
            );
            if (leaks.length > 0) {
              console.warn(
                `[CanvasPersistence] Runtime URL leak after sanitize: ${leaks.join(", ")}`,
              );
            }
          }
        }

        const payload: PersistedCanvas = {
          version: 1,
          savedAt: Date.now(),
          nodes: sanitizedNodes,
          edges,
        };

        const json = JSON.stringify(payload);

        if (json.length > MAX_SIZE_BYTES) {
          console.warn(
            `[CanvasPersistence] Canvas data too large (${(json.length / 1024 / 1024).toFixed(2)}MB), skipping save`,
          );
          return;
        }

        localStorage.setItem(STORAGE_KEY, json);
      } catch (err) {
        console.error("[CanvasPersistence] Save failed:", err);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [nodes, edges]);

  // ==========================================================================
  // CLEAR persisted canvas
  // ==========================================================================
  const clearPersistedCanvas = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { clearPersistedCanvas };
}

export default useCanvasPersistence;
