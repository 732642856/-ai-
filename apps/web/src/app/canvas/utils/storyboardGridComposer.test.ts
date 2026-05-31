import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Mock browser canvas + Image APIs for Node.js test runner
// ---------------------------------------------------------------------------

interface MockCanvasState {
  width: number;
  height: number;
  dataUrl: string;
  fillStyle: string;
  fills: Array<{ x: number; y: number; w: number; h: number; color: string }>;
  draws: Array<{ x: number; y: number; w: number; h: number }>;
}

const OG_Image = globalThis.Image;
const OG_document = typeof document !== "undefined" ? document : undefined;

function setupBrowserMocks(
  state: MockCanvasState,
  imageLoadBehavior: "all-success" | "all-fail" | "first-fail" = "all-success",
) {
  let loadAttemptCount = 0;

  // Mock document.createElement("canvas")
  const mockDoc: any = {
    createElement: (tag: string) => {
      if (tag !== "canvas") throw new Error(`Unexpected createElement("${tag}")`);
      return {
        get width() { return state.width; },
        set width(v: number) { state.width = v; },
        get height() { return state.height; },
        set height(v: number) { state.height = v; },
        toDataURL() { return state.dataUrl; },
        getContext() {
          return {
            get fillStyle() { return state.fillStyle; },
            set fillStyle(v: string) { state.fillStyle = v; },
            fillRect(x: number, y: number, w: number, h: number) {
              state.fills.push({ x, y, w, h, color: state.fillStyle });
            },
            save() {},
            beginPath() {},
            rect() {},
            clip() {},
            drawImage(_img: any, x: number, y: number, w: number, h: number) {
              state.draws.push({ x, y, w, h });
            },
            restore() {},
          };
        },
      };
    },
    createDocumentFragment: () => ({}),
  };

  globalThis.document = mockDoc as Document;

  // Mock Image constructor
  class MockImage {
    crossOrigin = "";
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 640;
    naturalHeight = 360;
    _src = "";
    width = 0;
    height = 0;

    get src() { return this._src; }
    set src(v: string) {
      this._src = v;
      const attemptIdx = loadAttemptCount;
      loadAttemptCount++;
      if (imageLoadBehavior === "all-fail") {
        queueMicrotask(() => this.onerror?.());
      } else if (imageLoadBehavior === "first-fail" && attemptIdx === 0) {
        queueMicrotask(() => this.onerror?.());
      } else {
        queueMicrotask(() => {
          this.width = this.naturalWidth;
          this.height = this.naturalHeight;
          this.onload?.();
        });
      }
    }
  }

  globalThis.Image = MockImage as unknown as typeof Image;

  return {
    restore: () => {
      delete (globalThis as any).document;
      if (OG_document) Object.defineProperty(globalThis, "document", { value: OG_document, configurable: true, writable: true });
      globalThis.Image = OG_Image;
    },
  };
}

import { composeStoryboardGrid } from "./storyboardGridComposer.ts";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("storyboardGridComposer", () => {
  describe("composeStoryboardGrid", () => {
    it("returns a data URL string", async () => {
      const state: MockCanvasState = {
        width: 0, height: 0, dataUrl: "data:image/png;base64,abc",
        fillStyle: "", fills: [], draws: [],
      };
      const env = setupBrowserMocks(state);
      const result = await composeStoryboardGrid({ images: ["blob:img1"] });
      assert.equal(typeof result, "string");
      assert.equal(result, "data:image/png;base64,abc");
      env.restore();
    });

    it("calculates canvas dimensions from 3 images in 3 columns (single row)", async () => {
      const state: MockCanvasState = {
        width: 0, height: 0, dataUrl: "data:png",
        fillStyle: "", fills: [], draws: [],
      };
      const env = setupBrowserMocks(state);
      await composeStoryboardGrid({ images: ["a", "b", "c"], columns: 3, gap: 12, cellWidth: 640 });

      const cellHeight = Math.round(640 / 1.778);
      assert.equal(state.width, 3 * 640 + 4 * 12);
      assert.equal(state.height, cellHeight + 2 * 12);
      env.restore();
    });

    it("calculates canvas dimensions for 4 images in 3 columns (2 rows)", async () => {
      const state: MockCanvasState = {
        width: 0, height: 0, dataUrl: "data:png",
        fillStyle: "", fills: [], draws: [],
      };
      const env = setupBrowserMocks(state);
      await composeStoryboardGrid({ images: ["a", "b", "c", "d"], columns: 3, gap: 8, cellWidth: 300 });

      const cellHeight = Math.round(300 / 1.778);
      assert.equal(state.width, 3 * 300 + 4 * 8);
      assert.equal(state.height, 2 * cellHeight + 3 * 8);
      env.restore();
    });

    it("paints background color first", async () => {
      const state: MockCanvasState = {
        width: 0, height: 0, dataUrl: "data:png",
        fillStyle: "", fills: [], draws: [],
      };
      const env = setupBrowserMocks(state);
      await composeStoryboardGrid({ images: ["a"], background: "#ff0000" });
      assert.equal(state.fills[0].color, "#ff0000");
      env.restore();
    });

    it("uses default background #080a10", async () => {
      const state: MockCanvasState = {
        width: 0, height: 0, dataUrl: "data:png",
        fillStyle: "", fills: [], draws: [],
      };
      const env = setupBrowserMocks(state);
      await composeStoryboardGrid({ images: ["a"] });
      assert.equal(state.fills[0].color, "#080a10");
      env.restore();
    });

    it("draws dark placeholder for each image slot", async () => {
      const state: MockCanvasState = {
        width: 0, height: 0, dataUrl: "data:png",
        fillStyle: "", fills: [], draws: [],
      };
      const env = setupBrowserMocks(state);
      await composeStoryboardGrid({ images: ["a", "b"], columns: 2, cellWidth: 100, gap: 4 });
      const placeholders = state.fills.filter((f) => f.color === "#111827");
      assert.equal(placeholders.length, 2);
      env.restore();
    });

    it("loads and draws images successfully", async () => {
      const state: MockCanvasState = {
        width: 0, height: 0, dataUrl: "data:png",
        fillStyle: "", fills: [], draws: [],
      };
      const env = setupBrowserMocks(state, "all-success");
      await composeStoryboardGrid({ images: ["blob:a", "blob:b"], columns: 2, cellWidth: 100, gap: 4 });
      assert.equal(state.draws.length, 2);
      env.restore();
    });

    it("throws when ALL images fail to load", async () => {
      const state: MockCanvasState = {
        width: 0, height: 0, dataUrl: "data:png",
        fillStyle: "", fills: [], draws: [],
      };
      const env = setupBrowserMocks(state, "all-fail");
      await assert.rejects(
        () => composeStoryboardGrid({ images: ["blob:a", "blob:b"], columns: 2, cellWidth: 100, gap: 4 }),
        /分镜合成失败/,
      );
      assert.equal(state.draws.length, 0);
      // Gray fill is still applied before the throw
      const grayFills = state.fills.filter((f) => f.color === "#334155");
      assert.equal(grayFills.length, 2);
      env.restore();
    });

    it("tolerates partial failures (some succeed, some fail)", async () => {
      const state: MockCanvasState = {
        width: 0, height: 0, dataUrl: "data:png",
        fillStyle: "", fills: [], draws: [],
      };
      // first-fail: first image fails, subsequent ones succeed
      const env = setupBrowserMocks(state, "first-fail");
      // Does NOT throw because not all images failed
      const result = await composeStoryboardGrid({
        images: ["blob:fail", "blob:ok1", "blob:ok2"],
        columns: 3, cellWidth: 100, gap: 4,
      });
      assert.equal(typeof result, "string");
      // 2 images loaded (first failed, second and third succeeded)
      assert.equal(state.draws.length, 2);
      // First slot should have gray placeholder
      const grayFills = state.fills.filter((f) => f.color === "#334155");
      assert.equal(grayFills.length, 1);
      env.restore();
    });

    it("skips null/undefined image entries", async () => {
      const state: MockCanvasState = {
        width: 0, height: 0, dataUrl: "data:png",
        fillStyle: "", fills: [], draws: [],
      };
      const env = setupBrowserMocks(state, "all-success");
      await composeStoryboardGrid({ images: ["blob:a", null, undefined, "blob:d"], columns: 2, cellWidth: 100, gap: 4 });
      assert.equal(state.draws.length, 2);
      env.restore();
    });

    it("throws when getContext returns null", async () => {
      const state: MockCanvasState = {
        width: 0, height: 0, dataUrl: "data:png",
        fillStyle: "", fills: [], draws: [],
      };
      // Override document to return null from getContext
      globalThis.document = { createElement: () => ({ getContext: () => null }) } as any;
      await assert.rejects(() => composeStoryboardGrid({ images: ["a"] }), /无法创建分镜合成画布/);
    });

    it("accepts custom cell dimensions", async () => {
      const state: MockCanvasState = {
        width: 0, height: 0, dataUrl: "data:png",
        fillStyle: "", fills: [], draws: [],
      };
      const env = setupBrowserMocks(state);
      await composeStoryboardGrid({ images: ["a", "b"], columns: 2, cellWidth: 200, cellHeight: 150, gap: 10 });
      assert.equal(state.width, 2 * 200 + 3 * 10);
      env.restore();
    });

    it("defaults to 3 columns and gap 12", async () => {
      const state: MockCanvasState = {
        width: 0, height: 0, dataUrl: "data:png",
        fillStyle: "", fills: [], draws: [],
      };
      const env = setupBrowserMocks(state);
      await composeStoryboardGrid({ images: ["a", "b", "c", "d"] });
      const cellHeight = Math.round(640 / 1.778);
      assert.equal(state.width, 3 * 640 + 4 * 12);
      assert.equal(state.height, 2 * cellHeight + 3 * 12);
      env.restore();
    });

    it("handles empty images array", async () => {
      const state: MockCanvasState = {
        width: 0, height: 0, dataUrl: "data:png",
        fillStyle: "", fills: [], draws: [],
      };
      const env = setupBrowserMocks(state);
      const result = await composeStoryboardGrid({ images: [] });
      assert.equal(typeof result, "string");
      assert.equal(state.draws.length, 0);
      env.restore();
    });
  });
});
