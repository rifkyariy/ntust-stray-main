"""
One-time offline precompute of demo-video detections, cached as JSON.
Pure helpers (frame_indices, cache_signature, is_cache_valid) are unit-tested;
the OpenCV worker + state machine are verified via the live service.
"""
from __future__ import annotations

import hashlib
import json


def frame_indices(fps: float, frame_count: int, stride: float) -> list[int]:
    """Frame indices sampled every `stride` seconds across the video."""
    if fps <= 0 or frame_count <= 0:
        return []
    step = max(1, round(stride * fps))
    return list(range(0, frame_count, step))


def cache_signature(video_id: str, model: str, settings: dict) -> str:
    """Stable hash of inputs that affect the output; order-independent over settings."""
    payload = json.dumps(
        {"video": video_id, "model": model, "settings": settings},
        sort_keys=True, separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode()).hexdigest()[:16]


def is_cache_valid(cached: dict, signature: str) -> bool:
    return bool(cached) and cached.get("hash") == signature
