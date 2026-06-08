"""
Voice Clone Service — Pydantic models.

Phase 2: Self-hosted FastAPI service for OmniVoice voice cloning.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class VoiceCloneStatus(str, Enum):
    """Status of a voice clone profile."""
    REGISTERING = "registering"   # Uploading & extracting embedding
    READY = "ready"                # Ready for synthesis
    FAILED = "failed"             # Extraction failed
    EXPIRED = "expired"           # TTL expired


class SynthesisStatus(str, Enum):
    """Status of a synthesis job."""
    QUEUED = "queued"
    PROCESSING = "processing"
    DONE = "done"
    FAILED = "failed"


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class RegisterVoiceRequest(BaseModel):
    """Register a new voice profile from reference audio."""
    character_id: str = Field(
        ...,
        description="Character identifier from the Character Continuity system.",
        examples=["char-xiaomei-001"],
    )
    character_name: str = Field(
        ...,
        description="Human-readable character name for display.",
        examples=["小梅"],
    )
    ref_text: Optional[str] = Field(
        default=None,
        description="Transcription of the reference audio (improves clone quality).",
        examples=["你好，我是小梅，很高兴认识你。"],
    )
    tags: list[str] = Field(
        default_factory=list,
        description="Optional tags for filtering (e.g. ['female', 'young', 'warm']).",
    )


class SynthesizeRequest(BaseModel):
    """Synthesize speech with a cloned voice."""
    profile_id: str = Field(
        ...,
        description="Registered voice profile ID.",
    )
    text: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Text to synthesize.",
    )
    speed: float = Field(
        default=1.0,
        ge=0.5,
        le=2.0,
        description="Speed multiplier.",
    )
    language: str = Field(
        default="Auto",
        description="Language code or 'Auto'.",
    )


class SynthesizeBatchRequest(BaseModel):
    """Batch synthesis for multiple lines (e.g. all lines of one character)."""
    profile_id: str
    lines: list[SynthesizeRequest] = Field(..., min_length=1, max_length=50)


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class VoiceProfile(BaseModel):
    """A registered voice clone profile."""
    profile_id: str
    character_id: str
    character_name: str
    status: VoiceCloneStatus
    ref_text: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    audio_duration_seconds: Optional[float] = None
    sample_rate: Optional[int] = None
    created_at: str
    updated_at: str
    error_message: Optional[str] = None


class RegisterVoiceResponse(BaseModel):
    """Response after uploading reference audio."""
    profile_id: str
    status: VoiceCloneStatus
    message: str


class SynthesizeResponse(BaseModel):
    """Response for a single synthesis job."""
    job_id: str
    profile_id: str
    status: SynthesisStatus
    text: str
    # When done: audio as base64
    audio_base64: Optional[str] = None
    audio_mime: Optional[str] = None
    duration_seconds: Optional[float] = None
    error_message: Optional[str] = None


class SynthesizeBatchResponse(BaseModel):
    """Response for a batch synthesis job."""
    batch_id: str
    profile_id: str
    jobs: list[SynthesizeResponse]


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "ok"
    version: str = "0.1.0"
    registered_profiles: int = 0
    uptime_seconds: float = 0
