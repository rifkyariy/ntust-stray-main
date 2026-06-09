import asyncio
import io
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, File, UploadFile, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image

from app import detector, pipeline, demo
from app.schemas import DetectionResponse

_executor = ThreadPoolExecutor(max_workers=1)

app = FastAPI(title="Stray Detector", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/config")
def get_config() -> dict:
    return detector.get_config()


class ModelSwitchRequest(BaseModel):
    model: str


@app.post("/config/model")
def switch_model(req: ModelSwitchRequest) -> dict:
    return detector.set_model(req.model)


@app.post("/detect", response_model=DetectionResponse)
async def detect(
    file: UploadFile = File(...),
    conf:    float = Query(default=0.15, ge=0.05, le=0.95),
    iou:     float = Query(default=0.45, ge=0.1,  le=0.9),
    imgsz:   int   = Query(default=960,  ge=320,  le=1536),
    augment: bool  = Query(default=False),
    slice:   bool  = Query(default=False),
    smooth:  bool  = Query(default=True),
) -> DetectionResponse:
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=415, detail=f"Unsupported media type: {file.content_type}")

    data = await file.read()
    try:
        image = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Cannot decode image: {exc}") from exc

    loop = asyncio.get_event_loop()
    detections, inference_ms, is_seg = await loop.run_in_executor(
        _executor,
        lambda: detector.run_detection(image, conf, iou, imgsz, augment, slice, smooth),
    )
    return DetectionResponse(detections=detections, inference_ms=inference_ms, is_segmentation=is_seg)


@app.post("/tracker/reset")
def tracker_reset() -> dict:
    pipeline.reset_tracking()
    return {"status": "ok"}


@app.get("/demo/detections")
def demo_detections() -> dict:
    return demo.ensure_started()


@app.post("/demo/process")
def demo_process(
    conf:   float = Query(default=0.15, ge=0.05, le=0.95),
    iou:    float = Query(default=0.45, ge=0.1, le=0.9),
    imgsz:  int   = Query(default=960, ge=320, le=1536),
    slice:  bool  = Query(default=False),
    smooth: bool  = Query(default=True),
    stride: float = Query(default=0.5, ge=0.1, le=2.0),
    force:  bool  = Query(default=False),
) -> dict:
    settings = {
        "conf": conf, "iou": iou, "imgsz": imgsz,
        "slice": slice, "smooth": smooth, "stride": stride,
    }
    return demo.start_processing(settings, force=force)
