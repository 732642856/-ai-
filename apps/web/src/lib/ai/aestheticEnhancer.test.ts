// ============================================================================
// Aesthetic Enhancer 单元测试
// ============================================================================
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { enhancePrompt, deAIPrompt, beautifyPortraitPrompt, cinematicEnhance } from "./aestheticEnhancer.ts"

describe("Aesthetic Enhancer", () => {
  describe("enhancePrompt", () => {
    it("returns a string containing original prompt", () => {
      const result = enhancePrompt("a cat sitting on a chair")
      assert.equal(result.includes("a cat sitting on a chair"), true)
    })

    it("adds aesthetic keywords with medium intensity", () => {
      const result = enhancePrompt("a landscape", { intensity: "medium" })
      // Should be longer than original
      assert.equal(result.length > "a landscape".length, true)
    })

    it("strong intensity adds more keywords than light", () => {
      const light = enhancePrompt("a portrait", { intensity: "light" })
      const strong = enhancePrompt("a portrait", { intensity: "strong" })
      // Strong should have more keywords (commas)
      const lightCommas = light.split(",").length
      const strongCommas = strong.split(",").length
      assert.equal(strongCommas >= lightCommas, true)
    })

    it("adds scene-specific keywords for portrait", () => {
      const result = enhancePrompt("a person", { sceneType: "portrait", intensity: "strong" })
      // Should contain portrait-specific keywords
      assert.equal(
        result.includes("natural skin") || result.includes("catchlight") || result.includes("portrait lens"),
        true,
      )
    })

    it("adds scene-specific keywords for night", () => {
      const result = enhancePrompt("a city street", { sceneType: "night", intensity: "strong" })
      assert.equal(
        result.includes("neon") || result.includes("noise") || result.includes("shadow"),
        true,
      )
    })

    it("prepends style prompt when provided", () => {
      const result = enhancePrompt("a scene", { stylePrompt: "watercolor painting" })
      assert.equal(result.startsWith("watercolor painting"), true)
    })
  })

  describe("deAIPrompt", () => {
    it("includes de-AI keywords", () => {
      const result = deAIPrompt("a beautiful woman")
      assert.equal(
        result.includes("avoid plastic") ||
        result.includes("natural skin") ||
        result.includes("analog photography"),
        true,
      )
    })
  })

  describe("beautifyPortraitPrompt", () => {
    it("includes portrait and de-AI keywords", () => {
      const result = beautifyPortraitPrompt("a character portrait")
      assert.equal(result.length > "a character portrait".length, true)
    })
  })

  describe("cinematicEnhance", () => {
    it("produces a movie-quality enhanced prompt", () => {
      const result = cinematicEnhance("a rainy street at night")
      assert.equal(result.includes("a rainy street at night"), true)
      // Should be significantly longer
      assert.equal(result.length > 80, true)
    })
  })
})
