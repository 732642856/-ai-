export type StoryboardAssistantStage = "idea" | "story" | "storyboard-text";

export const STORYBOARD_ASSISTANT_LABELS: Record<
  StoryboardAssistantStage,
  {
    badge: string;
    button: string;
    loading: string;
    placeholder: string;
    title: string;
  }
> = {
  idea: {
    badge: "故事想法",
    button: "生成完整故事",
    loading: "故事生成中...",
    placeholder: "写一句故事想法，例如：一个迷路的小女孩在雨夜遇到会说话的狐狸...",
    title: "故事分镜助手",
  },
  story: {
    badge: "完整故事",
    button: "生成文字分镜",
    loading: "分镜生成中...",
    placeholder: "这里会展示完整故事。你可以先修改故事，再生成文字分镜...",
    title: "完整故事",
  },
  "storyboard-text": {
    badge: "文字分镜",
    button: "拆成 Shot",
    loading: "正在拆分...",
    placeholder: "这里会展示已拆分好的文字分镜。确认后点击拆成 Shot...",
    title: "文字分镜",
  },
};

export function getStoryboardAssistantStage(input: {
  stage?: string;
  content?: string;
}): StoryboardAssistantStage {
  if (
    input.stage === "idea" ||
    input.stage === "story" ||
    input.stage === "storyboard-text"
  ) {
    return input.stage;
  }

  const text = input.content?.trim() ?? "";
  if (/镜头\s*\d+[：:]/.test(text) && /画面描述|生图提示词|生图 Prompt/i.test(text)) {
    return "storyboard-text";
  }

  return "idea";
}

export function getNextStoryboardAssistantStage(
  stage: StoryboardAssistantStage,
): StoryboardAssistantStage {
  if (stage === "idea") return "story";
  if (stage === "story") return "storyboard-text";
  return "storyboard-text";
}

export function estimateStoryboardTextNodeSize(input: {
  text: string;
  stage?: StoryboardAssistantStage;
  width?: number;
}): { width: number; height: number } {
  const text = input.text.trim();
  const stage = input.stage ?? getStoryboardAssistantStage({ content: text });
  const width = Math.max(420, input.width ?? (stage === "idea" ? 420 : 560));
  const charsPerLine = Math.max(24, Math.floor((width - 64) / 14));
  const explicitLines = text ? text.split(/\n/).length : 1;
  const wrappedLines = text
    ? text.split(/\n/).reduce((total, line) => {
        const visualLength = Math.max(1, Math.ceil(line.length / charsPerLine));
        return total + visualLength;
      }, 0)
    : 1;
  const estimatedLines = Math.max(explicitLines, wrappedLines);
  const chromeHeight = stage === "idea" ? 190 : 210;
  const lineHeight = 22;
  const minHeight = stage === "idea" ? 300 : 420;
  const maxHeight = stage === "idea" ? 560 : 1180;
  const height = Math.min(maxHeight, Math.max(minHeight, estimatedLines * lineHeight + chromeHeight));

  return { width, height };
}

export function buildFullStoryPrompt(seedText: string): string {
  const sourceText = seedText.trim();
  return [
    "请根据以下故事想法，创作一个完整、可读、适合继续拆分为影视分镜的短篇故事。",
    "要求：",
    "1. 有清晰的开端、发展、转折和结尾。",
    "2. 保留用户原始想法的核心，不要跳到分镜格式。",
    "3. 重点写人物目标、冲突、情绪变化、关键场景和画面感。",
    "4. 篇幅控制在 800-1500 字左右。",
    "5. 只输出故事正文，可以包含标题；不要输出解释、前言或 Markdown 代码块。",
    sourceText || "请基于一个短片开场创作完整故事。",
  ].join("\n\n");
}

export function buildStoryToStoryboardPrompt(storyText: string): string {
  const sourceText = storyText.trim();
  return [
    "请根据以下完整故事，生成一份已经拆分好的文字分镜。",
    "要求：",
    "1. 输出 6-12 个镜头，覆盖故事主要情节，不要只改写开头。",
    "2. 严格使用以下格式，方便后续解析成 Shot 节点：",
    "镜头 1：一句简短标题",
    "画面描述：写清画面、人物动作、情绪、环境和镜头调度。",
    "生图提示词：写成适合文生图的中文提示词，包含景别、构图、光线、风格。",
    "3. 每个镜头之间空一行。",
    "4. 不要输出解释、前言或 Markdown 代码块。",
    sourceText || "请基于一个完整故事生成文字分镜。",
  ].join("\n\n");
}
