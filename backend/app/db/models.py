from __future__ import annotations
import uuid
from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import String, Float, Integer, Boolean, DateTime, Enum, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class PaymentStatus(str, PyEnum):
    pending = "pending"
    paid    = "paid"
    expired = "expired"


class Base(DeclarativeBase):
    pass


class StationStatus(str, PyEnum):
    online = "online"
    low_food = "low_food"
    offline = "offline"


class Station(Base):
    __tablename__ = "stations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    station_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    district: Mapped[str] = mapped_column(String(100), nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[StationStatus] = mapped_column(
        Enum(StationStatus, name="stationstatus"), default=StationStatus.offline
    )
    food_pct: Mapped[int] = mapped_column(Integer, default=0)
    battery_pct: Mapped[int] = mapped_column(Integer, default=0)
    temp_c: Mapped[float] = mapped_column(Float, default=0.0)
    humidity_pct: Mapped[float] = mapped_column(Float, default=0.0)
    installed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    donations: Mapped[list[Donation]] = relationship(back_populates="station", cascade="all, delete-orphan", foreign_keys="Donation.station_id")
    schedules: Mapped[list[Schedule]] = relationship(back_populates="station", cascade="all, delete-orphan")


class Donation(Base):
    __tablename__ = "donations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    station_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stations.id"), nullable=False)
    amount_ntd: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    donor_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    grams: Mapped[int | None] = mapped_column(Integer, nullable=True)
    dispensed: Mapped[bool] = mapped_column(Boolean, default=False)
    payment_session_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("payment_sessions.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    station: Mapped[Station] = relationship(back_populates="donations")
    payment_session: Mapped[PaymentSession | None] = relationship(back_populates="donation")


class PaymentSession(Base):
    __tablename__ = "payment_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    short_id: Mapped[str] = mapped_column(String(8), unique=True, nullable=False, index=True)
    station_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stations.id"), nullable=False)
    donor_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    amount_ntd: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    grams: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="paymentstatus"), default=PaymentStatus.pending
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    station: Mapped[Station] = relationship()
    donation: Mapped[Donation | None] = relationship(back_populates="payment_session")


class Schedule(Base):
    __tablename__ = "schedules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    station_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stations.id"), nullable=False)
    cron_expr: Mapped[str] = mapped_column(String(100), nullable=False)
    grams: Mapped[int] = mapped_column(Integer, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    station: Mapped[Station] = relationship(back_populates="schedules")


class Cat(Base):
    __tablename__ = "cats"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cat_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    first_seen: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    station_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stations.id"), nullable=True
    )


class AdminUser(Base):
    __tablename__ = "admin_users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
