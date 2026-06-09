# Detection Quality Upgrade via Roboflow `supervision` — Design

**Date:** 2026-06-09
**Status:** Approved (pending spec review)
**Scope:** Detector service (`services/detector`) + admin stream page (`apps/admin/.../stream`)

## Problem

The demo stream page (`/stream`, localhost:3007) runs the cat detector over a fixed
local video (`/video/dummy.mp4`). Two quality problems:

1. **Small / distant cats are missed.** A single full-frame YOLO pass under-detects
   small objects.
2. **Boxes flicker and jitter** frame-to-frame, and tracks fragment.

The demo video is fixed and non-realtime. The user wants it **processed once, at high
quality, with the chronological detections saved**, then **replayed forever** — identical
every time the video plays.

## Goals

- Higher recall on small/distant cats (SAHI-style tiled inference).
- Stable, non-flickering boxes and consistent track IDs (temporal smoothing + tracking).
- The demo is processed **once ever** (server-side, cached) and replayed with **zero
  inference** — byte-identical overlays on every replay.
- The live ESP-Cam path keeps working and inherits the improved pipeline.

## Non-goals

- No browser-side inference. The frontend renders boxes only.
- No realtime optimization of the slicing path (slicing is slow on CPU; it runs once
  offline for the demo, and is an opt-in toggle for the live ESP-Cam path).
- No PolygonZone / region filtering, no false-positive class filtering (not requested).

## Background: current state

- `services/detector/app/detector.py` — `run_detection()` calls Ultralytics
  `model.track(..., persist=True, tracker="bytetrack.yaml")`, filtered to COCO cat (15)
  and dog (16, remapped to "cat"). Returns normalized bbox/mask/track_id. CPU inference,
  ~1–4 s/frame. `_preprocess()` crops the dark OS dock strip and returns a `y_scale`.
- `services/detector/app/main.py` — FastAPI, `POST /detect`, `GET /config`,
  `POST /config/model`. Single-worker `ThreadPoolExecutor` serializes inference.
- `apps/admin/app/(dashboard)/stream/StreamClient.tsx` — captures `<video>` frames in the
  browser, POSTs each to `/detect`, does a **3-pass** scan at 0.5× playback, dedupes, and
  renders a presence timeline. Reaches the detector via the same-origin `/detector`
  Next.js rewrite proxy (`next.config.mjs` → `http://detector:8001`).
- `docker-compose.yml` — `detector` service, port `3008:8001`. Demo video lives at
  `apps/admin/public/video/dummy.mp4`, served statically by the admin app.

## Why `supervision`

| Need | `supervision` primitive | Cost |
|---|---|---|
| Small/distant cats | `sv.InferenceSlicer` (SAHI tiling, merge w/ NMS) | High — runs once offline |
| Flicker / jitter | `sv.ByteTrack` + `sv.DetectionsSmoother` | Cheap |
| Duplicate cat/dog boxes (free win) | `detections.with_nms(class_agnostic=True)` | Cheap |
| Mask format for frontend | `sv.mask_to_polygons` | Cheap |

### Architectural consequence

Slicing is incompatible with Ultralytics `model.track()` (tiling breaks the full-frame
coordinate space tracking needs). Detection and tracking must therefore split. To avoid
two divergent code paths, **both the demo precompute and the live `/detect` path unify on
one supervision pipeline**:

```
preprocess (crop dock)
  → detect:  slice ON  → sv.InferenceSlicer(callback = model.predict on each tile)
             slice OFF → model.predict
  → detections.with_nms(class_agnostic=True)   # tile seams + cat/dog-remap dupes
  → sv.ByteTrack.update_with_detections()      # assigns track_id
  → sv.DetectionsSmoother.update_with_detections()  # temporal smoothing (when smooth)
  → normalize coords (reuse y_scale) + masks→polygons
```

`ByteTrack` and `DetectionsSmoother` are module-level singletons (state across frames);
the single-worker executor serializes access. They are reset on model switch, before each
demo precompute run, and via an explicit endpoint for live scans.

## Architecture

### One-time (offline, in detector)

```
detector reads DEMO_VIDEO_PATH via OpenCV (cv2.VideoCapture)
  → frame-step every `stride` seconds (frame_idx = round(stride * fps))
  → per frame: run the unified pipeline above (slice ON, smooth ON by default)
  → accumulate { t, detections:[...] } chronologically
  → write detections.json to DEMO_CACHE_DIR (atomic write)
```

Runs in a background thread with a progress global so the HTTP request never blocks for
the minutes-long compute.

### Every visit (browser)

```
GET /detector/demo/detections
  → status "ready": load JSON → loop dummy.mp4 at 1× → overlay boxes matched to videoTime
  → status "processing": show progress, poll until ready
  ZERO inference; identical overlays every replay.
```

## Components

### Backend

**`requirements.txt`** — add `supervision` (pin a recent version compatible with the
existing `numpy<2` / `opencv-python-headless` / `torch>=2.2` stack; verify on install).

**`app/pipeline.py`** (new; or refactor within `detector.py`) — the shared supervision
pipeline. One function, e.g.:

```python
def detect_frame(image: PIL.Image, *, conf, iou, imgsz, slice: bool, smooth: bool)
    -> tuple[list[dict], float, bool]
```

Responsibilities: preprocess crop (reuse existing logic / `y_scale`); run predict or
`InferenceSlicer`; class-agnostic NMS; `ByteTrack` update; optional `DetectionsSmoother`
update; build the normalized detection dicts (bbox/mask/track_id/class). Slicer tile size
≈ half the frame (≈2×2 grid) with ~0.2 overlap and NMS overlap handling; modest internal
thread count. Singletons `_tracker`, `_smoother`, plus `reset_tracking()`.

**`app/demo.py`** (new) — `cv2.VideoCapture(DEMO_VIDEO_PATH)`; read fps/frame-count/
duration; iterate frames at `stride`; convert BGR→RGB→PIL; call the pipeline; collect
chronological frames; write JSON atomically to `DEMO_CACHE_DIR`. Exposes:
- `start_processing(settings)` — launches a background worker (resets tracking first),
  updates a module-level progress state, writes JSON on completion.
- `get_state()` — `{status: "idle"|"processing"|"ready"|"error", progress: 0..1, data?}`.
- Cache validity: a settings+video hash stored in the JSON; mismatched hash ⇒ stale.

**`app/main.py`** — new endpoints:
- `GET /demo/detections` → if cached & valid: `{status:"ready", data}`. Else trigger
  background processing and return `{status:"processing", progress}`.
- `POST /demo/process` (query: `conf,iou,imgsz,slice,smooth,stride,force`) → (re)start
  processing with given settings; returns current state.
- `POST /tracker/reset` → `reset_tracking()` (for the live ESP-Cam scan path).
- `POST /detect` — unchanged contract; add `slice` and `smooth` query params (defaults:
  `slice=false`, `smooth=true`) routed through the unified pipeline.
- `GET /config` — also report `slice`/`smooth`/`stride` defaults.

**JSON schema** (`detections.json`):

```jsonc
{
  "video": "dummy.mp4",
  "hash": "<sha of video mtime/size + settings>",
  "duration": 123.4,
  "fps": 30.0,
  "model": "yolo26/yolo26l.pt",
  "is_segmentation": false,
  "settings": { "conf":0.15, "iou":0.45, "imgsz":1280, "slice":true, "smooth":true, "stride":0.3 },
  "frames": [
    { "t": 0.0, "detections": [
      { "confidence":0.91, "bbox":{"x":..,"y":..,"w":..,"h":..},
        "track_id":1, "mask":[[x,y],...]|null,
        "class_id":15, "class_name":"cat", "animal":"cat" } ] }
  ]
}
```

**`docker-compose.yml`** — under `detector`:
- mount `./apps/admin/public/video:/data/video:ro`
- mount a writable cache volume (named volume or `./services/detector/cache:/data/cache`)
- env `DEMO_VIDEO_PATH=/data/video/dummy.mp4`, `DEMO_CACHE_DIR=/data/cache`
- local-dev fallback: both env vars default to repo-relative paths when unset.

### Frontend (`StreamClient.tsx`)

**Demo source → replay-only:**
- On mount (demo), `fetch('/detector/demo/detections')`. While `status==="processing"`,
  show a progress indicator and poll (~1 s). On `"ready"`, flatten `frames` into the
  existing `Detection[]` shape (`videoTime = t`), feed `finalizeTimeline`/`catLogs`, set
  `scanDone = true`.
- Replay: `video.loop = true`, autoplay at 1×. Existing `displayBoxes` time-matching
  (`|d.videoTime - videoTime| < 0.45`) drives the overlay. **No `/detect` calls.**
- **Remove** the 3-pass browser scanning loop, `captureAndDetect` interval, slowed
  playback, and per-pass logic for the demo source.

**Config panel:**
- Slicing toggle (default **on**) and Smoothing toggle (default **on**); these now drive
  the precompute settings. A **Re-process** button → `POST /detector/demo/process?force=true`
  with current model/conf/iou/imgsz/slice/smooth, then re-poll.
- Copy update: "Re-process to apply changes" (demo) instead of "applies on next frame".

**ESP-Cam source:** keep the existing live `captureAndDetect` → `/detect` flow, now
passing `slice`/`smooth` and benefiting from the unified pipeline; call `/tracker/reset`
when (re)starting a live scan.

## Data flow

1. First demo visit → `GET /demo/detections` → background compute starts → frontend polls
   with progress → JSON cached on disk.
2. Subsequent visits → `GET /demo/detections` → `"ready"` immediately → instant replay.
3. Settings change → Re-process → recompute → new JSON (new hash) → replay updated.
4. ESP-Cam → live `/detect` per captured frame (unchanged UX).

## Error handling

- Video file missing / unreadable → `GET /demo/detections` returns
  `{status:"error", message}`; frontend shows an actionable error (mirrors existing
  "Detector offline" treatment).
- Compute crash → state `"error"` with message; Re-process retries.
- `supervision` API drift across versions (e.g. `overlap_ratio_wh` vs `overlap_wh`,
  `overlap_filter` naming) → resolve against the actually-installed version at
  implementation; isolate slicer construction behind one helper.
- Concurrency: a lock (or reliance on the single-worker executor) prevents the demo
  precompute and a live `/detect` from mutating tracker/smoother singletons concurrently.
- Atomic JSON write (temp file + rename) so a partial file is never served.

## Testing / verification

- `supervision` installs cleanly against the pinned stack (`pip install` succeeds, imports).
- `/detect` response shape is byte-compatible with the current frontend contract
  (bbox/mask/track_id/class fields unchanged).
- A/B one frame slice-off vs slice-on → slice-on yields ≥ as many small-cat detections.
- Smoothing on → boxes visibly steadier across consecutive stored frames.
- `GET /demo/detections` lifecycle: processing → progress increases → ready; second call
  is instant; `force=true` recomputes.
- Replay determinism: two replays produce identical overlays (same JSON).
- ESP-Cam live path still detects and tracks.

## Risks / trade-offs

- **+`supervision` dependency** and a detector refactor away from `model.track()` — a
  real behavior change; mitigated by unified-pipeline verification and unchanged output
  contract.
- **First compute is slow** (minutes with slicing on CPU) — mitigated by background job +
  progress polling; only happens once ever per settings hash.
- **Detector needs the video file** — compose volume mount; local-dev env fallback.
