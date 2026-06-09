"use client"

// @imgly/background-removal — 浏览器端背景移除，零服务端依赖
import { removeBackground } from "@imgly/background-removal"
import { memo, useCallback, useState, useRef } from "react"
import { Sparkles, Loader2, Download, Image } from "lucide-react"
import { DESIGN_TOKENS } from "../../styles/designSystem"

interface BackgroundRemoverPanelProps {
  imageUrl: string
  onResult: (resultUrl: string) => void
  onClose?: () => void
}

export const BackgroundRemoverPanel = memo(function BackgroundRemoverPanel({
  imageUrl,
  onResult,
  onClose,
}: BackgroundRemoverPanelProps) {
  const [processing, setProcessing] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleRemove = useCallback(async () => {
    setProcessing(true)
    setError(null)
    try {
      const blob = await removeBackground(imageUrl)
      const url = URL.createObjectURL(blob)
      setResultUrl(url)
      onResult(url)
    } catch (e: any) {
      setError(e.message || "处理失败")
    } finally {
      setProcessing(false)
    }
  }, [imageUrl, onResult])

  return (
    <div className="space-y-2 rounded-xl border p-2" style={{ borderColor: DESIGN_TOKENS.border, backgroundColor: "rgba(255,255,255,0.02)" }}>
      <div className="flex items-center gap-1 text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>
        <Sparkles size={11} />
        <span>智能换背景</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg overflow-hidden" style={{ border: "1px solid", borderColor: DESIGN_TOKENS.border }}>
          <img src={imageUrl} className="w-full h-24 object-cover" alt="原图" />
          <div className="text-[9px] text-center py-1" style={{ color: DESIGN_TOKENS.textMuted }}>原图</div>
        </div>
        <div className="rounded-lg overflow-hidden flex items-center justify-center" style={{ border: "1px solid", borderColor: DESIGN_TOKENS.border, backgroundColor: "rgba(255,255,255,0.03)", minHeight: 96 }}>
          {processing ? (
            <Loader2 size={16} className="animate-spin" style={{ color: DESIGN_TOKENS.textMuted }} />
          ) : resultUrl ? (
            <img src={resultUrl} className="w-full h-24 object-contain" alt="结果" />
          ) : (
            <Image size={20} style={{ color: DESIGN_TOKENS.textMuted }} />
          )}
          <div className="text-[9px] text-center py-1" style={{ color: DESIGN_TOKENS.textMuted }}>
            {resultUrl ? "去背景" : "预览"}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg px-2 py-1 text-[10px] text-red-300/80" style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleRemove}
          disabled={processing}
          className="nodrag flex-1 flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] transition-colors hover:bg-white/5 disabled:opacity-40"
          style={{ borderColor: DESIGN_TOKENS.accentHover, color: DESIGN_TOKENS.accentHover, backgroundColor: "rgba(99,102,241,0.06)" }}
        >
          {processing ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
          {processing ? "处理中..." : "移除背景"}
        </button>
        {resultUrl && (
          <a
            href={resultUrl}
            download="no-bg.png"
            className="nodrag flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px]"
            style={{ borderColor: DESIGN_TOKENS.border, color: DESIGN_TOKENS.textMuted }}
          >
            <Download size={11} />
            下载
          </a>
        )}
        {onClose && (
          <button onClick={onClose} className="nodrag rounded-lg border px-2 py-1.5 text-[11px]" style={{ borderColor: DESIGN_TOKENS.border, color: DESIGN_TOKENS.textMuted }}>
            关闭
          </button>
        )}
      </div>
    </div>
  )
})

export default BackgroundRemoverPanel
