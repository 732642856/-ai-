"""
Voice Clone Engine — wraps OmniVoice HF Space for voice cloning.

Architecture:
  - Pluggable backend interface (VoiceCloneBackend)
  - OmniVoiceSpaceBackend: calls HuggingFace Space API
  - LocalCacheBackend: uses local model (placeholder for future)
  - VoiceProfileStore: in-memory + file-based profile persistence

Flow:
  1. register(): upload reference audio → extract voice embedding → store profile
  2. synthesize(): lookup profile → send clone synthesis request → return audio
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import time
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import httpx

from .models import (
    RegisterVoiceRequest,
    RegisterVoiceResponse,
    SynthesizeRequest,
    SynthesizeResponse,
    SynthesisStatus,
    VoiceCloneStatus,
    VoiceProfile,
)


# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------

@dataclass
class StoredProfile:
    """Internal representation of a stored voice profile."""
    profile_id: str
    character_id: str
    character_name: str
    status: VoiceCloneStatus
    ref_audio_path: str              # Local path to reference audio
    ref_audio_url: str               # URL on the HF Space (for synthesis)
    ref_text: Optional[str] = None
    tags: list[str] = field(default_factory=list)
    audio_duration_seconds: Optional[float] = None
    sample_rate: Optional[int] = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    error_message: Optional[str] = None

    def to_response(self) -> VoiceProfile:
        return VoiceProfile(
            profile_id=self.profile_id,
            character_id=self.character_id,
            character_name=self.character_name,
            status=self.status,
            ref_text=self.ref_text,
            tags=self.tags,
            audio_duration_seconds=self.audio_duration_seconds,
            sample_rate=self.sample_rate,
            created_at=_ts_to_iso(self.created_at),
            updated_at=_ts_to_iso(self.updated_at),
            error_message=self.error_message,
        )


def _ts_to_iso(ts: float) -> str:
    from datetime import datetime, timezone
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Backend interface
# ---------------------------------------------------------------------------

class VoiceCloneBackend(ABC):
    """Abstract backend for voice cloning."""

    @abstractmethod
    async def register_voice(
        self,
        audio_data: bytes,
        ref_text: Optional[str],
    ) -> tuple[str, float]:
        """
        Register a new voice from reference audio.

        Returns:
            (ref_audio_url_on_space, audio_duration_seconds)
        """
        ...

    @abstractmethod
    async def synthesize(
        self,
        ref_audio_url: str,
        text: str,
        speed: float,
        language: str,
    ) -> bytes:
        """Synthesize speech with a cloned voice. Returns WAV bytes."""
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if the backend is available."""
        ...


# ---------------------------------------------------------------------------
# OmniVoice HuggingFace Space backend
# ---------------------------------------------------------------------------

class OmniVoiceSpaceBackend(VoiceCloneBackend):
    """
    Calls OmniVoice HuggingFace Space for voice cloning.

    The Space exposes:
      - /call/clone  → voice cloning endpoint (upload ref audio → get voice ID)
      - /call/generate → TTS with voice ID
    """

    HF_SPACE_URL = "https://k2-fsa-omnivoice.hf.space"
    TIMEOUT = 180.0  # 3 minutes for large operations

    def __init__(self, http_client: Optional[httpx.AsyncClient] = None):
        self._client = http_client

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=self.TIMEOUT)
        return self._client

    async def health_check(self) -> bool:
        try:
            resp = await self.client.get(f"{self.HF_SPACE_URL}/")
            return resp.status_code < 500
        except Exception:
            return False

    async def register_voice(
        self,
        audio_data: bytes,
        ref_text: Optional[str],
    ) -> tuple[str, float]:
        """
        Upload reference audio to OmniVoice Space for voice cloning.

        Strategy:
          1. POST to /upload to upload the audio file
          2. Call /call/clone with the uploaded file path + ref_text
          3. Parse the result to get the cloned voice reference URL
        """
        # Step 1: Upload the reference audio file
        files = {"file": ("reference.wav", audio_data, "audio/wav")}

        upload_resp = await self.client.post(
            f"{self.HF_SPACE_URL}/upload",
            files=files,
        )
        upload_resp.raise_for_status()
        upload_result = upload_resp.json()
        file_path = upload_result[0] if isinstance(upload_result, list) else upload_result.get("path", "")

        if not file_path:
            raise RuntimeError("OmniVoice upload failed: no file path returned")

        # Step 2: Call voice clone endpoint
        # The OmniVoice typical clone API: POST /call/clone with [audio_path, ref_text, num_steps, ...]
        clone_resp = await self.client.post(
            f"{self.HF_SPACE_URL}/call/clone",
            json={
                "data": [
                    file_path,               # reference audio path
                    ref_text or "",          # reference transcription
                    100,                     # training steps (more = better quality but slower)
                    0.3,                     # learning rate
                ],
            },
        )
        clone_resp.raise_for_status()
        clone_data = clone_resp.json()
        event_id = clone_data.get("event_id")

        if not event_id:
            raise RuntimeError("OmniVoice clone: no event_id returned")

        # Step 3: Poll for result via SSE
        result = await self._poll_result(event_id, endpoint="clone")
        if not result or not result[0]:
            raise RuntimeError(f"Voice cloning failed: {result}")

        # result[0] should contain the cloned voice reference info
        # It may be a URL or a voice ID string
        voice_ref = result[0]
        if isinstance(voice_ref, dict):
            ref_url = voice_ref.get("url", voice_ref.get("path", str(voice_ref)))
        else:
            ref_url = str(voice_ref)

        if not ref_url.startswith("http"):
            ref_url = f"{self.HF_SPACE_URL}{ref_url}" if ref_url.startswith("/") else ref_url

        duration = _estimate_wav_duration(audio_data)
        return ref_url, duration

    async def synthesize(
        self,
        ref_audio_url: str,
        text: str,
        speed: float,
        language: str,
    ) -> bytes:
        """
        Synthesize speech with a previously cloned voice.

        Calls /call/generate with the clone reference as the voice source.
        """
        gen_resp = await self.client.post(
            f"{self.HF_SPACE_URL}/call/generate",
            json={
                "data": [
                    text,               # text to synthesize
                    language or "Auto", # language
                    32,                 # inference steps
                    2.0,                # guidance scale
                    True,               # denoise
                    speed,              # speed
                    None,               # duration (null = use speed)
                    True,               # preprocess prompt
                    True,               # postprocess output
                    # Voice Clone: use the reference as voice source
                    "Clone",            # gender dropdown → Clone mode
                    "Clone",            # age dropdown → Clone mode
                    "Clone",            # pitch dropdown → Clone mode
                    "Clone",            # style dropdown → Clone mode
                    "Clone",            # accent dropdown → Clone mode
                    ref_audio_url,      # clone reference audio URL
                ],
            },
        )
        gen_resp.raise_for_status()
        gen_data = gen_resp.json()
        event_id = gen_data.get("event_id")

        if not event_id:
            raise RuntimeError("TTS generate: no event_id returned")

        result = await self._poll_result(event_id)
        if not result or not result[0]:
            raise RuntimeError(f"TTS synthesis failed: {result}")

        audio_info = result[0]

        # Download audio from URL
        if isinstance(audio_info, dict) and audio_info.get("url"):
            audio_url = audio_info["url"]
            if audio_url.startswith("/"):
                audio_url = f"{self.HF_SPACE_URL}{audio_url}"

            audio_resp = await self.client.get(audio_url)
            audio_resp.raise_for_status()
            return audio_resp.content

        # Base64-encoded data
        if isinstance(audio_info, dict) and audio_info.get("data"):
            return base64.b64decode(audio_info["data"])

        raise RuntimeError(f"Unexpected audio response format: {type(audio_info)}")

    async def _poll_result(
        self,
        event_id: str,
        endpoint: str = "generate",
        max_retries: int = 60,
        interval: float = 2.0,
    ) -> Optional[list]:
        """Poll SSE endpoint for async result."""
        for _ in range(max_retries):
            resp = await self.client.get(f"{self.HF_SPACE_URL}/call/{endpoint}/{event_id}")
            resp.raise_for_status()

            text = resp.text
            # Parse SSE
            data_line = ""
            for line in text.split("\n"):
                if line.startswith("data: "):
                    data_line = line[6:]

            if data_line:
                parsed = json.loads(data_line)
                return parsed

            await _async_sleep(interval)

        return None


async def _async_sleep(seconds: float):
    import asyncio
    await asyncio.sleep(seconds)


def _estimate_wav_duration(audio_data: bytes) -> float:
    """Estimate WAV duration from data size."""
    data_size = len(audio_data) - 44
    return data_size / 48000 if data_size > 0 else 0.0


# ---------------------------------------------------------------------------
# Profile Store
# ---------------------------------------------------------------------------

class VoiceProfileStore:
    """In-memory store for voice profiles with optional file persistence."""

    def __init__(self, data_dir: str = "./voice_profiles"):
        self._profiles: dict[str, StoredProfile] = {}
        self._data_dir = Path(data_dir)
        self._data_dir.mkdir(parents=True, exist_ok=True)
        self._load_from_disk()

    def create(
        self,
        character_id: str,
        character_name: str,
        ref_audio_path: str,
        ref_audio_url: str,
        ref_text: Optional[str] = None,
        tags: Optional[list[str]] = None,
        audio_duration_seconds: Optional[float] = None,
    ) -> StoredProfile:
        profile_id = f"vp_{uuid.uuid4().hex[:12]}"
        now = time.time()
        profile = StoredProfile(
            profile_id=profile_id,
            character_id=character_id,
            character_name=character_name,
            status=VoiceCloneStatus.READY,
            ref_audio_path=ref_audio_path,
            ref_audio_url=ref_audio_url,
            ref_text=ref_text,
            tags=tags or [],
            audio_duration_seconds=audio_duration_seconds,
            created_at=now,
            updated_at=now,
        )
        self._profiles[profile_id] = profile
        self._save_to_disk()
        return profile

    def get(self, profile_id: str) -> Optional[StoredProfile]:
        return self._profiles.get(profile_id)

    def get_by_character(self, character_id: str) -> Optional[StoredProfile]:
        """Find the most recent profile for a given character."""
        matches = [
            p for p in self._profiles.values()
            if p.character_id == character_id and p.status == VoiceCloneStatus.READY
        ]
        matches.sort(key=lambda p: p.created_at, reverse=True)
        return matches[0] if matches else None

    def list_all(self) -> list[StoredProfile]:
        return list(self._profiles.values())

    def delete(self, profile_id: str) -> bool:
        profile = self._profiles.pop(profile_id, None)
        if profile:
            # Try to delete reference audio file
            try:
                os.remove(profile.ref_audio_path)
            except OSError:
                pass
            self._save_to_disk()
            return True
        return False

    def mark_failed(self, profile_id: str, error: str) -> None:
        profile = self._profiles.get(profile_id)
        if profile:
            profile.status = VoiceCloneStatus.FAILED
            profile.error_message = error
            profile.updated_at = time.time()
            self._save_to_disk()

    def _save_to_disk(self) -> None:
        index_file = self._data_dir / "profiles.json"
        data = {}
        for pid, p in self._profiles.items():
            data[pid] = {
                "profile_id": p.profile_id,
                "character_id": p.character_id,
                "character_name": p.character_name,
                "status": p.status.value,
                "ref_audio_path": p.ref_audio_path,
                "ref_audio_url": p.ref_audio_url,
                "ref_text": p.ref_text,
                "tags": p.tags,
                "audio_duration_seconds": p.audio_duration_seconds,
                "created_at": p.created_at,
                "updated_at": p.updated_at,
                "error_message": p.error_message,
            }
        index_file.write_text(json.dumps(data, indent=2, ensure_ascii=False))

    def _load_from_disk(self) -> None:
        index_file = self._data_dir / "profiles.json"
        if not index_file.exists():
            return
        try:
            data = json.loads(index_file.read_text())
            for pid, raw in data.items():
                self._profiles[pid] = StoredProfile(
                    profile_id=raw["profile_id"],
                    character_id=raw["character_id"],
                    character_name=raw["character_name"],
                    status=VoiceCloneStatus(raw["status"]),
                    ref_audio_path=raw["ref_audio_path"],
                    ref_audio_url=raw["ref_audio_url"],
                    ref_text=raw.get("ref_text"),
                    tags=raw.get("tags", []),
                    audio_duration_seconds=raw.get("audio_duration_seconds"),
                    created_at=raw["created_at"],
                    updated_at=raw["updated_at"],
                    error_message=raw.get("error_message"),
                )
        except Exception:
            pass  # Corrupt profile index, start fresh
