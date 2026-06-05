import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.db.models import Station
from app.core.schemas import StationCreate, StationOut, StationUpdate

router = APIRouter(prefix="/stations", tags=["stations"])


@router.get("", response_model=list[StationOut])
async def list_stations(
    city: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[Station]:
    stmt = select(Station).order_by(Station.city, Station.station_code)
    if city:
        stmt = stmt.where(Station.city == city)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/{station_id}", response_model=StationOut)
async def get_station(station_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> Station:
    result = await db.execute(select(Station).where(Station.id == station_id))
    station = result.scalar_one_or_none()
    if station is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Station not found")
    return station


@router.post("", response_model=StationOut, status_code=status.HTTP_201_CREATED)
async def create_station(
    body: StationCreate,
    db: AsyncSession = Depends(get_db),
) -> Station:
    station = Station(**body.model_dump())
    db.add(station)
    await db.commit()
    await db.refresh(station)
    return station


@router.patch("/{station_id}", response_model=StationOut)
async def update_station(
    station_id: uuid.UUID,
    body: StationUpdate,
    db: AsyncSession = Depends(get_db),
) -> Station:
    result = await db.execute(select(Station).where(Station.id == station_id))
    station = result.scalar_one_or_none()
    if station is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Station not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(station, field, value)
    await db.commit()
    await db.refresh(station)
    return station
