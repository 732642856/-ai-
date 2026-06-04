import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  segmentDialogue,
  formatDialogueAsSrt,
  formatSrtTimecode,
  parseDurationToSeconds,
  convertSrtToVtt,
} from "./subtitleFormatter.ts";

void describe("formatSrtTimecode", () => {
  void it("formats zero seconds", () => {
    assert.equal(formatSrtTimecode(0), "00:00:00,000");
  });

  void it("formats seconds and milliseconds", () => {
    assert.equal(formatSrtTimecode(1.5), "00:00:01,500");
  });

  void it("formats minutes", () => {
    assert.equal(formatSrtTimecode(65.123), "00:01:05,123");
  });

  void it("formats hours", () => {
    assert.equal(formatSrtTimecode(3661.999), "01:01:01,999");
  });
});

void describe("segmentDialogue", () => {
  void it("splits on Chinese sentence boundaries", () => {
    const segments = segmentDialogue("你好。今天天气不错！真的吗？");
    assert.equal(segments.length, 3);
    assert.equal(segments[0], "你好。");
    assert.equal(segments[1], "今天天气不错！");
    assert.equal(segments[2], "真的吗？");
  });

  void it("splits on English sentence boundaries", () => {
    const segments = segmentDialogue("Hello. How are you? I'm fine!");
    assert.equal(segments.length, 3);
  });

  void it("splits long sentences on clause boundaries", () => {
    const longText =
      "这是一段很长很长的对话，包含了多个逗号分隔的子句，用于测试换行逻辑是否正常工作以及是否能正确处理中文标点符号";
    const segments = segmentDialogue(longText, { maxCharsPerLine: 30 });
    assert.ok(segments.length > 1, "should split into multiple segments");
    for (const seg of segments) {
      assert.ok(
        seg.length <= 30,
        `segment length ${seg.length} exceeds max 30: "${seg}"`,
      );
    }
  });

  void it("returns single segment for short text", () => {
    const segments = segmentDialogue("你好");
    assert.equal(segments.length, 1);
    assert.equal(segments[0], "你好");
  });

  void it("returns empty array for empty input", () => {
    assert.deepEqual(segmentDialogue(""), []);
    assert.deepEqual(segmentDialogue("   "), []);
  });
});

void describe("formatDialogueAsSrt", () => {
  void it("generates valid SRT with timestamps", () => {
    const result = formatDialogueAsSrt("你好。再见。", {
      durationSeconds: 4,
    });
    assert.equal(result.format, "srt");
    assert.equal(result.totalDurationSeconds, 4);
    assert.equal(result.segments.length, 2);
    assert.ok(result.srt.includes("00:00:00,000 --> "));
    assert.ok(result.srt.includes("你好。"));
    assert.ok(result.srt.includes("再见。"));
  });

  void it("respects segment count in timestamp distribution", () => {
    const result = formatDialogueAsSrt("一。二。三。四。", {
      durationSeconds: 8,
    });
    assert.equal(result.segments.length, 4);
    // Each segment should be ~2s
    const firstStart = result.segments[0]!.startSeconds;
    const firstEnd = result.segments[0]!.endSeconds;
    assert.equal(firstStart, 0);
    assert.equal(firstEnd, 2);
    const lastEnd = result.segments[3]!.endSeconds;
    assert.equal(lastEnd, 8);
  });

  void it("uses default duration of 5s when not specified", () => {
    const result = formatDialogueAsSrt("测试。");
    assert.equal(result.totalDurationSeconds, 5);
  });

  void it("respects min segment duration", () => {
    const result = formatDialogueAsSrt("一。二。三。", {
      durationSeconds: 1,
      minSegmentDuration: 2,
    });
    // Even with 1s total, segments should have min 2s each
    const firstSeg = result.segments[0]!;
    assert.ok(
      firstSeg.endSeconds - firstSeg.startSeconds >= 2,
      `segment duration ${firstSeg.endSeconds - firstSeg.startSeconds}s < min 2s`,
    );
  });

  void it("includes SRT index numbers", () => {
    const result = formatDialogueAsSrt("第一句。第二句。");
    const lines = result.srt.split("\n");
    assert.ok(lines.includes("1"), "should include index 1");
    assert.ok(lines.includes("2"), "should include index 2");
  });
});

void describe("parseDurationToSeconds", () => {
  void it("parses '3s' format", () => {
    assert.equal(parseDurationToSeconds("3s"), 3);
    assert.equal(parseDurationToSeconds("1.5s"), 1.5);
  });

  void it("parses '3000ms' format", () => {
    assert.equal(parseDurationToSeconds("3000ms"), 3);
    assert.equal(parseDurationToSeconds("500ms"), 0.5);
  });

  void it("parses raw number string", () => {
    assert.equal(parseDurationToSeconds("5"), 5);
    assert.equal(parseDurationToSeconds("2.5"), 2.5);
  });

  void it("returns undefined for unparseable input", () => {
    assert.equal(parseDurationToSeconds(undefined), undefined);
    assert.equal(parseDurationToSeconds(""), undefined);
    assert.equal(parseDurationToSeconds("abc"), undefined);
  });
});

void describe("convertSrtToVtt", () => {
  void it("adds WEBVTT header", () => {
    const srt = "1\n00:00:00,000 --> 00:00:02,000\n你好。\n";
    const vtt = convertSrtToVtt(srt);
    assert.ok(vtt.startsWith("WEBVTT\n\n"), "should start with WEBVTT header");
  });

  void it("converts comma timecodes to period timecodes", () => {
    const srt = "1\n00:00:00,000 --> 00:00:02,500\n你好。\n";
    const vtt = convertSrtToVtt(srt);
    assert.ok(vtt.includes("00:00:00.000 --> 00:00:02.500"), "timecodes should use periods");
    assert.ok(!vtt.includes(",000"), "should not contain comma timecodes");
  });

  void it("preserves subtitle text and index numbers", () => {
    const srt = "1\n00:00:00,000 --> 00:00:02,000\n第一句。\n\n2\n00:00:02,000 --> 00:00:04,000\n第二句。\n";
    const vtt = convertSrtToVtt(srt);
    assert.ok(vtt.includes("第一句。"), "should preserve first subtitle");
    assert.ok(vtt.includes("第二句。"), "should preserve second subtitle");
    assert.ok(vtt.includes("1\n"), "should preserve index 1");
    assert.ok(vtt.includes("2\n"), "should preserve index 2");
  });

  void it("round-trips correctly from formatDialogueAsSrt", () => {
    const result = formatDialogueAsSrt("你好。再见。", { durationSeconds: 4 });
    const vtt = convertSrtToVtt(result.srt);
    assert.ok(vtt.startsWith("WEBVTT\n\n"));
    assert.ok(vtt.includes("你好。"));
    assert.ok(vtt.includes("再见。"));
  });
});
