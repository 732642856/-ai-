"""
Voice Clone Service — FastAPI application.

Phase 2: Self-hosted FastAPI service for OmniVoice voice cloning.

Endpoints:
  GET  /health                              → health check
  POST /api/voice-clone/register            → upload reference audio, register profile
  GET  /api/voice-clone/profiles            → list registered profiles
  GET  /api/voice-clone/profiles/{id}       → get profile detail
  DELETE /api/voice-clone/profiles/{id}     → delete profile
  POST /api/voice-clone/synthesize          → synthesize speech with cloned voice

Start:
  uvicorn services.voice_clone.main:app --host 0.0.0.0 --port 8765 --reload
"""

from __future__ import annotations

import os
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .models import (
    HealthResponse,
    RegisterVoiceRequest,
    RegisterVoiceResponse,
    SynthesizeRequest,
    SynthesizeResponse,
    SynthesizeBatchRequest,
    SynthesizeBatchResponse,
    SynthesisStatus,
    VoiceCloneStatus,
)
from .voice_engine import (
    OmniVoiceSpaceBackend,
    VoiceProfileStore,
)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

DATA_DIR = os.environ.get("VOICE_CLONE_DATA_DIR", str(
    Path(__file__).resolve().parent.parent.parent.parent.parent /
    ".data" / "voice_clone"
))
MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB

# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------

_store: VoiceProfileStore
_backend: OmniVoiceSpaceBackend
_start_time: float


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _store, _backend, _start_time
    _start_time = time.time()
    _store = VoiceProfileStore(data_dir=DATA_DIR)
    _backend = OmniVoiceSpaceBackend()
    yield
    # Cleanup
    if _backend._client:
        await _backend._client.aclose()


app = FastAPI(
    title="StarCanvas Voice Clone Service",
    description="Voice cloning and TTS for StarCanvas characters.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        version="0.1.0",
        registered_profiles=len(_store.list_all()),
        uptime_seconds=round(time.time() - _start_time, 1),
    )


# ---------------------------------------------------------------------------
# Register voice profile
# ---------------------------------------------------------------------------

@app.post("/api/voice-clone/register", response_model=RegisterVoiceResponse)
async def register_voice(
    audio: UploadFile = File(..., description="Reference audio (WAV, 16kHz mono recommended)"),
    character_id: str = Form(..., description="Character ID from Character Continuity system"),
    character_name: str = Form(..., description="Human-readable character name"),
    ref_text: Optional[str] = Form(default=None, description="Transcription of reference audio"),
    tags: Optional[str] = Form(default=None, description="Comma-separated tags"),
):
    # Validate audio
    if not audio.content_type or not audio.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be an audio file (WAV, MP3, etc.)")

    audio_data = await audio.read()
    if len(audio_data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail=f"Audio file too large (max {MAX_UPLOAD_BYTES // 1024 // 1024}MB)")

    if len(audio_data) < 1024:
        raise HTTPException(status_code=400, detail="Audio file too small (min 1KB)")

    # Save reference audio to disk
    audio_dir = Path(DATA_DIR) / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    audio_path = audio_dir / f"{uuid.uuid4().hex}.wav"
    audio_path.write_bytes(audio_data)

    # Parse tags
    tag_list = [t.strip() for t in (tags or "").split(",") if t.strip()]

    # Create a REGISTERING profile first so we can mark it failed if needed
    profile = _store.create(
        character_id=character_id,
        character_name=character_name,
        ref_audio_path=str(audio_path),
        ref_audio_url="",  # will be updated after backend registration
        ref_text=ref_text,
        tags=tag_list,
        audio_duration_seconds=None,
    )
    # Temporarily mark as registering
    profile.status = VoiceCloneStatus.REGISTERING
    _store._save_to_disk()

    # Register via backend
    try:
        ref_audio_url, duration = await _backend.register_voice(audio_data, ref_text)

        profile.ref_audio_url = ref_audio_url
        profile.audio_duration_seconds = duration
        profile.status = VoiceCloneStatus.READY
        profile.updated_at = time.time()
        _store._save_to_disk()

        return RegisterVoiceResponse(
            profile_id=profile.profile_id,
            status=VoiceCloneStatus.READY,
            message=f"Voice profile registered for {character_name} ({profile.profile_id})",
        )
    except Exception as e:
        _store.mark_failed(profile.profile_id, error=str(e))
        raise HTTPException(status_code=500, detail=f"Voice cloning failed: {str(e)}")


# ---------------------------------------------------------------------------
# Profile management
# ---------------------------------------------------------------------------

@app.get("/api/voice-clone/profiles")
async def list_profiles(
    character_id: Optional[str] = Query(default=None),
):
    profiles = _store.list_all()
    if character_id:
        profiles = [p for p in profiles if p.character_id == character_id]
    return [p.to_response() for p in profiles]


@app.get("/api/voice-clone/profiles/{profile_id}")
async def get_profile(profile_id: str):
    profile = _store.get(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile.to_response()


@app.delete("/api/voice-clone/profiles/{profile_id}")
async def delete_profile(profile_id: str):
    deleted = _store.delete(profile_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"status": "deleted", "profile_id": profile_id}


# ---------------------------------------------------------------------------
# Synthesize
# ---------------------------------------------------------------------------

@app.post("/api/voice-clone/synthesize", response_model=SynthesizeResponse)
async def synthesize(req: SynthesizeRequest):
    profile = _store.get(req.profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Profile {req.profile_id} not found")

    if profile.status != VoiceCloneStatus.READY:
        raise HTTPException(
            status_code=409,
            detail=f"Profile not ready (status: {profile.status.value})",
        )

    job_id = f"job_{uuid.uuid4().hex[:12]}"

    try:
        audio_bytes = await _backend.synthesize(
            ref_audio_url=profile.ref_audio_url,
            text=req.text,
            speed=req.speed,
            language=req.language,
        )

        import base64
        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
        duration = max(len(audio_bytes) - 44, 0) / 48000

        return SynthesizeResponse(
            job_id=job_id,
            profile_id=req.profile_id,
            status=SynthesisStatus.DONE,
            text=req.text,
            audio_base64=audio_b64,
            audio_mime="audio/wav",
            duration_seconds=round(duration, 2),
        )
    except Exception as e:
        return SynthesizeResponse(
            job_id=job_id,
            profile_id=req.profile_id,
            status=SynthesisStatus.FAILED,
            text=req.text,
            error_message=str(e),
        )


@app.post("/api/voice-clone/synthesize/batch", response_model=SynthesizeBatchResponse)
async def synthesize_batch(req: SynthesizeBatchRequest):
    profile = _store.get(req.profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Profile {req.profile_id} not found")

    batch_id = f"batch_{uuid.uuid4().hex[:12]}"
    jobs: list[SynthesizeResponse] = []

    for line_req in req.lines:
        job_id = f"job_{uuid.uuid4().hex[:12]}"
        try:
            audio_bytes = await _backend.synthesize(
                ref_audio_url=profile.ref_audio_url,
                text=line_req.text,
                speed=line_req.speed,
                language=line_req.language,
            )
            import base64
            audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
            duration = max(len(audio_bytes) - 44, 0) / 48000

            jobs.append(SynthesizeResponse(
                job_id=job_id,
                profile_id=req.profile_id,
                status=SynthesisStatus.DONE,
                text=line_req.text,
                audio_base64=audio_b64,
                audio_mime="audio/wav",
                duration_seconds=round(duration, 2),
            ))
        except Exception as e:
            jobs.append(SynthesizeResponse(
                job_id=job_id,
                profile_id=req.profile_id,
                status=SynthesisStatus.FAILED,
                text=line_req.text,
                error_message=str(e),
            ))

    return SynthesizeBatchResponse(
        batch_id=batch_id,
        profile_id=req.profile_id,
        jobs=jobs,
    )


# ---------------------------------------------------------------------------
# Main entry
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8765)
