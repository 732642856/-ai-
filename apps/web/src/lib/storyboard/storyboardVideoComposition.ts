/**
 * Storyboard Video Composition — FFmpeg script generator for multi-shot video.
 *
 * Takes shot briefs, video URLs, audio URLs, and subtitle data.
 * Generates a self-contained FFmpeg bash script that:
 *   1. Concatenates all shot videos/images
 *   2. Overlays per-shot subtitles (burned in or soft)
 *   3. Mixes in audio tracks (voice clone audio)
 *   4. Outputs a single MP4 file
 *
 * Designed for filmmaker workflow: download script → run locally with FFmpeg.
 */

import type { ShotProductionBrief } from "./shotProductionBrief";
import type { SubtitleSegment } from "./subtitleFormatter";
import { buildSubtitleTimeline, type TimelineSubtitleSegment } from "./storyboardSubtitleTimeline";
import { parseDurationToSeconds } from "./subtitleFormatter";

// ============================================================================
// Types
// ============================================================================

export type VideoCompositionInput = {
  /** All shots in composition order */
  briefs: ShotProductionBrief[];
  /** Map of shotId → video/image URL */
  videoUrls: Record<string, string>;
  /** Map of shotId → voice audio URL */
  audioUrls: Record<string, string>;
  /** Project name for output filename */
  projectName?: string;
  /** Output resolution (default 1920x1080) */
  width?: number;
  height?: number;
  /** Frame rate (default 24) */
  fps?: number;
  /** Whether to burn subtitles into video (default true) */
  burnSubtitles?: boolean;
  /** Transition effect between shots */
  transition?: "none" | "fade" | "dissolve";
  /** Transition duration in seconds (default 0.5) */
  transitionDuration?: number;
};

export type VideoCompositionOutput = {
  /** Self-contained bash script */
  script: string;
  /** Script filename */
  scriptFilename: string;
  /** Output video filename */
  outputFilename: string;
  /** Shot count */
  shotCount: number;
  /** Estimated total duration */
  estimatedDurationSeconds: number;
  /** List of required tools */
  requiredTools: string[];
  /** Usage instructions */
  instructions: string;
};

// ============================================================================
// Helpers
// ============================================================================

const FFMPEG_CMD = "ffmpeg";
const FALLBACK_DURATION = 5;

function shotDuration(brief: ShotProductionBrief): number {
  const d = parseDurationToSeconds(brief.visual.duration);
  return d && d > 0 ? d : FALLBACK_DURATION;
}

function escapeShell(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

function formatTimestamp(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const ms = Math.round((totalSeconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

function generateDrawtextFilter(
  seg: TimelineSubtitleSegment,
  width: number,
  height: number,
): string {
  const text = seg.text
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"');
  const lineY = Math.round(height * 0.85); // Bottom 15% margin
  return (
    `drawtext=text=${escapeShell(seg.text)}` +
    `:fontfile=/System/Library/Fonts/PingFang.ttc` +
    `:fontsize=${Math.round(height * 0.035)}` +
    `:fontcolor=white` +
    `:bordercolor=black@0.5` +
    `:borderw=2` +
    `:x=(w-text_w)/2` +
    `:y=${lineY}` +
    `:enable='between(t,${seg.startSeconds},${seg.endSeconds})'`
  );
}

// ============================================================================
// Core: FFmpeg script generation
// ============================================================================

export function generateVideoCompositionScript(
  input: VideoCompositionInput,
): VideoCompositionOutput {
  const width = input.width ?? 1920;
  const height = input.height ?? 1080;
  const fps = input.fps ?? 24;
  const transitionDuration = input.transitionDuration ?? 0.5;
  const projectName = input.projectName ?? "starcanvas";
  const outputFile = `${projectName}_comp.mp4`;

  // Sort briefs by order
  const sorted = [...input.briefs].sort((a, b) => a.order - b.order);
  const lines: string[] = [];

  // ── Script header ──
  lines.push("#!/usr/bin/env bash");
  lines.push("# ═══════════════════════════════════════════════════");
  lines.push(`# StarCanvas 视频合成脚本 — ${projectName}`);
  lines.push(`# 镜头数: ${sorted.length}`);
  lines.push("# ═══════════════════════════════════════════════════");
  lines.push("");
  lines.push("set -euo pipefail");
  lines.push("");
  lines.push(`OUTPUT="${outputFile}"`);
  lines.push("");
  lines.push("# 检查 FFmpeg");
  lines.push(`if ! command -v ${FFMPEG_CMD} &>/dev/null; then`);
  lines.push('  echo "❌ 需要安装 FFmpeg: brew install ffmpeg"');
  lines.push("  exit 1");
  lines.push("fi");
  lines.push("");

  // ── Build filter complex ──
  const filterParts: string[] = [];
  const inputLines: string[] = [];

  // For each shot, add video and audio inputs
  for (let i = 0; i < sorted.length; i++) {
    const brief = sorted[i];
    const dur = shotDuration(brief);
    const videoUrl = input.videoUrls[brief.shotId];
    const audioUrl = input.audioUrls[brief.shotId];

    if (videoUrl) {
      lines.push(`# 镜头 ${brief.order}: ${brief.title || "无标题"} (${dur}s)`);
    }

    // Video input
    if (videoUrl) {
      inputLines.push(`-i ${escapeShell(videoUrl)}`);
    } else {
      // Placeholder: generate a black frame
      lines.push(`#   ⚠️ 镜头 ${brief.order} 缺失视频，使用黑场代替`);
      inputLines.push(`-f lavfi -i "color=black:size=${width}x${height}:duration=${dur}:rate=${fps}"`);
    }

    // Audio input (if available)
    if (audioUrl) {
      inputLines.push(`-i ${escapeShell(audioUrl)}`);
    }
  }

  lines.push("# 输入文件");
  lines.push(`INPUTS=(${inputLines.map((l) => `  ${l}`).join(" \\\n")})`);
  lines.push("");

  // ── Build filter_complex ──
  const timeline = buildSubtitleTimeline(sorted);

  // Video concat: scale each input to target resolution, then concat
  let videoInputIdx = 0;
  let audioInputIdx = sorted.length; // Audio inputs start after video inputs

  const scaleFilters: string[] = [];
  const concatInputs: string[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const brief = sorted[i];
    const hasVideo = Boolean(input.videoUrls[brief.shotId]);

    if (hasVideo) {
      // Scale to target resolution, pad to maintain aspect ratio
      scaleFilters.push(
        `[${videoInputIdx}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}]`,
      );
      videoInputIdx++;
    } else {
      // Black frame is already correct size
      scaleFilters.push(`[${videoInputIdx}:v]null[v${i}]`);
      videoInputIdx++;
    }
    concatInputs.push(`[v${i}]`);
  }

  // Concat all scaled videos
  filterParts.push(...scaleFilters);
  filterParts.push(
    `${concatInputs.join("")}concat=n=${sorted.length}:v=1:a=0[vout]`,
  );

  // ── Subtitle overlay ──
  if (input.burnSubtitles !== false && timeline.segments.length > 0) {
    const subtitleFilters: string[] = [];
    for (const seg of timeline.segments) {
      subtitleFilters.push(generateDrawtextFilter(seg, width, height));
    }
    if (subtitleFilters.length > 0) {
      filterParts.push(
        `[vout]${subtitleFilters.join(",")}[vsub]`,
      );
    } else {
      filterParts.push(`[vout]null[vsub]`);
    }
  } else {
    filterParts.push(`[vout]null[vsub]`);
  }

  // ── Audio mix ──
  let hasAudio = false;
  const audioFilters: string[] = [];

  for (let i = 0; i < sorted.length; i++) {
    if (input.audioUrls[sorted[i].shotId]) {
      if (!hasAudio) {
        // First audio: add silent padding before and after
        const startOffset = timeline.shots[i].startTimeSeconds;
        const endOffset =
          timeline.totalDurationSeconds -
          (startOffset + timeline.shots[i].durationSeconds);
        audioFilters.push(
          `[${audioInputIdx}:a]adelay=${Math.round(startOffset * 1000)}|${Math.round(startOffset * 1000)}[a${i}]`,
        );
        hasAudio = true;
        audioInputIdx++;
      } else {
        const startOffset = timeline.shots[i].startTimeSeconds;
        audioFilters.push(
          `[${audioInputIdx}:a]adelay=${Math.round(startOffset * 1000)}|${Math.round(startOffset * 1000)},volume=1[a${i}]`,
        );
        audioInputIdx++;
      }
    }
  }

  if (hasAudio) {
    const audioConcatInputs = sorted
      .map((_, i) => (input.audioUrls[sorted[i].shotId] ? `[a${i}]` : ""))
      .filter(Boolean);
    if (audioConcatInputs.length === 1) {
      filterParts.push(`${audioConcatInputs[0]}null[aout]`);
    } else {
      filterParts.push(
        `${audioConcatInputs.join("")}amix=inputs=${audioConcatInputs.length}:duration=longest:dropout_transition=0[aout]`,
      );
    }
  }

  // ── FFmpeg command ──
  const filterComplex = `"${filterParts.join(";")}"`;
  const audioMap = hasAudio ? '-map "[aout]"' : "";

  lines.push("# 执行合成");
  lines.push(`${FFMPEG_CMD} \\`);
  lines.push(`  "\${INPUTS[@]}" \\`);
  lines.push(`  -filter_complex ${filterComplex} \\`);
  lines.push(`  -map "[vsub]" ${audioMap} \\`);
  lines.push(`  -c:v libx264 -preset medium -crf 18 \\`);
  lines.push(`  -pix_fmt yuv420p \\`);
  if (hasAudio) {
    lines.push(`  -c:a aac -b:a 192k \\`);
  }
  lines.push(`  -r ${fps} \\`);
  lines.push(`  -movflags +faststart \\`);
  lines.push(`  "\${OUTPUT}"`);
  lines.push("");
  lines.push(`echo ""`);
  lines.push(`echo "✅ 合成完成: \${OUTPUT}"`);
  lines.push(
    `echo "   总时长: ${Math.round(timeline.totalDurationSeconds)}s"`,
  );
  lines.push(`echo "   分辨率: ${width}x${height}"`);

  const script = lines.join("\n");

  // ── Instructions ──
  const instructions = [
    "# 使用方法",
    "",
    "1. 将本脚本保存为 compose.sh",
    "2. 确保所有视频和音频文件可访问（本地路径或 URL）",
    "3. 确保已安装 FFmpeg: brew install ffmpeg",
    `4. chmod +x compose.sh && ./compose.sh`,
    `5. 输出文件: ${outputFile}`,
    "",
    `# 自定义`,
    `- 修改分辨率: 编辑 WIDTH/HEIGHT 变量`,
    `- 修改帧率: 编辑 FPS 变量`,
    `- 修改转场: 编辑 TRANSITION 变量`,
    `- 修改字幕样式: 编辑 drawtext 滤镜参数`,
  ].join("\n");

  return {
    script,
    scriptFilename: `${projectName}_compose.sh`,
    outputFilename: outputFile,
    shotCount: sorted.length,
    estimatedDurationSeconds: Math.round(timeline.totalDurationSeconds),
    requiredTools: ["ffmpeg"],
    instructions,
  };
}

/**
 * Download helper: creates a Blob URL for the composition script.
 */
export function compositionScriptBlob(
  input: VideoCompositionInput,
): { blob: Blob; filename: string } {
  const { script, scriptFilename } = generateVideoCompositionScript(input);
  return {
    blob: new Blob([script], { type: "text/x-sh;charset=utf-8" }),
    filename: scriptFilename,
  };
}
