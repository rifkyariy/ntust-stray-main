import uuid
import secrets
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.db.models import PaymentSession, PaymentStatus, Station, Donation
from app.core.schemas import PaymentSessionCreate, PaymentSessionOut
from app.mqtt.publisher import publish_show_qr, publish_dispense_command
from app.influx.writer import write_donation_event

router = APIRouter(prefix="/payments", tags=["payments"])

MOBILE_BASE = "https://stray.heretichydra.xyz"


def _short_id() -> str:
    return secrets.token_hex(3)  # 6 hex chars, e.g. "a3f9c1"


@router.post("/sessions", response_model=PaymentSessionOut, status_code=201)
async def create_session(
    body: PaymentSessionCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> PaymentSession:
    result = await db.execute(select(Station).where(Station.id == body.station_id))
    station = result.scalar_one_or_none()
    if station is None:
        raise HTTPException(status_code=404, detail="Station not found")

    session = PaymentSession(
        short_id=_short_id(),
        station_id=body.station_id,
        donor_name=body.donor_name or None,
        amount_ntd=body.amount_ntd,
        grams=body.grams,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    qr_url = f"{MOBILE_BASE}/payment/{session.short_id}"
    background_tasks.add_task(
        publish_show_qr, station.station_code, qr_url,
        float(body.amount_ntd), body.grams,
    )

    return session


@router.get("/sessions/{session_id}", response_model=PaymentSessionOut)
async def get_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> PaymentSession:
    result = await db.execute(select(PaymentSession).where(PaymentSession.id == session_id))
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.get("/sessions/by-short/{short_id}", response_model=PaymentSessionOut)
async def get_session_by_short(
    short_id: str,
    db: AsyncSession = Depends(get_db),
) -> PaymentSession:
    result = await db.execute(select(PaymentSession).where(PaymentSession.short_id == short_id))
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/sessions/{session_id}/pay", response_model=PaymentSessionOut)
async def pay_session(
    session_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> PaymentSession:
    result = await db.execute(select(PaymentSession).where(PaymentSession.id == session_id))
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != PaymentStatus.pending:
        raise HTTPException(status_code=409, detail=f"Session already {session.status}")

    station_result = await db.execute(select(Station).where(Station.id == session.station_id))
    station = station_result.scalar_one_or_none()

    session.status = PaymentStatus.paid
    session.paid_at = datetime.utcnow()

    donation = Donation(
        station_id=session.station_id,
        donor_name=session.donor_name,
        amount_ntd=session.amount_ntd,
        grams=session.grams,
        dispensed=True,
        payment_session_id=session.id,
    )
    db.add(donation)
    await db.commit()
    await db.refresh(session)

    if station:
        background_tasks.add_task(
            publish_dispense_command, station.station_code, session.grams, "donation"
        )
        background_tasks.add_task(
            write_donation_event, station.station_code, float(session.amount_ntd), "Payment"
        )

    return session
