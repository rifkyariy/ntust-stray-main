from fastapi import APIRouter, Query
from app.influx.queries import get_recent_feed_events

router = APIRouter(prefix="/events", tags=["events"])


@router.get("")
async def list_events(
    station_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[dict]:
    return await get_recent_feed_events(station_id=station_id, limit=limit)
