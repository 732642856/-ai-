// ============================================================
// Starrail Canvas - Shared Types
// ============================================================

export interface CanvasNodeData {
  id: string
  type: string
  label: string
  content?: string
  metadata?: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

export interface CanvasEdgeData {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  actions?: CanvasAction[]
  isStreaming?: boolean
}

export interface CanvasAction {
  type: CanvasActionType
  payload: Record<string, unknown>
  status: 'pending' | 'executed' | 'failed'
  error?: string
}

export type CanvasActionType =
  | 'create_node'
  | 'update_node'
  | 'delete_node'
  | 'duplicate_node'
  | 'create_edge'
  | 'delete_edge'
  | 'create_group'
  | 'auto_layout'
  | 'generate_text'
  | 'generate_image'
  | 'generate_video'
  | 'generate_storyboard'
  | 'generate_shot_list'
  | 'generate_camera_plan'
  | 'save_as_asset'
  | 'apply_template'
  | 'summarize_selection'
  | 'synthesize_selection'
  | 'create_from_sketch'
  | 'annotate_image'
  | 'revise_image_from_annotation'
  | 'export_canvas'

export interface SlashCommand {
  id: string
  label: string
  description: string
  icon: string
  category: SlashCommandCategory
  requiresSelection?: boolean
  action: SlashCommandAction
}

export type SlashCommandCategory =
  | 'generation'
  | 'editing'
  | 'canvas'
  | 'storyboard'
  | 'asset'
  | 'workflow'

export interface SlashCommandAction {
  type: 'send_message' | 'execute_action' | 'open_panel'
  payload: Record<string, unknown>
}

export interface AgentMode {
  mode: 'ask' | 'max' | 'preview'
  label: string
  description: string
}

export const AGENT_MODES: AgentMode[] = [
  {
    mode: 'ask',
    label: 'Ask',
    description: 'Plan first, execute after confirmation',
  },
  {
    mode: 'max',
    label: 'Max',
    description: 'Auto-execute all actions',
  },
  {
    mode: 'preview',
    label: 'Preview',
    description: 'Draft nodes, confirm to land',
  },
]
