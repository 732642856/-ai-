# ── StarCanvas Voice Clone Service ──
# Self-hosted FastAPI service for OmniVoice voice cloning.
#
# Build:  docker build -t starcanvas-voice-clone .
# Run:    docker compose up -d
# Manual: uvicorn services.voice_clone.main:app --host 0.0.0.0 --port 8765

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# ── Dependencies ──
FROM base AS deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Runtime ──
FROM base AS runtime

# Create non-root user
RUN groupadd -r voiceclone && useradd -r -g voiceclone -d /app voiceclone

COPY --from=deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin

COPY --chown=voiceclone:voiceclone . .

RUN mkdir -p /app/data/voice_clone/audio /app/data/voice_clone/profiles \
    && chown -R voiceclone:voiceclone /app/data

USER voiceclone

ENV VOICE_CLONE_DATA_DIR=/app/data/voice_clone

EXPOSE 8765

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8765/health').raise_for_status()" \
    || exit 1

CMD ["uvicorn", "services.voice_clone.main:app", "--host", "0.0.0.0", "--port", "8765"]
