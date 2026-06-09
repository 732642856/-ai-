"use client"

// ============================================================================
// WDYR 开发模式初始化（仅开发环境加载）
// ============================================================================

if (process.env.NODE_ENV === "development") {
  // 延迟导入让 React 先完成挂载
  Promise.resolve().then(() => import("../lib/dev/whyDidYouRender"))
}

export default function WdyrInit() {
  return null  // 纯副作用组件，不渲染任何 UI
}
