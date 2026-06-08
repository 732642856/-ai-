// ============================================================================
// lib/ai — Unified AI Provider Module (P2-5A)
// ============================================================================

export {
  getAiProviderConfig,
  getAiProviderConfigSafe,
  type AiProviderConfig,
  type AiProviderType,
} from "./provider-config"

export {
  normalizeUpstreamError,
  normalizeClientError,
  type NormalizedAiError,
} from "./errors"

export {
  callAiChat,
  checkAiHealth,
  getAiConfig,
  getDefaultModel,
  getDefaultImageModel,
  getVideoModel,
  type AiChatMessage,
  type AiChatRequest,
  type AiChatResponse,
  type AiHealthResponse,
} from "./client"
