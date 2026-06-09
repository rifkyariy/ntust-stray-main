"""
YOLO26 / YOLOv8 inference + ByteTrack tracking.
Supports both detection and segmentation models.
Model loaded lazily (singleton). Switching model via set_model() resets the singleton.
"""
import os
import time
from pathlib import Path
from PIL import Image
from ultralytics import YOLO

_COCO_ANIMALS: dict[int, str] = {
    15: "cat",
    16: "cat",  # COCO "dog" → remap to cat for feeder context (small cats misclassified)
}
_ANIMAL_CLASS_IDS = list(_COCO_ANIMALS.keys())

_model: YOLO | None = None

_cfg: dict = {
    "model": os.getenv("YOLO_MODEL", "yolo26/yolo26l.pt"),
    # Inference resolution — higher = better small-object recall, slower.
    # Must be a multiple of 32. 640 (fast) / 960 (balanced) / 1280 (best).
    "imgsz": int(os.getenv("YOLO_IMGSZ", "960")),
    # Test-time augmentation (multi-scale + flips) — better recall, ~3× slower.
    "augment": os.getenv("YOLO_AUGMENT", "false").lower() in ("1", "true", "yes"),
}


def _round32(v: int) -> int:
    """YOLO requires imgsz to be a multiple of 32."""
    v = max(320, min(1536, int(v)))
    return int(round(v / 32) * 32)


def _is_seg(path: str) -> bool:
    return "-seg" in path


def list_models() -> list[str]:
    return [str(p) for p in sorted(Path(".").rglob("*.pt"))]


def get_config() -> dict:
    return {
        "model": _cfg["model"],
        "is_segmentation": _is_seg(_cfg["model"]),
        "models": list_models(),
        "imgsz": _cfg["imgsz"],
        "augment": _cfg["augment"],
    }


def set_model(model_path: str) -> dict:
    global _model, _cfg
    if model_path != _cfg["model"]:
        _model = None
        _cfg["model"] = model_path
    return get_config()


def _get_model() -> YOLO:
    global _model
    if _model is None:
        candidates = [
            _cfg["model"],
            "yolo26/yolo26l.pt", "yolo26/yolo26m.pt", "yolo26/yolo26s.pt",
            "yolo8/yolov8l.pt", "yolo8/yolov8s.pt",
        ]
        seen: set[str] = set()
        for name in candidates:
            if name in seen:
                continue
            seen.add(name)
            try:
                _model = YOLO(name)
                _cfg["model"] = name
                print(f"[detector] loaded model: {name}")
                break
            except Exception as e:
                print(f"[detector] skipping {name}: {e}")
        if _model is None:
            raise RuntimeError("No usable YOLO model found")
    return _model


def _preprocess(image: Image.Image) -> tuple[Image.Image, float]:
    """
    Crop the dark OS dock/taskbar strip off screen recordings so it doesn't
    skew detection or coordinate normalisation. Resolution scaling is left to
    YOLO's letterbox resize (driven by imgsz) to avoid double interpolation.
    Returns (image, y_scale) where y_scale maps processed y back to the
    original frame height.
    """
    orig_w, orig_h = image.size

    strip_h = int(orig_h * 0.12)
    bottom = image.crop((0, orig_h - strip_h, orig_w, orig_h))
    px = list(bottom.convert("L").getdata())
    if sum(px) / len(px) < 80:
        image = image.crop((0, 0, orig_w, orig_h - strip_h))

    crop_h = image.size[1]
    return image, crop_h / orig_h  # y_scale


def run_detection(
    image: Image.Image,
    conf_threshold: float = 0.15,
    iou_threshold: float = 0.45,
    imgsz: int | None = None,
    augment: bool | None = None,
) -> tuple[list[dict], float, bool]:
    """
    Returns (detections, inference_ms, is_segmentation).
    bbox and mask coords are normalised [0,1] relative to the original image.
    imgsz / augment fall back to the configured defaults when not supplied.
    """
    imgsz = _round32(imgsz if imgsz is not None else _cfg["imgsz"])
    augment = _cfg["augment"] if augment is None else augment

    image, y_scale = _preprocess(image)
    proc_w, proc_h = image.size

    model = _get_model()
    seg = _is_seg(_cfg["model"])

    t0 = time.perf_counter()
    results = model.track(
        image,
        conf=conf_threshold,
        iou=iou_threshold,
        imgsz=imgsz,
        augment=augment,
        classes=_ANIMAL_CLASS_IDS,
        tracker="bytetrack.yaml",
        persist=True,
        verbose=False,
    )
    inference_ms = (time.perf_counter() - t0) * 1000

    detections: list[dict] = []

    for r in results:
        for idx, box in enumerate(r.boxes):
            cls_id  = int(box.cls[0].item())
            animal  = _COCO_ANIMALS.get(cls_id, "other")
            conf    = float(box.conf[0].item())
            x1, y1, x2, y2 = (v.item() for v in box.xyxy[0])

            x_n = x1 / proc_w
            y_n = (y1 / proc_h) * y_scale
            w_n = (x2 - x1) / proc_w
            h_n = ((y2 - y1) / proc_h) * y_scale

            track_id: int | None = None
            if box.id is not None:
                track_id = int(box.id[0].item())

            mask_poly: list[list[float]] | None = None
            if seg and r.masks is not None:
                try:
                    pts = r.masks.xy[idx]  # (N, 2) pixel coords of contour polygon
                    mask_poly = [
                        [round(float(pt[0]) / proc_w, 4),
                         round(float(pt[1]) / proc_h * y_scale, 4)]
                        for pt in pts
                    ]
                except (IndexError, AttributeError):
                    pass

            detections.append({
                "animal":     animal,
                "confidence": round(conf, 4),
                "bbox": {
                    "x": round(x_n, 4), "y": round(y_n, 4),
                    "w": round(w_n, 4), "h": round(h_n, 4),
                },
                "class_id":  cls_id,
                "class_name": r.names[cls_id],
                "track_id":  track_id,
                "mask":      mask_poly,
            })

    return detections, round(inference_ms, 1), seg
