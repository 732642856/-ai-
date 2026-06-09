// ============================================================================
// AngleControlPanel - 多角度控制面板组件（TapNow 风格）
// 通过提示词角度描述合成方案，调整角色朝向和姿态角度
// ============================================================================
"use client";

import { useState, useCallback } from "react";
import {
  X,
  Loader2,
  RotateCw,
  ArrowUpDown,
  Check,
  Eye,
} from "lucide-react";
import { DESIGN_TOKENS } from "../../styles/designSystem";
import { toDataUrl } from "../../utils/toDataUrl";

interface AngleControlPanelProps {
  /** 原始图片 URL */
  imageUrl: string;
  /** 原始 prompt（用于合成角度提示词） */
  basePrompt: string;
  /** 原始 assetId（用于 img2img 参考图） */
  assetId?: string;
  /** 生成成功回调（返回新图片 URL） */
  onResult: (resultImageUrl: string, angleDescription: string) => void;
  /** 关闭弹窗 */
  onClose: () => void;
}

// ── 角度描述映射 ──────────────────────────────────────────────────────────

/** 水平旋转角度 → 英文角度描述词 */
function yawToDescription(degrees: number): string {
  if (degrees <= 15) return "front view, facing the camera directly";
  if (degrees <= 60) return "three-quarter view, slightly turned to the side";
  if (degrees <= 120) return "side view, profile, looking to the side";
  if (degrees <= 165) return "three-quarter back view, mostly seen from behind";
  return "back view, seen from behind, facing away from camera";
}

/** 水平旋转角度 → 中文角度描述 */
function yawToChinese(degrees: number): string {
  if (degrees <= 15) return "正面";
  if (degrees <= 60) return "四分之三侧面";
  if (degrees <= 120) return "正侧面";
  if (degrees <= 165) return "四分之三背面";
  return "背面";
}

/** 俯仰角度 → 英文描述词 */
function pitchToDescription(degrees: number): string | null {
  if (degrees <= -20) return "view from above, looking down, high angle shot";
  if (degrees <= -8) return "slightly from above, looking down slightly";
  if (degrees >= 20) return "view from below, looking up, low angle shot";
  if (degrees >= 8) return "slightly from below, looking up slightly";
  return null;
}

/** 俯仰角度 → 中文描述 */
function pitchToChinese(degrees: number): string | null {
  if (degrees <= -20) return "俯视";
  if (degrees <= -8) return "微俯";
  if (degrees >= 20) return "仰视";
  if (degrees >= 8) return "微仰";
  return null;
}

/** 合成完整的角度描述文本（中文，用于展示） */
function buildAngleLabel(yaw: number, pitch: number): string {
  const yawLabel = yawToChinese(yaw);
  const pitchLabel = pitchToChinese(pitch);
  if (pitchLabel) return `${yawLabel} · ${pitchLabel}`;
  return yawLabel;
}

/** 合成角度英文描述（用于注入 prompt） */
function buildAnglePromptSuffix(yaw: number, pitch: number): string {
  const parts: string[] = [];
  const pitchDesc = pitchToDescription(pitch);
  if (pitchDesc) parts.push(pitchDesc);
  parts.push(yawToDescription(yaw));
  return parts.join(", ");
}

// ── 角度刻度标记 ──────────────────────────────────────────────────────────

const YAW_MARKS = [
  { value: 0, label: "0°" },
  { value: 45, label: "45°" },
  { value: 90, label: "90°" },
  { value: 135, label: "135°" },
  { value: 180, label: "180°" },
];

const PITCH_MARKS = [
  { value: -30, label: "-30°" },
  { value: -15, label: "-15°" },
  { value: 0, label: "0°" },
  { value: 15, label: "15°" },
  { value: 30, label: "30°" },
];

// ── 组件 ──────────────────────────────────────────────────────────────────

export default function AngleControlPanel({
  imageUrl,
  basePrompt,
  onResult,
  onClose,
}: AngleControlPanelProps) {
  const [yaw, setYaw] = useState(0); // 0~180 水平旋转
  const [pitch, setPitch] = useState(0); // -30~+30 俯仰
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultAngleDesc, setResultAngleDesc] = useState("");

  const angleLabel = buildAngleLabel(yaw, pitch);
  const anglePromptSuffix = buildAnglePromptSuffix(yaw, pitch);

  // 点击"生成"按钮
  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    try {
      // 合成最终 prompt: base prompt + 角度描述
      const angleDesc = buildAnglePromptSuffix(yaw, pitch);
      const finalPrompt = basePrompt.trim()
        ? `${basePrompt.trim()}, ${angleDesc}`
        : angleDesc;

      const body: Record<string, unknown> = {
        prompt: finalPrompt,
        model: "gpt-image-2",
        size: "1024x1024",
        requestId: crypto.randomUUID(),
      };

      // 将 imageUrl 转为 data URL，作为 img2img 参考图以保持角色一致性
      try {
        const sourceImage = await toDataUrl(imageUrl);
        body.sourceImage = sourceImage;
      } catch {
        // 转换失败则降级为纯文本生成
        console.warn("[AngleControl] 无法获取参考图 data URL，降级为纯文本生成");
      }

      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          typeof errData.error === "string"
            ? errData.error
            : errData.error?.userMessage || "生成失败",
        );
      }

      const result = await res.json();
      if (!result.imageUrl) throw new Error("No image data returned");

      setResultUrl(result.imageUrl);
      setResultAngleDesc(angleLabel);
    } catch (err: any) {
      setError(err?.message || "生成失败");
    } finally {
      setIsGenerating(false);
    }
  }, [yaw, pitch, basePrompt, imageUrl, angleLabel]);

  const handleApply = useCallback(() => {
    if (resultUrl) {
      onResult(resultUrl, resultAngleDesc);
      onClose();
    }
  }, [resultUrl, resultAngleDesc, onResult, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{
          backgroundColor: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
        }}
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[720px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          backgroundColor: DESIGN_TOKENS.panelSolid,
          borderColor: DESIGN_TOKENS.border,
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: DESIGN_TOKENS.border }}
        >
          <div className="flex items-center gap-2">
            <RotateCw
              size={18}
              strokeWidth={1.5}
              style={{ color: DESIGN_TOKENS.accent }}
            />
            <span
              className="text-sm font-medium"
              style={{ color: DESIGN_TOKENS.textPrimary }}
            >
              多角度控制
            </span>
            <span
              className="text-xs"
              style={{ color: DESIGN_TOKENS.textMuted }}
            >
              · 拖拽滑条调整角色朝向
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors hover:bg-white/10"
            style={{ color: DESIGN_TOKENS.textMuted }}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 gap-5 overflow-auto p-5">
          {/* Left: Original image + control sliders */}
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {/* Original image preview */}
            <div
              className="flex items-center justify-center overflow-hidden rounded-xl"
              style={{
                backgroundColor: "rgba(0,0,0,0.3)",
                border: `1px solid ${DESIGN_TOKENS.border}`,
                minHeight: "260px",
                maxHeight: "320px",
              }}
            >
              <img
                src={imageUrl}
                alt="原始图片"
                className="max-h-[320px] w-full object-contain"
              />
            </div>

            {/* Horizontal (yaw) slider */}
            <div className="rounded-xl border p-4" style={{ borderColor: DESIGN_TOKENS.border }}>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <RotateCw size={14} strokeWidth={1.5} style={{ color: DESIGN_TOKENS.textSecondary }} />
                  <span
                    className="text-xs font-medium"
                    style={{ color: DESIGN_TOKENS.textSecondary }}
                  >
                    水平旋转
                  </span>
                </div>
                <span
                  className="text-xs font-mono"
                  style={{ color: DESIGN_TOKENS.accentHover }}
                >
                  {yaw}°
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={180}
                value={yaw}
                onChange={(e) => setYaw(Number(e.target.value))}
                className="w-full accent-slate-400"
                style={{ cursor: "pointer", height: "6px" }}
              />
              {/* Marks */}
              <div className="mt-1 flex justify-between px-0.5">
                {YAW_MARKS.map((mark) => (
                  <button
                    key={mark.value}
                    onClick={() => setYaw(mark.value)}
                    className="text-[10px] transition-colors hover:text-white/80"
                    style={{
                      color:
                        yaw === mark.value
                          ? DESIGN_TOKENS.accentHover
                          : DESIGN_TOKENS.textMuted,
                      fontWeight: yaw === mark.value ? 600 : 400,
                    }}
                  >
                    {mark.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Vertical (pitch) slider */}
            <div className="rounded-xl border p-4" style={{ borderColor: DESIGN_TOKENS.border }}>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ArrowUpDown size={14} strokeWidth={1.5} style={{ color: DESIGN_TOKENS.textSecondary }} />
                  <span
                    className="text-xs font-medium"
                    style={{ color: DESIGN_TOKENS.textSecondary }}
                  >
                    俯仰角度
                  </span>
                </div>
                <span
                  className="text-xs font-mono"
                  style={{ color: DESIGN_TOKENS.accentHover }}
                >
                  {pitch > 0 ? `+${pitch}°` : `${pitch}°`}
                </span>
              </div>
              <input
                type="range"
                min={-30}
                max={30}
                value={pitch}
                onChange={(e) => setPitch(Number(e.target.value))}
                className="w-full accent-slate-400"
                style={{ cursor: "pointer", height: "6px" }}
              />
              {/* Marks */}
              <div className="mt-1 flex justify-between px-0.5">
                {PITCH_MARKS.map((mark) => (
                  <button
                    key={mark.value}
                    onClick={() => setPitch(mark.value)}
                    className="text-[10px] transition-colors hover:text-white/80"
                    style={{
                      color:
                        pitch === mark.value
                          ? DESIGN_TOKENS.accentHover
                          : DESIGN_TOKENS.textMuted,
                      fontWeight: pitch === mark.value ? 600 : 400,
                    }}
                  >
                    {mark.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Control info + Generate + Preview */}
          <div className="flex w-[240px] flex-shrink-0 flex-col gap-3">
            {/* Angle description display */}
            <div
              className="rounded-xl border p-3"
              style={{ borderColor: DESIGN_TOKENS.border }}
            >
              <div className="mb-1.5 flex items-center gap-1.5">
                <Eye size={13} strokeWidth={1.5} style={{ color: DESIGN_TOKENS.textSecondary }} />
                <span
                  className="text-[11px] font-medium"
                  style={{ color: DESIGN_TOKENS.textSecondary }}
                >
                  当前角度
                </span>
              </div>
              <div
                className="rounded-lg px-3 py-2 text-center text-sm font-medium"
                style={{
                  backgroundColor: "rgba(100, 116, 139, 0.15)",
                  color: DESIGN_TOKENS.accentHover,
                }}
              >
                {angleLabel}
              </div>
              <div
                className="mt-2 text-[10px] leading-relaxed"
                style={{ color: DESIGN_TOKENS.textMuted }}
              >
                {anglePromptSuffix}
              </div>
            </div>

            {/* Prompt preview */}
            <div
              className="rounded-xl border p-3"
              style={{ borderColor: DESIGN_TOKENS.border }}
            >
              <span
                className="mb-1 block text-[11px] font-medium"
                style={{ color: DESIGN_TOKENS.textSecondary }}
              >
                合成提示词预览
              </span>
              <div
                className="max-h-[80px] overflow-y-auto text-[11px] leading-relaxed"
                style={{ color: DESIGN_TOKENS.textMuted }}
              >
                {basePrompt.trim()
                  ? `${basePrompt.trim()}, ${anglePromptSuffix}`
                  : anglePromptSuffix}
              </div>
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all disabled:opacity-40"
              style={{
                backgroundColor: DESIGN_TOKENS.accent,
                color: "#fff",
              }}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>生成中...</span>
                </>
              ) : (
                <>
                  <RotateCw size={16} strokeWidth={1.5} />
                  <span>生成</span>
                </>
              )}
            </button>

            {/* Result preview */}
            {resultUrl && (
              <div
                className="rounded-xl border p-3"
                style={{ borderColor: "rgba(16, 185, 129, 0.3)" }}
              >
                <span
                  className="mb-1.5 block text-[11px] font-medium"
                  style={{ color: "#34d399" }}
                >
                  生成结果 · {resultAngleDesc}
                </span>
                <div
                  className="mb-2 flex items-center justify-center overflow-hidden rounded-lg"
                  style={{
                    backgroundColor: "rgba(0,0,0,0.2)",
                    minHeight: "120px",
                  }}
                >
                  <img
                    src={resultUrl}
                    alt="生成结果"
                    className="max-h-[180px] w-full object-contain"
                  />
                </div>
                <button
                  onClick={handleApply}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors hover:opacity-80"
                  style={{
                    backgroundColor: "rgba(16, 185, 129, 0.2)",
                    color: "#34d399",
                  }}
                >
                  <Check size={14} strokeWidth={1.5} />
                  <span>应用结果</span>
                </button>
              </div>
            )}

            {/* Error */}
            {error && (
              <div
                className="rounded-lg px-3 py-2"
                style={{ backgroundColor: "rgba(239,68,68,0.1)" }}
              >
                <span className="text-[11px] text-red-300/70">{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer hint ── */}
        <div
          className="border-t px-4 py-2"
          style={{ borderColor: DESIGN_TOKENS.border }}
        >
          <div
            className="text-[11px]"
            style={{ color: DESIGN_TOKENS.textMuted }}
          >
            提示：通过调整水平旋转和俯仰角度，生成角色不同朝向的图片。无需修改提示词即可切换视角。
          </div>
        </div>
      </div>
    </>
  );
}
