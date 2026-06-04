// ============================================================================
// subtitleFormatter — SRT/VTT subtitle generation utilities
// ============================================================================

/** A single subtitle segment with timecodes. */
export type SubtitleSegment = {
  index: number;
  startSeconds: number;
  endSeconds: number;
  text: string;
};

/** The result of formatting dialogue into SRT. */
export type FormattedSubtitle = {
  format: "srt";
  srt: string;
  segments: SubtitleSegment[];
  totalDurationSeconds: number;
};

/** Options for subtitle formatting. */
export type SubtitleFormatOptions = {
  /** Duration of the shot in seconds (default 5). */
  durationSeconds?: number;
  /** Minimum duration per segment in seconds (default 1). */
  minSegmentDuration?: number;
  /** Maximum chars per subtitle line (default 40 for readability). */
  maxCharsPerLine?: number;
};

const DEFAULT_DURATION = 5;
const DEFAULT_MIN_SEGMENT = 1;
const DEFAULT_MAX_CHARS = 40;

/**
 * Split a dialogue string into subtitle-sized segments.
 * Respects Chinese/English sentence boundaries and line-length limits.
 */
export function segmentDialogue(
  text: string,
  options: SubtitleFormatOptions = {},
): string[] {
  const maxChars = options.maxCharsPerLine ?? DEFAULT_MAX_CHARS;
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];

  // Split on sentence boundaries (Chinese and English)
  const sentenceDelim = /(?<=[。！？；.!?;])\s*/;
  const rawSentences = cleaned
    .split(sentenceDelim)
    .map((s) => s.trim())
    .filter(Boolean);

  const segments: string[] = [];

  for (const sentence of rawSentences) {
    if (sentence.length <= maxChars) {
      segments.push(sentence);
    } else {
      // Split long sentences on clause boundaries or by max line length
      const clauseDelim = /(?<=[，,、：:—…])\s*/;
      const clauses = sentence
        .split(clauseDelim)
        .map((c) => c.trim())
        .filter(Boolean);

      let current = "";
      for (const clause of clauses) {
        if (!current) {
          current = clause;
          continue;
        }
        const candidate = `${current}，${clause}`;
        if (candidate.length <= maxChars) {
          current = candidate;
        } else {
          segments.push(current);
          current = clause;
        }
      }
      if (current) segments.push(current);
    }
  }

  return segments.length > 0 ? segments : [cleaned];
}

/**
 * Format a timestamp as SRT timecode: HH:MM:SS,mmm
 */
export function formatSrtTimecode(totalSeconds: number): string {
  const totalMs = Math.round(totalSeconds * 1000);
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

/**
 * Convert dialogue text into SRT-formatted subtitles with evenly-spaced timestamps.
 */
export function formatDialogueAsSrt(
  dialogue: string,
  options: SubtitleFormatOptions = {},
): FormattedSubtitle {
  const rawDuration = options.durationSeconds ?? DEFAULT_DURATION;
  const duration = rawDuration > 0 ? rawDuration : DEFAULT_DURATION;
  const minSeg = options.minSegmentDuration ?? DEFAULT_MIN_SEGMENT;

  const segments = segmentDialogue(dialogue, options);

  // Distribute timestamps evenly across the duration
  const segmentDuration = Math.max(
    duration / segments.length,
    minSeg,
  );

  const subtitleSegments: SubtitleSegment[] = segments.map(
    (text, index) => {
      const startSeconds = index * segmentDuration;
      const endSeconds = startSeconds + segmentDuration;
      return {
        index: index + 1,
        startSeconds: Math.round(startSeconds * 1000) / 1000,
        endSeconds: Math.round(endSeconds * 1000) / 1000,
        text,
      };
    },
  );

  // Build SRT content
  const srt = subtitleSegments
    .map(
      (seg) =>
        `${seg.index}\n${formatSrtTimecode(seg.startSeconds)} --> ${formatSrtTimecode(seg.endSeconds)}\n${seg.text}\n`,
    )
    .join("\n");

  return {
    format: "srt",
    srt,
    segments: subtitleSegments,
    totalDurationSeconds: duration,
  };
}

/**
 * Parse a duration string (e.g. "3s", "1.5s", "3000ms") into seconds.
 * Returns undefined if unparseable.
 */
export function parseDurationToSeconds(raw?: string): number | undefined {
  if (!raw || typeof raw !== "string") return undefined;
  const trimmed = raw.trim().toLowerCase();

  const msMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*ms$/);
  if (msMatch) return parseFloat(msMatch[1]!) / 1000;

  const sMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*s$/);
  if (sMatch) return parseFloat(sMatch[1]!);

  const numericMatch = trimmed.match(/^(\d+(?:\.\d+)?)$/);
  if (numericMatch) return parseFloat(numericMatch[1]!);

  return undefined;
}
