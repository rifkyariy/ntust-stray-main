# Supervision Detection-Quality Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Process the demo video `dummy.mp4` once at high quality (SAHI slicing + ByteTrack + temporal smoothing), cache the chronological detections as JSON, and replay them forever in the browser with zero inference — while upgrading the live ESP-Cam `/detect` path onto the same supervision pipeline.

**Architecture:** A single supervision-based pipeline (`predict`/`InferenceSlicer` → class-agnostic NMS → `sv.ByteTrack` → `sv.DetectionsSmoother` → normalize) is shared by (a) an offline OpenCV frame-stepping precompute that writes `detections.json`, and (b) the existing live `/detect` endpoint. The admin stream page becomes replay-only for the demo source: it fetches the cached JSON, loops the video, and overlays stored boxes; the ESP-Cam source keeps live detection.

**Tech Stack:** Python 3.12, FastAPI, Ultralytics YOLO, Roboflow `supervision`, OpenCV, PyTorch (CPU); Next.js (React) admin app; Docker Compose.

---

## Conventions used in this plan

**Repo root:** `/Users/mit/Documents/Projects/Webapp/ntust-stray-main` (a git repo; current branch `feat/supervision-detection-quality`). All paths below are relative to this root.

**Test-run command** (used by every backend test step). The detector image already
contains `supervision`, `numpy`, `opencv`, `torch`, etc. We mount the detector source
over `/test`, add `pytest`, and run from there so `import app.*` resolves:

```bash
docker compose -f docker-compose.dev.yml build detector
docker compose -f docker-compose.dev.yml run --rm --no-deps \
  -v "$PWD/services/detector:/test" -w /test detector \
  sh -c "pip install -q pytest httpx && pytest tests/ -v"
```

To run a single test: append `tests/path::test_name` to the `pytest` invocation.

**Live detector** for curl/browser verification:
```bash
docker compose -f docker-compose.dev.yml up -d detector   # serves on http://localhost:8001
```

**Frontend** has no automated test harness; its tasks are verified manually in the browser
at http://localhost:3007/stream (admin) — run `pnpm --filter @stray/admin dev` or
`docker compose up -d admin`.

---

## File structure

**Backend — `services/detector/`:**
- `requirements.txt` — *modify*: add `supervision`.
- `requirements-dev.txt` — *create*: `pytest`, `httpx` (test-only).
- `app/pipeline.py` — *create*: the unified supervision detection pipeline + pure
  normalization/mask helpers + tracker/smoother singletons + `reset_tracking()`.
- `app/detector.py` — *modify*: delegate `run_detection()` to `pipeline.detect_frame`;
  keep model/config singletons; reset tracking on model switch.
- `app/demo.py` — *create*: OpenCV frame-stepping precompute, background worker, state
  machine, JSON cache (pure helpers: `frame_indices`, `cache_signature`, `is_cache_valid`).
- `app/main.py` — *modify*: add `slice`/`smooth` to `/detect`; add `/tracker/reset`,
  `GET /demo/detections`, `POST /demo/process`; report new fields in `/config`.
- `tests/` — *create*: `tests/__init__.py`, `tests/test_pipeline.py`,
  `tests/test_demo.py`, `tests/test_demo_endpoints.py`.

**Infra:**
- `docker-compose.yml` — *modify*: mount video (ro) + cache (rw) into `detector`, add
  `DEMO_VIDEO_PATH` / `DEMO_CACHE_DIR` env.
- `docker-compose.dev.yml` — *modify*: same mounts/env for dev.

**Frontend — `apps/admin/app/(dashboard)/stream/`:**
- `StreamClient.tsx` — *modify*: demo source becomes replay-only (fetch JSON + poll +
  loop overlay), remove the 3-pass browser scan, add slice/smooth toggles + Re-process
  button; ESP-Cam path passes `slice`/`smooth` and calls `/tracker/reset`.

---

## Task 1: Add `supervision` dependency

**Files:**
- Modify: `services/detector/requirements.txt`
- Create: `services/detector/requirements-dev.txt`

- [ ] **Step 1: Add supervision to requirements.txt**

Append this line to `services/detector/requirements.txt` (keep existing lines):

```
supervision>=0.25,<0.27
```

- [ ] **Step 2: Create requirements-dev.txt**

Create `services/detector/requirements-dev.txt`:

```
pytest>=8.0
httpx>=0.27
```

- [ ] **Step 3: Rebuild the detector image and verify supervision imports**

Run:
```bash
docker compose -f docker-compose.dev.yml build detector
docker compose -f docker-compose.dev.yml run --rm --no-deps detector \
  python -c "import supervision as sv; print('supervision', sv.__version__)"
```
Expected: prints a version `0.25.x`/`0.26.x` with no import error. If the resolver fails
on `numpy<2`, narrow the pin (e.g. `supervision==0.25.1`) and rebuild.

- [ ] **Step 4: Commit**

```bash
git add services/detector/requirements.txt services/detector/requirements-dev.txt
git commit -m "build(detector): add supervision dependency"
```

---

## Task 2: Pure helpers — coordinate normalization (TDD)

**Files:**
- Create: `services/detector/app/pipeline.py`
- Create: `services/detector/tests/__init__.py`, `services/detector/tests/test_pipeline.py`

- [ ] **Step 1: Create the tests package**

Create empty file `services/detector/tests/__init__.py` (no content).

- [ ] **Step 2: Write the failing test for normalization**

Create `services/detector/tests/test_pipeline.py`:

```python
import numpy as np
import supervision as sv
from app.pipeline import normalize_detections

NAMES = {15: "cat", 16: "dog"}


def test_normalize_detections_maps_coords_classes_and_track():
    # one box in a 200x100 processed image, y_scale 0.9 (12% dock strip cropped)
    dets = sv.Detections(
        xyxy=np.array([[20.0, 10.0, 120.0, 60.0]]),
        confidence=np.array([0.8123]),
        class_id=np.array([16]),            # dog -> remapped to "cat"
        tracker_id=np.array([7]),
    )
    out = normalize_detections(dets, proc_w=200, proc_h=100, y_scale=0.9, names=NAMES)
    assert len(out) == 1
    d = out[0]
    assert d["animal"] == "cat"             # dog remapped
    assert d["class_id"] == 16
    assert d["class_name"] == "dog"
    assert d["track_id"] == 7
    assert d["confidence"] == 0.8123
    assert d["bbox"]["x"] == 0.1            # 20/200
    assert d["bbox"]["y"] == 0.09           # 10/100 * 0.9
    assert d["bbox"]["w"] == 0.5            # (120-20)/200
    assert d["bbox"]["h"] == 0.45           # (60-10)/100 * 0.9
    assert d["mask"] is None


def test_normalize_detections_handles_missing_track_id():
    dets = sv.Detections(
        xyxy=np.array([[0.0, 0.0, 50.0, 50.0]]),
        confidence=np.array([0.5]),
        class_id=np.array([15]),
    )
    out = normalize_detections(dets, proc_w=100, proc_h=100, y_scale=1.0, names=NAMES)
    assert out[0]["track_id"] is None
    assert out[0]["animal"] == "cat"
```

- [ ] **Step 3: Run the test to verify it fails**

Run the **Test-run command** (top of plan).
Expected: FAIL with `ModuleNotFoundError: No module named 'app.pipeline'` /
`ImportError: cannot import name 'normalize_detections'`.

- [ ] **Step 4: Implement the pure helpers**

Create `services/detector/app/pipeline.py`:

```python
"""
Unified supervision-based detection pipeline.

Pure helpers (normalize_detections, mask_to_polygon) are model-free and unit-tested.
detect_frame() wires model inference + slicing + NMS + tracking + smoothing and is
verified via the live service.
"""
from __future__ import annotations

import numpy as np
import supervision as sv

# COCO class -> our animal label. Dog (16) remapped to cat for the feeder context.
_COCO_ANIMALS: dict[int, str] = {15: "cat", 16: "cat"}
_ANIMAL_CLASS_IDS = [15, 16]


def mask_to_polygon(mask: np.ndarray, proc_w: int, proc_h: int, y_scale: float):
    """Largest contour of a boolean mask -> normalized [[x,y],...] (or None)."""
    polys = sv.mask_to_polygons(mask.astype(bool))
    if not polys:
        return None
    largest = max(polys, key=lambda p: sv.polygon_to_mask(p, (mask.shape[1], mask.shape[0])).sum())
    return [
        [round(float(px) / proc_w, 4), round(float(py) / proc_h * y_scale, 4)]
        for px, py in largest
    ]


def normalize_detections(
    dets: sv.Detections, proc_w: int, proc_h: int, y_scale: float, names: dict,
) -> list[dict]:
    """Convert an sv.Detections (pixel coords in the processed image) to the API shape."""
    out: list[dict] = []
    n = len(dets)
    for i in range(n):
        x1, y1, x2, y2 = (float(v) for v in dets.xyxy[i])
        cls_id = int(dets.class_id[i]) if dets.class_id is not None else -1
        conf = float(dets.confidence[i]) if dets.confidence is not None else 0.0
        track_id = (
            int(dets.tracker_id[i])
            if getattr(dets, "tracker_id", None) is not None
            else None
        )
        mask_poly = None
        if getattr(dets, "mask", None) is not None:
            mask_poly = mask_to_polygon(dets.mask[i], proc_w, proc_h, y_scale)

        out.append({
            "animal": _COCO_ANIMALS.get(cls_id, "other"),
            "confidence": round(conf, 4),
            "bbox": {
                "x": round(x1 / proc_w, 4),
                "y": round(y1 / proc_h * y_scale, 4),
                "w": round((x2 - x1) / proc_w, 4),
                "h": round((y2 - y1) / proc_h * y_scale, 4),
            },
            "class_id": cls_id,
            "class_name": names.get(cls_id, str(cls_id)),
            "track_id": track_id,
            "mask": mask_poly,
        })
    return out
```

- [ ] **Step 5: Run the test to verify it passes**

Run the Test-run command.
Expected: both `test_normalize_detections_*` PASS.

- [ ] **Step 6: Commit**

```bash
git add services/detector/app/pipeline.py services/detector/tests/__init__.py services/detector/tests/test_pipeline.py
git commit -m "feat(detector): add pure detection normalization helpers"
```

---

## Task 3: Mask → polygon helper test (TDD)

**Files:**
- Modify: `services/detector/tests/test_pipeline.py`

- [ ] **Step 1: Write the failing test**

Append to `services/detector/tests/test_pipeline.py`:

```python
def test_mask_to_polygon_normalizes_largest_contour():
    from app.pipeline import mask_to_polygon
    # 100x100 mask with a filled 20..40 square (x and y)
    mask = np.zeros((100, 100), dtype=bool)
    mask[20:40, 20:40] = True
    poly = mask_to_polygon(mask, proc_w=100, proc_h=100, y_scale=1.0)
    assert poly is not None and len(poly) >= 3
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    assert min(xs) >= 0.18 and max(xs) <= 0.42   # ~0.20..0.40 normalized
    assert min(ys) >= 0.18 and max(ys) <= 0.42


def test_mask_to_polygon_empty_returns_none():
    from app.pipeline import mask_to_polygon
    assert mask_to_polygon(np.zeros((10, 10), dtype=bool), 10, 10, 1.0) is None
```

- [ ] **Step 2: Run to verify**

Run the Test-run command.
Expected: PASS. (`mask_to_polygon` already exists from Task 2; if the largest-contour
selection errors on the `polygon_to_mask` signature for the installed supervision
version, replace the `largest` line with area via the shoelace formula:
`max(polys, key=lambda p: abs(np.diff(p[:,0]*np.roll(p[:,1],1) - p[:,1]*np.roll(p[:,0],1)).sum()))`
— simplest robust fallback: `max(polys, key=len)`.)

- [ ] **Step 3: Commit**

```bash
git add services/detector/tests/test_pipeline.py
git commit -m "test(detector): cover mask_to_polygon helper"
```

---

## Task 4: Unified `detect_frame` pipeline (model inference)

**Files:**
- Modify: `services/detector/app/pipeline.py`

This task uses the real YOLO model; it is verified via the live service (curl), not a unit
test, because inference needs torch + weights and is slow.

- [ ] **Step 1: Add the preprocess crop, singletons, slicer, and detect_frame**

Append to `services/detector/app/pipeline.py`:

```python
import time
from PIL import Image
from ultralytics import YOLO

# Tracking/smoothing singletons (state across frames). The single-worker executor in
# main.py serializes access; reset on model switch / new scan / before each precompute.
_tracker: sv.ByteTrack | None = None
_smoother: sv.DetectionsSmoother | None = None


def reset_tracking() -> None:
    global _tracker, _smoother
    _tracker = sv.ByteTrack()
    _smoother = sv.DetectionsSmoother(length=2)


def _ensure_tracking() -> None:
    if _tracker is None or _smoother is None:
        reset_tracking()


def _preprocess(image: Image.Image) -> tuple[Image.Image, float]:
    """Crop the dark OS dock strip off screen recordings. Returns (image, y_scale)."""
    orig_w, orig_h = image.size
    strip_h = int(orig_h * 0.12)
    bottom = image.crop((0, orig_h - strip_h, orig_w, orig_h))
    px = list(bottom.convert("L").getdata())
    if px and sum(px) / len(px) < 80:
        image = image.crop((0, 0, orig_w, orig_h - strip_h))
    return image, image.size[1] / orig_h


def _build_slicer(model: YOLO, conf: float, iou: float, imgsz: int, proc_w: int, proc_h: int):
    """SAHI-style slicer: ~2x2 tiles with overlap, merged by NMS. Version-tolerant."""
    def callback(slice_img: np.ndarray) -> sv.Detections:
        res = model.predict(
            slice_img, conf=conf, iou=iou, imgsz=imgsz,
            classes=_ANIMAL_CLASS_IDS, verbose=False,
        )[0]
        return sv.Detections.from_ultralytics(res)

    slice_wh = (max(320, proc_w // 2 + 64), max(320, proc_h // 2 + 64))
    try:  # supervision >= 0.20 modern signature
        return sv.InferenceSlicer(
            callback=callback, slice_wh=slice_wh,
            overlap_ratio_wh=(0.2, 0.2),
            overlap_filter=sv.OverlapFilter.NON_MAX_SUPPRESSION,
            thread_workers=1,
        )
    except TypeError:  # older signature fallback
        return sv.InferenceSlicer(callback=callback, slice_wh=slice_wh)


def detect_frame(
    model: YOLO, image: Image.Image, *,
    conf: float, iou: float, imgsz: int,
    slice: bool, smooth: bool,
) -> tuple[list[dict], float, bool]:
    """Run the unified pipeline on one PIL image. Returns (detections, ms, is_seg)."""
    _ensure_tracking()
    image, y_scale = _preprocess(image)
    proc_w, proc_h = image.size
    is_seg = any("-seg" in str(getattr(model, "ckpt_path", "")) for _ in [0]) \
        or getattr(model, "task", "") == "segment"

    t0 = time.perf_counter()
    if slice:
        frame = np.asarray(image)  # RGB HxWx3
        dets = _build_slicer(model, conf, iou, imgsz, proc_w, proc_h)(frame)
    else:
        res = model.predict(
            image, conf=conf, iou=iou, imgsz=imgsz,
            classes=_ANIMAL_CLASS_IDS, verbose=False,
        )[0]
        dets = sv.Detections.from_ultralytics(res)

    if len(dets):
        dets = dets.with_nms(threshold=iou, class_agnostic=True)
    dets = _tracker.update_with_detections(dets)
    if smooth:
        dets = _smoother.update_with_detections(dets)

    inference_ms = (time.perf_counter() - t0) * 1000
    names = model.names if isinstance(model.names, dict) else dict(enumerate(model.names))
    return normalize_detections(dets, proc_w, proc_h, y_scale, names), round(inference_ms, 1), is_seg
```

- [ ] **Step 2: Verify imports load (no syntax/name errors)**

Run:
```bash
docker compose -f docker-compose.dev.yml run --rm --no-deps \
  -v "$PWD/services/detector:/test" -w /test detector \
  python -c "import app.pipeline as p; print('ok', hasattr(p,'detect_frame'), hasattr(p,'reset_tracking'))"
```
Expected: `ok True True`.

- [ ] **Step 3: Commit**

```bash
git add services/detector/app/pipeline.py
git commit -m "feat(detector): unified slice/track/smooth detect_frame pipeline"
```

---

## Task 5: Route `detector.run_detection` through the pipeline

**Files:**
- Modify: `services/detector/app/detector.py`

- [ ] **Step 1: Add slice/smooth defaults to config**

In `services/detector/app/detector.py`, extend the `_cfg` dict (after the `augment` key)
with:

```python
    "slice":  os.getenv("YOLO_SLICE", "false").lower() in ("1", "true", "yes"),
    "smooth": os.getenv("YOLO_SMOOTH", "true").lower() in ("1", "true", "yes"),
    "stride": float(os.getenv("DEMO_STRIDE", "0.3")),
```

And add these keys to the dict returned by `get_config()`:

```python
        "slice":  _cfg["slice"],
        "smooth": _cfg["smooth"],
        "stride": _cfg["stride"],
```

- [ ] **Step 2: Reset tracking on model switch**

In `set_model()`, when the model actually changes (inside the `if model_path != _cfg["model"]:`
block), add after `_model = None`:

```python
        from app import pipeline
        pipeline.reset_tracking()
```

- [ ] **Step 3: Replace run_detection body to delegate to the pipeline**

Replace the entire `run_detection(...)` function in `detector.py` with:

```python
def run_detection(
    image: Image.Image,
    conf_threshold: float = 0.15,
    iou_threshold: float = 0.45,
    imgsz: int | None = None,
    augment: bool | None = None,      # kept for signature compat; ignored
    slice: bool | None = None,
    smooth: bool | None = None,
) -> tuple[list[dict], float, bool]:
    from app import pipeline
    imgsz = _round32(imgsz if imgsz is not None else _cfg["imgsz"])
    slice = _cfg["slice"] if slice is None else slice
    smooth = _cfg["smooth"] if smooth is None else smooth
    model = _get_model()
    return pipeline.detect_frame(
        model, image,
        conf=conf_threshold, iou=iou_threshold, imgsz=imgsz,
        slice=slice, smooth=smooth,
    )
```

You may now delete the old `_preprocess`, `_COCO_ANIMALS`, `_ANIMAL_CLASS_IDS`, and the
`from PIL import Image` if unused — BUT keep `Image` imported (used in the type hint) and
keep `_is_seg`, `_round32`, `list_models`, `_get_model`, `get_config`, `set_model`.

- [ ] **Step 4: Verify the module imports and config has new keys**

Run:
```bash
docker compose -f docker-compose.dev.yml run --rm --no-deps \
  -v "$PWD/services/detector:/test" -w /test detector \
  python -c "from app import detector; c=detector.get_config(); print('slice' in c, 'smooth' in c, 'stride' in c)"
```
Expected: `True True True`.

- [ ] **Step 5: Commit**

```bash
git add services/detector/app/detector.py
git commit -m "refactor(detector): route run_detection through supervision pipeline"
```

---

## Task 6: Demo precompute pure helpers (TDD)

**Files:**
- Create: `services/detector/app/demo.py`
- Create: `services/detector/tests/test_demo.py`

- [ ] **Step 1: Write failing tests for the pure helpers**

Create `services/detector/tests/test_demo.py`:

```python
from app.demo import frame_indices, cache_signature, is_cache_valid


def test_frame_indices_steps_by_stride():
    # 10s video at 30fps, stride 0.5s -> samples at 0,0.5,...,9.5 => 20 frames
    idx = frame_indices(fps=30.0, frame_count=300, stride=0.5)
    assert idx[0] == 0
    assert idx[1] == 15          # 0.5s * 30fps
    assert len(idx) == 20
    assert all(0 <= i < 300 for i in idx)


def test_frame_indices_clamps_to_available_frames():
    idx = frame_indices(fps=30.0, frame_count=10, stride=1.0)
    assert idx == [0]            # only ~0.33s of video


def test_cache_signature_changes_with_settings():
    s1 = cache_signature(video_id="v", model="m", settings={"conf": 0.1, "slice": True})
    s2 = cache_signature(video_id="v", model="m", settings={"conf": 0.2, "slice": True})
    assert s1 != s2
    assert s1 == cache_signature(video_id="v", model="m", settings={"slice": True, "conf": 0.1})


def test_is_cache_valid_matches_signature():
    sig = cache_signature(video_id="v", model="m", settings={"conf": 0.1})
    assert is_cache_valid({"hash": sig}, sig) is True
    assert is_cache_valid({"hash": "other"}, sig) is False
    assert is_cache_valid({}, sig) is False
```

- [ ] **Step 2: Run to verify failure**

Run the Test-run command.
Expected: FAIL with `No module named 'app.demo'`.

- [ ] **Step 3: Implement the pure helpers**

Create `services/detector/app/demo.py`:

```python
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
```

- [ ] **Step 4: Run to verify pass**

Run the Test-run command.
Expected: all `test_demo.py` pure-helper tests PASS.

- [ ] **Step 5: Commit**

```bash
git add services/detector/app/demo.py services/detector/tests/test_demo.py
git commit -m "feat(detector): demo precompute pure helpers (frames + cache hash)"
```

---

## Task 7: Demo precompute worker + state machine

**Files:**
- Modify: `services/detector/app/demo.py`

Uses OpenCV + the model; verified via the live service in Task 9.

- [ ] **Step 1: Add the worker, state, and disk cache**

Append to `services/detector/app/demo.py`:

```python
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
    """Return current state; include cached data when ready (and matching signature)."""
    with _lock:
        st = dict(_state)
    cached = _read_cache()
    if cached and st["status"] in ("idle", "ready"):
        return {"status": "ready", "progress": 1.0, "data": cached}
    return st


def _default_settings() -> dict:
    cfg = detector.get_config()
    return {
        "conf": 0.15, "iou": 0.45, "imgsz": cfg["imgsz"],
        "slice": True, "smooth": True, "stride": cfg.get("stride", 0.3),
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
            "hash": cache_signature("dummy.mp4", model_name, settings),
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
    sig = cache_signature("dummy.mp4", cfg["model"], settings)

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
```

- [ ] **Step 2: Verify import loads**

Run:
```bash
docker compose -f docker-compose.dev.yml run --rm --no-deps \
  -v "$PWD/services/detector:/test" -w /test detector \
  python -c "from app import demo; print('ok', demo.get_state()['status'])"
```
Expected: `ok idle` (or `ready` if a cache file already exists — also fine).

- [ ] **Step 3: Commit**

```bash
git add services/detector/app/demo.py
git commit -m "feat(detector): demo precompute worker + state machine + JSON cache"
```

---

## Task 8: API endpoints — /detect params, /tracker/reset, /demo/*

**Files:**
- Modify: `services/detector/app/main.py`
- Create: `services/detector/tests/test_demo_endpoints.py`

- [ ] **Step 1: Write a failing endpoint test (demo lifecycle, model mocked out)**

Create `services/detector/tests/test_demo_endpoints.py`:

```python
from fastapi.testclient import TestClient
import app.demo as demo
from app.main import app

client = TestClient(app)


def test_demo_detections_reports_processing_then_ready(monkeypatch):
    # Stub the worker so no real video/model is touched.
    calls = {"started": False}

    def fake_ensure_started():
        calls["started"] = True
        return {"status": "processing", "progress": 0.0}

    monkeypatch.setattr(demo, "ensure_started", fake_ensure_started)
    r = client.get("/demo/detections")
    assert r.status_code == 200
    assert r.json()["status"] == "processing"
    assert calls["started"] is True


def test_demo_process_force_triggers_start(monkeypatch):
    seen = {}

    def fake_start(settings=None, force=False):
        seen["force"] = force
        seen["settings"] = settings
        return {"status": "processing", "progress": 0.0}

    monkeypatch.setattr(demo, "start_processing", fake_start)
    r = client.post("/demo/process?force=true&conf=0.2&slice=false&smooth=true&stride=0.4")
    assert r.status_code == 200
    assert seen["force"] is True
    assert seen["settings"]["conf"] == 0.2
    assert seen["settings"]["slice"] is False
    assert seen["settings"]["stride"] == 0.4


def test_tracker_reset_ok(monkeypatch):
    import app.pipeline as pipeline
    reset = {"n": 0}
    monkeypatch.setattr(pipeline, "reset_tracking", lambda: reset.__setitem__("n", reset["n"] + 1))
    r = client.post("/tracker/reset")
    assert r.status_code == 200
    assert reset["n"] == 1
```

- [ ] **Step 2: Run to verify failure**

Run the Test-run command.
Expected: FAIL (routes `/demo/detections`, `/demo/process`, `/tracker/reset` return 404).

- [ ] **Step 3: Add the endpoints and /detect params**

In `services/detector/app/main.py`:

(a) Add imports near the top:
```python
from app import detector, pipeline, demo
```
(keep the existing `from app import detector` — replace it with the line above).

(b) Extend the `/detect` handler signature with two query params (add after `augment`):
```python
    slice:   bool  = Query(default=False),
    smooth:  bool  = Query(default=True),
```
and pass them into the executor call:
```python
    detections, inference_ms, is_seg = await loop.run_in_executor(
        _executor,
        lambda: detector.run_detection(image, conf, iou, imgsz, augment, slice, smooth),
    )
```

(c) Append new routes at the end of the file:
```python
@app.post("/tracker/reset")
def tracker_reset() -> dict:
    pipeline.reset_tracking()
    return {"status": "ok"}


@app.get("/demo/detections")
def demo_detections() -> dict:
    return demo.ensure_started()


@app.post("/demo/process")
def demo_process(
    conf:   float = Query(default=0.15, ge=0.05, le=0.95),
    iou:    float = Query(default=0.45, ge=0.1, le=0.9),
    imgsz:  int   = Query(default=1280, ge=320, le=1536),
    slice:  bool  = Query(default=True),
    smooth: bool  = Query(default=True),
    stride: float = Query(default=0.3, ge=0.1, le=2.0),
    force:  bool  = Query(default=False),
) -> dict:
    settings = {
        "conf": conf, "iou": iou, "imgsz": imgsz,
        "slice": slice, "smooth": smooth, "stride": stride,
    }
    return demo.start_processing(settings, force=force)
```

- [ ] **Step 4: Run to verify pass**

Run the Test-run command.
Expected: all `test_demo_endpoints.py` tests PASS, and Task 2/3/6 tests still PASS.

- [ ] **Step 5: Commit**

```bash
git add services/detector/app/main.py services/detector/tests/test_demo_endpoints.py
git commit -m "feat(detector): /detect slice+smooth, /tracker/reset, /demo endpoints"
```

---

## Task 9: Wire the demo video into Docker + end-to-end backend verification

**Files:**
- Modify: `docker-compose.yml`
- Modify: `docker-compose.dev.yml`

- [ ] **Step 1: Add mounts + env to the prod compose detector service**

In `docker-compose.yml`, under the `detector:` service, add a `volumes:` block and extend
`environment:` (the service currently has no `volumes:` key):

```yaml
    environment:
      YOLO_MODEL: yolo26/yolo26l.pt
      DEMO_VIDEO_PATH: /data/video/dummy.mp4
      DEMO_CACHE_DIR: /data/cache
    volumes:
      - ./apps/admin/public/video:/data/video:ro
      - detector_cache:/data/cache
```

And add a top-level named volume (under the existing `volumes:` section at the bottom of
the file; if none exists, create one):

```yaml
volumes:
  detector_cache:
```

- [ ] **Step 2: Add the same env + mounts to the dev compose**

In `docker-compose.dev.yml`, under `detector:`, extend to:

```yaml
    environment:
      DEMO_VIDEO_PATH: /data/video/dummy.mp4
      DEMO_CACHE_DIR: /data/cache
    volumes:
      - ./services/detector/app:/app/app
      - ./apps/admin/public/video:/data/video:ro
      - ./services/detector/cache:/data/cache
```

(Keep the existing `command:` and `ports:`.)

- [ ] **Step 3: Add the dev cache dir to gitignore**

Append to `services/detector/.gitignore` (create it if missing):
```
cache/
```

- [ ] **Step 4: Bring up the detector and verify the full demo lifecycle**

```bash
docker compose -f docker-compose.dev.yml up -d --build detector
# kick off a fast pass (slice off, coarse stride) to verify wiring quickly:
curl -s -X POST "http://localhost:8001/demo/process?force=true&slice=false&stride=1.0" | head -c 300
# poll until ready:
for i in $(seq 1 60); do
  s=$(curl -s http://localhost:8001/demo/detections | python -c "import sys,json;d=json.load(sys.stdin);print(d['status'],d.get('progress'))")
  echo "$s"; case "$s" in ready*) break;; error*) echo FAIL; break;; esac; sleep 2
done
# inspect the result shape:
curl -s http://localhost:8001/demo/detections | python -c "import sys,json;d=json.load(sys.stdin);f=d['data']['frames'];print('frames',len(f),'first_t',f[0]['t'] if f else None,'sample',f[0]['detections'][:1] if f and f[0]['detections'] else 'none')"
```
Expected: status transitions `processing` → `ready`; `frames` is a non-empty list; each
frame has `t` and a `detections` list whose items contain `bbox`, `confidence`,
`track_id`, `animal`. If `error`, read `message` (most likely the video mount path).

- [ ] **Step 5: Verify a single live /detect call still works (ESP-Cam path)**

```bash
# grab one frame from the demo video as a JPEG and POST it:
docker compose -f docker-compose.dev.yml run --rm --no-deps \
  -v "$PWD/apps/admin/public/video:/v:ro" -w /v detector \
  python -c "import cv2;c=cv2.VideoCapture('dummy.mp4');_,f=c.read();cv2.imwrite('/v/.frame.jpg',f)"
curl -s -F "file=@apps/admin/public/video/.frame.jpg;type=image/jpeg" \
  "http://localhost:8001/detect?conf=0.15&smooth=true&slice=false" | head -c 400
rm -f apps/admin/public/video/.frame.jpg
```
Expected: JSON with `detections`, `inference_ms`, `is_segmentation`.

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml docker-compose.dev.yml services/detector/.gitignore
git commit -m "build: mount demo video + cache into detector, wire DEMO_* env"
```

---

## Task 10: Frontend — demo replay-only (fetch JSON, poll, loop overlay)

**Files:**
- Modify: `apps/admin/app/(dashboard)/stream/StreamClient.tsx`

No automated test harness; verify in the browser.

- [ ] **Step 1: Add demo-processing state and a typed JSON loader**

In `StreamClient.tsx`, inside the component (near the other `useState` declarations,
around line 458), add:

```tsx
  /* demo precompute state */
  const [demoStatus, setDemoStatus]   = useState<'idle'|'processing'|'ready'|'error'>('idle');
  const [demoProgress, setDemoProgress] = useState(0);
  const [demoError, setDemoError]     = useState<string | null>(null);
```

- [ ] **Step 2: Replace the browser scan with a JSON fetch+poll loader**

Add this effect (place it after the existing config-on-mount effect, ~line 492). It loads
the precomputed detections for the demo source and flattens them into the existing
`Detection[]` shape used by `finalizeTimeline`:

```tsx
  /* ── Demo: load precomputed detections (process-once, replay-forever) ── */
  useEffect(() => {
    if (source !== 'demo') return;
    let cancelled = false;

    const flatten = (data: any) => {
      const hist: Detection[] = [];
      for (const fr of data.frames ?? []) {
        for (const d of fr.detections ?? []) {
          hist.push({
            id: `${fr.t.toFixed(2)}-${Math.random().toString(36).slice(2)}`,
            videoTime: fr.t,
            confidence: d.confidence,
            bbox: d.bbox,
            track_id: d.track_id ?? null,
            mask: d.mask ?? null,
          });
        }
      }
      detectionHistoryRef.current = hist;
      finalizeTimeline(hist);
      setScanDone(true);
      setDemoStatus('ready');
      const v = videoRef.current;
      if (v) { v.loop = true; v.currentTime = 0; v.play().catch(() => {}); setPaused(false); }
    };

    const poll = async () => {
      try {
        const r = await fetch(`${detectorUrl}/demo/detections`);
        const j = await r.json();
        if (cancelled) return;
        if (j.status === 'ready') { setDetectorOnline(true); flatten(j.data); return; }
        if (j.status === 'error') { setDemoStatus('error'); setDemoError(j.message ?? 'processing failed'); return; }
        setDetectorOnline(true);
        setDemoStatus('processing');
        setDemoProgress(j.progress ?? 0);
        setTimeout(poll, 1200);
      } catch {
        if (!cancelled) { setDetectorOnline(false); setDemoStatus('error'); setDemoError('detector offline'); }
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [source, detectorUrl, finalizeTimeline]);
```

- [ ] **Step 3: Disable the live browser scan for the demo source**

Find the detection-loop effect (~line 664) and change its guard so it only runs for
ESP-Cam (the demo no longer does browser inference):

```tsx
  useEffect(() => {
    if (source !== 'espcam' || scanDone) return;
    const id = setInterval(captureAndDetect, 250);
    return () => clearInterval(id);
  }, [source, scanDone, captureAndDetect]);
```

Also change the slowed-playback effect (~line 672) to no longer slow the demo (it now
plays at 1× during replay):

```tsx
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.playbackRate = 1;
  }, [scanDone, passCount]);
```

- [ ] **Step 4: Make the demo `<video>` loop and stop driving multi-pass logic**

In the `<video>` element (~line 805), remove the `onEnded={handleVideoEnd}` handler (demo
now loops via the `loop` property set in Step 2; multi-pass is gone). Leave `onTimeUpdate`,
`onLoadedMetadata`, `onPlay`, `onPause` as-is. The element becomes:

```tsx
                <video
                  ref={videoRef}
                  src="/video/dummy.mp4"
                  muted playsInline
                  onTimeUpdate={() => {
                    if (!isSeekingRef.current) {
                      const v = videoRef.current;
                      if (v) setVideoTime(v.currentTime);
                    }
                  }}
                  onLoadedMetadata={() => {
                    const v = videoRef.current;
                    if (v) {
                      setVideoAspect(v.videoWidth / v.videoHeight);
                      setVideoDuration(v.duration);
                    }
                  }}
                  onPlay={() => setPaused(false)}
                  onPause={() => setPaused(true)}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                />
```

- [ ] **Step 5: Show a processing overlay while precompute runs**

Add this just after the `<video>`/`<img>` block (sibling of the Offline overlay, ~line 884),
so users see progress on first ever load:

```tsx
              {source === 'demo' && demoStatus === 'processing' && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 10,
                  background: 'rgba(13,17,23,0.78)', backdropFilter: 'blur(3px)',
                }}>
                  <ScanLine size={26} color={D.orange} strokeWidth={1.4} />
                  <span style={{ fontSize: 12, fontFamily: 'monospace', color: D.text }}>
                    Processing demo · {Math.round(demoProgress * 100)}%
                  </span>
                  <div style={{ width: 180, height: 4, background: D.border, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.round(demoProgress * 100)}%`, background: D.orange }} />
                  </div>
                </div>
              )}
              {source === 'demo' && demoStatus === 'error' && (
                <div style={{
                  position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
                  background: 'rgba(239,68,68,0.85)', borderRadius: 8, padding: '5px 14px',
                }}>
                  <span style={{ fontSize: 11, color: '#fff', fontFamily: 'monospace' }}>{demoError}</span>
                </div>
              )}
```

- [ ] **Step 6: Verify replay in the browser**

Start admin + detector, open http://localhost:3007/stream:
```bash
docker compose -f docker-compose.dev.yml up -d --build detector
pnpm --filter @stray/admin dev    # or: docker compose up -d admin
```
Expected: on first load the demo shows "Processing demo · N%", then the video loops at 1×
with stable, non-flickering boxes overlaid; reloading the page is instant (cached).
Scrubbing shows the stored boxes at each timestamp. No `/detect` calls fire during demo
replay (check the Network tab — only one `/demo/detections` request, then none).

- [ ] **Step 7: Commit**

```bash
git add "apps/admin/app/(dashboard)/stream/StreamClient.tsx"
git commit -m "feat(stream): demo replays cached detections, zero inference"
```

---

## Task 11: Frontend — slice/smooth toggles, Re-process button, ESP-Cam params

**Files:**
- Modify: `apps/admin/app/(dashboard)/stream/StreamClient.tsx`

- [ ] **Step 1: Add slice/smooth state seeded from /config**

Near the other detector state (~line 466) add:

```tsx
  const [slice, setSlice]   = useState(true);   // demo precompute default on
  const [smooth, setSmooth] = useState(true);
```

In the config-on-mount effect, after the existing `setAugment` line, add:
```tsx
        if (typeof cfg.slice  === 'boolean') setSlice(cfg.slice);
        if (typeof cfg.smooth === 'boolean') setSmooth(cfg.smooth);
```

- [ ] **Step 2: Pass slice/smooth into the live ESP-Cam /detect call**

In `captureAndDetect` (~line 612), extend the fetch URL and the dependency array:
```tsx
        const res = await fetch(
          `${detectorUrl}/detect?conf=${conf}&iou=${iou}&imgsz=${imgsz}&slice=${slice}&smooth=${smooth}`,
          { method: 'POST', body: form });
```
Update the `useCallback` deps at the end of `captureAndDetect` to:
`[detectorUrl, conf, iou, imgsz, slice, smooth]`.

- [ ] **Step 3: Reset tracker when an ESP-Cam scan (re)starts**

In the source-toggle button handler (~line 906) change to reset tracking when switching to
espcam:
```tsx
                  onClick={() => {
                    setSource(src);
                    setImgError(false);
                    if (src === 'espcam') fetch(`${detectorUrl}/tracker/reset`, { method: 'POST' }).catch(() => {});
                  }}
```

- [ ] **Step 4: Add a Re-process action for the demo**

Add this callback near the other callbacks (~line 583):
```tsx
  const reprocessDemo = useCallback(async () => {
    setScanDone(false);
    setDemoStatus('processing');
    setDemoProgress(0);
    setActiveBoxes([]);
    const qs = `conf=${conf}&iou=${iou}&imgsz=${imgsz}&slice=${slice}&smooth=${smooth}&force=true`;
    await fetch(`${detectorUrl}/demo/process?${qs}`, { method: 'POST' }).catch(() => {});
    // the demo loader effect will resume polling on next render; nudge it:
    setSource('demo');
  }, [detectorUrl, conf, iou, imgsz, slice, smooth]);
```

Note: the loader effect in Task 10 polls whenever `source === 'demo'`; after a forced
re-process it will observe `processing` and poll to completion. To guarantee it re-runs,
add `demoStatus` is NOT needed in deps — instead trigger a re-poll by toggling a nonce.
Add `const [reprocessNonce, setReprocessNonce] = useState(0);`, include `reprocessNonce`
in the Task-10 loader effect dependency array, and end `reprocessDemo` with
`setReprocessNonce(n => n + 1);` instead of `setSource('demo')`.

- [ ] **Step 5: Add the toggles + Re-process button to the config panel**

In the config `Card` (after the existing `Augment` `Toggle`, ~line 1097), add:
```tsx
              <Toggle
                label="Slicing"
                sub="SAHI tiling · finds small/distant cats"
                value={slice}
                onChange={setSlice}
              />
              <Toggle
                label="Smoothing"
                sub="temporal · steadier boxes"
                value={smooth}
                onChange={setSmooth}
              />
              {source === 'demo' && (
                <button onClick={reprocessDemo} disabled={demoStatus === 'processing'} style={{
                  marginTop: 4, padding: '7px 0', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${D.orange}`, background: D.orangeDim, color: D.orange,
                  fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
                  opacity: demoStatus === 'processing' ? 0.5 : 1,
                }}>
                  {demoStatus === 'processing' ? `Processing ${Math.round(demoProgress*100)}%` : 'Re-process demo'}
                </button>
              )}
```

- [ ] **Step 6: Update the config hint copy**

Replace the "Changes apply on the next captured frame" hint block (~line 1107) condition
so it only shows for ESP-Cam, and add a demo-specific hint:
```tsx
            {source === 'espcam' && !scanDone && (
              <div style={{ marginTop: 10, fontSize: 9, color: D.orange, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 5 }}>
                <ScanLine size={10} /> Changes apply on the next captured frame
              </div>
            )}
            {source === 'demo' && (
              <div style={{ marginTop: 10, fontSize: 9, color: D.muted, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 5 }}>
                <ScanLine size={10} /> Re-process to apply changes to the demo
              </div>
            )}
```

- [ ] **Step 7: Verify in the browser**

Reload http://localhost:3007/stream. Expected: Slicing + Smoothing toggles appear; on the
demo source a "Re-process demo" button shows; clicking it (e.g. after turning Slicing off)
shows progress and then replays the recomputed result. Toggle Smoothing and re-process to
see boxes become steadier/less steady. Switch to ESP-Cam → live detection still works and
honors the toggles.

- [ ] **Step 8: Commit**

```bash
git add "apps/admin/app/(dashboard)/stream/StreamClient.tsx"
git commit -m "feat(stream): slice/smooth toggles + demo re-process control"
```

---

## Task 12: Final verification & cleanup

- [ ] **Step 1: Run the full backend test suite**

Run the Test-run command (no path filter).
Expected: all tests in `tests/test_pipeline.py`, `tests/test_demo.py`,
`tests/test_demo_endpoints.py` PASS.

- [ ] **Step 2: A/B the slicing quality win**

```bash
# baseline (no slicing) vs sliced, coarse stride for speed:
curl -s -X POST "http://localhost:8001/demo/process?force=true&slice=false&stride=0.5" >/dev/null
# wait for ready, count total detections:
sleep 5; curl -s http://localhost:8001/demo/detections | python -c "import sys,json;d=json.load(sys.stdin);print('no-slice dets:',sum(len(f['detections']) for f in d['data']['frames']))"
curl -s -X POST "http://localhost:8001/demo/process?force=true&slice=true&stride=0.5" >/dev/null
# wait for ready (slicing is slower):
sleep 20; curl -s http://localhost:8001/demo/detections | python -c "import sys,json;d=json.load(sys.stdin);print('slice dets:',sum(len(f['detections']) for f in d['data']['frames']))"
```
Expected: sliced total ≥ no-slice total (more small cats found). Record both numbers.

- [ ] **Step 3: Confirm replay determinism**

Load `/stream`, note the boxes at a fixed timestamp; reload and confirm identical boxes at
the same timestamp (same cached JSON → identical overlays).

- [ ] **Step 4: Verification report**

Use superpowers:verification-before-completion. Summarize: tests passing (paste counts),
the A/B detection numbers from Step 2, and a confirmation that demo replay issues zero
`/detect` requests (Network tab).

- [ ] **Step 5: Finish the branch**

Use superpowers:finishing-a-development-branch to decide merge/PR for branch
`feat/supervision-detection-quality`.

---

## Self-review notes (already applied)

- **Spec coverage:** pipeline unification (T2–T5), slicing (T4/T11), smoothing+tracking
  (T4), free NMS (T4), demo precompute+cache+JSON schema (T6–T8), endpoints incl.
  `/tracker/reset` (T8), compose video mount (T9), frontend replay-only + toggles +
  re-process + ESP-Cam params (T10–T11), verification incl. A/B + determinism (T12).
- **No placeholders:** every code step contains complete code; commands have expected
  output.
- **Type consistency:** `normalize_detections`, `mask_to_polygon`, `reset_tracking`,
  `detect_frame`, `frame_indices`, `cache_signature`, `is_cache_valid`, `get_state`,
  `start_processing`, `ensure_started` are defined where first used and referenced with
  matching signatures across backend tasks; frontend `slice`/`smooth`/`demoStatus`/
  `demoProgress`/`reprocessNonce` introduced before use.
