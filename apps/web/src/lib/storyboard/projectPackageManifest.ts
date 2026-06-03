import type { ShotProductionBrief } from "./shotProductionBrief";

export type ProjectPackageShotExport = {
  id: string;
  order: number;
  title: string;
  intent?: string;
  visualReference?: string | null;
  status?: string;
};

export type ProjectPackageReference = {
  id: string;
  title: string;
  note?: string;
  url?: string | null;
  mimeType?: string | null;
};

export type ProjectPackageProductionRunManifest = {
  version: "1.1";
  workflow: {
    model: "sound-picture-production-run";
    orchestrationHint: "queue-by-shot";
    stages: Array<
      | "script"
      | "storyboard"
      | "visual"
      | "voice"
      | "subtitle"
      | "composition"
      | "handoff"
    >;
  };
  counts: {
    shots: number;
    productionBriefs: number;
    visualReferences: number;
    audioIntent: number;
    handoffNotes: number;
    warnings: number;
  };
  shotBriefIndex: Array<{
    shotId: string;
    order: number;
    title: string;
    hasVisualPrompt: boolean;
    hasVoice: boolean;
    hasSubtitle: boolean;
    characterCount: number;
    warningCount: number;
  }>;
  productionRunPlan: Array<{
    shotId: string;
    order: number;
    title: string;
    requiredAssets: Array<"visual" | "voice" | "subtitle" | "handoff-review">;
    nextActions: string[];
  }>;
  handoffWarnings: Array<{
    shotId: string;
    order: number;
    title: string;
    warning: string;
  }>;
  assetLinks: {
    visualReferenceIds: string[];
    audioIntentIds: string[];
    handoffNoteIds: string[];
  };
};

export type BuildProjectPackageManifestInput = {
  shots: ProjectPackageShotExport[];
  productionBriefs: ShotProductionBrief[];
  visualReferences?: ProjectPackageReference[];
  audioIntent?: ProjectPackageReference[];
  handoffNotes?: ProjectPackageReference[];
};

const STAGES: ProjectPackageProductionRunManifest["workflow"]["stages"] = [
  "script",
  "storyboard",
  "visual",
  "voice",
  "subtitle",
  "composition",
  "handoff",
];

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function hasText(value: unknown): boolean {
  return Boolean(cleanText(value));
}

function hasVoice(brief: ShotProductionBrief): boolean {
  return Boolean(
    hasText(brief.voice.dialogue) ||
      hasText(brief.voice.voiceIntent) ||
      hasText(brief.voice.soundCue) ||
      hasText(brief.voice.suggestedText) ||
      hasText(brief.voice.suggestedInstruct),
  );
}

function hasSubtitle(brief: ShotProductionBrief): boolean {
  return Boolean(hasText(brief.subtitle.text) || hasText(brief.subtitle.intent));
}

function buildRequiredAssets(brief: ShotProductionBrief): Array<"visual" | "voice" | "subtitle" | "handoff-review"> {
  const requiredAssets: Array<"visual" | "voice" | "subtitle" | "handoff-review"> = [];

  if (hasText(brief.visual.prompt)) {
    requiredAssets.push("visual");
  }
  if (hasVoice(brief)) {
    requiredAssets.push("voice");
  }
  if (hasSubtitle(brief)) {
    requiredAssets.push("subtitle");
  }
  if ((brief.handoff.warnings ?? []).length > 0 || hasText(brief.handoff.notes)) {
    requiredAssets.push("handoff-review");
  }

  return requiredAssets;
}

function buildNextActions(brief: ShotProductionBrief): string[] {
  const actions: string[] = [];

  if (hasText(brief.visual.prompt)) {
    actions.push("generate-storyboard-image");
  } else {
    actions.push("add-visual-prompt");
  }

  if (hasVoice(brief)) {
    actions.push("generate-voice-track");
  }

  if (hasSubtitle(brief)) {
    actions.push("create-subtitle-track");
  }

  if ((brief.handoff.warnings ?? []).length > 0) {
    actions.push("review-handoff-warnings");
  }

  return [...new Set(actions)];
}

function compareBriefOrder(a: ShotProductionBrief, b: ShotProductionBrief): number {
  if (a.order !== b.order) return a.order - b.order;
  return a.shotId.localeCompare(b.shotId);
}

export function buildProjectPackageManifest({
  shots,
  productionBriefs,
  visualReferences = [],
  audioIntent = [],
  handoffNotes = [],
}: BuildProjectPackageManifestInput): ProjectPackageProductionRunManifest {
  const orderedBriefs = productionBriefs.slice().sort(compareBriefOrder);
  const handoffWarnings = orderedBriefs.flatMap((brief) =>
    (brief.handoff.warnings ?? []).map((warning) => ({
      shotId: brief.shotId,
      order: brief.order,
      title: brief.title,
      warning,
    })),
  );

  return {
    version: "1.1",
    workflow: {
      model: "sound-picture-production-run",
      orchestrationHint: "queue-by-shot",
      stages: STAGES,
    },
    counts: {
      shots: shots.length,
      productionBriefs: orderedBriefs.length,
      visualReferences: visualReferences.length,
      audioIntent: audioIntent.length,
      handoffNotes: handoffNotes.length,
      warnings: handoffWarnings.length,
    },
    shotBriefIndex: orderedBriefs.map((brief) => ({
      shotId: brief.shotId,
      order: brief.order,
      title: brief.title,
      hasVisualPrompt: hasText(brief.visual.prompt),
      hasVoice: hasVoice(brief),
      hasSubtitle: hasSubtitle(brief),
      characterCount: brief.visual.characterIdentities.length,
      warningCount: brief.handoff.warnings?.length ?? 0,
    })),
    productionRunPlan: orderedBriefs.map((brief) => ({
      shotId: brief.shotId,
      order: brief.order,
      title: brief.title,
      requiredAssets: buildRequiredAssets(brief),
      nextActions: buildNextActions(brief),
    })),
    handoffWarnings,
    assetLinks: {
      visualReferenceIds: visualReferences.map((reference) => reference.id),
      audioIntentIds: audioIntent.map((reference) => reference.id),
      handoffNoteIds: handoffNotes.map((reference) => reference.id),
    },
  };
}
