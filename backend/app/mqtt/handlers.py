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
