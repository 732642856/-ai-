// ============================================================================
// Agents Module — Film Crew Multi-Agent System
// 基于 Mastra (Apache 2.0) 架构设计 + DEV PLAN.md 7 Agent 角色
// ============================================================================

export {
  FILM_CREW_ROLES,
  AGENT_SYSTEM_PROMPTS,
  OPERATION_MODE_LABELS,
  determineCrewPlan,
  buildCrewContext,
} from "./film-crew-agents"

export { orchestrateCrew, runFilmCrewPipeline } from "./orchestrator"

export type {
  FilmCrewRoleId,
  AgentActionType,
  AgentAction,
  AgentOperationMode,
  AgentContext,
  CrewAgentStatus,
  CrewExecutionResult,
} from "./film-crew-agents"

export type {
  AgentProgressCallback,
  CrewOrchestratorOptions,
} from "./orchestrator"
