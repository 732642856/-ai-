// ============================================================================
// Slash Command Types — TapNow-inspired slash command system
// ============================================================================

export type SlashCommandCategory =
  | "generation"   // AI 生成类
  | "editing"      // 文本编辑类
  | "canvas"        // 画布操作类
  | "storyboard"    // 分镜创作类
  | "asset"         // 资产管理类
  | "workflow"      // 工作流类

export interface SlashCommand {
  /** Unique command identifier, also the command text e.g. "扩写" */
  id: string
  /** Display label in the menu */
  label: string
  /** Longer description shown below the label */
  description: string
  /** Icon component name (lucide-react icon name or emoji) */
  icon: string
  /** Category for grouping in the menu */
  category: SlashCommandCategory
  /** 
   * Which AI model type this command uses.
   * - "text":  uses text model (gpt-5.5 etc.)
   * - "image": uses image model (gpt-image-2 etc.)
   * - "video": uses video model
   * - "none": no AI call (pure UI action)
   */
  modelType: "text" | "image" | "video" | "none"
  /** 
   * Minimum number of selected nodes required (0 = no selection needed).
   * For commands like "合并且节点" that need selection.
   */
  minSelection?: number
  /** 
   * Which node types this command applies to.
   * Empty = applies to all node types.
   */
  applicableNodeTypes?: string[]
  /** Whether this command triggers a high-cost AI call (shows cost warning) */
  isCostly?: boolean
  /** 
   * The prompt template sent to AI when this command is executed.
   * Use {{selection}} as placeholder for selected node content.
   * Use {{prompt}} as placeholder for user's additional input.
   */
  promptTemplate?: string
  /** The canvas-action type this command triggers (for AI action commands) */
  actionType?: string
}

/** A grouped representation for rendering the menu */
export interface SlashCommandGroup {
  category: SlashCommandCategory
  label: string
  commands: SlashCommand[]
}
