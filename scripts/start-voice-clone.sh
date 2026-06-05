#!/usr/bin/env bash
# ── StarCanvas Voice Clone — One-command startup ──
# Usage:
#   ./scripts/start-voice-clone.sh          → start
#   ./scripts/start-voice-clone.sh --build  → rebuild and start
#   ./scripts/start-voice-clone.sh --stop   → stop
#   ./scripts/start-voice-clone.sh --logs   → follow logs
#   ./scripts/start-voice-clone.sh --status → show status
#
# Requirements: docker, docker compose

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# ── Ensure .env exists ──
ENV_FILE="apps/web/src/services/voice_clone/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "📋 Creating .env from .env.example..."
  cp "$ENV_FILE.example" "$ENV_FILE"
  echo "✅ Created $ENV_FILE (edit if needed)"
fi

# ── Handle commands ──
case "${1:-}" in
  --stop)
    echo "🛑 Stopping Voice Clone service..."
    docker compose down
    echo "✅ Stopped"
    ;;
  --logs)
    echo "📋 Following Voice Clone logs..."
    docker compose logs -f voice-clone
    ;;
  --status)
    echo "📊 Voice Clone service status:"
    docker compose ps voice-clone 2>/dev/null || echo "  (not running)"
    if command -v curl &>/dev/null; then
      echo ""
      echo "📡 Health check:"
      curl -sf http://localhost:8765/health 2>/dev/null | python3 -m json.tool 2>/dev/null \
        || echo "  ❌ Service not reachable on port 8765"
    fi
    ;;
  --build)
    echo "🔨 Rebuilding and starting Voice Clone service..."
    docker compose up -d --build voice-clone
    echo ""
    echo "✅ Voice Clone service rebuilding..."
    echo "   Check logs:   ./scripts/start-voice-clone.sh --logs"
    echo "   Health check: curl http://localhost:8765/health"
    ;;
  *)
    echo "🚀 Starting Voice Clone service..."
    docker compose up -d voice-clone
    echo ""
    echo "✅ Voice Clone service starting on http://localhost:8765"
    echo ""
    echo "🔗 Endpoints:"
    echo "   Health:     GET  http://localhost:8765/health"
    echo "   Profiles:   GET  http://localhost:8765/api/voice-clone/profiles"
    echo "   Register:   POST http://localhost:8765/api/voice-clone/register"
    echo "   Synthesize: POST http://localhost:8765/api/voice-clone/synthesize"
    echo ""
    echo "📋 Commands:"
    echo "   Logs:   ./scripts/start-voice-clone.sh --logs"
    echo "   Status: ./scripts/start-voice-clone.sh --status"
    echo "   Stop:   ./scripts/start-voice-clone.sh --stop"
    echo "   Rebuild: ./scripts/start-voice-clone.sh --build"
    ;;
esac
