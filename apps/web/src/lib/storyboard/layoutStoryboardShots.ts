import type { Edge, Node } from "@xyflow/react";
import type { CanvasNodeData, StoryboardShotData } from "@/app/canvas/components/canvas/types";

export const STORYBOARD_SHOT_LAYOUT = {
  shotWidth: 340,
  shotHeight: 360,
  rowGap: 420,
  sourceOffsetX: 480,
  gridOffsetX: 480 + 340 + 560,
} as const;

function padOrder(order: number): string {
  return String(order).padStart(2, "0");
}

function stripShotPrefix(text: string): string {
  return text
    .replace(/^\s*(?:镜头|shot)\s*(?:第)?\s*\d+\s*[：:.)、/-]?\s*/i, "")
    .replace(/^\s*标题\s*[：:]\s*/i, "")
    .trim();
}

function compactText(text: string): string {
  return stripShotPrefix(text)
    .replace(/\s+/g, " ")
    .replace(/[。！？.!?；;，,：:、]+$/g, "")
    .trim();
}

export function createShotShortTitle(shot: Pick<StoryboardShotData, "title" | "description" | "visualPrompt">, maxLength = 16): string {
  const source = compactText(shot.title || shot.description || shot.visualPrompt || "");
  if (!source) return "未命名镜头";
  return source.length > maxLength ? source.slice(0, maxLength) : source;
}

export function createNormalizedShotTitle(shot: Pick<StoryboardShotData, "order" | "title" | "description" | "visualPrompt">): string {
  const order = Number.isFinite(shot.order) ? shot.order : 1;
  return `镜头 ${padOrder(order)} / ${createShotShortTitle(shot)}`;
}

export function getStoryboardShotPosition(sourceNode: Node<CanvasNodeData>, index: number) {
  return {
    x: sourceNode.position.x + STORYBOARD_SHOT_LAYOUT.sourceOffsetX,
    y: sourceNode.position.y + index * STORYBOARD_SHOT_LAYOUT.rowGap,
  };
}

export function getStoryboardGridPosition(sourceNode: Node<CanvasNodeData>) {
  return {
    x: sourceNode.position.x + STORYBOARD_SHOT_LAYOUT.gridOffsetX,
    y: sourceNode.position.y,
  };
}

export function createStoryboardSourceEdge(sourceNodeId: string, shotNodeId: string): Edge {
  return {
    id: `edge-storyboard-shot-${sourceNodeId}-${shotNodeId}`,
    source: sourceNodeId,
    target: shotNodeId,
    type: "creative",
    animated: false,
    data: {
      relation: "storyboard-shot",
      sourceType: "storyboard",
      targetType: "shot",
    },
  };
}
