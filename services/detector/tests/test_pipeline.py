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
