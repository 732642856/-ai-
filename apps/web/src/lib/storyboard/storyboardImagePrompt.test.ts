import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Node } from "@xyflow/react";
import type { CanvasNodeData } from "@/app/canvas/components/canvas/types";
import { buildStoryboardImagePrompt } from "./storyboardImagePrompt.ts";

function makeShotNode(order: number, data: Partial<NonNullable<CanvasNodeData["shot"]>> = {}): Node<CanvasNodeData> {
  return {
    id: `shot-${order}`,
    type: "shot",
    position: { x: order * 100, y: 0 },
    data: {
      nodeKind: "shot",
      shot: {
        id: `shot-data-${order}`,
        order,
        title: `镜头 ${order}`,
        description: `镜头 ${order} 画面描述`,
        visualPrompt: `visual prompt ${order}`,
        sourceStoryboardNodeId: "storyboard-1",
        ...data,
      },
    },
  };
}

describe("buildStoryboardImagePrompt", () => {
  it("builds a direct-only single storyboard-grid prompt for multiple shots", () => {
    const prompt = buildStoryboardImagePrompt([
      makeShotNode(1, { shotType: "wide shot" }),
      makeShotNode(2, { shotType: "close-up" }),
      makeShotNode(3, { shotType: "medium shot" }),
    ]);

    assert.match(prompt, /Create ONE professional cinematic storyboard sheet with 3 panels/);
    assert.match(prompt, /direct-only final storyboard-grid generation/);
    assert.match(prompt, /Do not create separate standalone images for individual shots/);
    assert.match(prompt, /Panel 1 \(wide shot\): visual prompt 1/);
    assert.match(prompt, /Panel 2 \(close-up\): visual prompt 2/);
    assert.match(prompt, /Panel 3 \(medium shot\): visual prompt 3/);
  });

  it("includes manually edited character identities in the direct-only storyboard prompt", () => {
    const prompt = buildStoryboardImagePrompt([
      makeShotNode(1, {
        characterIdentities: [
          {
            id: "manual-character-linxia",
            name: "女主林夏",
            role: "protagonist",
            visualSignature: "manual edit: sharp oval face, short black bob haircut, small mole under left eye",
            costume: "manual edit: same red wool coat with brass buttons",
            props: ["old brass key", "black shoulder bag"],
          },
        ],
      }),
      makeShotNode(2, {
        characterIdentities: [
          {
            id: "manual-character-linxia",
            name: "女主林夏",
            visualSignature: "manual edit: sharp oval face, short black bob haircut, small mole under left eye",
            costume: "manual edit: same red wool coat with brass buttons",
            props: ["old brass key"],
          },
        ],
      }),
    ]);

    assert.match(prompt, /direct-only final storyboard-grid generation/);
    assert.match(prompt, /Do not create separate standalone images for individual shots/);
    assert.match(prompt, /Character Identity Bible/);
    assert.match(prompt, /女主林夏 — role: protagonist/);
    assert.match(prompt, /manual edit: sharp oval face, short black bob haircut, small mole under left eye/);
    assert.match(prompt, /manual edit: same red wool coat with brass buttons/);
    assert.match(prompt, /persistent props: old brass key, black shoulder bag/);
    assert.match(prompt, /Character identity continuity: 女主林夏/);
    assert.match(prompt, /Treat the same named character as the same person across panels/);
  });

  it("includes a character identity bible and per-panel identity constraints", () => {
    const prompt = buildStoryboardImagePrompt([
      makeShotNode(1, {
        characterIdentities: [
          {
            id: "char-heroine",
            name: "女主林夏",
            aliases: ["红衣女主"],
            role: "protagonist",
            visualSignature: "young woman with sharp oval face, short black bob haircut, anxious eyes",
            costume: "same red wool coat with brass buttons",
            props: ["old brass key", "black shoulder bag"],
            physicalTraits: ["slim silhouette", "small mole under left eye"],
            colorPalette: ["deep red", "cold blue corridor light"],
          },
        ],
      }),
      makeShotNode(2, {
        characterIdentities: [
          {
            id: "char-heroine",
            name: "女主林夏",
            visualSignature: "young woman with sharp oval face, short black bob haircut, anxious eyes",
            costume: "same red wool coat with brass buttons",
            props: ["old brass key"],
          },
        ],
      }),
    ]);

    assert.match(prompt, /Character Identity Bible/);
    assert.match(prompt, /女主林夏 — aliases: 红衣女主; role: protagonist/);
    assert.match(prompt, /stable visual signature: young woman with sharp oval face, short black bob haircut, anxious eyes/);
    assert.match(prompt, /costume continuity: same red wool coat with brass buttons/);
    assert.match(prompt, /persistent props: old brass key, black shoulder bag/);
    assert.match(prompt, /physical traits: slim silhouette, small mole under left eye/);
    assert.match(prompt, /Character identity continuity: 女主林夏/);
    assert.match(prompt, /Treat the same named character as the same person across panels/);
    assert.match(prompt, /Preserve face structure, hairstyle, body silhouette, costume, color palette, identifying props/);
    assert.match(prompt, /Do not merge, swap, age-shift, gender-swap, or restyle recurring characters between panels/);
  });

  it("uses Director Agent metadata when cinematicShot is available", () => {
    const prompt = buildStoryboardImagePrompt([
      makeShotNode(1, {
        visualPrompt: "fallback prompt should not dominate",
        cinematicShot: {
          order: 1,
          sceneId: "scene-1",
          shotId: "shot-1",
          dramaticBeat: "女主发现门后有人",
          shotPurpose: "制造悬疑并压缩观众注意力",
          emotionalState: "suspense",
          dramaticWeight: 8,
          shotSize: "close-up",
          cameraAngle: "eye-level",
          cameraMovement: "push-in",
          composition: "door frame splits the face in half",
          blocking: "actor freezes with hand on the handle",
          durationEstimate: 4,
          visualPrompt: "cinematic close-up through a half-open door",
          voiceIntent: "low whisper, restrained panic",
          riskFlags: ["keep the red coat consistent"],
        },
        sceneAnalysis: {
          sceneId: "scene-1",
          sceneNumber: 1,
          location: "old apartment corridor",
          timeOfDay: "night",
          characters: ["女主"],
          sceneFunction: "revelation",
          emotionalArc: { start: "calm", peak: "suspense", end: "fear" },
          dramaticTension: 8,
          summary: "女主在旧公寓走廊发现门后的黑影",
        },
        continuityWarnings: [
          {
            type: "prop-consistency",
            severity: "warning",
            message: "红色外套必须跨镜头保持一致",
            shotIds: ["shot-1", "shot-2"],
          },
        ],
      }),
    ]);

    assert.match(prompt, /Panel 1 \(close-up\): cinematic close-up through a half-open door/);
    assert.match(prompt, /Movement: push-in/);
    assert.match(prompt, /dramatic beat: 女主发现门后有人/);
    assert.match(prompt, /shot purpose: 制造悬疑并压缩观众注意力/);
    assert.match(prompt, /composition: door frame splits the face in half/);
    assert.match(prompt, /blocking: actor freezes with hand on the handle/);
    assert.match(prompt, /sound\/voice intent: low whisper, restrained panic/);
    assert.match(prompt, /location: old apartment corridor/);
    assert.match(prompt, /Continuity constraints: keep the red coat consistent; 红色外套必须跨镜头保持一致/);
  });
});
