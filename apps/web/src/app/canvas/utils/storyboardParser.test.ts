import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { parseStoryboardTextToShots } from "./storyboardParser.ts"

describe("parseStoryboardTextToShots", () => {
  it("parses plain story text into fallback storyboard shots", () => {
    const shots = parseStoryboardTextToShots(
      "雨夜，女主角站在旧电影院门口，霓虹灯在积水里闪烁。她推门进去，看见空荡大厅尽头有一束手电光。她沿着走廊慢慢靠近，墙上的旧海报被风吹得沙沙作响。忽然放映室里传来胶片转动的声音，她抬头看见银幕亮了起来。",
      "source-1",
    )

    assert.ok(shots.length >= 3)
    assert.ok(shots.length <= 9)
    assert.equal(shots[0].order, 1)
    assert.equal(shots[0].sourceStoryboardNodeId, "source-1")
    assert.ok(shots.every((shot) => shot.description && shot.visualPrompt))
  })

  it("still respects numbered storyboard text before fallback parsing", () => {
    const shots = parseStoryboardTextToShots(
      "1. 远景，城市夜色。\n2. 近景，人物回头。",
      "source-2",
    )

    assert.equal(shots.length, 2)
    assert.equal(shots[0].description, "远景，城市夜色。")
    assert.equal(shots[1].description, "近景，人物回头。")
  })

  it("returns 1 shot for ultra-short text like '小兔子吃草'", () => {
    const shots = parseStoryboardTextToShots("小兔子吃草", "source-3")

    assert.equal(shots.length, 1)
    assert.equal(shots[0].description, "小兔子吃草")
    assert.equal(shots[0].visualPrompt, "小兔子吃草")
    assert.equal(shots[0].order, 1)
  })

  it("returns 1 shot for short text under 30 chars without punctuation", () => {
    const shots = parseStoryboardTextToShots("一个简短的灵感想法", "source-4")

    assert.equal(shots.length, 1)
    assert.equal(shots[0].description, "一个简短的灵感想法")
  })

  it("splits text with 2+ beats into multiple shots", () => {
    const shots = parseStoryboardTextToShots(
      "清晨，阳光穿过窗帘。她睁开眼，发现身边多了一只猫。猫舔了舔她的手指，发出咕噜声。",
      "source-5",
    )

    assert.ok(shots.length >= 2)
    assert.ok(shots.length <= 9)
    assert.ok(shots.every((shot) => shot.description.length > 0))
  })
})
