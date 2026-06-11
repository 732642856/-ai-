// ============================================================================
// AudioWaveform — 音频波形可视化（基于 wavesurfer.js BSD-3）
// ============================================================================
"use client"

import { memo, useEffect, useRef, useState, useCallback } from "react"
import { Play, Pause, Volume2, Loader2 } from "lucide-react"
import { DESIGN_TOKENS } from "../../styles/designSystem"

// ============================================================================
// Types
// ============================================================================

interface AudioWaveformProps {
  audioUrl?: string
  audioBuffer?: ArrayBuffer
  height?: number
  width?: number
  color?: string
  progressColor?: string
  showControls?: boolean
  autoPlay?: boolean
  onReady?: () => void
  onPlay?: () => void
  onPause?: () => void
  onFinish?: () => void
}

// ============================================================================
// Component — Pure React (no external deps, uses Web Audio API)
// ============================================================================

export const AudioWaveform = memo(function AudioWaveform({
  audioUrl,
  audioBuffer: externalBuffer,
  height = 48,
  width = 300,
  color = DESIGN_TOKENS.accent,
  progressColor = DESIGN_TOKENS.accentHover,
  showControls = true,
  autoPlay = false,
  onReady,
  onPlay,
  onPause,
  onFinish,
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const bufferRef = useRef<AudioBuffer | null>(null)
  const startTimeRef = useRef(0)
  const pauseOffsetRef = useRef(0)
  const animFrameRef = useRef<number>(0)

  // ── Draw waveform ──
  const drawWaveform = useCallback(
    (buffer: AudioBuffer, progress: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.scale(dpr, dpr)

      ctx.clearRect(0, 0, width, height)

      const data = buffer.getChannelData(0)
      const step = Math.ceil(data.length / width)
      const amp = height / 2
      const progressX = progress * width

      for (let i = 0; i < width; i++) {
        let min = 1.0
        let max = -1.0
        for (let j = 0; j < step; j++) {
          const val = data[i * step + j]
          if (val === undefined) continue
          if (val < min) min = val
          if (val > max) max = val
        }

        const barHeight = ((max - min) * amp) / 2 || 1
        const y = amp - barHeight / 2

        ctx.fillStyle = i < progressX ? progressColor : color
        ctx.globalAlpha = i < progressX ? 0.9 : 0.5
        ctx.fillRect(i, y, 1, Math.max(barHeight, 1))
      }
      ctx.globalAlpha = 1
    },
    [width, height, color, progressColor],
  )

  // ── Load audio ──
  const loadAudio = useCallback(async () => {
    if (!audioUrl && !externalBuffer) return
    setIsLoading(true)
    setError(null)

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext()
      }

      let arrayBuffer: ArrayBuffer

      if (externalBuffer) {
        arrayBuffer = externalBuffer
      } else if (audioUrl) {
        const res = await fetch(audioUrl)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        arrayBuffer = await res.arrayBuffer()
      } else {
        throw new Error("No audio source")
      }

      const buffer = await audioContextRef.current.decodeAudioData(arrayBuffer)
      bufferRef.current = buffer
      setDuration(buffer.duration)
      drawWaveform(buffer, 0)
      onReady?.()

      if (autoPlay) playAudio()
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败")
    } finally {
      setIsLoading(false)
    }
  }, [audioUrl, externalBuffer, autoPlay, drawWaveform, onReady])

  useEffect(() => { loadAudio() }, [loadAudio])

  // ── Playback ──
  const updateProgress = useCallback(() => {
    if (!audioContextRef.current || !bufferRef.current) return
    const elapsed = audioContextRef.current.currentTime - startTimeRef.current + pauseOffsetRef.current
    const progress = Math.min(elapsed / bufferRef.current.duration, 1)
    setCurrentTime(elapsed)
    drawWaveform(bufferRef.current, progress)

    if (progress >= 1) {
      stopAudio()
      onFinish?.()
    } else {
      animFrameRef.current = requestAnimationFrame(updateProgress)
    }
  }, [drawWaveform, onFinish])

  const playAudio = useCallback(() => {
    const ctx = audioContextRef.current
    const buf = bufferRef.current
    if (!ctx || !buf) return

    if (ctx.state === "suspended") ctx.resume()

    const source = ctx.createBufferSource()
    source.buffer = buf
    source.connect(ctx.destination)
    source.start(0, pauseOffsetRef.current)
    sourceRef.current = source

    startTimeRef.current = ctx.currentTime
    setIsPlaying(true)
    onPlay?.()
    animFrameRef.current = requestAnimationFrame(updateProgress)
  }, [updateProgress, onPlay])

  const pauseAudio = useCallback(() => {
    const source = sourceRef.current
    const ctx = audioContextRef.current
    if (source && ctx) {
      source.stop()
      sourceRef.current = null
    }
    pauseOffsetRef.current += ctx ? ctx.currentTime - startTimeRef.current : 0
    cancelAnimationFrame(animFrameRef.current)
    setIsPlaying(false)
    onPause?.()
  }, [onPause])

  const stopAudio = useCallback(() => {
    const source = sourceRef.current
    if (source) {
      try { source.stop() } catch { /* already stopped */ }
      sourceRef.current = null
    }
    pauseOffsetRef.current = 0
    cancelAnimationFrame(animFrameRef.current)
    setIsPlaying(false)
    if (bufferRef.current) drawWaveform(bufferRef.current, 0)
  }, [drawWaveform])

  const togglePlay = useCallback(() => {
    if (isPlaying) pauseAudio()
    else playAudio()
  }, [isPlaying, pauseAudio, playAudio])

  // ── Format time ──
  const fmt = (t: number) => {
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    return `${m}:${String(s).padStart(2, "0")}`
  }

  return (
    <div className="flex items-center gap-2" style={{ width }}>
      {showControls && (
        <button
          onClick={togglePlay}
          disabled={isLoading || !!error}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10 disabled:opacity-30"
          style={{ color: DESIGN_TOKENS.textSecondary }}
        >
          {isLoading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : isPlaying ? (
            <Pause size={12} />
          ) : (
            <Play size={12} />
          )}
        </button>
      )}

      <div className="relative flex-1">
        {error ? (
          <div className="flex h-full items-center text-[10px]" style={{ color: "#ef4444" }}>
            ⚠ {error}
          </div>
        ) : isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 size={12} className="animate-spin" style={{ color: DESIGN_TOKENS.textMuted }} />
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            style={{ width: "100%", height }}
            className="cursor-pointer rounded"
            onClick={togglePlay}
          />
        )}
      </div>

      {duration > 0 && (
        <span className="shrink-0 text-[10px] font-mono" style={{ color: DESIGN_TOKENS.textMuted, minWidth: 48, textAlign: "right" }}>
          {fmt(currentTime)} / {fmt(duration)}
        </span>
      )}
    </div>
  )
})
