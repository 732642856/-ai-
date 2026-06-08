// ============================================================================
// useCanvasPersistence — localStorage-based canvas persistence
// Saves/restores nodes and edges on change, debounced to reduce writes.
// ============================================================================
"use client"

import { useCallback, useEffect, useRef } from "react"
import type { Node, Edge } from "@xyflow/react"
import type { CanvasNodeData } from "../components/canvas/types"

const STORAGE_KEY = "startrails_canvas"
const MAX_SIZE_BYTES = 4 * 1024 * 1024 // 4MB safeguard
const DEBOUNCE_MS = 400

interface PersistedCanvas {
  version: 1
  savedAt: number
  nodes: Node<CanvasNodeData>[]
  edges: Edge[]
}

interface UseCanvasPersistenceOptions {
  /** Whether canvas restore has been attempted (prevents overwrite by initial mount) */
  isRestored: boolean
  onRestored: () => void
  nodes: Node<CanvasNodeData>[]
  edges: Edge[]
  setNodes: (nodes: Node<CanvasNodeData>[] | ((nds: Node<CanvasNodeData>[]) => Node<CanvasNodeData>[])) => void
  setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void
  setFitViewOnce: (value: boolean) => void
}

/**
 * Hook that auto-persists nodes+edges to localStorage on change,
 * and restores them when the component mounts for the first time.
 *
 * Usage in StarCanvas:
 *   useCanvasPersistence({
 *     isRestored, onRestored, nodes, edges, setNodes, setEdges, setFitViewOnce
 *   })
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Track if this is the first render to avoid saving before restore
  const hasRestoredRef = useRef(false)

  // ==========================================================================
  // RESTORE on mount
  // ==========================================================================
  useEffect(() => {
    if (isRestored || hasRestoredRef.current || typeof window === "undefined") return

    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        onRestored()
        hasRestoredRef.current = true
        return
      }

      const data: PersistedCanvas = JSON.parse(raw)

      if (!data || data.version !== 1 || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
        console.warn("[CanvasPersistence] Invalid stored data, clearing")
        localStorage.removeItem(STORAGE_KEY)
        onRestored()
        hasRestoredRef.current = true
        return
      }

      // Restore nodes and edges
      if (data.nodes.length > 0) {
        setNodes(data.nodes)
        setEdges(data.edges)
        // Skip fitView once since we're restoring existing layout
        setFitViewOnce(false)
      }

      console.log(
        `[CanvasPersistence] Restored ${data.nodes.length} nodes, ${data.edges.length} edges (saved ${new Date(data.savedAt).toLocaleString()})`
      )
    } catch (err) {
      console.error("[CanvasPersistence] Restore failed:", err)
      localStorage.removeItem(STORAGE_KEY)
    }

    onRestored()
    hasRestoredRef.current = true
  }, []) // eslint-disable-line react-hooks/exhaustive-deps — intentional: run only on mount

  // ==========================================================================
  // SAVE on change (debounced)
  // ==========================================================================
  useEffect(() => {
    // Don't save until after restore is complete and there's data to save
    if (!hasRestoredRef.current) return
    // Don't save empty canvas (let user clear intentionally via clearPersistedCanvas)
    if (nodes.length === 0 && edges.length === 0) return

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      try {
        const payload: PersistedCanvas = {
          version: 1,
          savedAt: Date.now(),
          nodes,
          edges,
        }

        const json = JSON.stringify(payload)

        // Size check
        if (json.length > MAX_SIZE_BYTES) {
          console.warn(
            `[CanvasPersistence] Canvas data too large (${(json.length / 1024 / 1024).toFixed(2)}MB), skipping save`
          )
          return
        }

        localStorage.setItem(STORAGE_KEY, json)
      } catch (err) {
        console.error("[CanvasPersistence] Save failed:", err)
      }
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [nodes, edges])

  // ==========================================================================
  // CLEAR persisted canvas
  // ==========================================================================
  const clearPersistedCanvas = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }, [])

  return { clearPersistedCanvas }
}

export default useCanvasPersistence
