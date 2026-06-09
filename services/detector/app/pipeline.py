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
