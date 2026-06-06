import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'

export interface StoryboardShotData {
  label: string
  shotNumber?: number
  description?: string
  cameraAngle?: string
  duration?: string
  imageUrl?: string
  status?: 'idle' | 'generating' | 'done'
  [key: string]: unknown
}

export type StoryboardShotNode = Node<StoryboardShotData, 'storyboard-shot'>

export function StoryboardShotNode({ data, selected }: NodeProps<StoryboardShotNode>) {
  return (
    <div
      style={{
        background: '#1A1A2E',
        border: `2px solid ${selected ? '#6C5CE7' : '#2A2A4E'}`,
        borderRadius: '10px',
        padding: '10px',
        minWidth: '220px',
        maxWidth: '280px',
        color: '#E0E0E0',
        fontSize: '12px',
        boxShadow: selected ? '0 0 0 2px rgba(108,92,231,0.3)' : '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#6C5CE7' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontWeight: 600, color: '#fff', fontSize: '12px' }}>
          Shot {data.shotNumber || '?'}
        </span>
        <span style={{ color: '#6C5CE7', fontSize: '10px', background: 'rgba(108,92,231,0.15)', padding: '2px 6px', borderRadius: '4px' }}>
          {data.cameraAngle || 'Medium'}
        </span>
      </div>
      <div style={{ color: '#A0A0B0', fontSize: '11px', lineHeight: 1.4, marginBottom: '6px' }}>
        {data.description || 'No description...'}
      </div>
      {data.imageUrl && (
        <img
          src={data.imageUrl}
          alt="shot"
          style={{ width: '100%', borderRadius: '6px', maxHeight: '140px', objectFit: 'cover' }}
        />
      )}
      {data.duration && (
        <div style={{ marginTop: '6px', fontSize: '10px', color: '#A0A0B0' }}>
          Duration: {data.duration}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: '#6C5CE7' }} />
    </div>
  )
}

export default memo(StoryboardShotNode)
