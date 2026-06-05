// ============================================================================
// Canvas Position Utilities
// ============================================================================
// Pure functions for calculating node positions during storyboard processing.
// Extracted from StarCanvas.tsx to reduce file size.
// ============================================================================

import type { Node, ReactFlowInstance, Viewport, XYPosition } from "@xyflow/react";
import type { CanvasNodeData } from "../components/canvas/types";
import { STORYBOARD_SHOT_LAYOUT } from "../../../lib/storyboard/layoutStoryboardShots.ts";

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------
export const CHAT_PANEL_WIDTH = 400;
export const LEFT_TOOLBAR_SAFE_WIDTH = 88;
export const STORYBOARD_FINAL_OUTPUT_OFFSET_X = 420;
export const STORYBOARD_FINAL_OUTPUT_VIEW_PADDING = 80;
export const STORYBOARD_PROCESS_NODE_OFFSET_X = 860;
export const STORYBOARD_PROCESS_IMAGE_OFFSET_X =
  STORYBOARD_PROCESS_NODE_OFFSET_X + STORYBOARD_SHOT_LAYOUT.shotWidth + 72;
export const STORYBOARD_PROCESS_GRID_OFFSET_X =
  STORYBOARD_PROCESS_IMAGE_OFFSET_X + 400;

// ---------------------------------------------------------------------------
// Position calculation
// ---------------------------------------------------------------------------

export function getCanvasFocusScreenPoint(chatOpen: boolean) {
  const availableWidth =
    window.innerWidth -
    (chatOpen ? CHAT_PANEL_WIDTH : 0) -
    LEFT_TOOLBAR_SAFE_WIDTH;
  return {
    x: LEFT_TOOLBAR_SAFE_WIDTH + Math.max(availableWidth, 0) / 2,
    y: window.innerHeight / 2,
  };
}

export function getCenteredFlowPosition(
  reactFlowInstance: ReactFlowInstance | null,
  nodeSize: { width: number; height: number } = { width: 0, height: 0 },
  chatOpen = false,
) {
  if (!reactFlowInstance) return { x: 400, y: 300 };
  const centerPosition = reactFlowInstance.screenToFlowPosition(
    getCanvasFocusScreenPoint(chatOpen),
  );
  return {
    x: centerPosition.x - nodeSize.width / 2,
    y: centerPosition.y - nodeSize.height / 2,
  };
}

export function getStoryboardProcessNodePosition(
  sourceNode: Node<CanvasNodeData>,
  index: number,
) {
  return {
    x: sourceNode.position.x + STORYBOARD_PROCESS_NODE_OFFSET_X,
    y: sourceNode.position.y + index * STORYBOARD_SHOT_LAYOUT.rowGap,
  };
}

export function getStoryboardProcessImagePosition(
  sourceNode: Node<CanvasNodeData>,
  index: number,
) {
  return {
    x: sourceNode.position.x + STORYBOARD_PROCESS_IMAGE_OFFSET_X,
    y: sourceNode.position.y + index * STORYBOARD_SHOT_LAYOUT.rowGap,
  };
}

export function getStoryboardProcessGridPosition(
  sourceNode: Node<CanvasNodeData>,
  shotCount: number,
) {
  return {
    x: sourceNode.position.x + STORYBOARD_PROCESS_GRID_OFFSET_X,
    y:
      sourceNode.position.y +
      Math.max(0, Math.floor((Math.max(1, shotCount) - 1) / 2)) *
        STORYBOARD_SHOT_LAYOUT.rowGap,
  };
}

export function getStoryboardFinalOutputPosition(
  sourceNode?: Node<CanvasNodeData>,
) {
  return sourceNode
    ? {
        x: sourceNode.position.x + STORYBOARD_FINAL_OUTPUT_OFFSET_X,
        y: sourceNode.position.y,
      }
    : { x: 0, y: 0 };
}

export function getViewportForNodePosition(
  position: XYPosition,
  currentViewport: Viewport,
  padding = STORYBOARD_FINAL_OUTPUT_VIEW_PADDING,
) {
  return {
    x: -(position.x - padding) * currentViewport.zoom,
    y: -(position.y - padding) * currentViewport.zoom,
    zoom: currentViewport.zoom,
  };
}
