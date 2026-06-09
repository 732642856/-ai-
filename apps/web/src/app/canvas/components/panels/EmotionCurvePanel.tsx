"use client"

// ============================================================================
// EmotionCurvePanel — 情绪曲线可视化面板
// 使用 recharts 渲染 StoryboardDirectorAgent 输出的 emotionalCurve
// 灰度风格，与 DESIGN_TOKENS 一致
// ============================================================================

import { memo, useMemo } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import { TrendingUp } from "lucide-react"
import { DESIGN_TOKENS } from "../../styles/designSystem"

const EMOTION_LABELS: Record<number, string> = {
  1: "平静", 2: "舒缓", 3: "期待", 4: "紧张", 5: "压迫",
  6: "恐惧", 7: "愤怒", 8: "绝望", 9: "崩溃", 10: "爆发",
}

function labelForValue(value: number): string {
  return EMOTION_LABELS[Math.round(value)] ?? `张力 ${Math.round(value)}`
}

export interface EmotionCurveDataPoint {
  sceneIndex: number
  tension: number
  label?: string
  function?: string
}

interface EmotionCurvePanelProps {
  data: EmotionCurveDataPoint[]
  title?: string
  showPeaks?: boolean
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload as EmotionCurveDataPoint
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-lg"
      style={{
        backgroundColor: "rgba(18,18,24,0.96)",
        borderColor: DESIGN_TOKENS.border,
        color: DESIGN_TOKENS.text,
      }}
    >
      <div className="font-medium mb-1" style={{ color: DESIGN_TOKENS.textMuted }}>
        场景 #{point.sceneIndex + 1}{point.label ? ` · ${point.label}` : ""}
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: DESIGN_TOKENS.accent }} />
        <span>张力：<strong>{point.tension}/10</strong></span>
        <span style={{ color: DESIGN_TOKENS.textMuted }}>（{labelForValue(point.tension)}）</span>
      </div>
      {point.function && (
        <div className="mt-1" style={{ color: DESIGN_TOKENS.textMuted }}>
          功能：{point.function}
        </div>
      )}
    </div>
  )
}

export const EmotionCurvePanel = memo(function EmotionCurvePanel({
  data,
  title = "情绪曲线",
  showPeaks = true,
}: EmotionCurvePanelProps) {
  const peaks = useMemo(() => {
    if (!showPeaks || data.length < 3) return []
    return data.reduce<number[]>((acc, d, i) => {
      if (i > 0 && i < data.length - 1 && d.tension > data[i - 1].tension && d.tension >= data[i + 1].tension) {
        acc.push(i)
      }
      return acc
    }, [])
  }, [data, showPeaks])

  const avgTension = useMemo(() => data.length ? data.reduce((s, d) => s + d.tension, 0) / data.length : 0, [data])
  const maxTension = useMemo(() => data.length ? Math.max(...data.map((d) => d.tension)) : 0, [data])

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2" style={{ color: DESIGN_TOKENS.textMuted }}>
        <TrendingUp size={32} opacity={0.3} />
        <span className="text-xs">暂无情绪曲线数据</span>
        <span className="text-[10px]">运行分镜导演后可生成情绪曲线</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs" style={{ color: DESIGN_TOKENS.text }}>
          <TrendingUp size={13} strokeWidth={1.8} style={{ color: DESIGN_TOKENS.accent }} />
          <span>{title}</span>
        </div>
        <div className="flex gap-3 text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>
          <span>平均：<strong style={{ color: DESIGN_TOKENS.accent }}>{avgTension.toFixed(1)}</strong></span>
          <span>峰值：<strong style={{ color: DESIGN_TOKENS.textSecondary }}>{maxTension}</strong></span>
          <span>场景数：<strong>{data.length}</strong></span>
        </div>
      </div>

      <div className="rounded-lg p-3" style={{ backgroundColor: DESIGN_TOKENS.card, border: `1px solid ${DESIGN_TOKENS.border}` }}>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="emotionGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={DESIGN_TOKENS.accent} stopOpacity={0.2} />
                <stop offset="100%" stopColor={DESIGN_TOKENS.accent} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="sceneIndex"
              tickFormatter={(v) => `S${v + 1}`}
              tick={{ fontSize: 10, fill: DESIGN_TOKENS.textMuted }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]}
              tick={{ fontSize: 9, fill: DESIGN_TOKENS.textMuted }}
              axisLine={false} tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            {peaks.map((idx) => (
              <ReferenceLine key={`peak-${idx}`} x={idx} stroke={DESIGN_TOKENS.textMuted} strokeOpacity={0.3} strokeDasharray="4 2" />
            ))}
            <Area
              type="monotone" dataKey="tension"
              stroke={DESIGN_TOKENS.accent} strokeWidth={2}
              fill="url(#emotionGradient)"
              activeDot={{ r: 5, stroke: DESIGN_TOKENS.accent, strokeWidth: 2, fill: DESIGN_TOKENS.panelSolid }}
              dot={(props: any) => {
                const { cx, cy, index } = props
                const isPeak = peaks.includes(index)
                return (
                  <circle
                    key={`dot-${index}`}
                    cx={cx} cy={cy}
                    r={isPeak ? 4 : 2}
                    fill={isPeak ? DESIGN_TOKENS.textSecondary : DESIGN_TOKENS.accent}
                    stroke={isPeak ? DESIGN_TOKENS.textSecondary : "none"}
                    strokeWidth={isPeak ? 1 : 0}
                  />
                )
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap gap-2 text-[9px]" style={{ color: DESIGN_TOKENS.textMuted }}>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-0.5 rounded" style={{ backgroundColor: DESIGN_TOKENS.accent }} />
          情绪张力
        </span>
        {peaks.length > 0 && (
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: DESIGN_TOKENS.textSecondary }} />
            情绪峰值 · S{peaks.map((p) => p + 1).join(", S")}
          </span>
        )}
      </div>
    </div>
  )
})

export default EmotionCurvePanel
