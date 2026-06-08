"use client"

import { useEffect } from "react"

export default function CanvasError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[StarCanvas] Canvas render error", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    })
  }, [error])

  return (
    <main className="flex min-h-screen items-center justify-center px-6" style={{ background: "#05060a", color: "rgba(255,255,255,0.92)" }}>
      <section
        className="w-full max-w-xl rounded-[28px] border p-7 shadow-2xl"
        style={{ background: "rgba(18,18,24,0.92)", borderColor: "rgba(255,255,255,0.1)", boxShadow: "0 24px 80px rgba(0,0,0,0.38)" }}
        data-testid="starcanvas-canvas-error"
      >
        <div className="inline-flex rounded-full px-3 py-1 text-xs font-bold" style={{ background: "rgba(251,113,133,0.12)", color: "#fecdd3" }}>
          Canvas Error Boundary
        </div>
        <h1 className="mt-5 text-2xl font-semibold">画布启动失败，但诊断页已接管</h1>
        <p className="mt-3 text-sm leading-7" style={{ color: "rgba(255,255,255,0.62)" }}>
          这通常来自依赖缺失、组件渲染异常、浏览器缓存状态损坏或 Next dev lock。请先重试；仍失败时运行健康检查脚本。
        </p>
        <pre className="mt-5 max-h-52 overflow-auto whitespace-pre-wrap rounded-2xl p-4 text-xs leading-6" style={{ background: "rgba(0,0,0,0.25)", color: "rgba(255,255,255,0.76)" }}>
          {error.message || "未知错误"}
          {error.digest ? `\nDigest: ${error.digest}` : ""}
        </pre>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-full px-4 py-2 text-sm font-bold"
            style={{ background: "#f59e0b", color: "#111827" }}
          >
            重试画布
          </button>
          <a
            href="/"
            className="rounded-full border px-4 py-2 text-sm no-underline"
            style={{ borderColor: "rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.78)" }}
          >
            返回首页
          </a>
        </div>
      </section>
    </main>
  )
}
