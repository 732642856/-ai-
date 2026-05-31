import type { Edge, Node } from "@xyflow/react";
import type { CanvasNodeData, CanvasNodeKind } from "../components/canvas/types";
import { createIdleRunMeta } from "./nodeRunMeta.ts";

type VideoWorkflowTemplateItem = {
  kind: CanvasNodeKind;
  x: number;
  y: number;
  type?: "content" | "workflow";
  overrides?: Partial<CanvasNodeData>;
};

export type BuildVideoWorkflowTemplateInput = {
  basePosition: { x: number; y: number };
  generateId: () => string;
  edgeStyle?: Edge["style"];
};

export type BuildVideoWorkflowTemplateResult = {
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
};

function getVideoWorkflowDefaults(nodeKind: CanvasNodeKind): CanvasNodeData {
  const idleMeta = createIdleRunMeta();
  const defaults: Partial<Record<CanvasNodeKind, CanvasNodeData>> = {
    script: {
      title: "灵感碎片",
      workflowRole: "灵感提炼",
      status: "draft",
      runMeta: idleMeta,
      summary: "粘贴新闻、文章、链接、资料摘录或随手想法，让 AI 提炼成可继续创作的故事种子。",
      model: "GPT-5.5",
      inputs: [{ label: "新闻 / 文章 / 想法 / 链接" }],
      outputs: [{ label: "故事种子", type: "text" }],
    },
    storyboard: {
      title: "分镜草稿",
      workflowRole: "Storyboard",
      status: "ready",
      runMeta: idleMeta,
      summary: "按创意拆出镜头草稿，先确定画面重点、景别、构图和调度意图。",
      inputs: [{ label: "前期文本" }],
      outputs: [{ label: "镜头草稿", type: "storyboard" }],
    },
    "image-generation": {
      title: "关键画面设计",
      workflowRole: "Text to Image",
      status: "ready",
      runMeta: idleMeta,
      summary: "根据分镜提示词生成角色、场景、首帧或风格板图片。",
      model: "Banana Pro",
      inputs: [{ label: "分镜提示词" }],
      outputs: [{ label: "关键画面", type: "image" }],
    },
    "image-result": {
      title: "关键画面结果",
      nodeKind: "image-result",
      runMeta: idleMeta,
      workflowRole: "Image Output",
      summary: "这里承接生成后的角色、场景、首帧或风格板图片。",
    },
    "video-generation": {
      title: "动效预演",
      workflowRole: "Image to Video",
      status: "draft",
      runMeta: idleMeta,
      summary: "只做前期预演：用关键帧验证动作、机位和氛围，不负责最终节奏精剪。",
      model: "Seedance 2.0",
      duration: "5s",
      inputs: [{ label: "关键画面" }, { label: "运动提示" }],
      outputs: [{ label: "预演片段", type: "video" }],
    },
    audio: {
      title: "声音意图",
      workflowRole: "Audio Brief",
      status: "draft",
      runMeta: idleMeta,
      summary: "记录旁白、环境声、音乐情绪和声音参考，供后期继续制作。",
      inputs: [{ label: "脚本/情绪" }],
      outputs: [{ label: "声音说明", type: "audio" }],
    },
    subtitle: {
      title: "对白/旁白草稿",
      workflowRole: "Dialogue Draft",
      status: "draft",
      runMeta: idleMeta,
      summary: "沉淀对白、旁白和字幕意图，后期再做时间轴校准。",
      inputs: [{ label: "前期文本" }],
      outputs: [{ label: "文案草稿", type: "subtitle" }],
    },
    composition: {
      title: "前期项目包",
      workflowRole: "Handoff JSON",
      status: "draft",
      runMeta: idleMeta,
      summary: "汇总创意、分镜、关键画面、参考素材和声音意图，整理为 startrails-project.json。",
      inputs: [{ label: "镜头草稿" }, { label: "关键画面" }, { label: "声音说明" }],
      outputs: [{ label: "startrails-project.json", type: "file" }],
    },
    "video-result": {
      title: "交给后期",
      workflowRole: "Post Handoff",
      status: "draft",
      runMeta: idleMeta,
      summary: "把前期项目包交给星轨画布（后期），继续做节奏、字幕、声音和成片精修。",
      inputs: [{ label: "前期项目包" }],
      outputs: [{ label: "后期任务", type: "video" }],
    },
  };

  return {
    title: "工作流节点",
    status: "draft",
    ...defaults[nodeKind],
    nodeKind,
    createdAt: Date.now(),
  };
}

const VIDEO_WORKFLOW_TEMPLATE: VideoWorkflowTemplateItem[] = [
  {
    kind: "text",
    type: "content",
    x: 0,
    y: 160,
    overrides: {
      title: "前期目标",
      content: "输入主题、类型、人物、情绪、画面风格和交付目标。",
      prompt: "输入主题、类型、人物、情绪、画面风格和交付目标。",
      nodeKind: "text",
      runMeta: createIdleRunMeta(),
    },
  },
  { kind: "script", x: 320, y: 40 },
  { kind: "storyboard", x: 640, y: 40 },
  { kind: "image-generation", x: 960, y: 40 },
  { kind: "image-result", x: 1280, y: 40 },
  { kind: "video-generation", x: 1600, y: 40 },
  { kind: "audio", x: 960, y: 280 },
  { kind: "subtitle", x: 1280, y: 280 },
  { kind: "composition", x: 1600, y: 280 },
  { kind: "video-result", x: 1920, y: 160 },
];

const VIDEO_WORKFLOW_EDGE_PAIRS: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 8],
  [1, 6],
  [1, 7],
  [6, 8],
  [7, 8],
  [8, 9],
];

export function buildVideoWorkflowTemplate(
  input: BuildVideoWorkflowTemplateInput,
): BuildVideoWorkflowTemplateResult {
  const nodes = VIDEO_WORKFLOW_TEMPLATE.map((item) => {
    const type = item.type ?? "workflow";
    return {
      id: input.generateId(),
      type,
      position: {
        x: input.basePosition.x + item.x,
        y: input.basePosition.y + item.y,
      },
      data: {
        ...(type === "workflow" ? getVideoWorkflowDefaults(item.kind) : {}),
        ...item.overrides,
      },
    } satisfies Node<CanvasNodeData>;
  });

  const edges = VIDEO_WORKFLOW_EDGE_PAIRS.map(([sourceIndex, targetIndex]) => ({
    id: input.generateId(),
    source: nodes[sourceIndex].id,
    target: nodes[targetIndex].id,
    type: "creative",
    animated: false,
    style: input.edgeStyle,
  })) satisfies Edge[];

  return { nodes, edges };
}
