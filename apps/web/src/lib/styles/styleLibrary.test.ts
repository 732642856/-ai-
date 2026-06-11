// ============================================================================
// Style Library 单元测试
// ============================================================================
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  STYLE_PRESETS,
  STYLE_CATEGORIES,
  getStylesByCategory,
  getStyleById,
  searchStyles,
  applyStyleToPrompt,
} from "./styleLibrary.ts"

describe("Style Library", () => {
  describe("Data integrity", () => {
    it("has 7 categories", () => {
      assert.equal(STYLE_CATEGORIES.length, 7)
    })

    it("has at least 25 styles across all categories", () => {
      assert.equal(STYLE_PRESETS.length >= 25, true)
    })

    it("every style has required fields", () => {
      for (const style of STYLE_PRESETS) {
        assert.ok(style.id, `Style ${style.name} missing id`)
        assert.ok(style.name, `Style missing name`)
        assert.ok(style.nameEn, `Style ${style.name} missing nameEn`)
        assert.ok(style.category, `Style ${style.name} missing category`)
        assert.ok(style.promptEnhancement, `Style ${style.name} missing promptEnhancement`)
        assert.ok(style.tags.length > 0, `Style ${style.name} has no tags`)
      }
    })

    it("every style id is unique", () => {
      const ids = STYLE_PRESETS.map((s) => s.id)
      assert.equal(new Set(ids).size, ids.length)
    })

    it("every category has at least one style", () => {
      for (const cat of STYLE_CATEGORIES) {
        const styles = getStylesByCategory(cat.id)
        assert.equal(styles.length > 0, true, `Category ${cat.name} has no styles`)
      }
    })
  })

  describe("getStylesByCategory", () => {
    it("returns only styles of the given category", () => {
      const cinematic = getStylesByCategory("cinematic")
      assert.equal(cinematic.length > 0, true)
      for (const s of cinematic) {
        assert.equal(s.category, "cinematic")
      }
    })

    it("returns empty array for invalid category", () => {
      // @ts-expect-error testing invalid input
      const result = getStylesByCategory("nonexistent")
      assert.deepEqual(result, [])
    })
  })

  describe("getStyleById", () => {
    it("finds an existing style", () => {
      const style = getStyleById("cinematic-wong-kar-wai")
      assert.ok(style)
      assert.equal(style.name, "王家卫港风")
    })

    it("returns undefined for nonexistent id", () => {
      assert.equal(getStyleById("nonexistent"), undefined)
    })
  })

  describe("searchStyles", () => {
    it("finds styles by Chinese name", () => {
      const results = searchStyles("港风")
      assert.equal(results.length >= 1, true)
      assert.equal(results.some((s) => s.id === "cinematic-wong-kar-wai"), true)
    })

    it("finds styles by English name", () => {
      const results = searchStyles("Ghibli")
      assert.equal(results.length >= 1, true)
    })

    it("finds styles by tag", () => {
      const results = searchStyles("赛博")
      assert.equal(results.length >= 1, true)
    })

    it("is case insensitive", () => {
      const lower = searchStyles("ghibli")
      const upper = searchStyles("GHIBLI")
      assert.equal(lower.length, upper.length)
    })

    it("returns empty for no match", () => {
      assert.deepEqual(searchStyles("xyzzy_nonexistent"), [])
    })
  })

  describe("applyStyleToPrompt", () => {
    it("appends style prompt to base prompt", () => {
      const result = applyStyleToPrompt("a rainy scene", "cinematic-wong-kar-wai")
      assert.equal(result.startsWith("a rainy scene"), true)
      assert.equal(result.length > "a rainy scene".length, true)
    })

    it("returns original prompt for invalid style id", () => {
      const result = applyStyleToPrompt("original text", "nonexistent")
      assert.equal(result, "original text")
    })
  })
})
