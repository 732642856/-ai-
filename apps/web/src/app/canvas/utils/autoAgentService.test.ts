import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { buildAutoAgentPlanningActions } from "./autoAgentService.ts"
import type { AutoAgentAction } from "../../../lib/ai/agents/agent-auto.ts"

function makeAction(intent: AutoAgentAction["intent"], params: Record<string, any> = {}): AutoAgentAction {
  return {
    intent,
    params,
    confidence: 0.95,
    description: intent,
  }
}

describe("buildAutoAgentPlanningActions", () => {
  it("creates a character compliance report from shot context", () => {
    const actions = buildAutoAgentPlanningActions(
      makeAction("validate-character-consistency"),
      "检查角色漂移",
      {
        nodes: [
          {
            id: "shot-1",
            type: "shot",
            nodeKind: "shot",
            title: "镜头一",
            shot: {
              characterIdentities: [
                { name: "阿岚", visualSignature: "短发，左脸痣", costume: "黑色风衣", avatarUrl: "data:image/png;base64,a" },
              ],
            },
          },
          {
            id: "shot-2",
            type: "shot",
            nodeKind: "shot",
            title: "镜头二",
            shot: {
              characterIdentities: [
                { name: "阿岚", visualSignature: "长发，左脸痣", costume: "红色外套" },
              ],
            },
          },
        ],
      },
    )

    assert.equal(actions.length, 1)
    assert.equal(actions[0].action, "create_node")
    assert.equal(actions[0].nodeType, "content")
    assert.equal(actions[0].nodeKind, "document")
    assert.equal(actions[0].title, "角色合规验证报告")
    assert.match(actions[0].content ?? "", /检查镜头数：2/)
    assert.match(actions[0].content ?? "", /阿岚：不同镜头存在多个外貌签名版本/)
    assert.match(actions[0].content ?? "", /镜头二 \/ 阿岚：缺少 参考图/)
  })

  it("creates a batch shot variation report using existing shots", () => {
    const actions = buildAutoAgentPlanningActions(
      makeAction("batch-shot-variation", { count: 3, style: "悬疑" }),
      "给我三套组镜变化",
      {
        nodes: [
          { id: "s1", type: "shot", nodeKind: "shot", title: "雨夜门口", description: "女主停在电影院门外。" },
          { id: "s2", type: "shot", nodeKind: "shot", title: "空大厅", description: "大厅尽头出现手电光。" },
        ],
      },
    )

    assert.equal(actions.length, 1)
    assert.equal(actions[0].title, "批量组镜变化方案")
    assert.match(actions[0].content ?? "", /雨夜门口：女主停在电影院门外/)
    assert.match(actions[0].content ?? "", /变化 A：节奏强化版/)
    assert.match(actions[0].content ?? "", /变化 B：悬疑信息差版/)
    assert.match(actions[0].content ?? "", /变化 C：视觉冲击版/)
  })

  it("creates the script-to-concept node bundle", () => {
    const actions = buildAutoAgentPlanningActions(
      makeAction("script-to-concept", {
        script: "雨夜，一个女孩走进废弃电影院，银幕突然亮起。",
        genre: "都市悬疑",
        style: "neo-noir, cinematic lighting",
      }),
      "从这个剧本生成概念图",
    )

    assert.equal(actions.length, 5)
    assert.deepEqual(actions.map((action) => action.title), [
      "剧本源文本",
      "角色概念图 Prompt",
      "场景概念图 Prompt",
      "整体视觉概念图生成",
      "整体视觉概念图生成",
    ])
    assert.equal(actions[0].nodeType, "content")
    assert.equal(actions[0].nodeKind, "storyboard")
    assert.equal(actions[3].action, "create_node")
    assert.equal(actions[3].nodeType, "workflow")
    assert.equal(actions[3].nodeKind, "image-generation")
    assert.match(actions[3].prompt ?? "", /都市悬疑/)
    assert.match(actions[3].prompt ?? "", /neo-noir/)
    assert.equal((actions[3].data as Record<string, unknown>).autoRunRecommended, true)
    assert.equal(actions[4].action, "run_node")
    assert.equal(actions[4].title, "整体视觉概念图生成")
  })

  it("creates the multi-step pipeline node chain with executable steps", () => {
    const actions = buildAutoAgentPlanningActions(
      makeAction("multi-step-pipeline", {
        goal: "古风仙侠微短剧",
        genre: "古装仙侠",
        style: "水墨画风",
        steps: [
          { type: "script", description: "生成剧本" },
          { type: "character", description: "角色 Bible" },
          { type: "scene", description: "场景 Bible" },
          { type: "storyboard", description: "拆解分镜" },
          { type: "concept", description: "生成概念图" },
          { type: "continuity", description: "一致性校验" },
        ],
      }),
      "帮我做一部古风仙侠微短剧",
    )

    // 1 overview + 6 step nodes + 2 run_node (concept, storyboard) + 1 run_node (pipeline) = 10
    const createNodes = actions.filter((a) => a.action === "create_node")
    const runNodes = actions.filter((a) => a.action === "run_node")
    assert.equal(createNodes.length, 7, "应该创建 1 个总览 + 6 个步骤节点")
    assert.equal(runNodes.length, 3, "应该追加 3 个 run_node（concept, storyboard, pipeline）")
    assert.equal(actions.length, 10)

    // Overview node
    assert.equal(createNodes[0].title?.slice(0, 3), "流水线")
    assert.match(createNodes[0].content ?? "", /古风仙侠微短剧/)
    assert.match(createNodes[0].content ?? "", /生成剧本/)
    assert.match(createNodes[0].content ?? "", /角色 Bible/)

    // Step nodes
    const titles = createNodes.map((n) => n.title)
    assert.match(titles[1] ?? "", /步骤 1/)
    assert.match(titles[2] ?? "", /步骤 2/)
    assert.match(titles[3] ?? "", /步骤 3/)
    assert.match(titles[4] ?? "", /步骤 4/)
    assert.match(titles[5] ?? "", /步骤 5/)
    assert.match(titles[6] ?? "", /步骤 6/)

    // Storyboard step (index 4) should be "content" type with storyboardAssistantStage
    assert.equal(createNodes[4].nodeType, "content")
    assert.equal(createNodes[4].nodeKind, "storyboard")
    assert.equal((createNodes[4].data as Record<string, unknown>).storyboardAssistantStage, "storyboard-text")

    // Concept step (index 5) should be "workflow" type with image-generation
    assert.equal(createNodes[5].nodeType, "workflow")
    assert.equal(createNodes[5].nodeKind, "image-generation")
    assert.equal((createNodes[5].data as Record<string, unknown>).autoRunRecommended, true)

    // run_node for storyboard (step type "storyboard" comes before "concept" in iteration)
    assert.equal(runNodes[0].title, createNodes[4].title)
    // run_node for concept
    assert.equal(runNodes[1].title, createNodes[5].title)
    // run_node for pipeline overview
    assert.equal(runNodes[2].title, createNodes[0].title)
  })
})
