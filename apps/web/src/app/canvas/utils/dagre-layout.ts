/**
 * dagre-layout.ts - 使用 dagre 算法自动布局节点
 */

import dagre from "dagre"
import type { Node, Edge } from "@xyflow/react"
import type { CanvasNodeData } from "../components/canvas/types"

// 默认节点尺寸
const DEFAULT_NODE_WIDTH = 280
const DEFAULT_NODE_HEIGHT = 200

/**
 * 使用 dagre 算法自动布局节点
 * @param nodes - React Flow 节点数组
 * @param edges - React Flow 边数组
 * @param direction - 布局方向: 'TB' (从上到下) | 'LR' (从左到右)
 * @returns 布局后的节点数组
 */
export function layoutNodes(
  nodes: Node<CanvasNodeData>[],
  edges: Edge[],
  direction: "TB" | "LR" = "TB"
): Node<CanvasNodeData>[] {
  if (nodes.length === 0) return nodes

  // 创建 dagre 图
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))

  // 设置图属性
  const isHorizontal = direction === "LR"
  g.setGraph({
    rankdir: direction,
    nodesep: 60,
    ranksep: 80,
    edgesep: 40,
    marginx: 40,
    marginy: 40,
  })

  // 添加节点
  nodes.forEach((node) => {
    const width = node.measured?.width || DEFAULT_NODE_WIDTH
    const height = node.measured?.height || DEFAULT_NODE_HEIGHT
    g.setNode(node.id, { width, height })
  })

  // 添加边
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target)
  })

  // 运行布局算法
  dagre.layout(g)

  // 更新节点位置
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id)
    
    if (!nodeWithPosition) return node

    // 计算居中位置
    const width = node.measured?.width || DEFAULT_NODE_WIDTH
    const height = node.measured?.height || DEFAULT_NODE_HEIGHT

    let x = nodeWithPosition.x - width / 2
    let y = nodeWithPosition.y - height / 2

    // 如果是水平布局，交换 x 和 y
    if (isHorizontal) {
      [x, y] = [y, x]
    }

    return {
      ...node,
      position: { x, y },
    }
  })

  return layoutedNodes
}

/**
 * 快速布局（简化版，适合少量节点）
 * 使用简单的层级算法
 */
export function quickLayout(
  nodes: Node<CanvasNodeData>[],
  edges: Edge[],
  cols: number = 3
): Node<CanvasNodeData>[] {
  if (nodes.length === 0) return nodes

  // 如果有边，使用 dagre 布局
  if (edges.length > 0) {
    return layoutNodes(nodes, edges, "TB")
  }

  // 否则使用简单的网格布局
  return nodes.map((node, index) => {
    const col = index % cols
    const row = Math.floor(index / cols)
    const width = node.measured?.width || DEFAULT_NODE_WIDTH
    const height = node.measured?.height || DEFAULT_NODE_HEIGHT

    return {
      ...node,
      position: {
        x: 100 + col * (width + 80),
        y: 100 + row * (height + 60),
      },
    }
  })
}
