import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'

export interface ImageNodeData {
  label: string
  imageUrl?: string
  prompt?: string
  status?: 'idle' | 'generating' | 'done' | 'error'
  [key: string]: unknown
}

export type ImageNode = Node<ImageNodeData, 'image'>

export function ImageNode({ data, selected }: NodeProps<ImageNode>) {
  return (
    <div
      style={{
        background: '#1E1E2E',
        border: `2px solid ${selected ? '#6C5CE7' : '#3A3A4E'}`,
        borderRadius: '10px',
        padding: '8px',
        minWidth: '180px',
        color: '#E0E0E0',
        fontSize: '12px',
        boxShadow: selected ? '0 0 0 2px rgba(108,92,231,0.3)' : '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#6C5CE7' }} />
      <div style={{ fontWeight: 600, marginBottom: '6px', color: '#fff', fontSize: '12px' }}>
        {data.label || 'Image'}
      </div>
      {data.imageUrl ? (
        <img
          src={data.imageUrl}
          alt={data.label || 'generated'}
          style={{ width: '100%', borderRadius: '6px', maxHeight: '200px', objectFit: 'cover' }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '120px',
            background: '#2A2A3E',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#A0A0B0',
            fontSize: '11px',
          }}
        >
          {data.status === 'generating' ? 'Generating...' : 'No image'}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: '#6C5CE7' }} />
    </div>
  )
}

export default memo(ImageNode)
