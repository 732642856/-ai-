import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'

export interface ContentNodeData {
  label: string
  content: string
  status?: 'idle' | 'generating' | 'done' | 'error'
  [key: string]: unknown
}

export type ContentNode = Node<ContentNodeData, 'content'>

export function ContentNode({ data, selected }: NodeProps<ContentNode>) {
  const statusColors: Record<string, string> = {
    idle: '#3A3A4E',
    generating: '#6C5CE7',
    done: '#00C853',
    error: '#FF5252',
  }
  const borderColor = statusColors[data.status || 'idle'] || '#3A3A4E'
  const bg = '#1E1E2E'

  return (
    <div
      style={{
        background: bg,
        border: `2px solid ${selected ? '#6C5CE7' : borderColor}`,
        borderRadius: '10px',
        padding: '12px 16px',
        minWidth: '200px',
        maxWidth: '320px',
        color: '#E0E0E0',
        fontSize: '13px',
        boxShadow: selected ? '0 0 0 2px rgba(108,92,231,0.3)' : '0 2px 8px rgba(0,0,0,0.3)',
        transition: 'box-shadow 0.2s',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#6C5CE7' }} />
      <div style={{ fontWeight: 600, marginBottom: '6px', color: '#fff', fontSize: '13px' }}>
        {data.label || 'Content'}
      </div>
      <div style={{ color: '#A0A0B0', fontSize: '12px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
        {data.content || 'Empty content...'}
      </div>
      {data.status === 'generating' && (
        <div style={{ marginTop: '8px', fontSize: '11px', color: '#6C5CE7' }}>
          Generating...
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: '#6C5CE7' }} />
    </div>
  )
}

export default memo(ContentNode)
