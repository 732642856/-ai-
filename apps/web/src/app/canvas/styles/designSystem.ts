/**
 * StarTrails Design System - TapNow-inspired Theme
 * 统一的设计 tokens 和组件配置
 */

export const DESIGN_TOKENS = {
  // 背景色
  bg: "#05060a",
  canvasBg: "#070911",
  panel: "rgba(18, 18, 24, 0.86)",
  panelSolid: "#15151b",
  card: "rgba(255, 255, 255, 0.04)",
  cardHover: "rgba(255, 255, 255, 0.07)",
  surfaceAlt: "rgba(255, 255, 255, 0.06)",

  // 边框
  border: "rgba(255, 255, 255, 0.08)",
  borderStrong: "rgba(148, 163, 184, 0.35)",
  borderAccent: "rgba(100, 116, 139, 0.40)",

  // 文字
  text: "rgba(255, 255, 255, 0.92)",
  textPrimary: "rgba(255, 255, 255, 0.92)",
  textSecondary: "rgba(255, 255, 255, 0.62)",
  textMuted: "rgba(255, 255, 255, 0.38)",

  // 主色 - 灰色系（替代原紫色系，降低饱和度）
  accent: "#64748b",
  accentHover: "#94a3b8",
  accentSoft: "rgba(100, 116, 139, 0.18)",
  accentSoftHover: "rgba(100, 116, 139, 0.30)",

  // 圆角
  radiusPanel: "28px",
  radiusCard: "22px",
  radiusNode: "16px",
  radiusPill: "999px",
  radiusButton: "12px",

  // 阴影
  shadowPanel: "0 16px 48px rgba(0, 0, 0, 0.35)",
  shadowMenu: "0 8px 32px rgba(0, 0, 0, 0.4)",
  shadowNode: "0 4px 16px rgba(0, 0, 0, 0.25)",

  // 节点颜色 - 低饱和度灰色系
  nodeHandle: "#94a3b8",
  nodeHandleGlow: "rgba(148, 163, 184, 0.3)",
  nodeEdge: "rgba(148, 163, 184, 0.25)",

  // Z-index 层级
  zIndex: {
    canvas: 1,
    controls: 10,
    hint: 15,
    toolbar: 20,
    panel: 30,
    contextMenu: 40,
    floatingToolbar: 50,
    overlay: 60,
  },
} as const

// 图标配置
export const ICON_CONFIG = {
  size: 20,
  strokeWidth: 1.75,
  color: "rgba(255, 255, 255, 0.55)",
  colorHover: "rgba(255, 255, 255, 0.9)",
  colorActive: "#ffffff",
  colorAccent: DESIGN_TOKENS.accent,
} as const

// 动画配置
export const ANIMATION = {
  transition: "all 0.2s ease",
  transitionSlow: "all 0.3s ease",
} as const
