import type { Edge, Node } from "@xyflow/react";
import type { CanvasNodeData } from "@/app/canvas/components/canvas/types";

export type ShotImageGenerationResult = {
  imageUrl?: string;
  assetId?: string;
  model?: string;
  generationId?: string;
  generationSnapshot?: Record<string, unknown>;
  enhancedPrompt?: string;
};

export type CreateShotImageNodeInput = {
  shotNode: Node<CanvasNodeData>;
  existingNodes: Node<CanvasNodeData>[];
  existingEdges?: Edge[];
  generationResult: ShotImageGenerationResult;
  prompt: string;
  generatedAt: string;
  imageNodeId: string;
};

export type CreateShotImageNodeOutput = {
  imageNode: Node<CanvasNodeData>;
  edge: Edge;
  mode: "create" | "update";
};

function isRuntimeImageUrl(url: unknown): url is string {
  return (
    typeof url === "string" &&
    (url.startsWith("blob:") || url.startsWith("data:image"))
  );
}

function getShotImageTitle(shot: NonNullable<CanvasNodeData["shot"]>): string {
  if (typeof shot.order === "number" && Number.isFinite(shot.order)) {
    return `镜头 ${String(shot.order).padStart(2, "0")} 图片`;
  }
  return "分镜图片";
}

function getImageNodePosition(shotNode: Node<CanvasNodeData>) {
  const shotWidth =
    typeof shotNode.width === "number"
      ? shotNode.width
      : typeof shotNode.data.displayWidth === "number"
        ? shotNode.data.displayWidth
        : 300;

  return {
    x: shotNode.position.x + shotWidth + 80,
    y: shotNode.position.y,
  };
}

function findExistingShotImageNode(
  shotNode: Node<CanvasNodeData>,
  existingNodes: Node<CanvasNodeData>[],
  existingEdges: Edge[] = [],
): Node<CanvasNodeData> | undefined {
  const shot = shotNode.data.shot;
  if (!shot) return undefined;

  if (shot.generatedImageNodeId) {
    const byShotField = existingNodes.find(
      (node) => node.id === shot.generatedImageNodeId,
    );
    if (byShotField) return byShotField;
  }

  const bySourceShotId = existingNodes.find(
    (node) => node.data?.sourceShotId === shotNode.id,
  );
  if (bySourceShotId) return bySourceShotId;

  const lineageEdge = existingEdges.find(
    (edge) =>
      edge.source === shotNode.id &&
      (edge.data as Record<string, unknown> | undefined)?.relation ===
        "generated-image",
  );
  if (!lineageEdge) return undefined;

  return existingNodes.find((node) => node.id === lineageEdge.target);
}

export function createShotImageNode({
  shotNode,
  existingNodes,
  existingEdges = [],
  generationResult,
  prompt,
  generatedAt,
  imageNodeId,
}: CreateShotImageNodeInput): CreateShotImageNodeOutput {
  const shot = shotNode.data.shot;
  if (!shot) {
    throw new Error("Shot node data is required");
  }

  const existingImageNode = findExistingShotImageNode(
    shotNode,
    existingNodes,
    existingEdges,
  );
  const resolvedImageNodeId = existingImageNode?.id ?? imageNodeId;
  const safeImageUrl = isRuntimeImageUrl(generationResult.imageUrl)
    ? generationResult.imageUrl
    : generationResult.imageUrl;

  const imageNode: Node<CanvasNodeData> = {
    ...(existingImageNode ?? {
      id: resolvedImageNodeId,
      type: "image",
      position: getImageNodePosition(shotNode),
    }),
    id: resolvedImageNodeId,
    type: "image",
    position: existingImageNode?.position ?? getImageNodePosition(shotNode),
    data: {
      ...(existingImageNode?.data ?? {}),
      title: getShotImageTitle(shot),
      imageUrl: safeImageUrl,
      assetId: generationResult.assetId,
      nodeKind: "ai-generated-image",
      prompt,
      sourcePromptId: shotNode.id,
      sourceType: "shot",
      sourceShotId: shotNode.id,
      sourceStoryboardNodeId:
        shot.sourceStoryboardNodeId ?? shotNode.data.sourceStoryboardNodeId,
      sourceShotOrder: shot.order,
      sourceShotTitle: shot.title,
      sourcePrompt: prompt,
      generatedAt,
      generationId: generationResult.generationId,
      generation: generationResult.generationSnapshot,
      generationOutput: {
        ...(existingImageNode?.data?.generationOutput ?? {}),
        prompt,
        finalPrompt: generationResult.enhancedPrompt,
        model: generationResult.model,
        sourceShotId: shotNode.id,
        sourceStoryboardNodeId:
          shot.sourceStoryboardNodeId ?? shotNode.data.sourceStoryboardNodeId,
        generatedAt,
      },
      model: generationResult.model,
      source: "generated",
      persistence: generationResult.assetId ? "indexeddb" : undefined,
      displayWidth: existingImageNode?.data?.displayWidth ?? 320,
      displayHeight: existingImageNode?.data?.displayHeight ?? 180,
      createdAt: existingImageNode?.data?.createdAt ?? Date.now(),
    },
  };

  const edge: Edge = {
    id: `edge-generated-image-${shotNode.id}-${resolvedImageNodeId}`,
    source: shotNode.id,
    target: resolvedImageNodeId,
    type: "creative",
    animated: true,
    data: {
      relation: "generated-image",
      sourceType: "shot",
      targetType: "image",
      prompt,
      generatedAt,
    },
  };

  return {
    imageNode,
    edge,
    mode: existingImageNode ? "update" : "create",
  };
}
