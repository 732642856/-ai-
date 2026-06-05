import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateStoryboardPdfHtml,
  storyboardPdfFilename,
  type StoryboardPdfExportInput,
} from "./storyboardPdfExport.ts";
import type { ShotProductionBrief } from "./shotProductionBrief.ts";

// ── Test fixtures ──

function makeBrief(overrides: Partial<ShotProductionBrief> & { order: number; shotId: string }): ShotProductionBrief {
  return {
    shotId: overrides.shotId,
    order: overrides.order,
    title: overrides.title ?? `镜头 ${overrides.order}`,
    visual: {
      prompt: overrides.visual?.prompt ?? "默认视觉提示词",
      shotType: overrides.visual?.shotType,
      cameraMovement: overrides.visual?.cameraMovement,
      duration: overrides.visual?.duration,
      characterIdentities: overrides.visual?.characterIdentities ?? [],
    },
    voice: {
      dialogue: overrides.voice?.dialogue,
      voiceIntent: overrides.voice?.voiceIntent,
      soundCue: overrides.voice?.soundCue,
      suggestedText: overrides.voice?.suggestedText,
      suggestedInstruct: overrides.voice?.suggestedInstruct,
    },
    subtitle: {
      text: overrides.subtitle?.text,
      intent: overrides.subtitle?.intent,
    },
    handoff: {
      notes: overrides.handoff?.notes,
      warnings: overrides.handoff?.warnings,
    },
  };
}

function makeFullInput(overrides?: Partial<StoryboardPdfExportInput>): StoryboardPdfExportInput {
  return {
    title: overrides?.title ?? "测试项目",
    subtitle: overrides?.subtitle,
    briefs: overrides?.briefs ?? [],
    imageUrls: overrides?.imageUrls,
    subtitleTexts: overrides?.subtitleTexts,
    voiceStatuses: overrides?.voiceStatuses,
  };
}

// ── Tests ──

describe("storyboardPdfExport", () => {
  describe("generateStoryboardPdfHtml", () => {
    it("returns valid HTML document", () => {
      const html = generateStoryboardPdfHtml(
        makeFullInput({
          briefs: [makeBrief({ order: 1, shotId: "s1", title: "开场" })],
        }),
      );

      assert.ok(html.startsWith("<!DOCTYPE html>"));
      assert.ok(html.includes("<html lang=\"zh-CN\">"));
      assert.ok(html.includes("</html>"));
      assert.ok(html.includes("<title>测试项目 — 分镜本</title>"));
    });

    it("generates cover page with project info", () => {
      const html = generateStoryboardPdfHtml(
        makeFullInput({
          title: "暗夜追踪",
          subtitle: "第三幕 · 追逐戏",
          briefs: [
            makeBrief({ order: 1, shotId: "s1", title: "天台对峙" }),
            makeBrief({ order: 2, shotId: "s2", title: "跳楼追逐" }),
            makeBrief({
              order: 3,
              shotId: "s3",
              title: "落地受伤",
              handoff: { warnings: ["面部需保持一致"] },
            }),
          ],
        }),
      );

      // Cover content
      assert.ok(html.includes("暗夜追踪"));
      assert.ok(html.includes("第三幕"));
      assert.ok(html.includes("3 镜"));

      // Index table
      assert.ok(html.includes("分镜索引"));
      assert.ok(html.includes("天台对峙"));
      assert.ok(html.includes("跳楼追逐"));
      assert.ok(html.includes("落地受伤"));

      // Shot detail sections
      assert.ok(html.includes("镜头 1"));
      assert.ok(html.includes("镜头 2"));
      assert.ok(html.includes("镜头 3"));
    });

    it("includes image URLs when provided", () => {
      const html = generateStoryboardPdfHtml(
        makeFullInput({
          briefs: [makeBrief({ order: 1, shotId: "s1", title: "测试" })],
          imageUrls: { s1: "https://example.com/frame.png" },
        }),
      );

      assert.ok(html.includes("https://example.com/frame.png"));
      assert.ok(html.includes('<img class="shot-image"'));
    });

    it("shows placeholder when no image", () => {
      const html = generateStoryboardPdfHtml(
        makeFullInput({ briefs: [makeBrief({ order: 1, shotId: "s1", title: "无图镜头" })] }),
      );

      assert.ok(html.includes("暂无参考图"));
      assert.ok(!html.includes('<img class="shot-image"'));
    });

    it("renders dialogue with styled box", () => {
      const html = generateStoryboardPdfHtml(
        makeFullInput({
          briefs: [
            makeBrief({
              order: 1,
              shotId: "s1",
              title: "对话场景",
              voice: { dialogue: "你是谁？\n别过来！" },
            }),
          ],
        }),
      );

      assert.ok(html.includes("你是谁？"));
      assert.ok(html.includes("别过来！"));
      assert.ok(html.includes("dialogue-box"));
    });

    it("renders character identities with cards", () => {
      const html = generateStoryboardPdfHtml(
        makeFullInput({
          briefs: [
            makeBrief({
              order: 1,
              shotId: "s1",
              title: "双人戏",
              visual: {
                prompt: "酒吧内灯光昏暗",
                characterIdentities: [
                  {
                    id: "c1",
                    name: "陈明",
                    role: "主角",
                    visualSignature: "中年、短发、沧桑",
                  },
                  {
                    id: "c2",
                    name: "林雪",
                    role: "女主",
                    costume: "红色连衣裙",
                  },
                ],
              },
            }),
          ],
        }),
      );

      assert.ok(html.includes("陈明"));
      assert.ok(html.includes("林雪"));
      assert.ok(html.includes("主角"));
      assert.ok(html.includes("红色连衣裙"));
      assert.ok(html.includes("char-card"));
    });

    it("shows warnings block when present", () => {
      const html = generateStoryboardPdfHtml(
        makeFullInput({
          briefs: [
            makeBrief({
              order: 1,
              shotId: "s1",
              title: "问题镜头",
              handoff: { warnings: ["缺少光源方向", "人脸模糊"] },
            }),
          ],
        }),
      );

      assert.ok(html.includes("审核警告"));
      assert.ok(html.includes("缺少光源方向"));
      assert.ok(html.includes("人脸模糊"));
      assert.ok(html.includes("warnings-block"));
    });

    it("shows visual tags for shotType and cameraMovement", () => {
      const html = generateStoryboardPdfHtml(
        makeFullInput({
          briefs: [
            makeBrief({
              order: 1,
              shotId: "s1",
              title: "特写推轨",
              visual: {
                prompt: "脸部特写",
                shotType: "大特写",
                cameraMovement: "推轨前进",
                duration: "3s",
              },
            }),
          ],
        }),
      );

      assert.ok(html.includes("大特写"));
      assert.ok(html.includes("推轨前进"));
      assert.ok(html.includes("3s"));
      assert.ok(html.includes("tag"));
    });

    it("renders voice status indicators", () => {
      const html = generateStoryboardPdfHtml(
        makeFullInput({
          briefs: [
            makeBrief({
              order: 1,
              shotId: "s1",
              title: "已配音",
              voice: { dialogue: "你好" },
            }),
          ],
          voiceStatuses: { s1: "ready" },
        }),
      );

      assert.ok(html.includes("已配音"));
      assert.ok(html.includes("voice-indicator"));
    });

    it("renders subtitle text when provided", () => {
      const html = generateStoryboardPdfHtml(
        makeFullInput({
          briefs: [makeBrief({ order: 1, shotId: "s1", title: "字幕镜" })],
          subtitleTexts: { s1: "00:00:01,000 --> 00:00:03,000\n字幕内容" },
        }),
      );

      assert.ok(html.includes("字幕内容"));
    });

    it("includes print-optimized CSS with page breaks", () => {
      const html = generateStoryboardPdfHtml(
        makeFullInput({
          briefs: [makeBrief({ order: 1, shotId: "s1" }), makeBrief({ order: 2, shotId: "s2" })],
        }),
      );

      assert.ok(html.includes("@page"));
      assert.ok(html.includes("page-break-after"));
      assert.ok(html.includes("print-color-adjust"));
    });

    it("handles empty briefs gracefully", () => {
      const html = generateStoryboardPdfHtml(makeFullInput());

      assert.ok(html.includes("0 镜"));
      assert.ok(html.includes("测试项目"));
      // Should still be valid HTML
      assert.ok(html.startsWith("<!DOCTYPE html>"));
    });

    it("escapes HTML special characters in content", () => {
      const html = generateStoryboardPdfHtml(
        makeFullInput({
          briefs: [
            makeBrief({
              order: 1,
              shotId: "s1",
              title: "特殊字符 <script>alert('xss')</script>",
              voice: { dialogue: "他说：\"你好\"" },
            }),
          ],
        }),
      );

      // Should NOT contain raw HTML from content
      assert.ok(!html.includes("<script>alert"));
      assert.ok(html.includes("&lt;script&gt;"));
      // Quotes should be escaped
      assert.ok(html.includes("&quot;"));
    });

    it("generates index table with correct shot count", () => {
      const briefs = Array.from({ length: 5 }, (_, i) =>
        makeBrief({ order: i + 1, shotId: `s${i + 1}`, title: `镜头 ${i + 1}` }),
      );

      const html = generateStoryboardPdfHtml(makeFullInput({ briefs }));

      // Count shot detail sections (each has class="shot-detail")
      const detailCount = (html.match(/class="shot-detail"/g) ?? []).length;
      assert.equal(detailCount, 5);
    });
  });

  describe("storyboardPdfFilename", () => {
    it("generates filename with project title and date", () => {
      const filename = storyboardPdfFilename("暗夜追踪");
      assert.ok(filename.includes("暗夜追踪"));
      assert.ok(filename.includes("分镜本"));
      assert.ok(filename.endsWith(".html"));
    });

    it("sanitizes special characters in title", () => {
      const filename = storyboardPdfFilename("项目 / 名称：测试版");
      assert.ok(!filename.includes("/"));
      assert.ok(!filename.includes("："));
      assert.ok(!filename.includes(" "));
    });

    it("truncates long titles", () => {
      const longTitle = "这是一个非常非常非常非常非常非常非常非常非常非常非常非常长的项目名称";
      const filename = storyboardPdfFilename(longTitle);
      assert.ok(filename.length < 100);
    });
  });
});
