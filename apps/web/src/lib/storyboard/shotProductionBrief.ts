import type { Node } from "@xyflow/react";
import type {
  CanvasNodeData,
  CharacterIdentityAsset,
  StoryboardShotData,
} from "@/app/canvas/components/canvas/types";

export type ShotProductionBrief = {
  shotId: string;
  order: number;
  title: string;
  visual: {
    prompt: string;
    shotType?: string;
    cameraMovement?: string;
    duration?: string;
    characterIdentities: CharacterIdentityAsset[];
  };
  voice: {
    dialogue?: string;
    voiceIntent?: string;
    soundCue?: string;
    suggestedText?: string;
    suggestedInstruct?: string;
  };
  subtitle: {
    text?: string;
    intent?: string;
  };
  handoff: {
    notes?: string;
    warnings?: string[];
  };
};

export type ShotProductionBriefNode = Pick<Node<CanvasNodeData>, "id" | "data">;

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function joinNonEmpty(parts: Array<string | undefined>, separator = "\n"): string | undefined {
  const text = [...new Set(parts.map(cleanText).filter(Boolean))].join(separator);
  return text || undefined;
}

function formatDuration(shot: StoryboardShotData): string | undefined {
  const explicitDuration = cleanText(shot.duration);
  if (explicitDuration) return explicitDuration;

  const durationEstimate = shot.cinematicShot?.durationEstimate;
  if (typeof durationEstimate === "number" && Number.isFinite(durationEstimate) && durationEstimate > 0) {
    return `${durationEstimate}s`;
  }

  return undefined;
}

function getVisualPrompt(shot: StoryboardShotData): string {
  return cleanText(
    shot.cinematicShot?.visualPrompt ||
      shot.visualPrompt ||
      shot.description ||
      shot.title,
  );
}

function getDialogue(shot: StoryboardShotData): string | undefined {
  return joinNonEmpty([
    shot.cinematicShot?.dialogue,
    shot.dialogue,
    shot.voiceConfig?.text,
  ], "\n");
}

function getSuggestedVoiceText(shot: StoryboardShotData, dialogue?: string): string | undefined {
  return cleanText(shot.voiceConfig?.text) || dialogue;
}

function getSuggestedVoiceInstruct(shot: StoryboardShotData): string | undefined {
  return joinNonEmpty([
    shot.voiceConfig?.instruct,
    shot.cinematicShot?.voiceIntent,
    shot.cinematicShot?.soundCue,
    shot.cinematicShot?.musicMood,
  ], "; ");
}

function collectWarnings(shot: StoryboardShotData): string[] | undefined {
  const warnings = [
    ...(shot.cinematicShot?.riskFlags ?? []),
    ...(shot.continuityWarnings ?? []).map((warning) => warning.message),
  ].map(cleanText).filter(Boolean);

  if (!getVisualPrompt(shot)) {
    warnings.push("Missing visual prompt for shot generation");
  }

  return warnings.length ? [...new Set(warnings)] : undefined;
}

function buildHandoffNotes(shot: StoryboardShotData): string | undefined {
  return joinNonEmpty([
    shot.notes,
    shot.sceneAnalysis?.summary ? `Scene summary: ${shot.sceneAnalysis.summary}` : undefined,
    shot.cinematicShot?.dramaticBeat ? `Dramatic beat: ${shot.cinematicShot.dramaticBeat}` : undefined,
    shot.cinematicShot?.shotPurpose ? `Shot purpose: ${shot.cinematicShot.shotPurpose}` : undefined,
    shot.cinematicShot?.transitionIn ? `Transition in: ${shot.cinematicShot.transitionIn}` : undefined,
    shot.cinematicShot?.transitionOut ? `Transition out: ${shot.cinematicShot.transitionOut}` : undefined,
  ]);
}

export function buildShotProductionBrief(shot: StoryboardShotData): ShotProductionBrief {
  const dialogue = getDialogue(shot);
  const voiceIntent = cleanText(shot.cinematicShot?.voiceIntent) || cleanText(shot.voiceConfig?.instruct) || undefined;
  const soundCue = joinNonEmpty([
    shot.cinematicShot?.soundCue,
    shot.cinematicShot?.musicMood ? `music mood: ${shot.cinematicShot.musicMood}` : undefined,
  ], "; ");

  return {
    shotId: cleanText(shot.id) || `shot-${shot.order}`,
    order: shot.order,
    title: cleanText(shot.title) || `镜头 ${shot.order}`,
    visual: {
      prompt: getVisualPrompt(shot),
      shotType: cleanText(shot.cinematicShot?.shotSize) || cleanText(shot.shotType) || undefined,
      cameraMovement: cleanText(shot.cinematicShot?.cameraMovement) || cleanText(shot.cameraMovement) || undefined,
      duration: formatDuration(shot),
      characterIdentities: shot.characterIdentities ?? [],
    },
    voice: {
      dialogue,
      voiceIntent,
      soundCue,
      suggestedText: getSuggestedVoiceText(shot, dialogue),
      suggestedInstruct: getSuggestedVoiceInstruct(shot),
    },
    subtitle: {
      text: dialogue,
      intent: voiceIntent || soundCue,
    },
    handoff: {
      notes: buildHandoffNotes(shot),
      warnings: collectWarnings(shot),
    },
  };
}

export function buildShotProductionBriefs(nodes: ShotProductionBriefNode[]): ShotProductionBrief[] {
  return nodes
    .map((node) => node.data?.shot)
    .filter((shot): shot is StoryboardShotData => Boolean(shot))
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(buildShotProductionBrief);
}
