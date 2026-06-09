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
