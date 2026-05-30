import {
  buildSlashCommandPrompt,
  type SlashCommandId,
} from "./slashCommands.ts";

export async function runSlashTextCommand(input: {
  commandId: Extract<SlashCommandId, "summarize" | "expand" | "rewrite" | "generate-storyboard-text">;
  nodeText: string;
  model?: string;
}): Promise<string> {
  const prompt = buildSlashCommandPrompt({
    commandId: input.commandId,
    nodeText: input.nodeText,
  });

  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: input.model || "gpt-5.5",
      temperature: 0.6,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      data?.error?.message || data?.error || `Slash command failed: ${response.status}`;
    throw new Error(message);
  }

  const content = typeof data.content === "string" ? data.content.trim() : "";
  if (!content) throw new Error("Slash command returned empty content");
  return content;
}
