"""
YOLO26 / YOLOv8 inference + ByteTrack tracking.
Supports both detection and segmentation models.
Model loaded lazily (singleton). Switching model via set_model() resets the singleton.
"""
import os
from pathlib import Path
from PIL import Image
from ultralytics import YOLO

_model: YOLO | None = None

_cfg: dict = {
    "model": os.getenv("YOLO_MODEL", "yolo26/yolo26l.pt"),
    # Inference resolution — higher = better small-object recall, slower.
    # Must be a multiple of 32. 640 (fast) / 960 (balanced) / 1280 (best).
    "imgsz": int(os.getenv("YOLO_IMGSZ", "960")),
    # Test-time augmentation (multi-scale + flips) — better recall, ~3× slower.
    "augment": os.getenv("YOLO_AUGMENT", "false").lower() in ("1", "true", "yes"),
    "slice":  os.getenv("YOLO_SLICE", "false").lower() in ("1", "true", "yes"),
    "smooth": os.getenv("YOLO_SMOOTH", "true").lower() in ("1", "true", "yes"),
    "stride": float(os.getenv("DEMO_STRIDE", "0.3")),
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
        "slice":  _cfg["slice"],
        "smooth": _cfg["smooth"],
        "stride": _cfg["stride"],
    }


def set_model(model_path: str) -> dict:
    global _model, _cfg
    if model_path != _cfg["model"]:
        _model = None
        from app import pipeline
        pipeline.reset_tracking()
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
