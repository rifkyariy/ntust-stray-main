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
