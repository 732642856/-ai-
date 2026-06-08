"use client"

import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[StarCanvas] Global render error", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    })
  }, [error])

  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, background: "#05060a", color: "rgba(255,255,255,0.92)", fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <section
            style={{
              width: "min(560px, 100%)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 28,
              background: "rgba(18,18,24,0.92)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.38)",
              padding: 28,
            }}
            data-testid="starcanvas-global-error"
          >
            <div style={{ display: "inline-flex", borderRadius: 999, padding: "6px 10px", background: "rgba(251,113,133,0.12)", color: "#fecdd3", fontSize: 12, fontWeight: 700 }}>
              StarCanvas 启动诊断
            </div>
            <h1 style={{ margin: "18px 0 8px", fontSize: 24, lineHeight: 1.2 }}>页面启动时遇到渲染错误</h1>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.62)", lineHeight: 1.7, fontSize: 14 }}>
              星轨画布没有把错误吞掉。请先点击“重试启动”；如果仍失败，在本地终端运行 <code style={{ color: "#fbbf24" }}>pnpm run health</code> 查看类型检查和构建结果。
            </p>
            <pre style={{ marginTop: 18, overflow: "auto", whiteSpace: "pre-wrap", borderRadius: 18, background: "rgba(0,0,0,0.25)", padding: 14, color: "rgba(255,255,255,0.76)", fontSize: 12, lineHeight: 1.6 }}>
              {error.message || "未知错误"}
              {error.digest ? `\nDigest: ${error.digest}` : ""}
            </pre>
            <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={reset}
                style={{ border: 0, borderRadius: 999, background: "#f59e0b", color: "#111827", padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                重试启动
              </button>
              <a
                href="/canvas"
                style={{ borderRadius: 999, border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.78)", padding: "10px 16px", fontSize: 13, textDecoration: "none" }}
              >
                回到画布
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  )
}
