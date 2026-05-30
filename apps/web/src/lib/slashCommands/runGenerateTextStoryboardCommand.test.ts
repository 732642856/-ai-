import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runGenerateTextStoryboardCommand } from "./runGenerateTextStoryboardCommand.ts";

const originalFetch = globalThis.fetch;

describe("runGenerateTextStoryboardCommand legacy compatibility", () => {
  it("throws before calling AI when source text is empty", async () => {
    let updatedText = "unchanged";
    let splitNodeId = "";

    await assert.rejects(
      runGenerateTextStoryboardCommand({
        text: "   ",
        nodeId: "node-1",
        updateNodeText: (text) => {
          updatedText = text;
        },
        triggerSplitStoryboard: (nodeId) => {
          splitNodeId = nodeId;
        },
      }),
      /请先输入一句故事想法/,
    );

    assert.equal(updatedText, "unchanged");
    assert.equal(splitNodeId, "");
  });

  it("updates node text and triggers split-storyboard after AI succeeds", async () => {
    let fetchPayload: any = null;
    let updatedText = "";
    let splitNodeId = "";
    const generatedStoryboard = [
      "镜头 1：雨夜迷路",
      "画面描述：小女孩站在巷口，雨水打湿外套。",
      "生图提示词：雨夜街巷，小女孩，电影感低角度构图。",
    ].join("\n");

    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      fetchPayload = JSON.parse(String(init?.body || "{}"));
      return new Response(JSON.stringify({ content: generatedStoryboard }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const result = await runGenerateTextStoryboardCommand({
        text: "一个迷路的小女孩在雨夜遇到会说话的狐狸",
        nodeId: "storyboard-node-1",
        updateNodeText: (text) => {
          updatedText = text;
        },
        triggerSplitStoryboard: (nodeId) => {
          splitNodeId = nodeId;
        },
      });

      assert.equal(result, generatedStoryboard);
      assert.equal(updatedText, generatedStoryboard);
      assert.equal(splitNodeId, "storyboard-node-1");
      assert.equal(fetchPayload.model, "gpt-5.5");
      assert.match(fetchPayload.messages[0].content, /可直接拆分为 Shot 节点/);
      assert.match(fetchPayload.messages[0].content, /一个迷路的小女孩/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
