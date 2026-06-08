export type SlashCommandId =
  | "summarize"
  | "expand"
  | "rewrite"
  | "continue-storyboard-assistant"
  | "generate-storyboard-text"
  | "split-storyboard"
  | "generate-image";

export type SlashCommandTargetType = "text" | "shot";

export type SlashCommand = {
  id: SlashCommandId;
  label: string;
  description: string;
  targets: SlashCommandTargetType[];
};

export type SlashQueryRange = {
  start: number;
  end: number;
};

export type SlashQuery = {
  query: string;
  range: SlashQueryRange;
};

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: "summarize",
    label: "总结",
    description: "将当前内容总结为更短版本",
    targets: ["text", "shot"],
  },
  {
    id: "expand",
    label: "扩写",
    description: "扩写当前内容，增加画面细节",
    targets: ["text", "shot"],
  },
  {
    id: "rewrite",
    label: "改写",
    description: "改写为更清晰的影视分镜描述",
    targets: ["text", "shot"],
  },
  {
    id: "continue-storyboard-assistant",
    label: "继续故事分镜",
    description: "按当前阶段继续：想法成故事，故事成分镜，分镜拆 Shot",
    targets: ["text"],
  },
  {
    id: "split-storyboard",
    label: "拆成分镜",
    description: "将已有文字分镜拆分为多个镜头",
    targets: ["text"],
  },
  {
    id: "generate-image",
    label: "生成图片",
    description: "为当前镜头生成一张图片",
    targets: ["shot"],
  },
];

export function getSlashCommandsForTarget(
  target: SlashCommandTargetType,
  query: string,
): SlashCommand[] {
  const normalizedQuery = query.trim().toLowerCase();

  return SLASH_COMMANDS.filter((command) => {
    if (!command.targets.includes(target)) return false;
    if (!normalizedQuery) return true;

    return (
      command.id.includes(normalizedQuery) ||
      command.label.toLowerCase().includes(normalizedQuery) ||
      command.description.toLowerCase().includes(normalizedQuery)
    );
  });
}

export function parseSlashQuery(
  text: string,
  cursorPosition: number,
): SlashQuery | null {
  const safeCursor = Math.max(0, Math.min(cursorPosition, text.length));
  const beforeCursor = text.slice(0, safeCursor);
  const slashIndex = beforeCursor.lastIndexOf("/");
  if (slashIndex < 0) return null;

  const beforeSlash = slashIndex > 0 ? beforeCursor[slashIndex - 1] : "";
  if (beforeSlash && !/\s/.test(beforeSlash)) return null;

  const query = beforeCursor.slice(slashIndex + 1);
  if (/\s/.test(query)) return null;

  return {
    query,
    range: {
      start: slashIndex,
      end: safeCursor,
    },
  };
}

export function removeSlashCommandFromText(
  text: string,
  range: SlashQueryRange,
): string {
  const start = Math.max(0, Math.min(range.start, text.length));
  const end = Math.max(start, Math.min(range.end, text.length));
  const before = text.slice(0, start);
  const after = text.slice(end);

  if (!before && after.startsWith(" ")) return after.slice(1);
  if (before.endsWith(" ") && after.startsWith(" ")) return `${before}${after.slice(1)}`;
  return `${before}${after}`;
}

export function buildSlashCommandPrompt(input: {
  commandId: Extract<SlashCommandId, "summarize" | "expand" | "rewrite" | "generate-storyboard-text">;
  nodeText: string;
}): string {
  const sourceText = input.nodeText.trim();
  switch (input.commandId) {
    case "summarize":
      return [
        "请将以下内容总结为更短、更清晰的版本。",
        "保留关键信息，不要加入新情节。",
        "只输出改写后的正文，不要解释。",
        sourceText,
      ].join("\n\n");
    case "expand":
      return [
        "请扩写以下内容，增加影视画面、动作、情绪、环境细节。",
        "保持原意，不要改变人物关系和事件走向。",
        "只输出扩写后的正文，不要解释。",
        sourceText,
      ].join("\n\n");
    case "rewrite":
      return [
        "请改写以下内容，使其更清晰、更适合影视分镜描述。",
        "突出画面、动作、镜头感和可执行性。",
        "只输出改写后的正文，不要解释。",
        sourceText,
      ].join("\n\n");
    case "generate-storyboard-text":
      return [
        "请根据以下创意或剧情，生成一份可直接拆分为 Shot 节点的文字分镜。",
        "输出 4-8 个镜头，严格使用以下格式：",
        "镜头 1：一句简短标题",
        "画面描述：写清画面、人物动作、情绪和环境。",
        "生图提示词：写成适合文生图的中文提示词，包含景别、构图、光线、风格。",
        "不要输出解释、前言或 Markdown 代码块。",
        sourceText || "请基于一个短片开场生成文字分镜。",
      ].join("\n\n");
  }
}
