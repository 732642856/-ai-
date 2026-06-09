// ============================================================================
// TransitionPicker — 多视频分镜转场选择面板
// 嵌入 StoryboardGridNode 的编辑模式，提供转场效果选择、时长调节和预览
// ============================================================================
"use client";

import { memo, useCallback, useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  Trash2,
  Play,
  Clock,
  LayoutGrid,
} from "lucide-react";
import { DESIGN_TOKENS } from "../../styles/designSystem";
import {
  type TransitionEffect,
  TRANSITION_LABELS,
  TRANSITION_EFFECTS,
} from "../../../../lib/storyboard/storyboardVideoComposition";

// ============================================================================
// 常量
// ============================================================================

/** 转场效果列表（含图标描述） */
const TRANSITION_OPTIONS: Array<{
  effect: TransitionEffect;
  label: string;
  icon: string;
  desc: string;
}> = [
  { effect: "none", label: "无转场", icon: "➖", desc: "直接拼接，无过渡效果" },
  { effect: "fade", label: "淡入淡出", icon: "🌗", desc: "前镜头渐隐，后镜头渐显" },
  { effect: "crossfade", label: "交叉溶解", icon: "🌓", desc: "前后镜头同时淡入淡出交叉过渡" },
  { effect: "dissolve", label: "溶解", icon: "💧", desc: "前后镜头溶合过渡" },
  { effect: "slide", label: "滑动", icon: "➡️", desc: "后镜头从右侧滑入覆盖前镜头" },
  { effect: "crosswarp", label: "交叉扭曲", icon: "🌀", desc: "扭曲交叉溶解，柔和过渡" },
  { effect: "circleopen", label: "圆形展开", icon: "⭕", desc: "圆形从中心展开到全屏" },
  { effect: "directionalWipe", label: "方向擦除", icon: "↔️", desc: "水平方向擦除过渡" },
  { effect: "cube", label: "立方体旋转", icon: "📦", desc: "立方体旋转切换，3D 效果" },
];

// ============================================================================
// 导出转场类型（便于外部引用）
// ============================================================================

export type { TransitionEffect };
export { TRANSITION_LABELS, TRANSITION_EFFECTS };

// ============================================================================
// Props
// ============================================================================

interface TransitionPickerProps {
  /** 当前转场效果 */
  transition: TransitionEffect;
  /** 转场时长（秒） */
  transitionDuration: number;
  /** 变化回调 */
  onChange: (transition: TransitionEffect, duration: number) => void;
}

// ============================================================================
// 子组件：滑条控制（复用 CinemaLabPanel 风格）
// ============================================================================

function SliderControl({
  label,
  icon,
  value,
  min,
  max,
  step,
  displayValue,
  onChange,
}: {
  label: string;
  icon?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span style={{ color: DESIGN_TOKENS.textMuted }}>
          {icon && <span className="mr-1">{icon}</span>}
          {label}
        </span>
        <span style={{ color: DESIGN_TOKENS.textSecondary }}>
          {displayValue ?? value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="nodrag nopan w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${DESIGN_TOKENS.accent} ${
            ((value - min) / (max - min)) * 100
          }%, rgba(255,255,255,0.1) ${((value - min) / (max - min)) * 100}%)`,
          accentColor: DESIGN_TOKENS.accent,
        }}
      />
    </div>
  );
}

// ============================================================================
// 子组件：转场效果按钮
// ============================================================================

function TransitionButton({
  effect,
  label,
  icon,
  desc,
  active,
  disabled,
  onClick,
}: {
  effect: TransitionEffect;
  label: string;
  icon: string;
  desc: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={desc}
      className="nodrag nopan flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg text-[11px] transition-all disabled:opacity-40"
      style={{
        backgroundColor: active
          ? "rgba(99,102,241,0.15)"
          : "rgba(255,255,255,0.03)",
        border: `1px solid ${
          active ? DESIGN_TOKENS.accent : DESIGN_TOKENS.border
        }`,
        color: active ? DESIGN_TOKENS.accentHover : DESIGN_TOKENS.textMuted,
        minWidth: "56px",
      }}
    >
      <span className="text-base leading-none">{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
}

// ============================================================================
// 主组件
// ============================================================================

export const TransitionPicker = memo(function TransitionPicker({
  transition,
  transitionDuration,
  onChange,
}: TransitionPickerProps) {
  const [expanded, setExpanded] = useState(false);
  const [localEffect, setLocalEffect] = useState<TransitionEffect>(transition);
  const [localDuration, setLocalDuration] = useState(transitionDuration);

  // 同步外部变化
  useEffect(() => {
    setLocalEffect(transition);
    setLocalDuration(transitionDuration);
  }, [transition, transitionDuration]);

  const isNoTransition = localEffect === "none";

  // 选择转场效果
  const handleEffectSelect = useCallback(
    (effect: TransitionEffect) => {
      const newEffect = effect === localEffect && effect !== "none" ? "none" : effect;
      setLocalEffect(newEffect);
      onChange(newEffect, localDuration);
    },
    [localEffect, localDuration, onChange],
  );

  // 时长滑条变化
  const handleDurationChange = useCallback(
    (v: number) => {
      const rounded = Math.round(v * 10) / 10; // 保留一位小数
      setLocalDuration(rounded);
      onChange(localEffect, rounded);
    },
    [localEffect, onChange],
  );

  // 清除转场设置
  const handleClear = useCallback(() => {
    setLocalEffect("none");
    setLocalDuration(0.5);
    onChange("none", 0.5);
  }, [onChange]);

  // 生成当前转场摘要
  const summaryLabel = TRANSITION_LABELS[localEffect];
  const summary = isNoTransition
    ? null
    : `${summaryLabel} · ${localDuration.toFixed(1)}s`;

  return (
    <div className="border-t" style={{ borderColor: DESIGN_TOKENS.border }}>
      {/* 标题栏 - 始终可见 */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="nodrag nopan w-full flex items-center justify-between px-3 py-2 text-[11px] font-medium transition-colors hover:bg-white/5"
        style={{ color: DESIGN_TOKENS.textSecondary }}
      >
        <span className="flex items-center gap-1.5">
          <LayoutGrid size={14} style={{ color: DESIGN_TOKENS.accent }} />
          转场设置
          {summary && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: "rgba(99,102,241,0.12)",
                color: DESIGN_TOKENS.accentHover,
              }}
            >
              {summary}
            </span>
          )}
          {isNoTransition && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: "rgba(148,163,184,0.1)",
                color: DESIGN_TOKENS.textMuted,
              }}
            >
              无转场
            </span>
          )}
        </span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* 展开面板 */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* 转场效果选择 */}
          <div>
            <div className="text-[11px] mb-1.5" style={{ color: DESIGN_TOKENS.textMuted }}>
              转场效果
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {TRANSITION_OPTIONS.map((opt) => (
                <TransitionButton
                  key={opt.effect}
                  effect={opt.effect}
                  label={opt.label}
                  icon={opt.icon}
                  desc={opt.desc}
                  active={localEffect === opt.effect}
                  disabled={false}
                  onClick={() => handleEffectSelect(opt.effect)}
                />
              ))}
            </div>
          </div>

          {/* 时长滑条（无转场时隐藏） */}
          {!isNoTransition && (
            <SliderControl
              label="转场时长"
              icon="⏱️"
              value={localDuration}
              min={0.1}
              max={2.0}
              step={0.1}
              displayValue={`${localDuration.toFixed(1)}s`}
              onChange={handleDurationChange}
            />
          )}

          {/* 当前配置摘要 */}
          <div
            className="rounded-lg p-2 text-[10px] space-y-0.5"
            style={{
              backgroundColor: isNoTransition
                ? "rgba(148,163,184,0.06)"
                : "rgba(99,102,241,0.06)",
              border: `1px solid ${
                isNoTransition
                  ? "rgba(148,163,184,0.15)"
                  : "rgba(99,102,241,0.15)"
              }`,
            }}
          >
            <div className="flex items-center gap-1" style={{ color: DESIGN_TOKENS.accentHover }}>
              <LayoutGrid size={12} />
              <span className="font-medium">当前配置</span>
            </div>
            <div style={{ color: DESIGN_TOKENS.textSecondary }}>
              {summary ? summary : "无转场 · 镜头直接拼接"}
            </div>
            <div style={{ color: DESIGN_TOKENS.textMuted }}>
              {!isNoTransition && (
                <>
                  引擎: FFmpeg xfade · {localDuration.toFixed(1)}s 过渡
                </>
              )}
            </div>
          </div>

          {/* 提示信息 */}
          <div
            className="rounded-lg p-2 text-[10px] leading-relaxed"
            style={{
              backgroundColor: "rgba(148,163,184,0.06)",
              border: `1px solid ${DESIGN_TOKENS.border}`,
              color: DESIGN_TOKENS.textMuted,
            }}
          >
            <span className="flex items-center gap-1 mb-0.5">
              <Clock size={10} />
              注意
            </span>
            转场会增加视频总时长（每段转场增加约 {localDuration.toFixed(1)}s 重叠区）。
            建议转场时长控制在 0.3-1.0s 之间，过长会影响观看节奏。
          </div>

          {/* 清除按钮 */}
          {!isNoTransition && (
            <button
              type="button"
              onClick={handleClear}
              className="nodrag nopan w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] transition-colors"
              style={{
                backgroundColor: "rgba(239,68,68,0.08)",
                color: "#ef4444",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              <Trash2 size={12} />
              清除转场设置
            </button>
          )}
        </div>
      )}
    </div>
  );
});

export default TransitionPicker;
