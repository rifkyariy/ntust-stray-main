import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from app.db.session import get_db
from app.db.models import Donation, Station
from app.core.schemas import DonationCreate, DonationOut
from app.mqtt.publisher import publish_dispense_command
from app.influx.writer import write_donation_event

router = APIRouter(prefix="/donations", tags=["donations"])


@router.post("", response_model=DonationOut, status_code=status.HTTP_201_CREATED)
async def create_donation(
    body: DonationCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> Donation:
    # Verify station exists
    result = await db.execute(select(Station).where(Station.id == body.station_id))
    station = result.scalar_one_or_none()
    if station is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Station not found")

    donation = Donation(
        station_id=body.station_id,
        amount_ntd=body.amount_ntd,
        donor_name=body.donor_name,
        dispensed=body.dispense,
    )
    db.add(donation)
    await db.commit()
    await db.refresh(donation)

    # Trigger dispense if requested
    if body.dispense:
        # Map amount → grams using the fixed price tiers
        amt = float(body.amount_ntd)
        if amt >= 90:
            grams = 200
        elif amt >= 75:
            grams = 150
        elif amt >= 50:
            grams = 100
        else:
            grams = 50
        background_tasks.add_task(publish_dispense_command, station.station_code, grams, "donation")
        background_tasks.add_task(
            write_donation_event, station.station_code,
            float(body.amount_ntd), body.donor_name or "Anonymous"
        )

    return donation


@router.get("/daily")
async def daily_donation_counts(
    station_id: uuid.UUID = Query(...),
    days: int = Query(90, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Return donation counts per day (Asia/Taipei) for the last N days."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    stmt = (
        select(
            func.date(func.timezone("Asia/Taipei", Donation.created_at)).label("day"),
            func.count().label("count"),
        )
        .where(Donation.station_id == station_id)
        .where(Donation.created_at >= cutoff)
        .group_by(text("day"))
        .order_by(text("day"))
    )
    result = await db.execute(stmt)
    return [{"date": str(row.day), "count": int(row.count)} for row in result.all()]


@router.get("", response_model=list[DonationOut])
async def list_donations(
    station_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[Donation]:
    stmt = select(Donation).order_by(Donation.created_at.desc()).limit(200)
    if station_id:
        stmt = stmt.where(Donation.station_id == station_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())
