import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSlashCommandPrompt,
  getSlashCommandsForTarget,
  parseSlashQuery,
  removeSlashCommandFromText,
} from "./slashCommands.ts";

describe("slashCommands", () => {
  describe("getSlashCommandsForTarget", () => {
    it("returns text node commands without generate-image", () => {
      const ids = getSlashCommandsForTarget("text", "").map((command) => command.id);

      assert.deepEqual(ids, [
        "summarize",
        "expand",
        "rewrite",
        "continue-storyboard-assistant",
        "split-storyboard",
      ]);
      assert.equal(ids.includes("generate-image"), false);
    });

    it("returns shot node commands without split-storyboard", () => {
      const ids = getSlashCommandsForTarget("shot", "").map((command) => command.id);

      assert.deepEqual(ids, ["summarize", "expand", "rewrite", "generate-image"]);
      assert.equal(ids.includes("split-storyboard"), false);
    });

    it("filters by english id and Chinese label or description", () => {
      assert.deepEqual(
        getSlashCommandsForTarget("text", "exp").map((command) => command.id),
        ["expand"],
      );
      assert.deepEqual(
        getSlashCommandsForTarget("shot", "图片").map((command) => command.id),
        ["generate-image"],
      );
      assert.deepEqual(
        getSlashCommandsForTarget("text", "故事分镜").map((command) => command.id),
        ["continue-storyboard-assistant"],
      );
      assert.deepEqual(
        getSlashCommandsForTarget("text", "文字分镜").map((command) => command.id),
        ["split-storyboard"],
      );
    });
  });

  describe("parseSlashQuery", () => {
    it("parses a slash query at the cursor", () => {
      assert.deepEqual(parseSlashQuery("hello /exp", 10), {
        query: "exp",
        range: { start: 6, end: 10 },
      });
    });

    it("parses empty query after slash", () => {
      assert.deepEqual(parseSlashQuery("/", 1), {
        query: "",
        range: { start: 0, end: 1 },
      });
      assert.deepEqual(parseSlashQuery("hello /", 7), {
        query: "",
        range: { start: 6, end: 7 },
      });
    });

    it("returns null when cursor is not in an active slash command", () => {
      assert.equal(parseSlashQuery("hello /exp world", 16), null);
      assert.equal(parseSlashQuery("hello/exp", 9), null);
      assert.equal(parseSlashQuery("plain text", 5), null);
    });
  });

  describe("removeSlashCommandFromText", () => {
    it("removes the slash command and keeps the surrounding text", () => {
      assert.equal(
        removeSlashCommandFromText("hello /expand world", { start: 6, end: 13 }),
        "hello world",
      );
    });

    it("removes a leading slash command without damaging body text", () => {
      assert.equal(
        removeSlashCommandFromText("/rewrite 镜头内容", { start: 0, end: 8 }),
        "镜头内容",
      );
    });
  });

  describe("buildSlashCommandPrompt", () => {
    it("builds summarize prompt with source text", () => {
      const prompt = buildSlashCommandPrompt({
        commandId: "summarize",
        nodeText: "一段很长的剧情内容",
      });

      assert.match(prompt, /总结为更短、更清晰/);
      assert.match(prompt, /一段很长的剧情内容/);
    });

    it("builds expand prompt with cinematic detail instruction", () => {
      const prompt = buildSlashCommandPrompt({
        commandId: "expand",
        nodeText: "角色进入房间",
      });

      assert.match(prompt, /增加影视画面、动作、情绪、环境细节/);
      assert.match(prompt, /角色进入房间/);
    });

    it("builds rewrite prompt for storyboard writing", () => {
      const prompt = buildSlashCommandPrompt({
        commandId: "rewrite",
        nodeText: "他看见了真相",
      });

      assert.match(prompt, /更适合影视分镜描述/);
      assert.match(prompt, /他看见了真相/);
    });

    it("keeps legacy storyboard text prompt parseable for compatibility", () => {
      const prompt = buildSlashCommandPrompt({
        commandId: "generate-storyboard-text",
        nodeText: "雨夜，一个人追查真相",
      });

      assert.match(prompt, /可直接拆分为 Shot 节点/);
      assert.match(prompt, /镜头 1/);
      assert.match(prompt, /画面描述/);
      assert.match(prompt, /生图提示词/);
      assert.match(prompt, /雨夜，一个人追查真相/);
    });
  });
});
