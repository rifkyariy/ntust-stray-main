import uuid
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
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
        grams = max(50, min(200, int(body.amount_ntd / 15 * 100)))
        background_tasks.add_task(publish_dispense_command, station.station_code, grams, "donation")
        background_tasks.add_task(
            write_donation_event, station.station_code,
            float(body.amount_ntd), body.donor_name or "Anonymous"
        )

    return donation


@router.get("", response_model=list[DonationOut])
async def list_donations(
    station_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[Donation]:
    stmt = select(Donation).order_by(Donation.created_at.desc()).limit(100)
    if station_id:
        stmt = stmt.where(Donation.station_id == station_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())
