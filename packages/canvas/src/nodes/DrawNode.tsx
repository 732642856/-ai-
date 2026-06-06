import { memo, useRef, useEffect, useState, useCallback } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'

export interface DrawNodeData {
  label: string
  strokes?: unknown[]
  imageDataUrl?: string
  [key: string]: unknown
}

export type DrawNode = Node<DrawNodeData, 'draw'>

export function DrawNode({ data, selected }: NodeProps<DrawNode>) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (context) {
      context.lineCap = 'round'
      context.lineWidth = 2
      context.strokeStyle = '#E0E0E0'
      setCtx(context)
    }
  }, [])

  const startDraw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!ctx) return
    setIsDrawing(true)
    const rect = e.currentTarget.getBoundingClientRect()
    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
  }, [ctx])

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !ctx) return
    const rect = e.currentTarget.getBoundingClientRect()
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.stroke()
  }, [isDrawing, ctx])

  const stopDraw = useCallback(() => {
    setIsDrawing(false)
    if (!ctx) return
    ctx.closePath()
    // Save to imageDataUrl
    const canvas = canvasRef.current
    if (canvas && data) {
      const url = canvas.toDataURL('image/png')
      // Would update node data here
    }
  }, [ctx, data])

  return (
    <div
      style={{
        background: '#1E1E2E',
        border: `2px solid ${selected ? '#6C5CE7' : '#3A3A4E'}`,
        borderRadius: '10px',
        padding: '8px',
        minWidth: '240px',
        color: '#E0E0E0',
        fontSize: '12px',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#6C5CE7' }} />
      <div style={{ fontWeight: 600, marginBottom: '6px', color: '#fff', fontSize: '12px' }}>
        {data.label || 'Draw'}
      </div>
      <canvas
        ref={canvasRef}
        width={240}
        height={160}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        style={{
          background: '#0A0A1E',
          borderRadius: '6px',
          cursor: 'crosshair',
          width: '100%',
        }}
      />
      <div style={{ marginTop: '6px', fontSize: '10px', color: '#A0A0B0' }}>
        Click & drag to draw
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#6C5CE7' }} />
    </div>
  )
}

export default memo(DrawNode)
