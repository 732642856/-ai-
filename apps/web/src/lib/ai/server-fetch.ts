// ============================================================================
// Server-side AI fetch utilities
// ============================================================================
// Centralizes timeout and proxy handling for Next.js Route Handlers.
// Node's native fetch does not automatically honor HTTPS_PROXY/HTTP_PROXY in
// all environments, so we opt into undici ProxyAgent when a proxy is configured.
// ============================================================================

import type { Dispatcher } from "undici"
import { ProxyAgent } from "undici"

type FetchInitWithDispatcher = RequestInit & {
  dispatcher?: Dispatcher
}

let cachedProxyUrl: string | undefined
let cachedDispatcher: Dispatcher | undefined

function getProxyUrl(): string | undefined {
  return (
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    process.env.ALL_PROXY ||
    process.env.all_proxy ||
    undefined
  )
}

function getProxyDispatcher(): Dispatcher | undefined {
  const proxyUrl = getProxyUrl()
  if (!proxyUrl) return undefined

  if (cachedDispatcher && cachedProxyUrl === proxyUrl) {
    return cachedDispatcher
  }

  cachedProxyUrl = proxyUrl
  cachedDispatcher = new ProxyAgent(proxyUrl)
  return cachedDispatcher
}

export function getServerFetchNetworkInfo() {
  const proxyUrl = getProxyUrl()
  return {
    proxyEnabled: Boolean(proxyUrl),
    proxyProtocol: proxyUrl ? new URL(proxyUrl).protocol.replace(":", "") : undefined,
  }
}

export async function serverFetch(
  input: string | URL | Request,
  init: RequestInit = {},
): Promise<Response> {
  const dispatcher = getProxyDispatcher()
  const nextInit: FetchInitWithDispatcher = dispatcher
    ? { ...init, dispatcher }
    : init

  return fetch(input, nextInit)
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
