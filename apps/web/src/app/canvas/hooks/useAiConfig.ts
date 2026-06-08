// ============================================================================
// useAiConfig - AI model configuration hook
// ============================================================================
// Fetches and caches the AI provider configuration from /api/ai/config.
// Uses a module-level singleton to avoid redundant fetches across components.
// ============================================================================

"use client"

import { useState, useCallback } from "react"

// ============================================================================
// Types
// ============================================================================

export interface AiConfig {
  /** Default text generation model (e.g. "gpt-5.5") */
  defaultModel?: string
  /** Default image generation model (e.g. "gpt-image-2") */
  defaultImageModel?: string
  /** Video generation model */
  videoModel?: string
  /** Request timeout in ms */
  timeoutMs?: number
  /** Base URL for the AI provider API */
  baseUrl?: string
  /** Whether the API key is configured */
  hasApiKey?: boolean
  /** Provider name */
  provider?: string
  /** Any extra fields from the config endpoint */
  [key: string]: unknown
}

export interface AiConfigResult {
  /** Current AI config (null while loading) */
  config: AiConfig | null
  /** Whether the config is being fetched */
  isLoading: boolean
  /** Error message if fetch failed */
  error: string | null
  /** Force re-fetch the config */
  refetch: () => Promise<void>
}

// ============================================================================
// Singleton cache
// ============================================================================

let _cachedConfig: AiConfig | null = null
let _cacheTimestamp = 0
const CACHE_TTL = 60_000 // 1 minute

async function fetchConfig(): Promise<AiConfig> {
  const now = Date.now()
  if (_cachedConfig && now - _cacheTimestamp < CACHE_TTL) {
    return _cachedConfig
  }

  const res = await fetch("/api/ai/config")
  if (!res.ok) {
    throw new Error(`Failed to fetch AI config: ${res.status}`)
  }

  const data: AiConfig = await res.json()
  _cachedConfig = data
  _cacheTimestamp = now
  return data
}

// ============================================================================
// Hook
// ============================================================================

export function useAiConfig(): AiConfigResult {
  const [config, setConfig] = useState<AiConfig | null>(() => _cachedConfig)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchConfig()
      setConfig(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { config, isLoading, error, refetch }
}
