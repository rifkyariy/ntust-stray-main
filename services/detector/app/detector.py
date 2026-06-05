"""
YOLOv8 inference wrapper.
Model is loaded once at import time (singleton pattern).
Supports multiple model weights via YOLO_MODEL environment variable.
"""
import os
import time
from pathlib import Path
from PIL import Image
from ultralytics import YOLO

# ── COCO class mapping ──────────────────────────────────────────────────────
# Only classes we care about for stray animal monitoring
_ANIMAL_MAP: dict[int, str] = {
    14: "other",   # bird
    15: "cat",
    16: "dog",
    17: "other",   # horse
    18: "other",   # sheep
    19: "other",   # cow
    20: "other",   # elephant
    21: "other",   # bear
    22: "other",   # zebra
    23: "other",   # giraffe
}

# Only detect animals (skip people, vehicles, etc.)
_ANIMAL_CLASS_IDS = set(_ANIMAL_MAP.keys())

_model: YOLO | None = None


def _get_model() -> YOLO:
    global _model
    if _model is None:
        model_name = os.getenv("YOLO_MODEL", "catFinderV14_yoloWeights.pt")
        weights = Path(model_name)
        if not weights.exists():
            raise FileNotFoundError(f"Model not found: {model_name}")
        _model = YOLO(str(weights))
    return _model


def run_detection(
    image: Image.Image,
    conf_threshold: float = 0.45,
    iou_threshold: float = 0.45,
) -> tuple[list[dict], float]:
    """
    Run YOLOv8 on a PIL image.

    Returns (detections, inference_ms).
    Each detection: {animal, confidence, bbox:{x,y,w,h}, class_id, class_name}
    bbox coordinates are normalised to [0, 1] relative to image dimensions.
    """
    model = _get_model()

    t0 = time.perf_counter()
    results = model.predict(
        image,
        conf=conf_threshold,
        iou=iou_threshold,
        verbose=False,
    )
    inference_ms = (time.perf_counter() - t0) * 1000

    detections: list[dict] = []
    img_w, img_h = image.size

    for r in results:
        for box in r.boxes:
            cls_id = int(box.cls[0].item())

            # Skip non-animal classes
            if cls_id not in _ANIMAL_CLASS_IDS:
                continue

            conf = float(box.conf[0].item())
            x1, y1, x2, y2 = (v.item() for v in box.xyxy[0])

            detections.append(
                {
                    "animal": _ANIMAL_MAP[cls_id],
                    "confidence": round(conf, 4),
                    "bbox": {
                        "x": round(x1 / img_w, 4),
                        "y": round(y1 / img_h, 4),
                        "w": round((x2 - x1) / img_w, 4),
                        "h": round((y2 - y1) / img_h, 4),
                    },
                    "class_id": cls_id,
                    "class_name": r.names[cls_id],
                }
            )

    return detections, round(inference_ms, 1)
