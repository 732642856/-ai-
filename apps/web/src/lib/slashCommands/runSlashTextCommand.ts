import { callAiChat } from "../ai/client";
import {
  buildSlashCommandPrompt,
  type SlashCommandId,
} from "./slashCommands";

export async function runSlashTextCommand(input: {
  commandId: Extract<SlashCommandId, "summarize" | "expand" | "rewrite" | "generate-storyboard-text">;
  nodeText: string;
  model?: string;
}): Promise<string> {
  const nodeText = input.nodeText.trim();
  if (!nodeText) throw new Error("请先输入内容后再执行 AI 命令");

  const prompt = buildSlashCommandPrompt({
    commandId: input.commandId,
    nodeText,
  });

  const data = await callAiChat({
    model: input.model || "gpt-5.5",
    temperature: 0.6,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = data.content.trim();
  if (!content) throw new Error("Slash command returned empty content");
  return content;
}
