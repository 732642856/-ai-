import { runSlashTextCommand } from "./runSlashTextCommand";

export async function runGenerateTextStoryboardCommand(input: {
  text: string;
  nodeId: string;
  updateNodeText: (nextText: string) => void;
  triggerSplitStoryboard?: (nodeId: string) => void;
  model?: string;
}): Promise<string> {
  const sourceText = input.text.trim();
  if (!sourceText) throw new Error("请先输入一句故事想法或剧情梗概");

  const result = await runSlashTextCommand({
    commandId: "generate-storyboard-text",
    nodeText: sourceText,
    model: input.model,
  });

  input.updateNodeText(result);
  input.triggerSplitStoryboard?.(input.nodeId);
  return result;
}
