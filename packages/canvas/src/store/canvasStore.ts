import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { Node, Edge } from '@xyflow/react'

export interface CanvasState {
  nodes: Node[]
  edges: Edge[]
  selectedNodeIds: string[]
  agentMode: 'ask' | 'max' | 'preview'
  isStreaming: boolean
  streamingContent: string

  // Actions
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void
  addNode: (node: Node) => void
  updateNode: (id: string, data: Partial<Node>) => void
  deleteNode: (id: string) => void
  setAgentMode: (mode: 'ask' | 'max' | 'preview') => void
  setStreaming: (streaming: boolean, content?: string) => void
  addEdge: (edge: Edge) => void
  deleteEdge: (id: string) => void
  clearCanvas: () => void
}

export const useCanvasStore = create<CanvasState>()(
  devtools(
    persist(
      (set) => ({
        nodes: [],
        edges: [],
        selectedNodeIds: [],
        agentMode: 'ask',
        isStreaming: false,
        streamingContent: '',

        setNodes: (nodes) => set((state) => ({
          nodes: typeof nodes === 'function' ? nodes(state.nodes) : nodes
        })),

        setEdges: (edges) => set((state) => ({
          edges: typeof edges === 'function' ? edges(state.edges) : edges
        })),

        addNode: (node) => set((state) => ({
          nodes: [...state.nodes, node]
        })),

        updateNode: (id, data) => set((state) => ({
          nodes: state.nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, ...(data.data || data) } } : n
          )
        })),

        deleteNode: (id) => set((state) => ({
          nodes: state.nodes.filter((n) => n.id !== id),
          edges: state.edges.filter((e) => e.source !== id && e.target !== id)
        })),

        setAgentMode: (mode) => set({ agentMode: mode }),

        setStreaming: (streaming, content = '') => set({
          isStreaming: streaming,
          streamingContent: content
        }),

        addEdge: (edge) => set((state) => ({
          edges: [...state.edges, edge]
        })),

        deleteEdge: (id) => set((state) => ({
          edges: state.edges.filter((e) => e.id !== id)
        })),

        clearCanvas: () => set({ nodes: [], edges: [], selectedNodeIds: [] }),
      }),
      {
        name: 'starcanvas-store',
        partialize: (state) => ({
          nodes: state.nodes,
          edges: state.edges,
          agentMode: state.agentMode,
        }),
      }
    )
  )
)
