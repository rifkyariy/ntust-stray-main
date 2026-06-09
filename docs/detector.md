# Detector Service

The detector service is a Python FastAPI application that runs YOLO object detection on images. It identifies cats (and dogs, remapped to cat in the feeder context) in camera frames uploaded from the admin dashboard.

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | FastAPI 0.11+ |
| Inference | Ultralytics YOLO (YOLOv8 and YOLO26 variants) |
| Tracking | Supervision (ByteTrack + DetectionsSmoother) |
| Image handling | Pillow, OpenCV, NumPy |
| Slicing | SAHI-style via `supervision.InferenceSlicer` |

## Running locally

```bash
cd services/detector
pip install -r requirements.txt
uvicorn app.main:app --port 8001
```

Or via Docker Compose:

```bash
docker compose up detector
# Detector listens on host port 3008
```

Environment variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| `YOLO_MODEL` | `yolo26/yolo26l.pt` | Active model path (relative to service root) |
| `YOLO_IMGSZ` | `960` | Default inference resolution (must be multiple of 32) |
| `YOLO_AUGMENT` | `false` | Enable test-time augmentation |
| `YOLO_SLICE` | `false` | Enable SAHI-style tiled inference |
| `YOLO_SMOOTH` | `true` | Enable DetectionsSmoother (temporal smoothing) |
| `DEMO_VIDEO_PATH` | `/data/video/dummy.mp4` | Video file for demo endpoint |
| `DEMO_CACHE_DIR` | `/data/cache` | Pre-processed detection cache directory |
| `DEMO_STRIDE` | `0.3` | Frame stride for demo pre-processing (seconds) |

## API endpoints

### `GET /health`
Returns `{"status": "ok"}`. Used by Docker healthcheck (starts with 60s grace period because model loading takes ~30s).

### `GET /config`
Returns the active model configuration:
```json
{
  "model": "yolo26/yolo26l.pt",
  "is_segmentation": false,
  "models": ["yolo26/yolo26l.pt", ...],
  "imgsz": 960,
  "augment": false,
  "slice": false,
  "smooth": true,
  "stride": 0.3
}
```

### `POST /config/model`
Switch to a different model at runtime. Resets ByteTrack state.
```json
{ "model": "yolo26/yolo26s.pt" }
```

### `POST /detect`
Main inference endpoint. Accepts a multipart image upload.

Query parameters:
| Param | Default | Range | Description |
|-------|---------|-------|-------------|
| `conf` | 0.15 | 0.05–0.95 | Confidence threshold |
| `iou` | 0.45 | 0.1–0.9 | NMS IoU threshold |
| `imgsz` | 960 | 320–1536 | Inference image size |
| `augment` | false | — | Test-time augmentation |
| `slice` | false | — | SAHI tiled inference |
| `smooth` | true | — | Temporal smoothing |

Response (`DetectionResponse`):
```json
{
  "detections": [
    {
      "animal": "cat",
      "confidence": 0.872,
      "bbox": {"x": 0.12, "y": 0.34, "w": 0.15, "h": 0.18},
      "class_id": 15,
      "class_name": "cat",
      "track_id": 3,
      "mask": [[0.12, 0.34], ...]   // null for detection models
    }
  ],
  "inference_ms": 124.5,
  "is_segmentation": false
}
```

Bounding box coordinates are **normalised** to the input image dimensions (0.0–1.0).

### `POST /tracker/reset`
Resets the ByteTrack tracker and smoother state. Call this between unrelated video streams to avoid stale track IDs.

### `GET /demo/detections`
Returns pre-computed detections from the cached demo video. Starts background processing if the cache is missing.

### `POST /demo/process`
Triggers (re-)processing of the demo video. Accepts the same query params as `/detect` plus `stride` (seconds between sampled frames) and `force` (ignore cache).

## Model files

```
services/detector/models/
├── yolo26/
│   ├── yolo26n.pt   # nano   — fastest,  lowest accuracy
│   ├── yolo26s.pt   # small
│   ├── yolo26m.pt   # medium
│   ├── yolo26l.pt   # large  — default in production
│   └── yolo26x.pt   # xlarge — best accuracy, slowest
├── yolo26-seg/
│   ├── yolo26n-seg.pt
│   ├── yolo26s-seg.pt
│   ├── yolo26m-seg.pt
│   ├── yolo26l-seg.pt
│   └── yolo26x-seg.pt
└── yolo8/
    ├── yolov8s.pt
    └── yolov8l.pt
```

The custom fine-tuned weight `catFinderV14_yoloWeights.pt` is stored at the service root and can be loaded via the `/config/model` endpoint.

## Detection pipeline (`app/pipeline.py`)

### Preprocessing
Before inference, the pipeline crops a dark OS dock strip from the bottom of the image (if the mean brightness of the bottom 12% is < 80). This is relevant for screen recordings from tablets/phones.

### Inference modes
- **Standard:** `model.predict()` on the full image.
- **Sliced (SAHI):** `InferenceSlicer` divides the image into overlapping ~(W/2+64)×(H/2+64) tiles, runs inference on each, then merges with NMS. Improves recall on small/distant cats.

### Post-processing
1. Class-agnostic NMS (`dets.with_nms(threshold=iou)`)
2. ByteTrack tracking (`_tracker.update_with_detections`)
3. Optional `DetectionsSmoother` with a 2-frame window to reduce jitter

### Animal remapping
COCO class 15 (`cat`) and class 16 (`dog`) are both mapped to `"cat"` in the output — relevant because some YOLO checkpoints classify small animals as dogs.

## Concurrency model

A `ThreadPoolExecutor(max_workers=1)` serialises all inference calls. YOLO is not thread-safe and GPU memory is limited; a single-worker pool prevents races while still allowing FastAPI to handle other requests concurrently.

## Integration with admin

The admin dashboard proxies `/detector/*` → this service. The browser never connects directly to port 3008. The admin page POSTs frames to `/detector/detect` via the proxy.

## Docker

```dockerfile
# services/detector/Dockerfile
FROM python:3.11-slim
...
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
```

The `detector_cache` Docker volume persists pre-computed demo detections across container restarts.

Internal port: **8001**. Exposed as **3008** in `docker-compose.yml`.

Not exposed through the Cloudflare Tunnel — accessed only through the admin Next.js proxy.
