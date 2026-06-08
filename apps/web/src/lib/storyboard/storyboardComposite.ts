import type { Edge, Node } from "@xyflow/react";
import type {
  CanvasNodeData,
  StoryboardShotData,
} from "@/app/canvas/components/canvas/types";

export type StoryboardCompositeLayoutOption = "auto" | "2x2" | "1x4" | "4x1";

export const STORYBOARD_FRAME_ASPECT_RATIO = 16 / 9;
export const STORYBOARD_FRAME_ASPECT_RATIO_LABEL = "16:9";

export type StoryboardCompositeStrategy =
  | "auto-compose-or-generate"
  | "always-generate-composite";

export type StoryboardCompositeSettings = {
  layout: StoryboardCompositeLayoutOption;
  showShotNumber: boolean;
  showShotTitle: boolean;
  stylePrompt: string;
  strategy: StoryboardCompositeStrategy;
};

export const DEFAULT_STORYBOARD_COMPOSITE_SETTINGS: StoryboardCompositeSettings = {
  layout: "auto",
  showShotNumber: true,
  showShotTitle: false,
  stylePrompt: "",
  strategy: "auto-compose-or-generate",
};

export type StoryboardCompositeLayout = {
  columns: number;
  rows: number;
  label: string;
  requestedLayout: StoryboardCompositeLayoutOption;
  fallbackFrom?: StoryboardCompositeLayoutOption;
};

export function shouldComposeStoryboardLocally(
  imageUrls: Array<string | null | undefined>,
): boolean {
  return (
    imageUrls.length > 0 &&
    imageUrls.every((url) => typeof url === "string" && url.trim().length > 0)
  );
}

export function shouldUseLocalStoryboardCompose(input: {
  imageUrls: Array<string | null | undefined>;
  settings?: StoryboardCompositeSettings;
}): boolean {
  const settings = input.settings ?? DEFAULT_STORYBOARD_COMPOSITE_SETTINGS;
  if (settings.strategy === "always-generate-composite") return false;
  return shouldComposeStoryboardLocally(input.imageUrls);
}

function getAutoStoryboardCompositeLayout(shotCount: number): Omit<
  StoryboardCompositeLayout,
  "requestedLayout" | "fallbackFrom"
> {
  const safeCount = Math.max(0, shotCount);
  if (safeCount === 0) return { columns: 0, rows: 0, label: "0x0" };
  if (safeCount === 1) return { columns: 1, rows: 1, label: "1x1" };
  if (safeCount === 2) return { columns: 2, rows: 1, label: "2x1" };
  if (safeCount === 3) return { columns: 3, rows: 1, label: "3x1" };
  if (safeCount === 4) return { columns: 2, rows: 2, label: "2x2" };
  if (safeCount <= 6) return { columns: 3, rows: 2, label: "3x2" };
  if (safeCount <= 9) return { columns: 3, rows: 3, label: "3x3" };

  const columns = 3;
  const rows = Math.ceil(safeCount / columns);
  return { columns, rows, label: `${columns}x${rows}` };
}

function getExplicitStoryboardCompositeLayout(
  layout: Exclude<StoryboardCompositeLayoutOption, "auto">,
): Omit<StoryboardCompositeLayout, "requestedLayout" | "fallbackFrom"> {
  switch (layout) {
    case "2x2":
      return { columns: 2, rows: 2, label: "2x2" };
    case "1x4":
      return { columns: 4, rows: 1, label: "1x4" };
    case "4x1":
      return { columns: 1, rows: 4, label: "4x1" };
  }
}

export function getStoryboardCompositeLayout(
  shotCount: number,
  settings: Pick<StoryboardCompositeSettings, "layout"> =
    DEFAULT_STORYBOARD_COMPOSITE_SETTINGS,
): StoryboardCompositeLayout {
  const requestedLayout = settings.layout;
  if (requestedLayout === "auto") {
    return {
      ...getAutoStoryboardCompositeLayout(shotCount),
      requestedLayout,
    };
  }

  const explicit = getExplicitStoryboardCompositeLayout(requestedLayout);
  const capacity = explicit.columns * explicit.rows;
  if (capacity < shotCount) {
    return {
      ...getAutoStoryboardCompositeLayout(shotCount),
      requestedLayout: "auto",
      fallbackFrom: requestedLayout,
    };
  }

  return {
    ...explicit,
    requestedLayout,
  };
}

function getShotLine(input: {
  node: { id: string; data: Pick<CanvasNodeData, "prompt" | "shot"> };
  index: number;
  settings: StoryboardCompositeSettings;
}): string {
  const { node, index, settings } = input;
  const shot = node.data.shot;
  const order = shot?.order ?? index + 1;
  const title = shot?.title?.trim();
  const visualPrompt = shot?.visualPrompt || shot?.description || node.data.prompt;
  if (!visualPrompt?.trim()) return "";

  const labelParts: string[] = [];
  if (settings.showShotNumber) labelParts.push(`镜头 ${order}`);
  if (settings.showShotTitle && title) labelParts.push(title);

  const label = labelParts.length > 0 ? labelParts.join(" / ") : `第 ${index + 1} 格`;
  return `${label}: ${visualPrompt.trim()}`;
}

export function buildStoryboardCompositePrompt(
  shots: Array<{
    id: string;
    data: Pick<CanvasNodeData, "prompt" | "shot">;
  }>,
  settings: StoryboardCompositeSettings = DEFAULT_STORYBOARD_COMPOSITE_SETTINGS,
): { prompt: string; sourcePrompt: string; layout: StoryboardCompositeLayout } {
  const layout = getStoryboardCompositeLayout(shots.length, settings);
  const sourcePrompt = shots
    .map((node, index) => getShotLine({ node, index, settings }))
    .filter(Boolean)
    .join("\n\n");

  const layoutDescription = layout.fallbackFrom
    ? `布局：请求 ${layout.fallbackFrom}，但镜头数量超过格子容量，已自动调整为 ${layout.label}，必须容纳全部 ${shots.length} 个镜头。`
    : `布局：${settings.layout === "auto" ? "自动" : settings.layout}，实际 ${layout.label}。`;

  const prompt = [
    `生成一张 ${layout.label} 的电影分镜图，共 ${shots.length} 格。`,
    "只输出一张完整图片，不要拆成多张单图。",
    `行业格式：影视分镜板。每一格都必须是横屏 ${STORYBOARD_FRAME_ASPECT_RATIO_LABEL} 画幅，按电影/剧集镜头构图，不要出现竖屏、正方形或社交媒体比例的单格。`,
    "每格内部保持横向画面安全框，主体、人物和景别都按横屏镜头设计。",
    layoutDescription,
    settings.showShotNumber ? "显示镜头编号：是。" : "显示镜头编号：否。",
    settings.showShotTitle ? "显示简短标题：是。" : "显示简短标题：否。",
    settings.stylePrompt.trim()
      ? `统一风格要求：\n${settings.stylePrompt.trim()}`
      : "",
    "每一格按镜头顺序排列，保持统一画风、统一角色设定、统一光影和色彩。",
    "每格需要有清晰横屏构图，不要出现大段文字。",
    sourcePrompt ? `镜头内容：\n${sourcePrompt}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { prompt, sourcePrompt, layout };
}

export function createStoryboardCompositeEdges(input: {
  sourceShotIds: string[];
  compositeNodeId: string;
  existingEdges: Edge[];
  removePreviousCompositeEdgesForSources?: boolean;
  edgeStyle?: Edge["style"];
}): Edge[] {
  const {
    sourceShotIds,
    compositeNodeId,
    existingEdges,
    removePreviousCompositeEdgesForSources = false,
    edgeStyle,
  } = input;

  const uniqueSourceShotIds = [...new Set(sourceShotIds)];
  const baseEdges = removePreviousCompositeEdgesForSources
    ? existingEdges.filter(
        (edge) =>
          !(
            uniqueSourceShotIds.includes(edge.source) &&
            (edge.data as Record<string, unknown> | undefined)?.relation ===
              "storyboard-composite"
          ),
      )
    : existingEdges;

  const existingPairs = new Set(
    baseEdges
      .filter(
        (edge) =>
          edge.target === compositeNodeId &&
          (edge.data as Record<string, unknown> | undefined)?.relation ===
            "storyboard-composite",
      )
      .map((edge) => `${edge.source}->${edge.target}`),
  );

  const newEdges: Edge[] = [];
  for (const shotId of uniqueSourceShotIds) {
    const pairKey = `${shotId}->${compositeNodeId}`;
    if (existingPairs.has(pairKey)) continue;
    existingPairs.add(pairKey);
    newEdges.push({
      id: `edge-compose-${shotId}-${compositeNodeId}`,
      source: shotId,
      target: compositeNodeId,
      type: "creative",
      animated: true,
      data: {
        relation: "storyboard-composite",
        sourceType: "shot",
        targetType: "image",
      },
      style: edgeStyle,
    });
  }

  return [...baseEdges, ...newEdges];
}

export function getShotImageUrlFromCanvas(input: {
  shotId: string;
  nodes: Node<CanvasNodeData>[];
}): string | undefined {
  const { shotId, nodes } = input;
  const shotNode = nodes.find((node) => node.id === shotId);
  const directUrl = shotNode?.data.shot?.generatedImageUrl;
  if (directUrl) return directUrl;

  const generatedImageNodeId = shotNode?.data.shot?.generatedImageNodeId;
  const linkedImageNode = nodes.find(
    (node) =>
      node.type === "image" &&
      (node.data.sourceShotId === shotId ||
        node.data.generationOutput?.sourceShotId === shotId ||
        node.id === generatedImageNodeId),
  );

  return linkedImageNode?.data.imageUrl || linkedImageNode?.data.generationOutput?.imageUrl;
}

export function getShotVisualPrompt(
  shot: Pick<StoryboardShotData, "visualPrompt" | "description"> | undefined,
  fallbackPrompt?: string,
): string {
  return shot?.visualPrompt || shot?.description || fallbackPrompt || "";
}

export interface StoryboardGridImageUrlValidation {
  valid: boolean;
  validCount: number;
  totalCount: number;
  missingIndices: number[];
  message: string;
}

export function validateStoryboardGridImageUrls(
  imageUrls: Array<string | null | undefined>,
  shotTitles: string[],
): StoryboardGridImageUrlValidation {
  const validCount = imageUrls.filter((url) => Boolean(url?.trim())).length;
  const totalCount = imageUrls.length;
  const missingIndices = imageUrls
    .map((url, i) => (!url?.trim() ? i : -1))
    .filter((i) => i >= 0);

  if (validCount === 0) {
    return {
      valid: false,
      validCount: 0,
      totalCount,
      missingIndices,
      message: "还没有可合成的镜头图片。一键生成分镜图会先生成镜头图片；如果仍停在这里，请在左侧原文节点重新点击\u201C一键生成分镜图\u201D，或在镜头节点点击\u201C生成图片\u201D。",
    };
  }
  if (validCount < totalCount) {
    const titles = missingIndices
      .map((i) => shotTitles[i] || `镜头${i + 1}`)
      .join("、");
    return {
      valid: false,
      validCount,
      totalCount,
      missingIndices,
      message:
        missingIndices.length === 1
          ? `镜头\u300C${titles}\u300D缺少可用的镜头图片，请先生成该镜头图片后再合成。`
          : `以下 ${missingIndices.length} 个镜头缺少可用的镜头图片：${titles}。请先生成后再合成。`,
    };
  }
  return { valid: true, validCount, totalCount, missingIndices: [], message: "" };
}
