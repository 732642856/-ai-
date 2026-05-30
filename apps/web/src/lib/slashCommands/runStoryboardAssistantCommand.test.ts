import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runStoryboardAssistantCommand } from "./runStoryboardAssistantCommand.ts";

const originalFetch = globalThis.fetch;

describe("runStoryboardAssistantCommand", () => {
  it("generates a full story from idea without splitting shots", async () => {
    let fetchPayload: any = null;
    let updated: any = null;
    let splitNodeId = "";
    const generatedStory = "《雨夜狐狸》\n\n小女孩在雨夜迷路，遇到一只会说话的狐狸。";

    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      fetchPayload = JSON.parse(String(init?.body || "{}"));
      return new Response(JSON.stringify({ content: generatedStory }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const result = await runStoryboardAssistantCommand({
        text: "一个迷路的小女孩在雨夜遇到会说话的狐狸",
        stage: "idea",
        nodeId: "node-1",
        updateNode: (next) => {
          updated = next;
        },
        triggerSplitStoryboard: (nodeId) => {
          splitNodeId = nodeId;
        },
      });

      assert.equal(result.text, generatedStory);
      assert.equal(result.stage, "story");
      assert.equal(updated.stage, "story");
      assert.equal(splitNodeId, "");
      assert.match(fetchPayload.messages[0].content, /创作一个完整/);
      assert.match(fetchPayload.messages[0].content, /不要跳到分镜格式/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("generates storyboard text from full story without auto splitting", async () => {
    let updated: any = null;
    let splitNodeId = "";
    const generatedStoryboard = [
      "镜头 1：雨夜迷路",
      "画面描述：小女孩站在巷口。",
      "生图提示词：雨夜街巷，小女孩，电影感。",
    ].join("\n");

    globalThis.fetch = (async () => new Response(JSON.stringify({ content: generatedStoryboard }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

    try {
      const result = await runStoryboardAssistantCommand({
        text: "完整故事正文",
        stage: "story",
        nodeId: "node-1",
        updateNode: (next) => {
          updated = next;
        },
        triggerSplitStoryboard: (nodeId) => {
          splitNodeId = nodeId;
        },
      });

      assert.equal(result.text, generatedStoryboard);
      assert.equal(result.stage, "storyboard-text");
      assert.equal(updated.stage, "storyboard-text");
      assert.equal(splitNodeId, "");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("splits only at storyboard-text stage", async () => {
    let updated = false;
    let splitNodeId = "";

    const result = await runStoryboardAssistantCommand({
      text: "镜头 1：雨夜\n画面描述：女孩站在雨中\n生图提示词：雨夜，电影感",
      stage: "storyboard-text",
      nodeId: "node-1",
      updateNode: () => {
        updated = true;
      },
      triggerSplitStoryboard: (nodeId) => {
        splitNodeId = nodeId;
      },
    });

    assert.equal(result.stage, "storyboard-text");
    assert.equal(splitNodeId, "node-1");
    assert.equal(updated, false);
  });
});
