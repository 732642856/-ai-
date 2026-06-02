import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { buildStoryboardImagePrompt } from "./storyboard/storyboardImagePrompt.ts"
import {
  inferCharacterIdentitiesForShot,
  postProcessStoryboard,
  storyboardPlanToShotData,
} from "./storyboard-director-agent.ts"

const rawDirectorOutput = {
  scenes: [
    {
      sceneId: "scene-1",
      sceneNumber: 1,
      location: "old apartment corridor",
      timeOfDay: "night",
      characters: ["女主林夏"],
      sceneFunction: "establishing" as const,
      emotionalArc: { start: "tense" as const, peak: "fear" as const, end: "suspense" as const },
      dramaticTension: 8,
      summary: "女主林夏在旧公寓走廊发现门后的黑影",
    },
  ],
  shots: [
    {
      order: 1,
      sceneId: "scene-1",
      shotId: "shot-1",
      dramaticBeat: "女主停在门前",
      shotPurpose: "建立旧公寓走廊和女主的危险处境",
      emotionalState: "tense" as const,
      dramaticWeight: 7,
      shotSize: "wide" as const,
      cameraAngle: "eye-level" as const,
      cameraMovement: "push-in" as const,
      composition: "door frame creates pressure lines around 女主林夏",
      blocking: "女主林夏 wears a red wool coat and holds an old brass key",
      durationEstimate: 4,
      visualPrompt: "cinematic wide storyboard panel, 女主林夏 in same red wool coat, old brass key, cold corridor light",
      referenceTags: ["red wool coat", "old brass key"],
      riskFlags: ["keep red wool coat consistent across panels"],
    },
    {
      order: 2,
      sceneId: "scene-1",
      shotId: "shot-2",
      dramaticBeat: "女主听见门后呼吸",
      shotPurpose: "用反应镜头放大恐惧",
      emotionalState: "fear" as const,
      dramaticWeight: 8,
      shotSize: "close-up" as const,
      cameraAngle: "eye-level" as const,
      cameraMovement: "static" as const,
      composition: "tight close-up keeps 女主林夏 face readable",
      blocking: "女主林夏 freezes, still wearing the same red wool coat",
      durationEstimate: 2,
      visualPrompt: "cinematic close-up, 女主林夏 anxious eyes, same short black bob, same red wool coat",
      referenceTags: ["short black bob", "red wool coat"],
      riskFlags: ["do not redesign 女主林夏 between shots"],
    },
  ],
  emotionalCurve: [7, 8],
  overallDuration: 6,
}

describe("storyboard director character continuity", () => {
  it("infers character identity assets from scene characters and shot metadata", () => {
    const plan = postProcessStoryboard(rawDirectorOutput, {
      title: "旧公寓",
      genre: "悬疑短剧",
      style: "cinematic suspense",
      targetPlatform: "short-drama",
      shotDensity: "normal",
    })
    const shots = storyboardPlanToShotData(plan, "source-storyboard")

    assert.equal(shots.length, 2)
    assert.equal(shots[0].characterIdentities?.[0]?.name, "女主林夏")
    assert.equal(shots[0].characterIdentities?.[0]?.role, "protagonist")
    assert.match(shots[0].characterIdentities?.[0]?.visualSignature ?? "", /red wool coat/)
    assert.deepEqual(shots[0].characterIdentities?.[0]?.props, ["red wool coat", "old brass key", "keep red wool coat consistent across panels"])

    const prompt = buildStoryboardImagePrompt(shots.map((shot) => ({ data: { nodeKind: "shot", shot } })))
    assert.match(prompt, /Character Identity Bible/)
    assert.match(prompt, /女主林夏/)
    assert.match(prompt, /same red wool coat/)
    assert.match(prompt, /Do not merge, swap, age-shift, gender-swap, or restyle recurring characters between panels/)
  })

  it("falls back to generic recurring-character assets when only shot text names a character", () => {
    const plan = postProcessStoryboard({
      scenes: [],
      shots: [
        {
          order: 1,
          sceneId: "scene-1",
          shotId: "shot-1",
          dramaticBeat: "主角回头",
          shotPurpose: "制造悬念",
          emotionalState: "suspense",
          dramaticWeight: 6,
          shotSize: "medium",
          cameraAngle: "eye-level",
          cameraMovement: "static",
          composition: "主角 is framed at the end of a corridor",
          blocking: "主角 slowly turns back",
          durationEstimate: 3,
          visualPrompt: "medium shot, protagonist turns back in corridor",
        },
      ],
    })
    const identities = inferCharacterIdentitiesForShot(plan.shots[0], plan.scenes[0])

    assert.equal(identities?.[0]?.name, "主角")
    assert.equal(identities?.[0]?.role, "protagonist")
    assert.match(identities?.[0]?.visualSignature ?? "", /主角 slowly turns back/)
    assert.match(identities?.[0]?.visualSignature ?? "", /主角 is framed at the end of a corridor/)
  })
})
