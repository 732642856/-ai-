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
  // 内容优先：当内容明确符合分镜格式时，无论 stage 字段是什么都返回 storyboard-text。
  // 这样可以正确处理"生成文字分镜"步骤因超时未能更新 stage 字段的情况。
  const text = input.content?.trim() ?? "";
  if (/镜头\s*\d+[：:]/.test(text) && /画面描述|生图提示词|生图 Prompt/i.test(text)) {
    return "storyboard-text";
  }

  if (
    input.stage === "idea" ||
    input.stage === "story" ||
    input.stage === "storyboard-text"
  ) {
    return input.stage;
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
  const compactSourceText = sourceText.length > 2400
    ? `${sourceText.slice(0, 1400)}\n\n……\n\n${sourceText.slice(-800)}`
    : sourceText;
  return [
    "请根据以下完整故事，生成一份已经拆分好的文字分镜，并让它具有成熟镜头语言。",
    "要求：",
    "1. 输出 6-9 个关键镜头；兼容旧流程时至少满足 4-6 个关键镜头，覆盖故事的开端、发展、转折、高潮和结尾，不要只改写开头。",
    "2. 每个镜头必须有明确的戏剧功能，不能为了凑数；镜头变化要服务人物关系、情绪推进和信息释放。",
    "3. 镜头语言必须成熟：场景开头优先用远景/全景建立空间；情绪推进时有远景→中景→近景/特写的节奏；冲突和恐惧可使用推近、手持、遮挡；亲密场景使用近景、平视和视线匹配。",
    "4. 避免连续多个镜头使用相同景别；对话/反打要注意轴线和视线方向；必要时用空镜、插入镜头或反应镜头控制节奏。",
    "5. 严格使用以下格式，方便后续解析成 Shot 节点：",
    "镜头 1：一句简短标题",
    "景别：远景/全景/中景/近景/特写/过肩/插入镜头",
    "镜头运动：固定/推入/拉出/摇/移/跟拍/手持/升降",
    "时长：预估秒数",
    "画面描述：不超过 120 字，写清画面、人物动作、情绪、环境、调度和镜头动机。",
    "对白：如无对白可写无",
    "生图提示词：英文 prompt，不超过 120 字，包含景别、构图、光线、角色动作、氛围和风格。",
    "备注：写明这个镜头的剧情节拍、潜台词、声画关系或连续性注意事项。",
    "6. 每个镜头之间空一行。",
    "7. 不要输出解释、前言或 Markdown 代码块。",
    compactSourceText || "请基于一个完整故事生成专业文字分镜。",
  ].join("\n\n");
}
