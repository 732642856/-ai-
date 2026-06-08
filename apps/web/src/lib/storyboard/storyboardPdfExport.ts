import type { ShotProductionBrief } from "./shotProductionBrief";

// ============================================================================
// Types
// ============================================================================

export type StoryboardPdfExportInput = {
  /** Project or workspace title, shown on cover page */
  title: string;
  /** Subtitle / tagline shown on cover below title */
  subtitle?: string;
  /** Ordered shot production briefs */
  briefs: ShotProductionBrief[];
  /** Optional image URL per shot (keyed by shotId), shown alongside shot detail */
  imageUrls?: Record<string, string>;
  /** Optional subtitle text per shot (keyed by shotId) */
  subtitleTexts?: Record<string, string>;
  /** Optional voice/audio status indicator per shot */
  voiceStatuses?: Record<string, "ready" | "pending" | "none">;
};

// ============================================================================
// Helpers
// ============================================================================

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatList(items: string[] | undefined): string {
  if (!items || items.length === 0) return "";
  return items.map((item) => `<li>${esc(item)}</li>`).join("\n");
}

function safeString(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function hasContent(value: unknown): boolean {
  return safeString(value).length > 0;
}

function shotStatusLabel(brief: ShotProductionBrief): string {
  const hasVisual = hasContent(brief.visual.prompt);
  const hasVoice = hasContent(brief.voice.dialogue) || hasContent(brief.voice.voiceIntent);
  const hasWarnings = (brief.handoff.warnings?.length ?? 0) > 0;

  if (!hasVisual) return "缺少视觉";
  if (hasWarnings) return "需审核";
  if (hasVoice) return "声画齐备";
  return "仅视觉";
}

function shotStatusColor(status: string): string {
  switch (status) {
    case "声画齐备": return "#16a34a";
    case "需审核": return "#ea580c";
    case "仅视觉": return "#2563eb";
    case "缺少视觉": return "#dc2626";
    default: return "#6b7280";
  }
}

// ============================================================================
// CSS (print-optimized, standalone)
// ============================================================================

const PRINT_CSS = /* css */ `
  @page {
    size: A4;
    margin: 20mm 18mm 20mm 18mm;
    @bottom-center {
      content: counter(page);
      font-family: -apple-system, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif;
      font-size: 10px;
      color: #9ca3af;
    }
  }

  @page :first {
    margin-top: 25mm;
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html {
    font-size: 13px;
    line-height: 1.6;
    color: #1f2937;
    font-family: -apple-system, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  body {
    max-width: 100%;
    padding: 0;
  }

  /* ── Cover Page ── */
  .cover {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 95vh;
    page-break-after: always;
    text-align: center;
    padding: 4rem 2rem;
  }

  .cover h1 {
    font-size: 2.4rem;
    font-weight: 700;
    color: #111827;
    letter-spacing: 0.04em;
    margin-bottom: 0.5rem;
  }

  .cover .subtitle {
    font-size: 1.1rem;
    color: #6b7280;
    margin-bottom: 3rem;
  }

  .cover .meta {
    font-size: 0.95rem;
    color: #9ca3af;
    line-height: 2;
  }

  .cover .meta strong {
    color: #4b5563;
    font-weight: 500;
  }

  .cover .divider {
    width: 80px;
    height: 2px;
    background: #d1d5db;
    margin: 2rem auto;
  }

  /* ── Section Titles ── */
  .section-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
    border-bottom: 2px solid #e5e7eb;
    padding-bottom: 0.4rem;
    margin-bottom: 1.2rem;
    page-break-before: always;
  }

  .section-title:first-of-type {
    page-break-before: auto;
  }

  /* ── Index / Overview Table ── */
  .shot-index {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.95rem;
  }

  .shot-index thead th {
    text-align: left;
    padding: 0.6rem 0.7rem;
    background: #f3f4f6;
    color: #374151;
    font-weight: 600;
    border-bottom: 2px solid #d1d5db;
    white-space: nowrap;
  }

  .shot-index tbody td {
    padding: 0.5rem 0.7rem;
    border-bottom: 1px solid #f3f4f6;
    vertical-align: top;
  }

  .shot-index tbody tr:nth-child(even) {
    background: #fafafa;
  }

  .shot-index .shot-num {
    color: #9ca3af;
    font-variant-numeric: tabular-nums;
    width: 3rem;
  }

  .shot-index .shot-title {
    font-weight: 500;
    max-width: 16rem;
  }

  .shot-index .status-badge {
    display: inline-block;
    padding: 0.15rem 0.5rem;
    border-radius: 3px;
    font-size: 0.82rem;
    font-weight: 500;
    color: #fff;
  }

  .shot-index .char-tag {
    display: inline-block;
    padding: 0.1rem 0.4rem;
    background: #eff6ff;
    color: #1d4ed8;
    border-radius: 2px;
    font-size: 0.8rem;
    margin-right: 0.2rem;
  }

  .shot-index .warn-count {
    color: #dc2626;
    font-weight: 600;
  }

  /* ── Shot Detail Page ── */
  .shot-detail {
    page-break-before: always;
    padding-top: 1rem;
  }

  .shot-detail:first-of-type {
    page-break-before: auto;
  }

  .shot-header {
    display: flex;
    align-items: baseline;
    gap: 0.8rem;
    margin-bottom: 0.8rem;
    border-bottom: 2px solid #2563eb;
    padding-bottom: 0.3rem;
  }

  .shot-header .num {
    font-size: 1.1rem;
    font-weight: 700;
    color: #2563eb;
    font-variant-numeric: tabular-nums;
  }

  .shot-header .title {
    font-size: 1.3rem;
    font-weight: 600;
    color: #111827;
    flex: 1;
  }

  .shot-header .duration {
    font-size: 0.9rem;
    color: #6b7280;
    white-space: nowrap;
  }

  /* ── Detail grid ── */
  .detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem 1.5rem;
    margin-top: 0.8rem;
  }

  .detail-block {
    break-inside: avoid;
  }

  .detail-block.full {
    grid-column: 1 / -1;
  }

  .detail-block h4 {
    font-size: 0.85rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 0.3rem;
  }

  .detail-block p,
  .detail-block ul {
    font-size: 0.93rem;
    color: #374151;
    line-height: 1.7;
  }

  .detail-block ul {
    list-style: none;
    padding: 0;
  }

  .detail-block ul li {
    padding: 0.15rem 0;
    border-bottom: 1px dotted #f3f4f6;
  }

  .detail-block .tag {
    display: inline-block;
    padding: 0.1rem 0.5rem;
    background: #eff6ff;
    color: #1d4ed8;
    border-radius: 3px;
    font-size: 0.85rem;
    margin: 0.1rem 0.2rem 0.1rem 0;
  }

  .detail-block .warn-tag {
    display: inline-block;
    padding: 0.1rem 0.5rem;
    background: #fef2f2;
    color: #dc2626;
    border-radius: 3px;
    font-size: 0.85rem;
    margin: 0.1rem 0.2rem 0.1rem 0;
  }

  /* ── Image frame ── */
  .shot-image {
    width: 100%;
    max-height: 380px;
    object-fit: contain;
    background: #f9fafb;
    border-radius: 4px;
    border: 1px solid #e5e7eb;
    margin-bottom: 0.5rem;
  }

  .shot-image-placeholder {
    width: 100%;
    height: 260px;
    background: #f9fafb;
    border: 2px dashed #e5e7eb;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #9ca3af;
    font-size: 0.95rem;
    margin-bottom: 0.5rem;
  }

  /* ── Dialogue block ── */
  .dialogue-box {
    background: #f0f7ff;
    border-left: 3px solid #2563eb;
    padding: 0.6rem 0.9rem;
    border-radius: 0 4px 4px 0;
    margin-bottom: 0.6rem;
  }

  .dialogue-box .speaker {
    font-weight: 600;
    color: #1d4ed8;
    font-size: 0.85rem;
    margin-bottom: 0.15rem;
  }

  .dialogue-box .lines {
    color: #1e293b;
    font-size: 0.95rem;
    line-height: 1.7;
  }

  /* ── Voice / Audio indicators ── */
  .voice-indicator {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.8rem;
    padding: 0.15rem 0.5rem;
    border-radius: 3px;
  }

  .voice-indicator.ready {
    background: #f0fdf4;
    color: #16a34a;
  }

  .voice-indicator.pending {
    background: #fffbeb;
    color: #d97706;
  }

  /* ── Character card in shot detail ── */
  .char-card {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    padding: 0.4rem 0.6rem;
    margin-bottom: 0.3rem;
  }

  .char-card .char-name {
    font-weight: 600;
    font-size: 0.9rem;
    color: #1f2937;
  }

  .char-card .char-detail {
    font-size: 0.82rem;
    color: #6b7280;
    line-height: 1.5;
  }

  /* ── Warnings block ── */
  .warnings-block {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 4px;
    padding: 0.5rem 0.7rem;
  }

  .warnings-block h4 {
    color: #dc2626;
  }

  .warnings-block ul {
    color: #991b1b;
  }

  .warnings-block li {
    border-bottom: 1px dotted #fecaca !important;
  }

  /* ── Footer ── */
  .export-footer {
    margin-top: 3rem;
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
    text-align: center;
    font-size: 0.8rem;
    color: #9ca3af;
  }
`;

// ============================================================================
// HTML Generation
// ============================================================================

function generateCover(input: StoryboardPdfExportInput): string {
  const { title, subtitle, briefs } = input;
  const dateStr = formatDate(new Date());
  const totalShots = briefs.length;
  const withVisual = briefs.filter((b) => hasContent(b.visual.prompt)).length;
  const withVoice = briefs.filter((b) => hasContent(b.voice.dialogue) || hasContent(b.voice.voiceIntent)).length;
  const totalWarnings = briefs.reduce((sum, b) => sum + (b.handoff.warnings?.length ?? 0), 0);

  return /* html */ `
  <section class="cover">
    <h1>${esc(title)}</h1>
    ${subtitle ? `<p class="subtitle">${esc(subtitle)}</p>` : ""}
    <div class="divider"></div>
    <div class="meta">
      <p><strong>分镜本</strong> · 影视前期创作</p>
      <p><strong>导出日期</strong> ${dateStr}</p>
      <p><strong>总镜数</strong> ${totalShots} 镜 · <strong>已配视觉</strong> ${withVisual} 镜 · <strong>已有配音</strong> ${withVoice} 镜</p>
      ${totalWarnings > 0 ? `<p><strong>⚠ 待审核项</strong> ${totalWarnings} 条</p>` : ""}
    </div>
    <div class="divider"></div>
    <p class="meta" style="color:#9ca3af">由 StarCanvas 星轨画布自动生成 · 生成时间 ${formatDate(new Date())}</p>
  </section>`;
}

function generateIndex(input: StoryboardPdfExportInput): string {
  const { briefs, imageUrls, voiceStatuses } = input;

  const rows = briefs.map((brief) => {
    const status = shotStatusLabel(brief);
    const color = shotStatusColor(status);
    const characters = brief.visual.characterIdentities.map((c) => c.name).filter(Boolean);
    const warnings = brief.handoff.warnings?.length ?? 0;
    const hasImg = imageUrls?.[brief.shotId] ? "✓" : "—";
    const voiceStatus = voiceStatuses?.[brief.shotId];
    const hasVoiceLabel = voiceStatus === "ready" ? "✓" : voiceStatus === "pending" ? "⏳" : "—";

    return /* html */ `
    <tr>
      <td class="shot-num">${brief.order}</td>
      <td class="shot-title">${esc(brief.title)}</td>
      <td>${esc(brief.visual.shotType ?? "—")}</td>
      <td>${esc(brief.visual.cameraMovement ?? "—")}</td>
      <td>${esc(brief.visual.duration ?? "—")}</td>
      <td>
        ${characters.length > 0
          ? characters.map((name) => `<span class="char-tag">${esc(name)}</span>`).join("")
          : "—"}
      </td>
      <td>${hasImg}</td>
      <td>${hasVoiceLabel}</td>
      <td>${warnings > 0 ? `<span class="warn-count">${warnings}</span>` : "—"}</td>
      <td><span class="status-badge" style="background:${color}">${esc(status)}</span></td>
    </tr>`;
  }).join("\n");

  return /* html */ `
  <section>
    <h2 class="section-title">分镜索引</h2>
    <table class="shot-index">
      <thead>
        <tr>
          <th>#</th>
          <th>标题</th>
          <th>景别</th>
          <th>运镜</th>
          <th>时长</th>
          <th>角色</th>
          <th>图</th>
          <th>配音</th>
          <th>⚠</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </section>`;
}

function generateShotDetail(
  brief: ShotProductionBrief,
  index: number,
  input: StoryboardPdfExportInput,
): string {
  const { imageUrls, subtitleTexts, voiceStatuses } = input;
  const imageUrl = imageUrls?.[brief.shotId];
  const subtitleText = subtitleTexts?.[brief.shotId];
  const voiceStatus = voiceStatuses?.[brief.shotId];

  // Build sections
  const sections: string[] = [];

  // Image
  sections.push(/* html */ `
  <div class="detail-block full">
    ${imageUrl
      ? `<img class="shot-image" src="${esc(imageUrl)}" alt="镜头 ${brief.order} 参考图" />`
      : `<div class="shot-image-placeholder">暂无参考图 — 镜头 ${brief.order}</div>`}
  </div>`);

  // Visual info
  const visualTags: string[] = [];
  if (brief.visual.shotType) visualTags.push(`<span class="tag">景别：${esc(brief.visual.shotType)}</span>`);
  if (brief.visual.cameraMovement) visualTags.push(`<span class="tag">运镜：${esc(brief.visual.cameraMovement)}</span>`);
  if (brief.visual.duration) visualTags.push(`<span class="tag">时长：${esc(brief.visual.duration)}</span>`);

  if (hasContent(brief.visual.prompt)) {
    sections.push(/* html */ `
    <div class="detail-block">
      <h4>视觉提示词</h4>
      <p>${esc(brief.visual.prompt)}</p>
      ${visualTags.length > 0 ? `<p style="margin-top:0.4rem">${visualTags.join(" ")}</p>` : ""}
    </div>`);
  }

  // Dialogue
  if (hasContent(brief.voice.dialogue)) {
    sections.push(/* html */ `
    <div class="detail-block">
      <h4>对白</h4>
      <div class="dialogue-box">
        <div class="lines">${esc(brief.voice.dialogue ?? "")}</div>
      </div>
      ${voiceStatus
        ? `<span class="voice-indicator ${voiceStatus}">${voiceStatus === "ready" ? "✓ 已配音" : "⏳ 待配音"}</span>`
        : ""}
    </div>`);
  }

  // Voice intent
  if (hasContent(brief.voice.voiceIntent) || hasContent(brief.voice.soundCue)) {
    sections.push(/* html */ `
    <div class="detail-block">
      <h4>声音意图</h4>
      ${hasContent(brief.voice.voiceIntent)
        ? `<p>${esc(brief.voice.voiceIntent ?? "")}</p>`
        : ""}
      ${hasContent(brief.voice.soundCue)
        ? `<p style="margin-top:0.2rem">音效：${esc(brief.voice.soundCue ?? "")}</p>`
        : ""}
    </div>`);
  }

  // Subtitle
  if (subtitleText || hasContent(brief.subtitle.text)) {
    const text = subtitleText ?? safeString(brief.subtitle.text);
    if (text) {
      sections.push(/* html */ `
      <div class="detail-block">
        <h4>字幕</h4>
        <p style="background:#f8fafc;padding:0.4rem 0.6rem;border-radius:3px">${esc(text)}</p>
      </div>`);
    }
  }

  // Characters
  if (brief.visual.characterIdentities.length > 0) {
    const charCards = brief.visual.characterIdentities.map((char) => {
      const details: string[] = [];
      if (char.role) details.push(`角色：${esc(char.role)}`);
      if (char.visualSignature) details.push(esc(char.visualSignature));
      if (char.costume) details.push(`服装：${esc(char.costume)}`);

      return /* html */ `
      <div class="char-card">
        <div class="char-name">${esc(char.name)}</div>
        ${details.length > 0 ? `<div class="char-detail">${details.join("<br>")}</div>` : ""}
      </div>`;
    }).join("\n");

    sections.push(/* html */ `
    <div class="detail-block full">
      <h4>角色</h4>
      ${charCards}
    </div>`);
  }

  // Handoff notes
  if (hasContent(brief.handoff.notes)) {
    sections.push(/* html */ `
    <div class="detail-block full">
      <h4>后期交接</h4>
      <p>${esc(brief.handoff.notes ?? "")}</p>
    </div>`);
  }

  // Warnings
  if (brief.handoff.warnings && brief.handoff.warnings.length > 0) {
    sections.push(/* html */ `
    <div class="detail-block full">
      <div class="warnings-block">
        <h4>⚠ 审核警告</h4>
        <ul>${formatList(brief.handoff.warnings)}</ul>
      </div>
    </div>`);
  }

  return /* html */ `
  <section class="shot-detail">
    <div class="shot-header">
      <span class="num">镜头 ${brief.order}</span>
      <span class="title">${esc(brief.title)}</span>
      ${brief.visual.duration ? `<span class="duration">${esc(brief.visual.duration)}</span>` : ""}
    </div>
    <div class="detail-grid">
      ${sections.join("\n")}
    </div>
  </section>`;
}

// ============================================================================
// Public API
// ============================================================================

export function generateStoryboardPdfHtml(input: StoryboardPdfExportInput): string {
  const { title, briefs } = input;

  const cover = generateCover(input);
  const index = generateIndex(input);

  const shotsHtml = briefs
    .map((brief, idx) => generateShotDetail(brief, idx, input))
    .join("\n");

  const pageCount = 2 + briefs.length; // cover + index + N shots
  const warningTotal = briefs.reduce((sum, b) => sum + (b.handoff.warnings?.length ?? 0), 0);

  return /* html */ `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} — 分镜本</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
  ${cover}
  ${index}
  ${shotsHtml}
  <footer class="export-footer">
    <p>${esc(title)} · 分镜本 · ${formatDate(new Date())} · 共 ${pageCount} 页</p>
    <p>${briefs.length} 镜 ${warningTotal > 0 ? `· ${warningTotal} 条待审核` : ""}</p>
    <p style="margin-top:0.3rem">由 <strong>StarCanvas 星轨画布</strong> 自动生成</p>
  </footer>
</body>
</html>`;
}

/**
 * Generate filename-safe slug from title.
 */
export function storyboardPdfFilename(title: string): string {
  const slug = title
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
  return `${slug}_分镜本_${formatDate(new Date())}.html`;
}
