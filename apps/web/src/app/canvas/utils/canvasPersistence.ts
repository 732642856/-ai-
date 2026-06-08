// ============================================================================
// canvasPersistence.ts — IndexedDB persistence for StarTrails Canvas
// Upgraded from localStorage to IndexedDB to bypass 4MB limit.
// ============================================================================

import type { Node, Edge, Viewport } from "@xyflow/react"
import type { CanvasNodeData } from "../components/canvas/types"
import { getItem, setItem, removeItem, clear as clearDb } from "./canvasIndexedDB"

const STORAGE_KEY = "startrails_canvas_data"
const LS_MIGRATION_KEY = "startrails_canvas_data" // old localStorage key
const STORAGE_VERSION = 1

// ============================================================================
// TYPES
// ============================================================================
export interface PersistedCanvasState {
  version: number
  updatedAt: number
  viewport: Viewport | null
  nodes: Node<CanvasNodeData>[]
  edges: Edge[]
}

// ============================================================================
// MIGRATION: Transfer data from localStorage to IndexedDB (one-time)
// ============================================================================
async function migrateFromLocalStorage(): Promise<void> {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return

  // Check if we already have data in IndexedDB
  const existing = await getItem<PersistedCanvasState>(STORAGE_KEY)
  if (existing) return // Already migrated

  const raw = localStorage.getItem(LS_MIGRATION_KEY)
  if (!raw) return

  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === "object" && parsed.version === STORAGE_VERSION) {
      await setItem(STORAGE_KEY, parsed)
      console.info("[CanvasPersistence] Migrated canvas data from localStorage to IndexedDB.")
      // Keep old localStorage data as fallback until user clears it
    }
  } catch {
    // Corrupted old data, ignore
  }
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

function isBase64ImageUrl(url: unknown): boolean {
  return typeof url === "string" && url.startsWith("data:image/")
}

function getSerializedSize(obj: unknown): number {
  try {
    return new Blob([JSON.stringify(obj)]).size
  } catch {
    return Infinity
  }
}

function stripBase64Images(node: Node<CanvasNodeData>): Node<CanvasNodeData> {
  const data = node.data as Record<string, unknown> | undefined
  if (!data) return node
  const stripped = { ...data }
  let changed = false
  for (const key of ["imageUrl", "assetUrl", "resultUrl", "src"]) {
    if (isBase64ImageUrl(stripped[key])) {
      stripped[key] = "__BASE64_STRIPPED__"
      changed = true
    }
  }
  if (!changed) return node
  return { ...node, data: stripped as CanvasNodeData }
}

function stripImageOnlyNodes(nodes: Node<CanvasNodeData>[]): Node<CanvasNodeData>[] {
  return nodes.filter((n) => n.type !== "image" || !isBase64ImageUrl((n.data as Record<string, unknown>)?.imageUrl))
}

// ============================================================================
// PUBLIC API (async — now backed by IndexedDB)
// ============================================================================

/**
 * Save canvas state to IndexedDB with degradation for base64 images.
 *
 * Level 1: Full save (all nodes, edges, viewport)
 * Level 2: Strip base64 data URLs from image nodes
 * Level 3: Skip image-heavy nodes, save only non-image nodes
 * Level 4: Warn and skip
 *
 * Even though IndexedDB has effectively no size limit, base64 stripping still
 * makes sense to keep reads fast and avoid bloating the database.
 */
export async function saveCanvasState(
  viewport: Viewport,
  nodes: Node<CanvasNodeData>[],
  edges: Edge[]
): Promise<void> {
  if (typeof window === "undefined") return

  const base: Omit<PersistedCanvasState, "nodes"> = {
    version: STORAGE_VERSION,
    updatedAt: Date.now(),
    viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom },
    edges,
  }

  const WARN_THRESHOLD = 50 * 1024 * 1024 // 50MB warning before saving bloated data

  // Level 1: Full save
  let candidateNodes = nodes
  let candidate: PersistedCanvasState = { ...base, nodes: candidateNodes }
  if (getSerializedSize(candidate) <= WARN_THRESHOLD) {
    await tryStore(candidate)
    return
  }

  // Level 2: Strip base64 images
  candidateNodes = nodes.map(stripBase64Images)
  candidate = { ...base, nodes: candidateNodes }
  if (getSerializedSize(candidate) <= WARN_THRESHOLD) {
    console.warn("[CanvasPersistence] Base64 images stripped to keep IndexedDB read fast.")
    await tryStore(candidate)
    return
  }

  // Level 3: Skip heavy image nodes
  candidateNodes = stripImageOnlyNodes(nodes)
  candidate = { ...base, nodes: candidateNodes }
  if (getSerializedSize(candidate) <= WARN_THRESHOLD) {
    console.warn("[CanvasPersistence] Large image nodes skipped to keep IndexedDB read fast.")
    await tryStore(candidate)
    return
  }

  // Level 4: Store anyway (IndexedDB can handle it)
  const finalNodes = nodes.map(stripBase64Images)
  console.warn("[CanvasPersistence] Canvas data is very large (" + Math.round(getSerializedSize({ ...base, nodes: finalNodes }) / (1024 * 1024)) + "MB). Consider using external asset storage.")
  await tryStore({ ...base, nodes: finalNodes })
}

async function tryStore(state: PersistedCanvasState): Promise<void> {
  await setItem(STORAGE_KEY, state)
}

/**
 * Load canvas state from IndexedDB.
 * Returns null if unavailable, corrupted, or version mismatch.
 * Automatically migrates from localStorage on first run.
 */
export async function loadCanvasState(): Promise<PersistedCanvasState | null> {
  if (typeof window === "undefined") return null

  // Attempt migration from localStorage (no-op if already in IndexedDB)
  await migrateFromLocalStorage()

  try {
    const data = await getItem<PersistedCanvasState>(STORAGE_KEY)
    if (!data) return null

    // Validate shape
    if (typeof data !== "object" || data === null) return null
    if (data.version !== STORAGE_VERSION) {
      console.info("[CanvasPersistence] Version mismatch, discarding old data.", {
        stored: data.version,
        current: STORAGE_VERSION,
      })
      await removeItem(STORAGE_KEY)
      return null
    }
    if (!Array.isArray(data.nodes)) return null
    if (!Array.isArray(data.edges)) return null

    // Restore base64-stripped image URLs
    const nodes = data.nodes.map((node: Node<CanvasNodeData>) => {
      const d = node.data as Record<string, unknown> | undefined
      if (!d) return node
      const cleaned = { ...d }
      for (const key of ["imageUrl", "assetUrl", "resultUrl", "src"]) {
        if (cleaned[key] === "__BASE64_STRIPPED__") {
          cleaned[key] = null
        }
      }
      return { ...node, data: cleaned as CanvasNodeData }
    })

    return {
      version: data.version,
      updatedAt: data.updatedAt || 0,
      viewport: data.viewport || null,
      nodes,
      edges: data.edges,
    }
  } catch (e) {
    console.warn("[CanvasPersistence] Failed to load from IndexedDB:", e)
    return null
  }
}

/**
 * Clear persisted canvas state from both IndexedDB and localStorage.
 */
export async function clearCanvasState(): Promise<void> {
  if (typeof window === "undefined") return
  try {
    await removeItem(STORAGE_KEY)
    // Also clean old localStorage remnants
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(LS_MIGRATION_KEY)
    }
  } catch {
    // ignore
  }
}
