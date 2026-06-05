import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.db.models import Station, Schedule, AdminUser
from app.core.schemas import DispenseCommand, ScheduleCreate, ScheduleOut
from app.core.security import get_current_admin
from app.mqtt.publisher import publish_dispense_command, publish_schedule_command

router = APIRouter(prefix="/stations", tags=["controls"])


@router.post("/{station_id}/dispense")
async def dispense_now(
    station_id: uuid.UUID,
    body: DispenseCommand,
    db: AsyncSession = Depends(get_db),
    _admin: AdminUser = Depends(get_current_admin),
) -> dict:
    result = await db.execute(select(Station).where(Station.id == station_id))
    station = result.scalar_one_or_none()
    if station is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Station not found")
    await publish_dispense_command(station.station_code, body.grams, body.trigger)
    return {"ok": True, "station_code": station.station_code, "grams": body.grams}


@router.post("/{station_id}/schedule", response_model=ScheduleOut)
async def set_schedule(
    station_id: uuid.UUID,
    body: ScheduleCreate,
    db: AsyncSession = Depends(get_db),
    _admin: AdminUser = Depends(get_current_admin),
) -> Schedule:
    result = await db.execute(select(Station).where(Station.id == station_id))
    station = result.scalar_one_or_none()
    if station is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Station not found")

    schedule = Schedule(
        station_id=station_id,
        cron_expr=body.cron_expr,
        grams=body.grams,
        active=body.active,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    await publish_schedule_command(station.station_code, body.cron_expr, body.grams, body.active)
    return schedule
