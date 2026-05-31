import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Edge, Node } from "@xyflow/react";
import type { CanvasNodeData } from "@/app/canvas/components/canvas/types";
import {
  DEFAULT_STORYBOARD_COMPOSITE_SETTINGS,
  buildStoryboardCompositePrompt,
  createStoryboardCompositeEdges,
  getShotImageUrlFromCanvas,
  getStoryboardCompositeLayout,
  shouldComposeStoryboardLocally,
  shouldUseLocalStoryboardCompose,
  validateStoryboardGridImageUrls,
  type StoryboardCompositeSettings,
} from "./storyboardComposite.ts";

function makeShotNode(input: {
  id: string;
  order?: number;
  title?: string;
  visualPrompt?: string;
  description?: string;
  generatedImageUrl?: string;
  generatedImageNodeId?: string;
}): Node<CanvasNodeData> {
  return {
    id: input.id,
    type: "shot",
    position: { x: 0, y: 0 },
    data: {
      prompt: `fallback prompt ${input.id}`,
      shot: {
        id: `${input.id}-data`,
        order: input.order ?? 1,
        title: input.title ?? `Shot ${input.order ?? 1}`,
        description: input.description ?? "shot description",
        visualPrompt: input.visualPrompt ?? "shot visual prompt",
        generatedImageUrl: input.generatedImageUrl,
        generatedImageNodeId: input.generatedImageNodeId,
      },
    },
  };
}

function makeSettings(
  overrides: Partial<StoryboardCompositeSettings>,
): StoryboardCompositeSettings {
  return {
    ...DEFAULT_STORYBOARD_COMPOSITE_SETTINGS,
    ...overrides,
  };
}

describe("storyboardComposite", () => {
  describe("DEFAULT_STORYBOARD_COMPOSITE_SETTINGS", () => {
    it("uses the safe MVP defaults", () => {
      assert.deepEqual(DEFAULT_STORYBOARD_COMPOSITE_SETTINGS, {
        layout: "auto",
        showShotNumber: true,
        showShotTitle: false,
        stylePrompt: "",
        strategy: "auto-compose-or-generate",
      });
    });
  });

  describe("shouldComposeStoryboardLocally", () => {
    it("returns false for empty input", () => {
      assert.equal(shouldComposeStoryboardLocally([]), false);
    });

    it("returns false when all image urls are missing", () => {
      assert.equal(shouldComposeStoryboardLocally([undefined, null]), false);
    });

    it("returns false when only part of the shots have images", () => {
      assert.equal(
        shouldComposeStoryboardLocally(["blob:http://localhost/a", undefined]),
        false,
      );
    });

    it("returns false when a selected shot has only a blank image url", () => {
      assert.equal(
        shouldComposeStoryboardLocally(["blob:http://localhost/a", "   "]),
        false,
      );
    });

    it("returns true only when every selected shot has an image", () => {
      assert.equal(
        shouldComposeStoryboardLocally([
          "blob:http://localhost/a",
          "https://cdn.example.com/b.png",
        ]),
        true,
      );
    });
  });

  describe("shouldUseLocalStoryboardCompose", () => {
    it("uses local compose in auto strategy only when every selected shot has an image", () => {
      assert.equal(
        shouldUseLocalStoryboardCompose({
          imageUrls: ["blob:http://localhost/a", "blob:http://localhost/b"],
          settings: makeSettings({ strategy: "auto-compose-or-generate" }),
        }),
        true,
      );
      assert.equal(
        shouldUseLocalStoryboardCompose({
          imageUrls: ["blob:http://localhost/a", undefined],
          settings: makeSettings({ strategy: "auto-compose-or-generate" }),
        }),
        false,
      );
    });

    it("never uses local compose when strategy is always-generate-composite", () => {
      assert.equal(
        shouldUseLocalStoryboardCompose({
          imageUrls: ["blob:http://localhost/a", "blob:http://localhost/b"],
          settings: makeSettings({ strategy: "always-generate-composite" }),
        }),
        false,
      );
    });
  });

  describe("getStoryboardCompositeLayout", () => {
    it("uses 2x2 for four selected shots in auto mode", () => {
      assert.deepEqual(getStoryboardCompositeLayout(4), {
        columns: 2,
        rows: 2,
        label: "2x2",
        requestedLayout: "auto",
      });
    });

    it("uses one row for up to three selected shots in auto mode", () => {
      assert.deepEqual(getStoryboardCompositeLayout(3), {
        columns: 3,
        rows: 1,
        label: "3x1",
        requestedLayout: "auto",
      });
    });

    it("uses three columns for five or six selected shots in auto mode", () => {
      assert.deepEqual(getStoryboardCompositeLayout(5), {
        columns: 3,
        rows: 2,
        label: "3x2",
        requestedLayout: "auto",
      });
    });

    it("respects explicit 2x2, 1x4, and 4x1 layouts when they fit", () => {
      assert.deepEqual(getStoryboardCompositeLayout(4, { layout: "2x2" }), {
        columns: 2,
        rows: 2,
        label: "2x2",
        requestedLayout: "2x2",
      });
      assert.deepEqual(getStoryboardCompositeLayout(4, { layout: "1x4" }), {
        columns: 4,
        rows: 1,
        label: "1x4",
        requestedLayout: "1x4",
      });
      assert.deepEqual(getStoryboardCompositeLayout(4, { layout: "4x1" }), {
        columns: 1,
        rows: 4,
        label: "4x1",
        requestedLayout: "4x1",
      });
    });

    it("falls back to auto when the requested layout cannot contain all shots", () => {
      assert.deepEqual(getStoryboardCompositeLayout(5, { layout: "2x2" }), {
        columns: 3,
        rows: 2,
        label: "3x2",
        requestedLayout: "auto",
        fallbackFrom: "2x2",
      });
    });
  });

  describe("buildStoryboardCompositePrompt", () => {
    it("builds a single-image composite prompt with shot order", () => {
      const shotNodes = [
        makeShotNode({ id: "shot-1", order: 1, visualPrompt: "wide shot" }),
        makeShotNode({ id: "shot-2", order: 2, visualPrompt: "close up" }),
        makeShotNode({ id: "shot-3", order: 3, visualPrompt: "over shoulder" }),
        makeShotNode({ id: "shot-4", order: 4, visualPrompt: "final reveal" }),
      ];

      const result = buildStoryboardCompositePrompt(shotNodes);

      assert.match(result.prompt, /生成一张 2x2 的电影分镜图/);
      assert.match(result.prompt, /只输出一张完整图片，不要拆成多张单图/);
      assert.match(result.prompt, /每一格都必须是横屏 16:9 画幅/);
      assert.match(result.prompt, /不要出现竖屏、正方形或社交媒体比例的单格/);
      assert.match(result.prompt, /显示镜头编号：是/);
      assert.match(result.prompt, /显示简短标题：否/);
      assert.match(result.sourcePrompt, /镜头 1: wide shot/);
      assert.match(result.sourcePrompt, /镜头 4: final reveal/);
    });

    it("includes explicit layout, title display, and style prompt settings", () => {
      const shotNodes = [
        makeShotNode({
          id: "shot-1",
          order: 1,
          title: "雨夜街口",
          visualPrompt: "wide shot",
        }),
        makeShotNode({
          id: "shot-2",
          order: 2,
          title: "回头",
          visualPrompt: "close up",
        }),
        makeShotNode({
          id: "shot-3",
          order: 3,
          title: "追逐",
          visualPrompt: "tracking shot",
        }),
        makeShotNode({
          id: "shot-4",
          order: 4,
          title: "揭示",
          visualPrompt: "final reveal",
        }),
      ];

      const result = buildStoryboardCompositePrompt(
        shotNodes,
        makeSettings({
          layout: "1x4",
          showShotTitle: true,
          stylePrompt:
            "cinematic noir storyboard, same protagonist, consistent lighting",
        }),
      );

      assert.match(result.prompt, /布局：1x4，实际 1x4/);
      assert.match(result.prompt, /显示简短标题：是/);
      assert.match(result.prompt, /统一风格要求/);
      assert.match(result.prompt, /cinematic noir storyboard/);
      assert.match(result.sourcePrompt, /镜头 1 \/ 雨夜街口: wide shot/);
    });

    it("documents layout fallback in the prompt", () => {
      const shotNodes = Array.from({ length: 5 }, (_, index) =>
        makeShotNode({
          id: `shot-${index + 1}`,
          order: index + 1,
          visualPrompt: `shot ${index + 1}`,
        }),
      );

      const result = buildStoryboardCompositePrompt(
        shotNodes,
        makeSettings({ layout: "2x2" }),
      );

      assert.equal(result.layout.fallbackFrom, "2x2");
      assert.match(result.prompt, /请求 2x2/);
      assert.match(result.prompt, /必须容纳全部 5 个镜头/);
    });
  });

  describe("createStoryboardCompositeEdges", () => {
    it("creates one storyboard-composite edge for each selected shot", () => {
      const result = createStoryboardCompositeEdges({
        sourceShotIds: ["shot-1", "shot-2", "shot-3", "shot-4"],
        compositeNodeId: "composite-1",
        existingEdges: [],
      });

      assert.equal(result.length, 4);
      assert.deepEqual(
        result.map((edge) => edge.source),
        ["shot-1", "shot-2", "shot-3", "shot-4"],
      );
      assert.ok(
        result.every(
          (edge) =>
            edge.target === "composite-1" &&
            edge.data?.relation === "storyboard-composite",
        ),
      );
    });

    it("deduplicates duplicate shot ids for the same composite node", () => {
      const result = createStoryboardCompositeEdges({
        sourceShotIds: ["shot-1", "shot-1", "shot-2"],
        compositeNodeId: "composite-1",
        existingEdges: [],
      });

      assert.equal(result.length, 2);
      assert.deepEqual(
        result.map((edge) => `${edge.source}->${edge.target}`),
        ["shot-1->composite-1", "shot-2->composite-1"],
      );
    });

    it("does not create duplicate storyboard-composite edges for an existing pair", () => {
      const existingEdges: Edge[] = [
        {
          id: "edge-compose-shot-1-composite-1",
          source: "shot-1",
          target: "composite-1",
          data: { relation: "storyboard-composite" },
        },
      ];

      const result = createStoryboardCompositeEdges({
        sourceShotIds: ["shot-1", "shot-2"],
        compositeNodeId: "composite-1",
        existingEdges,
      });

      assert.equal(result.length, 2);
      assert.equal(
        result.filter(
          (edge) => edge.source === "shot-1" && edge.target === "composite-1",
        ).length,
        1,
      );
    });

    it("can remove previous composite lineage edges for the same source shots", () => {
      const existingEdges: Edge[] = [
        {
          id: "old-composite-edge",
          source: "shot-1",
          target: "old-composite",
          data: { relation: "storyboard-composite" },
        },
        {
          id: "generated-image-edge",
          source: "shot-1",
          target: "single-image",
          data: { relation: "generated-image" },
        },
      ];

      const result = createStoryboardCompositeEdges({
        sourceShotIds: ["shot-1"],
        compositeNodeId: "new-composite",
        existingEdges,
        removePreviousCompositeEdgesForSources: true,
      });

      assert.equal(result.some((edge) => edge.id === "old-composite-edge"), false);
      assert.equal(result.some((edge) => edge.id === "generated-image-edge"), true);
      assert.equal(
        result.some(
          (edge) =>
            edge.source === "shot-1" &&
            edge.target === "new-composite" &&
            edge.data?.relation === "storyboard-composite",
        ),
        true,
      );
    });
  });

  describe("getShotImageUrlFromCanvas", () => {
    it("uses the direct shot generated image url first", () => {
      const shot = makeShotNode({
        id: "shot-1",
        generatedImageUrl: "blob:http://localhost/direct",
        generatedImageNodeId: "image-1",
      });
      const linkedImage: Node<CanvasNodeData> = {
        id: "image-1",
        type: "image",
        position: { x: 0, y: 0 },
        data: { imageUrl: "blob:http://localhost/linked" },
      };

      assert.equal(
        getShotImageUrlFromCanvas({ shotId: "shot-1", nodes: [shot, linkedImage] }),
        "blob:http://localhost/direct",
      );
    });

    it("falls back to linked image node by sourceShotId", () => {
      const shot = makeShotNode({ id: "shot-1" });
      const linkedImage: Node<CanvasNodeData> = {
        id: "image-1",
        type: "image",
        position: { x: 0, y: 0 },
        data: {
          sourceShotId: "shot-1",
          imageUrl: "blob:http://localhost/linked",
        },
      };

      assert.equal(
        getShotImageUrlFromCanvas({ shotId: "shot-1", nodes: [shot, linkedImage] }),
        "blob:http://localhost/linked",
      );
    });

    it("falls back to generation output lineage when shot fields are stale", () => {
      const shot = makeShotNode({ id: "shot-1" });
      const linkedImage: Node<CanvasNodeData> = {
        id: "image-1",
        type: "image",
        position: { x: 0, y: 0 },
        data: {
          generationOutput: {
            sourceShotId: "shot-1",
            imageUrl: "blob:http://localhost/from-generation-output",
          },
        },
      };

      assert.equal(
        getShotImageUrlFromCanvas({ shotId: "shot-1", nodes: [shot, linkedImage] }),
        "blob:http://localhost/from-generation-output",
      );
    });
  });

  describe("validateStoryboardGridImageUrls", () => {
    it("returns invalid when all URLs are null/undefined", () => {
      const result = validateStoryboardGridImageUrls([null, undefined], ["Shot 1", "Shot 2"]);
      assert.equal(result.valid, false);
      assert.equal(result.validCount, 0);
      assert.equal(result.totalCount, 2);
      assert.equal(result.missingIndices.length, 2);
      assert.match(result.message, /还没有可合成的镜头图片/);
    });

    it("returns invalid when all URLs are empty strings", () => {
      const result = validateStoryboardGridImageUrls(["", "  "], ["Shot 1", "Shot 2"]);
      assert.equal(result.valid, false);
      assert.equal(result.validCount, 0);
    });

    it("returns invalid when some URLs are missing (partial failure)", () => {
      const result = validateStoryboardGridImageUrls(
        ["blob:http://localhost/a", null, "blob:http://localhost/c"],
        ["星空镜头", "室内镜头", "室外镜头"],
      );
      assert.equal(result.valid, false);
      assert.equal(result.validCount, 2);
      assert.equal(result.totalCount, 3);
      assert.deepEqual(result.missingIndices, [1]);
      assert.match(result.message, /镜头「室内镜头」/);
      assert.match(result.message, /请先生成该镜头图片/);
    });

    it("returns invalid with multiple missing URLs and names them all", () => {
      const result = validateStoryboardGridImageUrls(
        ["blob:http://localhost/a", null, undefined, "blob:http://localhost/d"],
        ["星空镜头", "室内镜头", "室外镜头", "动作镜头"],
      );
      assert.equal(result.valid, false);
      assert.equal(result.validCount, 2);
      assert.equal(result.totalCount, 4);
      assert.deepEqual(result.missingIndices, [1, 2]);
      assert.match(result.message, /2 个镜头/);
      assert.match(result.message, /室内镜头、室外镜头/);
    });

    it("falls back to generic names when shotTitles are empty", () => {
      const result = validateStoryboardGridImageUrls([null, "blob:img"], ["", ""]);
      assert.equal(result.valid, false);
      assert.equal(result.validCount, 1);
      assert.equal(result.missingIndices.length, 1);
      assert.match(result.message, /镜头1/);
    });

    it("returns valid when all URLs are present", () => {
      const result = validateStoryboardGridImageUrls(
        ["blob:http://localhost/a", "blob:http://localhost/b", "blob:http://localhost/c"],
        ["Shot 1", "Shot 2", "Shot 3"],
      );
      assert.equal(result.valid, true);
      assert.equal(result.validCount, 3);
      assert.equal(result.totalCount, 3);
      assert.equal(result.missingIndices.length, 0);
      assert.equal(result.message, "");
    });

    it("treats whitespace-only URLs as missing", () => {
      const result = validateStoryboardGridImageUrls(
        ["blob:img", "   "],
        ["Shot 1", "Shot 2"],
      );
      assert.equal(result.valid, false);
      assert.equal(result.validCount, 1);
      assert.deepEqual(result.missingIndices, [1]);
    });
  });
});
