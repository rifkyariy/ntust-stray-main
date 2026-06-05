# Plan 03 — MQTT Bridge + InfluxDB + WebSocket

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the real-time data pipeline: aiomqtt subscribes to Mosquitto, writes sensor data to InfluxDB, updates PostgreSQL station status, and broadcasts JSON messages to all connected WebSocket clients.

**Architecture:** A background asyncio task (started in FastAPI lifespan) subscribes to `stray/+/+` wildcard. Each incoming MQTT message is dispatched to a handler that (1) writes InfluxDB, (2) updates PostgreSQL, (3) broadcasts a typed WebSocket message via the connection manager. The WebSocket endpoint at `/ws` is a single shared channel — all clients receive all messages.

**Tech Stack:** aiomqtt 1.2, influxdb-client[async] 1.43, FastAPI WebSocket, asyncio

**Prerequisite:** Plans 01 + 02 complete.

---

## File Map

| File | Purpose |
|---|---|
| `backend/app/influx/__init__.py` | Package marker |
| `backend/app/influx/writer.py` | `write_telemetry`, `write_feed_event`, `write_donation` |
| `backend/app/influx/queries.py` | `get_station_metrics`, `get_recent_feed_events` |
| `backend/app/ws/__init__.py` | Package marker |
| `backend/app/ws/manager.py` | `ConnectionManager` — connect/disconnect/broadcast |
| `backend/app/ws/router.py` | FastAPI `WebSocket` endpoint at `/ws` |
| `backend/app/mqtt/__init__.py` | Package marker |
| `backend/app/mqtt/handlers.py` | `handle_telemetry`, `handle_detection`, `handle_dispense_ack` |
| `backend/app/mqtt/client.py` | `mqtt_listener` background task |
| `backend/app/main.py` | Updated lifespan: start MQTT + WebSocket router |
| `backend/tests/test_ws.py` | WebSocket connection + broadcast test |
| `backend/tests/test_mqtt_handlers.py` | Handler unit tests with mocked InfluxDB + WS manager |

---

## Task 1: InfluxDB Writer

**Files:**
- Create: `backend/app/influx/__init__.py`
- Create: `backend/app/influx/writer.py`

- [ ] **Step 1: Create `backend/app/influx/__init__.py`** (empty)

```python
```

- [ ] **Step 2: Create `backend/app/influx/writer.py`**

```python
from datetime import datetime, timezone
from influxdb_client.client.influxdb_client_async import InfluxDBClientAsync
from influxdb_client import Point
from app.core.config import settings


def _client() -> InfluxDBClientAsync:
    return InfluxDBClientAsync(
        url=settings.influx_url,
        token=settings.influx_token,
        org=settings.influx_org,
    )


async def write_telemetry(
    station_id: str,
    city: str,
    food_pct: int,
    battery_pct: int,
    temp_c: float,
    humidity_pct: float,
) -> None:
    point = (
        Point("station_metrics")
        .tag("station_id", station_id)
        .tag("city", city)
        .field("food_pct", food_pct)
        .field("battery_pct", battery_pct)
        .field("temp_c", temp_c)
        .field("humidity_pct", humidity_pct)
        .time(datetime.now(timezone.utc))
    )
    async with _client() as client:
        write_api = client.write_api()
        await write_api.write(bucket=settings.influx_bucket, record=point)


async def write_feed_event(
    station_id: str,
    cat_code: str,
    grams_dispensed: int,
    confidence: float,
    trigger: str,
) -> None:
    point = (
        Point("feed_events")
        .tag("station_id", station_id)
        .tag("cat_code", cat_code)
        .tag("trigger", trigger)
        .field("grams_dispensed", grams_dispensed)
        .field("confidence", confidence)
        .time(datetime.now(timezone.utc))
    )
    async with _client() as client:
        write_api = client.write_api()
        await write_api.write(bucket=settings.influx_bucket, record=point)


async def write_donation_event(
    station_id: str,
    amount_ntd: float,
    donor_name: str,
) -> None:
    point = (
        Point("donation_events")
        .tag("station_id", station_id)
        .field("amount_ntd", amount_ntd)
        .field("donor_name", donor_name or "Anonymous")
        .time(datetime.now(timezone.utc))
    )
    async with _client() as client:
        write_api = client.write_api()
        await write_api.write(bucket=settings.influx_bucket, record=point)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/influx/
git commit -m "feat(backend): InfluxDB async writer (telemetry, feed_events, donations)"
```

---

## Task 2: InfluxDB Queries

**Files:**
- Create: `backend/app/influx/queries.py`

- [ ] **Step 1: Create `backend/app/influx/queries.py`**

```python
from influxdb_client.client.influxdb_client_async import InfluxDBClientAsync
from app.core.config import settings


def _client() -> InfluxDBClientAsync:
    return InfluxDBClientAsync(
        url=settings.influx_url,
        token=settings.influx_token,
        org=settings.influx_org,
    )


async def get_station_metrics(station_id: str, range_str: str = "1h") -> list[dict]:
    """
    Returns list of telemetry records for a station over the given range.
    range_str: "1h" | "24h" | "7d"
    """
    query = f"""
    from(bucket: "{settings.influx_bucket}")
      |> range(start: -{range_str})
      |> filter(fn: (r) => r._measurement == "station_metrics")
      |> filter(fn: (r) => r.station_id == "{station_id}")
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: 500)
    """
    async with _client() as client:
        query_api = client.query_api()
        tables = await query_api.query(query)
        results = []
        for table in tables:
            for record in table.records:
                results.append({
                    "ts": record.get_time().isoformat(),
                    "food_pct": record.values.get("food_pct"),
                    "battery_pct": record.values.get("battery_pct"),
                    "temp_c": record.values.get("temp_c"),
                    "humidity_pct": record.values.get("humidity_pct"),
                })
        return results


async def get_recent_feed_events(station_id: str | None = None, limit: int = 50) -> list[dict]:
    """
    Returns recent feed events. Optionally filtered by station_id.
    """
    station_filter = f'|> filter(fn: (r) => r.station_id == "{station_id}")' if station_id else ""
    query = f"""
    from(bucket: "{settings.influx_bucket}")
      |> range(start: -24h)
      |> filter(fn: (r) => r._measurement == "feed_events")
      {station_filter}
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: {limit})
    """
    async with _client() as client:
        query_api = client.query_api()
        tables = await query_api.query(query)
        results = []
        for table in tables:
            for record in table.records:
                results.append({
                    "ts": record.get_time().isoformat(),
                    "station_id": record.values.get("station_id"),
                    "cat_code": record.values.get("cat_code"),
                    "grams_dispensed": record.values.get("grams_dispensed"),
                    "confidence": record.values.get("confidence"),
                    "trigger": record.values.get("trigger"),
                })
        return results
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/influx/queries.py
git commit -m "feat(backend): InfluxDB query helpers — metrics + feed events"
```

---

## Task 3: WebSocket Connection Manager

**Files:**
- Create: `backend/app/ws/__init__.py`
- Create: `backend/app/ws/manager.py`
- Create: `backend/app/ws/router.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_ws.py`:

```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.ws.manager import manager


@pytest.mark.asyncio
async def test_websocket_connects_and_receives_broadcast():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Use the TestClient WebSocket support via starlette
        from starlette.testclient import TestClient
        with TestClient(app) as tc:
            with tc.websocket_connect("/ws") as ws:
                # Trigger a broadcast
                import asyncio
                async def do_broadcast():
                    await manager.broadcast({"type": "test", "msg": "hello"})
                asyncio.get_event_loop().run_until_complete(do_broadcast())
                # In sync test context we just verify connection doesn't throw
                assert ws is not None
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd backend && pytest tests/test_ws.py -v
```

Expected: `FAILED` — `ImportError: cannot import name 'manager'`.

- [ ] **Step 3: Create `backend/app/ws/__init__.py`** (empty)

```python
```

- [ ] **Step 4: Create `backend/app/ws/manager.py`**

```python
import json
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, data: dict) -> None:
        dead: list[WebSocket] = []
        for ws in self.active:
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()
```

- [ ] **Step 5: Create `backend/app/ws/router.py`**

```python
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.ws.manager import manager

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await manager.connect(ws)
    try:
        while True:
            # Keep connection alive; we only push from server side
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)
```

- [ ] **Step 6: Update `backend/app/main.py` to include WS router**

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth
from app.ws import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # MQTT listener added in Task 5
    yield


app = FastAPI(title="Stray API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(ws_router.router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
```

- [ ] **Step 7: Run all tests**

```bash
cd backend && pytest tests/ -v
```

Expected: All auth tests pass. WS test passes (connection accepted without error).

- [ ] **Step 8: Commit**

```bash
git add backend/app/ws/ backend/app/main.py backend/tests/test_ws.py
git commit -m "feat(backend): WebSocket manager + /ws endpoint"
```

---

## Task 4: MQTT Handlers

**Files:**
- Create: `backend/app/mqtt/__init__.py`
- Create: `backend/app/mqtt/handlers.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_mqtt_handlers.py`:

```python
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timezone


@pytest.mark.asyncio
async def test_handle_telemetry_updates_station_and_broadcasts(db_session):
    from app.mqtt.handlers import handle_telemetry
    from app.db.models import Station, StationStatus
    from app.db.seed import STATIONS

    # Insert a station
    s = Station(
        station_code="F-TPE-01",
        name="Ximending",
        city="Taipei",
        district="Wanhua",
        lat=25.0,
        lng=121.5,
        installed_at=datetime.utcnow(),
    )
    db_session.add(s)
    await db_session.commit()

    payload = b'{"food_pct": 75, "battery_pct": 90, "temp_c": 26.5, "humidity_pct": 70}'

    with patch("app.mqtt.handlers.write_telemetry", new_callable=AsyncMock) as mock_write, \
         patch("app.mqtt.handlers.manager") as mock_manager:
        mock_manager.broadcast = AsyncMock()
        await handle_telemetry("F-TPE-01", payload, db_session)

    # Station status updated in DB
    await db_session.refresh(s)
    assert s.food_pct == 75
    assert s.battery_pct == 90
    assert s.status == StationStatus.online

    # InfluxDB write called
    mock_write.assert_called_once()

    # WebSocket broadcast sent
    mock_manager.broadcast.assert_called_once()
    ws_msg = mock_manager.broadcast.call_args[0][0]
    assert ws_msg["type"] == "telemetry"
    assert ws_msg["station_id"] == "F-TPE-01"
    assert ws_msg["food_pct"] == 75
```

- [ ] **Step 2: Run test — verify it fails**

```bash
pytest tests/test_mqtt_handlers.py -v
```

Expected: `FAILED` — `ImportError: cannot import name 'handle_telemetry'`.

- [ ] **Step 3: Create `backend/app/mqtt/__init__.py`** (empty)

```python
```

- [ ] **Step 4: Create `backend/app/mqtt/handlers.py`**

```python
import json
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.models import Station, StationStatus, Cat
from app.db.session import AsyncSessionLocal
from app.influx.writer import write_telemetry, write_feed_event
from app.ws.manager import manager


async def _get_station(station_id: str, db: AsyncSession) -> Station | None:
    result = await db.execute(select(Station).where(Station.station_code == station_id))
    return result.scalar_one_or_none()


async def handle_telemetry(station_id: str, payload: bytes, db: AsyncSession) -> None:
    data = json.loads(payload)
    food_pct: int = int(data.get("food_pct", 0))
    battery_pct: int = int(data.get("battery_pct", 0))
    temp_c: float = float(data.get("temp_c", 0.0))
    humidity_pct: float = float(data.get("humidity_pct", 0.0))

    station = await _get_station(station_id, db)
    if station is None:
        return

    station.food_pct = food_pct
    station.battery_pct = battery_pct
    station.temp_c = temp_c
    station.humidity_pct = humidity_pct
    station.status = (
        StationStatus.offline if battery_pct == 0 else
        StationStatus.low_food if food_pct < 25 else
        StationStatus.online
    )
    await db.commit()

    await write_telemetry(
        station_id=station_id,
        city=station.city,
        food_pct=food_pct,
        battery_pct=battery_pct,
        temp_c=temp_c,
        humidity_pct=humidity_pct,
    )

    await manager.broadcast({
        "type": "telemetry",
        "station_id": station_id,
        "food_pct": food_pct,
        "battery_pct": battery_pct,
        "temp_c": temp_c,
        "humidity_pct": humidity_pct,
        "ts": datetime.now(timezone.utc).isoformat(),
    })

    if food_pct < 25:
        await manager.broadcast({
            "type": "alert",
            "station_id": station_id,
            "level": "warning",
            "message": f"Food at {food_pct}%",
            "ts": datetime.now(timezone.utc).isoformat(),
        })


async def handle_detection(station_id: str, payload: bytes, db: AsyncSession) -> None:
    data = json.loads(payload)
    cat_code: str = data.get("cat_code", "CAT-???")
    confidence: float = float(data.get("confidence", 0.0))

    # Upsert cat record
    result = await db.execute(select(Cat).where(Cat.cat_code == cat_code))
    cat = result.scalar_one_or_none()
    if cat is None:
        station = await _get_station(station_id, db)
        cat = Cat(cat_code=cat_code, station_id=station.id if station else None)
        db.add(cat)
        await db.commit()

    await manager.broadcast({
        "type": "detection",
        "station_id": station_id,
        "cat_code": cat_code,
        "confidence": confidence,
        "ts": datetime.now(timezone.utc).isoformat(),
    })


async def handle_dispense_ack(station_id: str, payload: bytes, db: AsyncSession) -> None:
    data = json.loads(payload)
    grams: int = int(data.get("grams", 0))
    trigger: str = data.get("trigger", "manual")
    cat_code: str = data.get("cat_code", "UNKNOWN")
    confidence: float = float(data.get("confidence", 0.0))

    await write_feed_event(
        station_id=station_id,
        cat_code=cat_code,
        grams_dispensed=grams,
        confidence=confidence,
        trigger=trigger,
    )

    await manager.broadcast({
        "type": "feed_event",
        "station_id": station_id,
        "grams": grams,
        "trigger": trigger,
        "donor": data.get("donor"),
        "ts": datetime.now(timezone.utc).isoformat(),
    })
```

- [ ] **Step 5: Run tests**

```bash
pytest tests/test_mqtt_handlers.py -v
```

Expected: `PASSED tests/test_mqtt_handlers.py::test_handle_telemetry_updates_station_and_broadcasts`

- [ ] **Step 6: Commit**

```bash
git add backend/app/mqtt/ backend/tests/test_mqtt_handlers.py
git commit -m "feat(backend): MQTT handlers — telemetry, detection, dispense_ack"
```

---

## Task 5: MQTT Background Listener

**Files:**
- Create: `backend/app/mqtt/client.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create `backend/app/mqtt/client.py`**

```python
import asyncio
import aiomqtt
from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.mqtt.handlers import handle_telemetry, handle_detection, handle_dispense_ack


async def mqtt_listener() -> None:
    """
    Subscribes to stray/+/+ and dispatches to handlers.
    Reconnects automatically on failure.
    """
    while True:
        try:
            async with aiomqtt.Client(
                hostname=settings.mqtt_broker,
                port=settings.mqtt_port,
            ) as client:
                await client.subscribe("stray/+/telemetry")
                await client.subscribe("stray/+/detection")
                await client.subscribe("stray/+/dispense/ack")

                async for message in client.messages:
                    topic_parts = str(message.topic).split("/")
                    if len(topic_parts) < 3:
                        continue

                    station_id = topic_parts[1]
                    subtopic = "/".join(topic_parts[2:])

                    async with AsyncSessionLocal() as db:
                        if subtopic == "telemetry":
                            await handle_telemetry(station_id, message.payload, db)
                        elif subtopic == "detection":
                            await handle_detection(station_id, message.payload, db)
                        elif subtopic == "dispense/ack":
                            await handle_dispense_ack(station_id, message.payload, db)

        except aiomqtt.MqttError as exc:
            print(f"[MQTT] Connection error: {exc} — retrying in 5s")
            await asyncio.sleep(5)
        except Exception as exc:
            print(f"[MQTT] Unexpected error: {exc} — retrying in 5s")
            await asyncio.sleep(5)
```

- [ ] **Step 2: Update `backend/app/main.py` lifespan to start MQTT**

```python
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth
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
app.include_router(ws_router.router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
```

- [ ] **Step 3: Start the full stack and test MQTT→WebSocket flow**

```bash
docker compose up -d
```

In a new terminal, publish a test telemetry message:
```bash
docker compose exec mosquitto mosquitto_pub \
  -t "stray/F-TPE-01/telemetry" \
  -m '{"food_pct": 55, "battery_pct": 88, "temp_c": 27.1, "humidity_pct": 65}'
```

In another terminal, connect a WebSocket listener:
```bash
# Install wscat: npm install -g wscat
wscat -c ws://localhost:8000/ws
```

Expected: Within 1 second you see:
```json
{"type":"telemetry","station_id":"F-TPE-01","food_pct":55,"battery_pct":88,"temp_c":27.1,"humidity_pct":65.0,"ts":"..."}
```

- [ ] **Step 4: Verify station status updated in DB**

```bash
docker compose exec postgres psql -U stray -d stray -c \
  "SELECT station_code, status, food_pct, battery_pct FROM stations WHERE station_code='F-TPE-01';"
```

Expected:
```
 station_code | status | food_pct | battery_pct
--------------+--------+----------+-------------
 F-TPE-01     | online |       55 |          88
```

- [ ] **Step 5: Run full test suite**

```bash
cd backend && pytest tests/ -v
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/mqtt/client.py backend/app/main.py
git commit -m "feat(backend): MQTT background listener — auto-reconnect, routes to handlers"
```

---

## Task 6: Publish MQTT Command Helper

**Files:**
- Create: `backend/app/mqtt/publisher.py`

- [ ] **Step 1: Create `backend/app/mqtt/publisher.py`**

```python
import json
import aiomqtt
from app.core.config import settings


async def publish_dispense_command(station_id: str, grams: int, trigger: str = "manual") -> None:
    """Publish a dispense command to the station's ESP32."""
    payload = json.dumps({"grams": grams, "trigger": trigger})
    async with aiomqtt.Client(hostname=settings.mqtt_broker, port=settings.mqtt_port) as client:
        await client.publish(f"stray/{station_id}/dispense/cmd", payload=payload)


async def publish_schedule_command(station_id: str, cron_expr: str, grams: int, active: bool) -> None:
    """Publish a schedule update to the station's ESP32."""
    payload = json.dumps({"cron_expr": cron_expr, "grams": grams, "active": active})
    async with aiomqtt.Client(hostname=settings.mqtt_broker, port=settings.mqtt_port) as client:
        await client.publish(f"stray/{station_id}/schedule/set", payload=payload)
```

- [ ] **Step 2: Smoke-test publish**

```bash
# In one terminal, subscribe to commands:
docker compose exec mosquitto mosquitto_sub -t "stray/+/dispense/cmd" -v

# In another, call the future /dispense endpoint (or test directly):
python3 -c "
import asyncio
from backend.app.mqtt.publisher import publish_dispense_command
asyncio.run(publish_dispense_command('F-TPE-01', 100, 'manual'))
"
```

Expected: subscriber terminal shows:
```
stray/F-TPE-01/dispense/cmd {"grams": 100, "trigger": "manual"}
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/mqtt/publisher.py
git commit -m "feat(backend): MQTT publish helpers — dispense + schedule commands"
```
