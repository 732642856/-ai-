// ============================================================================
// useChatSSE - Hook for Server-Sent Events streaming chat
// ============================================================================
"use client"

import { useCallback, useRef, useState } from "react"

interface UseChatSSEOptions {
  onMessage?: (content: string) => void
  onComplete?: (fullContent: string) => void
  onError?: (error: Error) => void
}

interface UseChatSSEReturn {
  sendMessage: (message: string, context?: Record<string, any>) => Promise<string>
  isStreaming: boolean
  streamingContent: string
  abort: () => void
}

export function useChatSSE(options: UseChatSSEOptions = {}): UseChatSSEReturn {
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState("")
  const abortControllerRef = useRef<AbortController | null>(null)

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsStreaming(false)
    }
  }, [])

  const sendMessage = useCallback(
    async (message: string, context?: Record<string, any>): Promise<string> => {
      // Abort any existing stream
      abort()

      setIsStreaming(true)
      setStreamingContent("")
      let fullContent = ""

      const abortController = new AbortController()
      abortControllerRef.current = abortController

      try {
        const response = await fetch("/api/ai/chat/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message,
            model: context?.model ?? "gpt-4o",
            context: { ...context },
          }),
          signal: abortController.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        if (!response.body) {
          throw new Error("Response body is null")
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            break
          }

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split("\n")

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6)

              if (data === "[DONE]") {
                break
              }

              try {
                const parsed = JSON.parse(data)

                if (parsed.content) {
                  fullContent += parsed.content
                  setStreamingContent(fullContent)
                  options.onMessage?.(parsed.content)
                }

                if (parsed.error) {
                  throw new Error(parsed.error)
                }
              } catch (e) {
                // Ignore parse errors for incomplete JSON
                console.warn("[SSE] Parse error:", e)
              }
            }
          }
        }

        setIsStreaming(false)
        options.onComplete?.(fullContent)
        return fullContent
      } catch (error: any) {
        if (error.name === "AbortError") {
          console.log("[SSE] Stream aborted")
        } else {
          console.error("[SSE] Error:", error)
          setIsStreaming(false)
          setStreamingContent("")
          options.onError?.(error)
        }
        throw error
      } finally {
        abortControllerRef.current = null
      }
    },
    [abort, options]
  )

  return {
    sendMessage,
    isStreaming,
    streamingContent,
    abort,
  }
}

export default useChatSSE
