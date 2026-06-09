#!/usr/bin/env bash
# ── StarCanvas Voice — One-command startup ──
# Supports: OmniVoice (self-hosted Docker) + VoxCPM2 (cloud GPU via vLLM-Omni)
#
# Usage:
#   ./scripts/start-voice-clone.sh                          → start OmniVoice (Docker)
#   ./scripts/start-voice-clone.sh --voxcpm                 → print VoxCPM2 config guide
#   ./scripts/start-voice-clone.sh --build                  → rebuild and start
#   ./scripts/start-voice-clone.sh --stop                   → stop
#   ./scripts/start-voice-clone.sh --logs                   → follow logs
#   ./scripts/start-voice-clone.sh --status                 → show status
#
# Requirements (OmniVoice): docker, docker compose
# Requirements (VoxCPM2):   NVIDIA GPU ≥8GB VRAM, CUDA 12+, Python ≥3.10

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
    echo ""
    echo "📡 VoxCPM2 status:"
    VOXCPM_URL="${VOXCPM_BASE_URL:-http://localhost:8000}/v1/audio/speech"
    if curl -sf -o /dev/null "$VOXCPM_URL" 2>/dev/null; then
      echo "  ✅ VoxCPM2 reachable at $VOXCPM_URL"
    else
      echo "  ⚪ VoxCPM2 not detected (set VOXCPM_BASE_URL env if running on cloud GPU)"
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
  --voxcpm)
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  VoxCPM2 — Cloud GPU TTS Quick Start"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "1. Rent a GPU instance (AutoDL / RunPod / any Linux with RTX 4090)"
    echo ""
    echo "2. On the instance, run:"
    echo "   pip install vllm"
    echo "   git clone https://github.com/vllm-project/vllm-omni.git"
    echo "   cd vllm-omni && pip install -e ."
    echo "   vllm serve openbmb/VoxCPM2 --omni --port 8000"
    echo ""
    echo "3. In StarCanvas .env.local, add:"
    echo "   VOXCPM_BASE_URL=http://<INSTANCE_IP>:8000"
    echo ""
    echo "4. The VoicePanel will auto-detect VoxCPM2 and use it"
    echo ""
    echo "   cost: ~¥2-3/hour (RTX 4090 on AutoDL)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
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
    echo "   Logs:    ./scripts/start-voice-clone.sh --logs"
    echo "   Status:  ./scripts/start-voice-clone.sh --status"
    echo "   VoxCPM:  ./scripts/start-voice-clone.sh --voxcpm"
    echo "   Stop:    ./scripts/start-voice-clone.sh --stop"
    echo "   Rebuild: ./scripts/start-voice-clone.sh --build"
    ;;
esac
