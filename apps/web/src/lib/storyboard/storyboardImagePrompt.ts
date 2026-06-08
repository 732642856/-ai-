import type { Node } from "@xyflow/react";
import type { CanvasNodeData } from "@/app/canvas/components/canvas/types";

export type StoryboardImagePromptShot = Pick<Node<CanvasNodeData>, "data">;

function cleanLine(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function joinNonEmpty(parts: string[], separator = "; "): string {
  return parts.map(cleanLine).filter(Boolean).join(separator);
}

function describeDirectorLayer(shot: NonNullable<CanvasNodeData["shot"]>): string {
  const cinematicShot = shot.cinematicShot;
  if (!cinematicShot) return "";

  const directorParts = [
    cinematicShot.dramaticBeat ? `dramatic beat: ${cinematicShot.dramaticBeat}` : "",
    cinematicShot.shotPurpose ? `shot purpose: ${cinematicShot.shotPurpose}` : "",
    cinematicShot.cameraAngle ? `camera angle: ${cinematicShot.cameraAngle}` : "",
    cinematicShot.cameraMovement ? `camera movement: ${cinematicShot.cameraMovement}` : "",
    cinematicShot.composition ? `composition: ${cinematicShot.composition}` : "",
    cinematicShot.blocking ? `blocking: ${cinematicShot.blocking}` : "",
    cinematicShot.voiceIntent ? `sound/voice intent: ${cinematicShot.voiceIntent}` : "",
  ];

  return joinNonEmpty(directorParts);
}

function describeContinuity(shot: NonNullable<CanvasNodeData["shot"]>): string {
  const warnings = shot.continuityWarnings ?? [];
  const riskFlags = shot.cinematicShot?.riskFlags ?? [];
  const warningText = warnings
    .map((warning) => warning.message)
    .filter(Boolean)
    .slice(0, 2);
  return joinNonEmpty([...riskFlags, ...warningText]);
}

function describeScene(shot: NonNullable<CanvasNodeData["shot"]>): string {
  const scene = shot.sceneAnalysis;
  if (!scene) return "";
  return joinNonEmpty([
    scene.location ? `location: ${scene.location}` : "",
    scene.timeOfDay ? `time: ${scene.timeOfDay}` : "",
    scene.sceneFunction ? `scene function: ${scene.sceneFunction}` : "",
    scene.emotionalArc?.peak ? `dominant emotion: ${scene.emotionalArc.peak}` : "",
    scene.summary ? `scene summary: ${scene.summary}` : "",
  ]);
}

function describeCharacterIdentities(shot: NonNullable<CanvasNodeData["shot"]>): string {
  const identities = shot.characterIdentities ?? [];
  return identities.map((identity) => {
    const name = cleanLine(identity.name);
    if (!name) return "";

    const parts = [
      identity.aliases?.length ? `aliases: ${identity.aliases.map(cleanLine).filter(Boolean).join("/")}` : "",
      identity.role ? `role: ${identity.role}` : "",
      identity.visualSignature ? `stable visual signature: ${identity.visualSignature}` : "",
      identity.costume ? `costume continuity: ${identity.costume}` : "",
      identity.props?.length ? `persistent props: ${identity.props.map(cleanLine).filter(Boolean).join(", ")}` : "",
      identity.physicalTraits?.length ? `physical traits: ${identity.physicalTraits.map(cleanLine).filter(Boolean).join(", ")}` : "",
      identity.colorPalette?.length ? `character palette: ${identity.colorPalette.map(cleanLine).filter(Boolean).join(", ")}` : "",
      identity.notes ? `notes: ${identity.notes}` : "",
    ];

    const details = joinNonEmpty(parts);
    return details ? `${name} — ${details}` : name;
  }).filter(Boolean).join("\n");
}

function collectGlobalCharacterIdentities(shots: StoryboardImagePromptShot[]): string {
  const identityByName = new Map<string, string>();

  for (const shot of shots) {
    const s = shot.data.shot;
    if (!s) continue;
    const described = describeCharacterIdentities(s);
    for (const line of described.split("\n").map(cleanLine).filter(Boolean)) {
      const key = line.split("—")[0]?.trim().toLowerCase() || line.toLowerCase();
      if (!identityByName.has(key)) {
        identityByName.set(key, line);
      }
    }
  }

  return [...identityByName.values()].join("\n");
}

/**
 * Build the direct-only prompt for generating one final multi-panel storyboard image.
 * This prompt is intentionally pure and testable so expensive image-generation flows
 * can be protected without calling real AI image APIs.
 */
export function buildStoryboardImagePrompt(shots: StoryboardImagePromptShot[]): string {
  const cols = shots.length <= 2 ? 2 : shots.length <= 4 ? 2 : 3;
  const rows = Math.ceil(shots.length / cols);
  const globalCharacterIdentities = collectGlobalCharacterIdentities(shots);
  const panelDescs = shots.map((shot, i) => {
    const s = shot.data.shot!;
    const order = s.order ?? i + 1;
    const framing = s.cinematicShot?.shotSize || s.shotType || "";
    const movement = s.cinematicShot?.cameraMovement || s.cameraMovement || "";
    const desc = cleanLine(s.cinematicShot?.visualPrompt || s.visualPrompt || s.description || s.title || "");
    const directorLayer = describeDirectorLayer(s);
    const sceneLayer = describeScene(s);
    const characterLayer = describeCharacterIdentities(s);
    const continuityLayer = describeContinuity(s);

    return [
      `Panel ${order}${framing ? ` (${framing})` : ""}: ${desc}`,
      movement ? `Movement: ${movement}` : "",
      sceneLayer ? `Scene: ${sceneLayer}` : "",
      directorLayer ? `Director notes: ${directorLayer}` : "",
      characterLayer ? `Character identity continuity: ${characterLayer}` : "",
      continuityLayer ? `Continuity constraints: ${continuityLayer}` : "",
    ].filter(Boolean).join("\n");
  });

  return `Create ONE professional cinematic storyboard sheet with ${shots.length} panels arranged in a ${rows}×${cols} grid layout on a clean light gray background.

This is a direct-only final storyboard-grid generation. Do not create separate standalone images for individual shots. Every panel must appear together in the same single image.

${globalCharacterIdentities ? `Character Identity Bible — keep these exact identities stable across every panel where the character appears:\n${globalCharacterIdentities}\n\n` : ""}Each panel depicts a distinct sequential film shot:

${panelDescs.join("\n\n")}

Character continuity requirements:
- Treat the same named character as the same person across panels, not a new actor or random redesign
- Preserve face structure, hairstyle, body silhouette, costume, color palette, identifying props, and distinctive marks across all appearances
- If shot size or lighting changes, keep identity cues recognizable and consistent
- Do not merge, swap, age-shift, gender-swap, or restyle recurring characters between panels

Style requirements:
- Professional film storyboard aesthetic
- Cinematic composition and lighting
- Consistent color palette, character appearance, costume, props, and mood across all panels
- Clear panel divisions with subtle spacing
- Numbered panel labels visible at the top-left of each panel
- Respect each panel's shot size, camera angle, camera movement, blocking, and emotional beat
- Realistic, detailed, high-quality illustration style`;
}
