// ============================================================================
// CinemaLabPanel — 摄影机运镜控制面板
// 嵌入 VideoNode 的编辑模式，提供推/拉/摇/移/跟 5 种运镜参数调节
// ============================================================================
"use client";

import { memo, useCallback, useState, useEffect } from "react";
import { Camera, ChevronDown, ChevronUp, Eye, EyeOff, Trash2, Film } from "lucide-react";
import { DESIGN_TOKENS } from "../../styles/designSystem";
import type { CameraCommandType, CameraCommand, ShotCameraConfig } from "../canvas/types";

// ============================================================================
// 常量
// ============================================================================

const CAMERA_TYPES: Array<{ type: CameraCommandType; label: string; icon: string; desc: string }> = [
  { type: "push", label: "推", icon: "🎯", desc: "从全景推到特写" },
  { type: "pull", label: "拉", icon: "🔭", desc: "从特写拉到全景" },
  { type: "pan", label: "摇", icon: "🔄", desc: "水平旋转拍摄" },
  { type: "truck", label: "移", icon: "➡️", desc: "横向平移跟拍" },
  { type: "follow", label: "跟", icon: "🎬", desc: "跟随主体运动" },
];

const SPEED_OPTIONS = [
  { label: "慢速", value: 0.5, icon: "🐢" },
  { label: "中速", value: 1.0, icon: "🚶" },
  { label: "快速", value: 2.0, icon: "🏃" },
] as const;

const EASING_OPTIONS = [
  { label: "线性", value: "linear" as const },
  { label: "缓入", value: "ease-in" as const },
  { label: "缓出", value: "ease-out" as const },
];

/** 运镜类型的默认参数 */
const DEFAULT_PARAMS: Record<CameraCommandType, { startValue: number; endValue: number; intensity: number }> = {
  push:    { startValue: 1.0, endValue: 1.5, intensity: 5 },
  pull:    { startValue: 1.5, endValue: 1.0, intensity: 5 },
  pan:     { startValue: 0,   endValue: 200,  intensity: 5 },
  truck:   { startValue: 0,   endValue: 100,  intensity: 5 },
  follow:  { startValue: 0,   endValue: 100,  intensity: 5 },
  none:    { startValue: 0,   endValue: 0,    intensity: 0 },
};

// ============================================================================
// Props
// ============================================================================

interface CinemaLabPanelProps {
  nodeId: string
  /** 当前摄影机配置 */
  cameraConfig?: ShotCameraConfig
  /** 镜头时长（秒），用于预览计算 */
  shotDuration?: number
  /** 更新回调 */
  onChange: (config: ShotCameraConfig | undefined) => void
}

// ============================================================================
// 子组件：参数滑条
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
  label: string
  icon?: string
  value: number
  min: number
  max: number
  step: number
  displayValue?: string
  onChange: (v: number) => void
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
// 子组件：运镜类型按钮
// ============================================================================

function CameraTypeButton({
  type,
  label,
  icon,
  desc,
  active,
  onClick,
}: {
  type: CameraCommandType
  label: string
  icon: string
  desc: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={desc}
      className="nodrag nopan flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg text-[11px] transition-all"
      style={{
        backgroundColor: active
          ? "rgba(99,102,241,0.15)"
          : "rgba(255,255,255,0.03)",
        border: `1px solid ${
          active ? DESIGN_TOKENS.accent : DESIGN_TOKENS.border
        }`,
        color: active ? DESIGN_TOKENS.accentHover : DESIGN_TOKENS.textMuted,
        minWidth: "52px",
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

export const CinemaLabPanel = memo(function CinemaLabPanel({
  nodeId: _nodeId,
  cameraConfig,
  shotDuration: _shotDuration,
  onChange,
}: CinemaLabPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedType, setSelectedType] = useState<CameraCommandType>(
    cameraConfig?.commands[0]?.type ?? "none"
  );
  const [intensity, setIntensity] = useState(
    cameraConfig?.commands[0]
      ? getIntensityFromCommand(cameraConfig.commands[0])
      : 5
  );
  const [speed, setSpeed] = useState<number>(
    cameraConfig?.commands[0]?.duration
      ? cameraConfig.commands[0].duration > 2
        ? 0.5
        : cameraConfig.commands[0].duration >= 1
          ? 1.0
          : 2.0
      : 1.0
  );
  const [easing, setEasing] = useState<"linear" | "ease-in" | "ease-out">(
    cameraConfig?.commands[0]?.easing ?? "linear"
  );
  const [enabled, setEnabled] = useState(cameraConfig?.enabled ?? false);

  // 当外部 cameraConfig 变化时同步内部状态
  useEffect(() => {
    if (cameraConfig?.commands[0]) {
      setSelectedType(cameraConfig.commands[0].type);
      setIntensity(getIntensityFromCommand(cameraConfig.commands[0]));
      setEasing(cameraConfig.commands[0].easing ?? "linear");
      setEnabled(cameraConfig.enabled);
    } else {
      setSelectedType("none");
      setIntensity(5);
      setEnabled(false);
    }
  }, [cameraConfig]);

  // 构建命令并通知父组件
  const applyConfig = useCallback(
    (params: {
      type: CameraCommandType;
      intensity: number;
      speed: number;
      easingVal: "linear" | "ease-in" | "ease-out";
      isEnabled: boolean;
    }) => {
      if (params.type === "none" || !params.isEnabled) {
        onChange(undefined);
        return;
      }

      const defaults = DEFAULT_PARAMS[params.type];
      const intensityRatio = params.intensity / 5; // 0.2 ~ 1.0

      let startValue: number | undefined;
      let endValue: number | undefined;

      switch (params.type) {
        case "push":
          startValue = 1.0;
          endValue = 1.0 + intensityRatio; // 1.0 ~ 2.0
          break;
        case "pull":
          startValue = 1.0 + intensityRatio;
          endValue = 1.0;
          break;
        case "pan":
          startValue = 0;
          endValue = Math.round(100 * intensityRatio);
          break;
        case "truck":
          startValue = 0;
          endValue = Math.round(60 * intensityRatio);
          break;
        case "follow":
          startValue = 0;
          endValue = Math.round(80 * intensityRatio);
          break;
        default:
          startValue = defaults.startValue;
          endValue = defaults.endValue;
      }

      const duration = params.speed <= 0.5 ? 3.0 : params.speed >= 2.0 ? 0.8 : 1.5;

      const cmd: CameraCommand = {
        type: params.type,
        startValue,
        endValue,
        duration,
        easing: params.easingVal,
      };

      onChange({
        commands: [cmd],
        enabled: true,
      });
    },
    [onChange]
  );

  // 类型选择
  const handleTypeSelect = useCallback(
    (type: CameraCommandType) => {
      const newType = type === selectedType ? "none" : type;
      setSelectedType(newType);
      applyConfig({
        type: newType,
        intensity,
        speed,
        easingVal: easing,
        isEnabled: newType !== "none",
      });
    },
    [selectedType, intensity, speed, easing, applyConfig]
  );

  // 滑条变化
  const handleIntensityChange = useCallback(
    (v: number) => {
      setIntensity(v);
      if (selectedType !== "none") {
        applyConfig({ type: selectedType, intensity: v, speed, easingVal: easing, isEnabled: true });
      }
    },
    [selectedType, speed, easing, applyConfig]
  );

  const handleSpeedChange = useCallback(
    (v: number) => {
      setSpeed(v);
      if (selectedType !== "none") {
        applyConfig({ type: selectedType, intensity, speed: v, easingVal: easing, isEnabled: true });
      }
    },
    [selectedType, intensity, easing, applyConfig]
  );

  const handleEasingChange = useCallback(
    (v: "linear" | "ease-in" | "ease-out") => {
      setEasing(v);
      if (selectedType !== "none") {
        applyConfig({ type: selectedType, intensity, speed, easingVal: v, isEnabled: true });
      }
    },
    [selectedType, intensity, speed, applyConfig]
  );

  const handleToggle = useCallback(() => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    if (newEnabled && selectedType !== "none") {
      applyConfig({ type: selectedType, intensity, speed, easingVal: easing, isEnabled: true });
    } else {
      onChange(undefined);
    }
  }, [enabled, selectedType, intensity, speed, easing, applyConfig, onChange]);

  const handleClear = useCallback(() => {
    setSelectedType("none");
    setIntensity(5);
    setSpeed(1.0);
    setEasing("linear");
    setEnabled(false);
    onChange(undefined);
  }, [onChange]);

  // 生成运镜摘要文字
  const commandSummary = cameraConfig?.enabled && cameraConfig.commands[0]
    ? generateSummary(cameraConfig.commands[0])
    : null;

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
          <Camera size={14} style={{ color: DESIGN_TOKENS.accent }} />
          摄影机控制
          {commandSummary && (
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{
              backgroundColor: "rgba(99,102,241,0.12)",
              color: DESIGN_TOKENS.accentHover,
            }}>
              {commandSummary}
            </span>
          )}
        </span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* 展开面板 */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* 启停开关 */}
          <div className="flex items-center justify-between">
            <span className="text-[11px]" style={{ color: DESIGN_TOKENS.textMuted }}>
              运镜开关
            </span>
            <button
              type="button"
              onClick={handleToggle}
              className="nodrag nopan flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-medium transition-colors"
              style={{
                backgroundColor: enabled ? "rgba(34,197,94,0.12)" : "rgba(148,163,184,0.1)",
                color: enabled ? "#22c55e" : DESIGN_TOKENS.textMuted,
                border: `1px solid ${enabled ? "rgba(34,197,94,0.3)" : DESIGN_TOKENS.border}`,
              }}
            >
              {enabled ? <Eye size={12} /> : <EyeOff size={12} />}
              {enabled ? "已开启" : "已关闭"}
            </button>
          </div>

          {/* 运镜类型选择 */}
          <div>
            <div className="text-[11px] mb-1.5" style={{ color: DESIGN_TOKENS.textMuted }}>
              运镜类型
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {CAMERA_TYPES.map((ct) => (
                <CameraTypeButton
                  key={ct.type}
                  type={ct.type}
                  label={ct.label}
                  icon={ct.icon}
                  desc={ct.desc}
                  active={selectedType === ct.type}
                  onClick={() => handleTypeSelect(ct.type)}
                />
              ))}
            </div>
          </div>

          {/* 当选中非 none 类型时显示参数调节 */}
          {selectedType !== "none" && (
            <>
              {/* 幅度滑条 */}
              <SliderControl
                label="幅度"
                icon="💪"
                value={intensity}
                min={1}
                max={10}
                step={1}
                displayValue={`${intensity}/10`}
                onChange={handleIntensityChange}
              />

              {/* 速度选择 */}
              <div>
                <div className="text-[11px] mb-1.5" style={{ color: DESIGN_TOKENS.textMuted }}>
                  <span className="mr-1">🏃</span>速度
                </div>
                <div className="flex gap-1">
                  {SPEED_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSpeedChange(opt.value)}
                      className="nodrag nopan flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] transition-all"
                      style={{
                        backgroundColor:
                          speed === opt.value
                            ? "rgba(99,102,241,0.15)"
                            : "rgba(255,255,255,0.03)",
                        border: `1px solid ${
                          speed === opt.value
                            ? DESIGN_TOKENS.accent
                            : DESIGN_TOKENS.border
                        }`,
                        color:
                          speed === opt.value
                            ? DESIGN_TOKENS.accentHover
                            : DESIGN_TOKENS.textMuted,
                      }}
                    >
                      <span>{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 缓动选择 */}
              <div>
                <div className="text-[11px] mb-1.5" style={{ color: DESIGN_TOKENS.textMuted }}>
                  <span className="mr-1">📈</span>曲线
                </div>
                <div className="flex gap-1">
                  {EASING_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleEasingChange(opt.value)}
                      className="nodrag nopan flex-1 px-2 py-1.5 rounded text-[10px] transition-all"
                      style={{
                        backgroundColor:
                          easing === opt.value
                            ? "rgba(99,102,241,0.15)"
                            : "rgba(255,255,255,0.03)",
                        border: `1px solid ${
                          easing === opt.value
                            ? DESIGN_TOKENS.accent
                            : DESIGN_TOKENS.border
                        }`,
                        color:
                          easing === opt.value
                            ? DESIGN_TOKENS.accentHover
                            : DESIGN_TOKENS.textMuted,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 当前配置摘要 */}
              <div
                className="rounded-lg p-2 text-[10px] space-y-0.5"
                style={{
                  backgroundColor: "rgba(99,102,241,0.06)",
                  border: `1px solid rgba(99,102,241,0.15)`,
                }}
              >
                <div className="flex items-center gap-1" style={{ color: DESIGN_TOKENS.accentHover }}>
                  <Film size={12} />
                  <span className="font-medium">当前配置</span>
                </div>
                {commandSummary && (
                  <div style={{ color: DESIGN_TOKENS.textSecondary }}>
                    {commandSummary}
                  </div>
                )}
                <div style={{ color: DESIGN_TOKENS.textMuted }}>
                  速度: {SPEED_OPTIONS.find((o) => o.value === speed)?.label ?? "中速"}
                  {" · "}幅度: {intensity}/10
                  {" · "}曲线: {EASING_OPTIONS.find((o) => o.value === easing)?.label ?? "线性"}
                </div>
              </div>
            </>
          )}

          {/* 清除按钮 */}
          {cameraConfig?.enabled && (
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
              清除运镜设置
            </button>
          )}
        </div>
      )}
    </div>
  );
});

// ============================================================================
// Helpers
// ============================================================================

function getIntensityFromCommand(cmd: CameraCommand): number {
  if (cmd.type === "none") return 5;
  const defaults = DEFAULT_PARAMS[cmd.type];
  const endVal = cmd.endValue ?? defaults.endValue;
  switch (cmd.type) {
    case "push":
    case "pull":
      return Math.round(((endVal - 1) / 1.0) * 10); // 1.0~2.0 → 0~10
    case "pan":
      return Math.round((endVal / 200) * 10);
    case "truck":
      return Math.round((endVal / 100) * 10);
    case "follow":
      return Math.round((endVal / 100) * 10);
    default:
      return 5;
  }
}

function generateSummary(cmd: CameraCommand): string {
  const typeLabel = CAMERA_TYPES.find((c) => c.type === cmd.type)?.label ?? cmd.type;
  const endVal = cmd.endValue;
  let detail = "";
  switch (cmd.type) {
    case "push":
      detail = `×${endVal?.toFixed(1) ?? "1.5"}`;
      break;
    case "pull":
      detail = `×${(cmd.startValue ?? 1.5).toFixed(1)}→1.0`;
      break;
    case "pan":
      detail = `${endVal ?? 200}px`;
      break;
    case "truck":
      detail = `${endVal ?? 100}px`;
      break;
    case "follow":
      detail = `${endVal ?? 100}px`;
      break;
    default:
      detail = "";
  }
  return `${typeLabel} ${detail}`;
}

export default CinemaLabPanel;
