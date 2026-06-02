import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildFullStoryPrompt,
  buildStoryToStoryboardPrompt,
  estimateStoryboardTextNodeSize,
  getNextStoryboardAssistantStage,
  getStoryboardAssistantStage,
} from "./storyboardTextNode.ts";

describe("storyboardTextNode", () => {
  it("infers assistant stage from explicit stage or parseable storyboard text", () => {
    assert.equal(getStoryboardAssistantStage({ stage: "story" }), "story");
    assert.equal(
      getStoryboardAssistantStage({
        content: "镜头 1：雨夜\n画面描述：女孩站在巷口\n生图提示词：雨夜，电影感",
      }),
      "storyboard-text",
    );
    assert.equal(getStoryboardAssistantStage({ content: "一个雨夜故事想法" }), "idea");
  });

  it("content takes priority over stage field when content matches storyboard format", () => {
    // 关键行为：即使 stage 字段是 "story"，只要内容符合分镜格式就应返回 storyboard-text
    // 这解决了"生成文字分镜"步骤超时后 stage 字段未更新，导致"拆成 Shot"走错路径的问题
    const storyboardContent = "镜头 1：清晨巷口\n\n画面描述：薄雾老巷，豆豆叼红球\n\n生图提示词：中景，巷口纵深构图";
    assert.equal(
      getStoryboardAssistantStage({ stage: "story", content: storyboardContent }),
      "storyboard-text",
      "内容符合分镜格式时应覆盖 stage=story",
    );
    assert.equal(
      getStoryboardAssistantStage({ stage: "idea", content: storyboardContent }),
      "storyboard-text",
      "内容符合分镜格式时应覆盖 stage=idea",
    );
    // 无内容时仍然尊重 stage 字段
    assert.equal(getStoryboardAssistantStage({ stage: "story", content: "" }), "story");
    assert.equal(getStoryboardAssistantStage({ stage: "idea", content: "" }), "idea");
  });

  it("advances stages without skipping storyboard text review", () => {
    assert.equal(getNextStoryboardAssistantStage("idea"), "story");
    assert.equal(getNextStoryboardAssistantStage("story"), "storyboard-text");
    assert.equal(getNextStoryboardAssistantStage("storyboard-text"), "storyboard-text");
  });

  it("estimates fixed-width growing height for long story text", () => {
    const shortIdea = estimateStoryboardTextNodeSize({
      text: "一个迷路的小女孩在雨夜遇到会说话的狐狸",
      stage: "idea",
    });
    const longStory = estimateStoryboardTextNodeSize({
      text: "这是一个完整故事。".repeat(120),
      stage: "story",
      width: 560,
    });

    assert.equal(shortIdea.width, 420);
    assert.equal(shortIdea.height, 300);
    assert.equal(longStory.width, 560);
    assert.ok(longStory.height > shortIdea.height);
    assert.ok(longStory.height <= 1180);
  });

  it("builds prompts for idea to story and story to storyboard", () => {
    const storyPrompt = buildFullStoryPrompt("雨夜狐狸");
    assert.match(storyPrompt, /完整、可读/);
    assert.match(storyPrompt, /不要跳到分镜格式/);
    assert.match(storyPrompt, /雨夜狐狸/);

    const storyboardPrompt = buildStoryToStoryboardPrompt("完整故事正文");
    assert.match(storyboardPrompt, /已经拆分好的文字分镜/);
    assert.match(storyboardPrompt, /4-6 个关键镜头/);
    assert.match(storyboardPrompt, /镜头 1/);
    assert.match(storyboardPrompt, /画面描述/);
    assert.match(storyboardPrompt, /生图提示词/);
    assert.match(storyboardPrompt, /完整故事正文/);
  });

  it("compacts long story text before building storyboard prompt", () => {
    const longStory = ["开端".repeat(800), "中段".repeat(800), "结尾".repeat(800)].join("\n");
    const storyboardPrompt = buildStoryToStoryboardPrompt(longStory);

    assert.match(storyboardPrompt, /开端/);
    assert.match(storyboardPrompt, /结尾/);
    assert.match(storyboardPrompt, /……/);
    assert.ok(!storyboardPrompt.includes("中段".repeat(100)));
    assert.ok(storyboardPrompt.length < longStory.length);
  });
});
