import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ShotProductionBrief } from "./shotProductionBrief.ts";
import { buildProjectPackageManifest } from "./projectPackageManifest.ts";

function makeBrief(
  order: number,
  overrides: Partial<ShotProductionBrief> = {},
): ShotProductionBrief {
  const base: ShotProductionBrief = {
    shotId: `shot-${order}`,
    order,
    title: `镜头 ${order}`,
    visual: {
      prompt: `visual prompt ${order}`,
      shotType: "close-up",
      cameraMovement: "push-in",
      duration: "4s",
      characterIdentities: [],
    },
    voice: {},
    subtitle: {},
    handoff: {},
  };

  return {
    ...base,
    ...overrides,
    visual: {
      ...base.visual,
      ...overrides.visual,
    },
    voice: {
      ...base.voice,
      ...overrides.voice,
    },
    subtitle: {
      ...base.subtitle,
      ...overrides.subtitle,
    },
    handoff: {
      ...base.handoff,
      ...overrides.handoff,
    },
  };
}

describe("buildProjectPackageManifest", () => {
  it("builds a sound-picture production run manifest with counts and ordered shot index", () => {
    const manifest = buildProjectPackageManifest({
      shots: [
        { id: "shot-node-1", order: 1, title: "镜头 1" },
        { id: "shot-node-2", order: 2, title: "镜头 2" },
      ],
      productionBriefs: [
        makeBrief(2, {
          voice: { dialogue: "我听见声音了。", voiceIntent: "low whisper" },
          subtitle: { text: "我听见声音了。" },
          visual: {
            characterIdentities: [
              { id: "char-linxia", name: "林夏" },
              { id: "char-shadow", name: "黑影" },
            ],
          },
        }),
        makeBrief(1, {
          visual: {
            characterIdentities: [{ id: "char-linxia", name: "林夏" }],
          },
        }),
      ],
      visualReferences: [{ id: "image-1", title: "走廊参考" }],
      audioIntent: [{ id: "audio-1", title: "环境音" }],
      handoffNotes: [{ id: "handoff-1", title: "剪辑说明" }],
    });

    assert.equal(manifest.version, "1.1");
    assert.equal(manifest.workflow.model, "sound-picture-production-run");
    assert.equal(manifest.workflow.orchestrationHint, "queue-by-shot");
    assert.deepEqual(manifest.workflow.stages, [
      "script",
      "storyboard",
      "visual",
      "voice",
      "subtitle",
      "composition",
      "handoff",
    ]);
    assert.deepEqual(manifest.counts, {
      shots: 2,
      productionBriefs: 2,
      visualReferences: 1,
      audioIntent: 1,
      handoffNotes: 1,
      warnings: 0,
    });
    assert.deepEqual(
      manifest.shotBriefIndex.map((item) => item.shotId),
      ["shot-1", "shot-2"],
    );
    assert.equal(manifest.shotBriefIndex[0]?.characterCount, 1);
    assert.equal(manifest.shotBriefIndex[1]?.hasVoice, true);
    assert.equal(manifest.shotBriefIndex[1]?.hasSubtitle, true);
    assert.deepEqual(manifest.assetLinks, {
      visualReferenceIds: ["image-1"],
      audioIntentIds: ["audio-1"],
      handoffNoteIds: ["handoff-1"],
    });
  });

  it("creates per-shot next actions for visual, voice, subtitle, and warning review", () => {
    const manifest = buildProjectPackageManifest({
      shots: [{ id: "shot-node-1", order: 1, title: "镜头 1" }],
      productionBriefs: [
        makeBrief(1, {
          voice: {
            suggestedText: "别出声。",
            suggestedInstruct: "female, restrained panic",
          },
          subtitle: { text: "别出声。" },
          handoff: {
            warnings: ["红色外套必须跨镜头保持一致"],
          },
        }),
      ],
    });

    assert.deepEqual(manifest.productionRunPlan[0]?.requiredAssets, [
      "visual",
      "voice",
      "subtitle",
      "handoff-review",
    ]);
    assert.deepEqual(manifest.productionRunPlan[0]?.nextActions, [
      "generate-storyboard-image",
      "generate-voice-track",
      "create-subtitle-track",
      "review-handoff-warnings",
    ]);
    assert.deepEqual(manifest.handoffWarnings, [
      {
        shotId: "shot-1",
        order: 1,
        title: "镜头 1",
        warning: "红色外套必须跨镜头保持一致",
      },
    ]);
  });

  it("marks missing visual prompt as an add-visual-prompt action", () => {
    const manifest = buildProjectPackageManifest({
      shots: [{ id: "shot-node-1", order: 1, title: "镜头 1" }],
      productionBriefs: [
        makeBrief(1, {
          visual: { prompt: "" },
        }),
      ],
    });

    assert.equal(manifest.shotBriefIndex[0]?.hasVisualPrompt, false);
    assert.deepEqual(manifest.productionRunPlan[0]?.requiredAssets, []);
    assert.deepEqual(manifest.productionRunPlan[0]?.nextActions, ["add-visual-prompt"]);
  });
});
