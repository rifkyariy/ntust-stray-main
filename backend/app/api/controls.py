import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.db.models import Station, Schedule, AdminUser
from app.core.schemas import DispenseCommand, ScheduleBody, ScheduleOut
from app.core.security import get_current_admin
from app.mqtt.publisher import publish_dispense_command
from app.scheduler import add_schedule_job, remove_schedule_job

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
    ok = await publish_dispense_command(station.station_code, body.grams, body.trigger)
    if not ok:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="MQTT broker unreachable")
    return {"ok": True, "station_code": station.station_code, "grams": body.grams, "dispensing_ms": body.grams // 50 * 600}


@router.post("/{station_id}/schedule", response_model=ScheduleOut)
async def set_schedule(
    station_id: uuid.UUID,
    body: ScheduleBody,
    db: AsyncSession = Depends(get_db),
) -> Schedule:
    """Create a schedule slot. No admin auth required — mobile app also calls this."""
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
    if body.active:
        add_schedule_job(schedule.id, station.station_code, body.cron_expr, body.grams)
    return schedule


@router.get("/{station_id}/schedules", response_model=List[ScheduleOut])
async def list_schedules(
    station_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> list:
    """List all schedule slots for a station. Public — no auth required."""
    result = await db.execute(
        select(Schedule).where(Schedule.station_id == station_id).order_by(Schedule.id)
    )
    return result.scalars().all()


@router.delete("/{station_id}/schedules/{schedule_id}", status_code=204)
async def delete_schedule(
    station_id: uuid.UUID,
    schedule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _admin: AdminUser = Depends(get_current_admin),
) -> None:
    """Delete a schedule slot. Admin-only."""
    result = await db.execute(
        select(Schedule).where(Schedule.id == schedule_id, Schedule.station_id == station_id)
    )
    schedule = result.scalar_one_or_none()
    if schedule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")
    remove_schedule_job(schedule_id)
    await db.delete(schedule)
    await db.commit()
