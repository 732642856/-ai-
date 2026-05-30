import {
  buildFullStoryPrompt,
  buildStoryToStoryboardPrompt,
  estimateStoryboardTextNodeSize,
  getNextStoryboardAssistantStage,
  type StoryboardAssistantStage,
} from "../storyboard/storyboardTextNode.ts";

async function runStoryboardAssistantPrompt(input: {
  prompt: string;
  model?: string;
}): Promise<string> {
  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: input.model || "gpt-5.5",
      temperature: 0.65,
      messages: [
        {
          role: "user",
          content: input.prompt,
        },
      ],
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      data?.error?.message || data?.error || `Storyboard assistant failed: ${response.status}`;
    throw new Error(message);
  }

  const content = typeof data.content === "string" ? data.content.trim() : "";
  if (!content) throw new Error("Storyboard assistant returned empty content");
  return content;
}

export async function runStoryboardAssistantCommand(input: {
  text: string;
  stage: StoryboardAssistantStage;
  nodeId: string;
  nodeWidth?: number;
  updateNode: (next: {
    text: string;
    stage: StoryboardAssistantStage;
    width: number;
    height: number;
  }) => void;
  triggerSplitStoryboard?: (nodeId: string) => void;
  model?: string;
}): Promise<{
  text: string;
  stage: StoryboardAssistantStage;
  width: number;
  height: number;
}> {
  const sourceText = input.text.trim();
  if (!sourceText) throw new Error("请先输入一句故事想法或故事正文");

  if (input.stage === "storyboard-text") {
    input.triggerSplitStoryboard?.(input.nodeId);
    const size = estimateStoryboardTextNodeSize({
      text: sourceText,
      stage: input.stage,
      width: input.nodeWidth,
    });
    return {
      text: sourceText,
      stage: input.stage,
      ...size,
    };
  }

  const nextStage = getNextStoryboardAssistantStage(input.stage);
  const prompt = input.stage === "idea"
    ? buildFullStoryPrompt(sourceText)
    : buildStoryToStoryboardPrompt(sourceText);
  const result = await runStoryboardAssistantPrompt({ prompt, model: input.model });
  const size = estimateStoryboardTextNodeSize({
    text: result,
    stage: nextStage,
    width: input.nodeWidth,
  });

  input.updateNode({
    text: result,
    stage: nextStage,
    width: size.width,
    height: size.height,
  });

  return {
    text: result,
    stage: nextStage,
    ...size,
  };
}
