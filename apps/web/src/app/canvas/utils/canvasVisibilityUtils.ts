// ============================================================================
// Canvas Visibility Utilities
// ============================================================================
// Pure functions for managing node visibility, recovery, and layout fallback.
// Extracted from StarCanvas.tsx to reduce file size.
// ============================================================================

import type { Node, ReactFlowInstance } from "@xyflow/react";
import type { CanvasNodeData } from "../components/canvas/types";
import {
  CHAT_PANEL_WIDTH,
  LEFT_TOOLBAR_SAFE_WIDTH,
} from "./canvasPositionUtils.ts";

// ---------------------------------------------------------------------------
// Storyboard node identification
// ---------------------------------------------------------------------------

export function isStoryboardProcessNode(
  node: Node<CanvasNodeData>,
  sourceNodeId: string,
) {
  const data = node.data;
  return Boolean(
    (data.sourceStoryboardNodeId === sourceNodeId ||
      data.storyboardGrid?.sourceStoryboardNodeId === sourceNodeId ||
      data.shot?.sourceStoryboardNodeId === sourceNodeId) &&
      (node.type === "shot" ||
        node.type === "storyboardGrid" ||
        data.role === "storyboard-process" ||
        data.role === "shot-image" ||
        data.isStoryboardProcessNode === true),
  );
}

export function isStoryboardFinalOutputNode(
  node: Node<CanvasNodeData>,
  sourceNodeId: string,
) {
  const data = node.data;
  return Boolean(
    data.sourceStoryboardNodeId === sourceNodeId &&
      (data.role === "storyboard-final-output" ||
        data.isStoryboardFinalOutput === true),
  );
}

// ---------------------------------------------------------------------------
// Visibility helpers
// ---------------------------------------------------------------------------

export function getVisibleCanvasNodes(nodes: Node<CanvasNodeData>[]) {
  return nodes.filter((node) => node.hidden !== true);
}

export function shouldRecoverHiddenCanvasNode(_node: Node<CanvasNodeData>) {
  // All hidden nodes should be recoverable.
  // Previously excluded storyboard process nodes; that caused issues
  // when the entire canvas was hidden.
  return true;
}

// ---------------------------------------------------------------------------
// Layout fallback
// ---------------------------------------------------------------------------

export function applyFallbackCanvasLayout(nodes: Node<CanvasNodeData>[]) {
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

// ---------------------------------------------------------------------------
// Recovery
// ---------------------------------------------------------------------------

export function applyCanvasVisibilityRecovery(nodes: Node<CanvasNodeData>[]) {
  const visibleNodes = getVisibleCanvasNodes(nodes);
  if (visibleNodes.length > 0) return nodes;

  const primaryRecoverableIds = nodes
    .filter(
      (node) =>
        node.hidden === true && shouldRecoverHiddenCanvasNode(node),
    )
    .map((node) => node.id);
  const fallbackRecoverableIds = nodes
    .filter((node) => node.hidden === true)
    .map((node) => node.id);
  const recoverableIds = new Set(
    primaryRecoverableIds.length > 0
      ? primaryRecoverableIds
      : fallbackRecoverableIds,
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

export function applyCanvasVisibilityAndLayoutRecovery(
  nodes: Node<CanvasNodeData>[],
) {
  return applyFallbackCanvasLayout(applyCanvasVisibilityRecovery(nodes));
}

// ---------------------------------------------------------------------------
// View actions
// ---------------------------------------------------------------------------

export function fitViewToVisibleCanvas(
  reactFlowInstance: ReactFlowInstance | null,
  nodes: Node<CanvasNodeData>[],
  chatOpen: boolean,
  duration = 500,
) {
  if (!reactFlowInstance) return;
  const visibleNodes = getVisibleCanvasNodes(nodes);
  if (visibleNodes.length === 0) return;
  const horizontalFocusOffset =
    ((chatOpen ? CHAT_PANEL_WIDTH : 0) - LEFT_TOOLBAR_SAFE_WIDTH) / 2;
  setTimeout(() => {
    reactFlowInstance.fitView({
      nodes: visibleNodes.map((node) => ({ id: node.id })),
      padding: 0.28,
      maxZoom: 1.1,
      duration,
    });
    if (horizontalFocusOffset !== 0) {
      setTimeout(() => {
        const currentViewport = reactFlowInstance.getViewport();
        reactFlowInstance.setViewport(
          {
            ...currentViewport,
            x: currentViewport.x - horizontalFocusOffset,
          },
          { duration: 220 },
        );
      }, duration + 20);
    }
  }, 50);
}

export function focusCanvasNode(
  reactFlowInstance: ReactFlowInstance | null,
  nodes: Node<CanvasNodeData>[],
  nodeId: string,
  currentZoom: number,
): boolean {
  const target = nodes.find((node) => node.id === nodeId);
  if (!target) return false;
  if (!reactFlowInstance) return true;
  reactFlowInstance.setCenter(
    target.position.x +
      (target.measured?.width ?? target.width ?? 280) / 2,
    target.position.y +
      (target.measured?.height ?? target.height ?? 200) / 2,
    { duration: 600, zoom: Math.max(currentZoom, 1) },
  );
  return true;
}
