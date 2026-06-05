import io
from fastapi import FastAPI, File, UploadFile, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from app.detector import run_detection
from app.schemas import DetectionResponse

app = FastAPI(title="Stray Detector", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/detect", response_model=DetectionResponse)
async def detect(
    file: UploadFile = File(..., description="JPEG/PNG video frame"),
    conf: float = Query(default=0.45, ge=0.1, le=0.95, description="Confidence threshold"),
    iou:  float = Query(default=0.45, ge=0.1, le=0.9,  description="IoU threshold"),
) -> DetectionResponse:
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported media type: {file.content_type}",
        )

    data = await file.read()
    try:
        image = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Cannot decode image: {exc}") from exc

    detections, inference_ms = run_detection(image, conf_threshold=conf, iou_threshold=iou)

    return DetectionResponse(detections=detections, inference_ms=inference_ms)
