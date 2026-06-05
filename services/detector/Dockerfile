FROM python:3.12-slim

# Runtime libs needed by OpenCV / PyTorch + curl for downloading weights
RUN apt-get update && apt-get install -y --no-install-recommends \
        libglib2.0-0 libsm6 libxext6 libxrender1 libgomp1 libgl1 curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download all available YOLO models from catocam repo
RUN mkdir -p /root/.config/Ultralytics && \
    curl -L -o catFinderV5_yoloWeights.pt https://raw.githubusercontent.com/jones139/catocam/main/yolo/catFinderV5_yoloWeights.pt && \
    curl -L -o catFinderV8_yoloWeights.pt https://raw.githubusercontent.com/jones139/catocam/main/yolo/catFinderV8_yoloWeights.pt && \
    curl -L -o catFinderV9_yoloWeights.pt https://raw.githubusercontent.com/jones139/catocam/main/yolo/catFinderV9_yoloWeights.pt && \
    curl -L -o catFinderV10_yoloWeights.pt https://raw.githubusercontent.com/jones139/catocam/main/yolo/catFinderV10_yoloWeights.pt && \
    curl -L -o catFinderV11_yoloWeights.pt https://raw.githubusercontent.com/jones139/catocam/main/yolo/catFinderV11_yoloWeights.pt && \
    curl -L -o catFinderV13_yoloWeights.pt https://raw.githubusercontent.com/jones139/catocam/main/yolo/catFinderV13_yoloWeights.pt && \
    curl -L -o catFinderV14_yoloWeights.pt https://raw.githubusercontent.com/jones139/catocam/main/yolo/catFinderV14_yoloWeights.pt && \
    python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

COPY app/ ./app/

EXPOSE 8001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
