import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, stations, donations, controls, events, metrics, payments
from app.ws import router as ws_router
from app.mqtt.client import mqtt_listener
from app.scheduler import scheduler, load_all_schedules
from app.db.session import AsyncSessionLocal

_BANNER = r"""
  ____  _____ ____      _    __   __     _    ____  ___
 / ___||_   _||  _ \   / \   \ \ / /    / \  |  _ \|_ _|
 \___ \  | |  | |_) | / _ \   \ V /   / _ \ | |_) || |
  ___) | | |  |  _ < / ___ \   | |   / ___ \|  __/ | |
 |____/ |_|  |_| \_/_/   \_\  |_|  /_/   \_\_|   |___|

  Stray Cat Feeder Network  ·  v0.1.0
  National Taiwan University of Science and Technology
  ─────────────────────────────────────────────────────────
  GET    /health                  service health check
  GET    /stations                list all stations
  GET    /donations               donation records
  POST   /payments/sessions       initiate payment + OLED QR
  GET    /payments/sessions/{id}  session status
  WS     /ws                      live telemetry stream
  ─────────────────────────────────────────────────────────
  Docs   https://api-stray.heretichydra.xyz/docs
  MQTT   mqtt-stray.heretichydra.xyz  (WebSocket :443)
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(mqtt_listener())
    scheduler.start()
    async with AsyncSessionLocal() as db:
        await load_all_schedules(db)
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    scheduler.shutdown(wait=False)


app = FastAPI(title="Stray API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(stations.router)
app.include_router(donations.router)
app.include_router(controls.router)
app.include_router(events.router)
app.include_router(metrics.router)
app.include_router(payments.router)
app.include_router(ws_router.router)


@app.get("/", response_class=PlainTextResponse, include_in_schema=False)
async def root() -> str:
    return _BANNER


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
