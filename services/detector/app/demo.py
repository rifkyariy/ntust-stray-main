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


import os
import threading
import time
from pathlib import Path

import cv2
from PIL import Image

from app import detector, pipeline

_VIDEO_PATH = os.getenv("DEMO_VIDEO_PATH", "../../apps/admin/public/video/dummy.mp4")
_CACHE_DIR = os.getenv("DEMO_CACHE_DIR", "./cache")
_CACHE_FILE = "dummy.detections.json"


def _video_id() -> str:
    """Fingerprint the demo video so a replaced file invalidates the cache."""
    try:
        s = os.stat(_VIDEO_PATH)
        return f"dummy.mp4:{int(s.st_mtime)}:{s.st_size}"
    except OSError:
        return "dummy.mp4"


_lock = threading.Lock()
_state: dict = {"status": "idle", "progress": 0.0, "message": ""}


def _cache_path() -> Path:
    return Path(_CACHE_DIR) / _CACHE_FILE


def _read_cache() -> dict | None:
    p = _cache_path()
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text())
    except (json.JSONDecodeError, OSError):
        return None


def _write_cache(data: dict) -> None:
    p = _cache_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(data))
    tmp.replace(p)  # atomic


def get_state() -> dict:
    """Return current state; serve cached data only if it matches the current signature."""
    with _lock:
        st = dict(_state)
    cached = _read_cache()
    if cached and st["status"] in ("idle", "ready"):
        sig = cache_signature(_video_id(), detector.get_config()["model"], _default_settings())
        if is_cache_valid(cached, sig):
            return {"status": "ready", "progress": 1.0, "data": cached}
        return {"status": "idle", "progress": 0.0, "message": ""}
    return st


def _default_settings() -> dict:
    # Fast single-pass defaults so the one-time precompute finishes in ~minutes on
    # CPU. Slicing (SAHI) is far better for small/distant cats but is ~4-5x slower
    # per frame — opt into it from the UI (Slicing toggle + Re-process) when wanted.
    return {
        "conf": 0.15, "iou": 0.45, "imgsz": 960,
        "slice": False, "smooth": True, "stride": 0.5,
    }


def _run(settings: dict) -> None:
    try:
        cap = cv2.VideoCapture(_VIDEO_PATH)
        if not cap.isOpened():
            raise FileNotFoundError(f"cannot open video: {_VIDEO_PATH}")
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
        duration = frame_count / fps if fps else 0.0
        indices = frame_indices(fps, frame_count, settings["stride"])

        model = detector._get_model()
        model_name = detector.get_config()["model"]
        pipeline.reset_tracking()

        frames_out: list[dict] = []
        is_seg = False
        for n, fi in enumerate(indices):
            cap.set(cv2.CAP_PROP_POS_FRAMES, fi)
            ok, bgr = cap.read()
            if not ok:
                continue
            rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
            img = Image.fromarray(rgb)
            dets, _ms, is_seg = pipeline.detect_frame(
                model, img,
                conf=settings["conf"], iou=settings["iou"], imgsz=settings["imgsz"],
                slice=settings["slice"], smooth=settings["smooth"],
            )
            frames_out.append({"t": round(fi / fps, 3), "detections": dets})
            with _lock:
                _state["progress"] = (n + 1) / max(1, len(indices))
        cap.release()

        data = {
            "video": "dummy.mp4",
            "hash": cache_signature(_video_id(), model_name, settings),
            "duration": round(duration, 3),
            "fps": round(fps, 3),
            "model": model_name,
            "is_segmentation": bool(is_seg),
            "settings": settings,
            "frames": frames_out,
        }
        _write_cache(data)
        with _lock:
            _state.update(status="ready", progress=1.0, message="")
    except Exception as exc:  # noqa: BLE001 - surfaced to the client
        with _lock:
            _state.update(status="error", message=str(exc))


def start_processing(settings: dict | None = None, force: bool = False) -> dict:
    """Kick off (or reuse) a precompute. Returns the immediate state."""
    settings = settings or _default_settings()
    cfg = detector.get_config()
    sig = cache_signature(_video_id(), cfg["model"], settings)

    with _lock:
        if _state["status"] == "processing":
            return dict(_state)
        cached = _read_cache()
        if cached and is_cache_valid(cached, sig) and not force:
            _state.update(status="ready", progress=1.0, message="")
            return {"status": "ready", "progress": 1.0, "data": cached}
        _state.update(status="processing", progress=0.0, message="")

    threading.Thread(target=_run, args=(settings,), daemon=True).start()
    time.sleep(0)  # yield so the thread starts
    return {"status": "processing", "progress": 0.0}


def ensure_started() -> dict:
    """Used by GET: return ready data if cached, else start processing."""
    st = get_state()
    if st["status"] == "ready":
        return st
    if st["status"] == "processing":
        return st
    return start_processing()
