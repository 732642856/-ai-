// ============================================================================
// Server-side AI fetch utilities
// ============================================================================
// Centralizes timeout and proxy handling for Next.js Route Handlers.
// Strategy: set global dispatcher for undici-based fetch when a proxy is
// configured, and ensure NO_PROXY is respected. For the AI API host that
// needs the proxy but where undici dispatcher causes compatibility issues,
// we use a direct HTTPS request via the proxy as a tunnel.
// ============================================================================

export function getServerFetchNetworkInfo() {
  const proxyUrl =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy
  return {
    proxyEnabled: Boolean(proxyUrl),
    proxyProtocol: proxyUrl ? new URL(proxyUrl).protocol.replace(":", "") : undefined,
  }
}

/**
 * Server-side fetch with timeout.
 * For the AI API endpoint, we use the proxy by setting the global dispatcher.
 * This is configured once at startup.
 */
export async function serverFetch(
  input: string | URL | Request,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(input, init)
}

export async function fetchWithTimeout(
  input: string | URL | Request,
  init: RequestInit = {},
  timeoutMs = 120_000,
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await serverFetch(input, {
      ...init,
      signal: init.signal ?? controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

// ============================================================================
// Initialize global proxy dispatcher (undici) at module load time
// ============================================================================
// This ensures all server-side fetch calls go through the proxy when configured.
// We must do this before any fetch() calls are made.
(async () => {
  const proxyUrl =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy

  if (proxyUrl) {
    try {
      const { setGlobalDispatcher, ProxyAgent } = await import("undici")
      setGlobalDispatcher(new ProxyAgent(proxyUrl))
    } catch (e) {
      console.warn("[server-fetch] Failed to set global proxy dispatcher:", e)
    }
  }
})()
