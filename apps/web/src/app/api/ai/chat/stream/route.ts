import { NextRequest, NextResponse } from 'next/server'

// System prompt for Starrail Canvas AI
function buildSystemPrompt(): string {
  return `You are the AI assistant for Starrail Canvas, a creative AI canvas tool for storytelling, scripting, and visual creation.

You help users create content nodes, generate images, build storyboards, and organize ideas on an infinite canvas.

When the user asks you to create something, respond with clear, organized content that can be placed into canvas nodes.

AVAILABLE NODE TYPES:
- content: Text content, scripts, notes
- image: AI-generated or uploaded images
- storyboard-shot: Individual shots in a storyboard
- draw: Freehand drawing nodes

If the user types a slash command (/generate-image, /storyboard, etc.), handle it accordingly.

Be concise, creative, and helpful. The user is a creator working on visual storytelling projects.`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const message: string = body.message || ''
    const history: { role: string; content: string }[] = body.history || []

    const systemPrompt = buildSystemPrompt()

    // Build conversation context
    const contextMsgs = history.slice(-10).map((m) => ({
      role: m.role,
      content: m.content,
    }))

    // Call external AI API (OpenAI-compatible)
    const apiKey = process.env.OPENAI_API_KEY
    const apiBase = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'

    // If no API key, return a friendly mock response for development
    if (!apiKey) {
      return createMockSSEStream(message)
    }

    const aiRes = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.MODEL || 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          ...contextMsgs,
          { role: 'user', content: message },
        ],
        stream: true,
        temperature: 0.7,
      }),
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      return NextResponse.json({ error: errText }, { status: aiRes.status })
    }

    // SSE streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const reader = aiRes.body!.getReader()
        const encoder = new TextEncoder()
        const decoder = new TextDecoder()

        let buffer = ''
        function flush() {
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || trimmed === 'data: [DONE]') {
              if (trimmed === 'data: [DONE]') {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              }
              continue
            }
            if (trimmed.startsWith('data: ')) {
              const dataStr = trimmed.slice(6)
              try {
                const parsed = JSON.parse(dataStr)
                const token = parsed.choices?.[0]?.delta?.content
                if (token) {
                  const payload = JSON.stringify({ token })
                  controller.enqueue(encoder.encode(`data: ${payload}\n\n`))
                }
              } catch {
                // Skip non-JSON lines
              }
            }
          }
        }

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            flush()
          }
          // Flush remaining
          flush()
          controller.close()
        } catch (err) {
          controller.error(err)
        }
      },
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Mock SSE stream for development (no API key needed)
function createMockSSEStream(message: string): NextResponse {
  const mockResponses: Record<string, string> = {
    default: `I received your message: "${message.slice(0, 50)}...". \n\nTo get real AI responses:\n1. Set OPENAI_API_KEY in .env.local\n2. Optionally set MODEL (default: gpt-4o)\n3. Restart the dev server\n\nIn the meantime, I can still help you organize content on the canvas!`,
  }

  let responseText = mockResponses['default']

  // Simple keyword matching for demo
  if (message.toLowerCase().includes('storyboard')) {
    responseText = `Here's a basic storyboard structure for your project:\n\n**Shot 1: Wide Shot**\n- Camera: Wide angle\n- Action: Establish the scene\n- Duration: 3-5s\n\n**Shot 2: Medium Shot**\n- Camera: Medium\n- Action: Character enters frame\n- Duration: 2-4s\n\n**Shot 3: Close-Up**\n- Camera: Close-up\n- Action: Emotional beat\n- Duration: 2-3s\n\nWould you like me to generate detailed node content for each shot?`
  } else if (message.toLowerCase().includes('image') || message.includes('/generate-image')) {
    responseText = `I'd generate an image for you! To enable real image generation:\n\n1. Configure OPENAI_API_KEY (DALL-E) or\n2. Set up a Stable Diffusion / ComfyUI endpoint\n\nFor now, I can help you write detailed image prompts that you can use in Midjourney, DALL-E, or other tools.`
  } else if (message.startsWith('/')) {
    responseText = `You triggered a slash command: ${message}\n\nAvailable commands:\n- /generate-text\n- /generate-image\n- /storyboard\n- /shot-list\n- /revise-text\n- /expand\n- /summarize\n\nType / in the input to see the full command palette!`
  }

  const encoder = new TextEncoder()
  let idx = 0

  const stream = new ReadableStream({
    async start(controller) {
      while (idx < responseText.length) {
        const chunk = responseText.slice(idx, idx + 2)
        idx += 2
        const payload = JSON.stringify({ token: chunk })
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`))
        await new Promise((r) => setTimeout(r, 30))
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  })
}
