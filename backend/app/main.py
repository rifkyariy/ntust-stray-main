import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, stations, donations, controls, events, metrics
from app.ws import router as ws_router
from app.mqtt.client import mqtt_listener


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(mqtt_listener())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


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
app.include_router(ws_router.router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
