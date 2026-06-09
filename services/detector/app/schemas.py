from pydantic import BaseModel


class BBox(BaseModel):
    x: float  # left edge, relative 0-1
    y: float  # top edge, relative 0-1
    w: float  # width, relative 0-1
    h: float  # height, relative 0-1


class DetectionItem(BaseModel):
    animal: str
    confidence: float
    bbox: BBox
    class_id: int
    class_name: str
    track_id: int | None = None
    mask: list[list[float]] | None = None  # [[x,y], ...] normalised 0-1, seg models only


class DetectionResponse(BaseModel):
    detections: list[DetectionItem]
    inference_ms: float
    is_segmentation: bool = False
