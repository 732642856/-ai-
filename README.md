# Starrail Canvas (星轨画布)

AI-Native Creative Canvas for storytelling, scripting, and visual creation.

## Features

- Infinite canvas with React Flow
- AI Assistant with SSE streaming chat
- Slash commands (`/` palette)
- Node types: Content, Image, Storyboard Shot, Draw
- Agent modes: Ask / Max / Preview
- TapNow-grade multi-model AI support (planned)

## Open Source References

This project builds upon these open-source projects:

| Project | License | Usage |
|---------|----------|-------|
| [Tapnow Studio](https://github.com/OrangeBorning/tapnow-studio--) | GPLv3 | Reference for node system & AI workflow design |
| [OpenWrite](https://github.com/ilrein/openwrite) | AGPLv3 | Story Canvas narrative structure design |
| [tldraw](https://github.com/tldraw) | MIT | Hand-drawing canvas (planned) |
| [React Flow](https://reactflow.dev) | MIT | Node-based canvas engine |

## Quick Start

```bash
# Install pnpm
npm install -g pnpm

# Install dependencies
pnpm install

# Set up environment
cp apps/web/.env.example apps/web/.env.local
# Edit .env.local and add your OPENAI_API_KEY

# Start dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
starcanvas/
├─ packages/
│   ├─ shared/        # Shared types & utilities
│   └─ canvas/        # Core canvas engine & nodes
└─ apps/
    └─ web/           # Next.js frontend
```

## License

MIT
