import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.db.models import Station
from app.influx.queries import get_station_metrics

router = APIRouter(prefix="/stations", tags=["metrics"])

VALID_RANGES = {"1h", "24h", "7d"}


@router.get("/{station_id}/metrics")
async def station_metrics(
    station_id: uuid.UUID,
    range: str = Query(default="1h"),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    if range not in VALID_RANGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"range must be one of {VALID_RANGES}",
        )
    result = await db.execute(select(Station).where(Station.id == station_id))
    station = result.scalar_one_or_none()
    if station is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Station not found")
    return await get_station_metrics(station_id=station.station_code, range_str=range)
