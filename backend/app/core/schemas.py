from __future__ import annotations
import uuid
from datetime import datetime
from enum import Enum
from pydantic import BaseModel


# ── Station ──────────────────────────────────────────────────────────────────

class StationStatus(str, Enum):
    online = "online"
    low_food = "low_food"
    offline = "offline"


class StationBase(BaseModel):
    station_code: str
    name: str
    city: str
    district: str
    lat: float
    lng: float
    image_url: str | None = None


class StationCreate(StationBase):
    pass


class StationUpdate(BaseModel):
    name: str | None = None
    status: StationStatus | None = None
    food_pct: int | None = None
    battery_pct: int | None = None
    image_url: str | None = None


class StationOut(StationBase):
    id: uuid.UUID
    status: StationStatus
    food_pct: int
    battery_pct: int
    temp_c: float
    humidity_pct: float
    installed_at: datetime

    model_config = {"from_attributes": True}


# ── Donation ──────────────────────────────────────────────────────────────────

class DonationCreate(BaseModel):
    station_id: uuid.UUID
    amount_ntd: float
    donor_name: str | None = None
    dispense: bool = False
    grams: int | None = None


class DonationOut(BaseModel):
    id: uuid.UUID
    station_id: uuid.UUID
    amount_ntd: float
    donor_name: str | None
    dispensed: bool
    grams: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Payment session ───────────────────────────────────────────────────────────

class PaymentSessionCreate(BaseModel):
    station_id: uuid.UUID
    amount_ntd: float
    grams: int
    donor_name: str | None = None


class PaymentSessionOut(BaseModel):
    id: uuid.UUID
    short_id: str
    station_id: uuid.UUID
    donor_name: str | None
    amount_ntd: float
    grams: int
    status: str
    created_at: datetime
    paid_at: datetime | None

    model_config = {"from_attributes": True}


# ── Schedule ──────────────────────────────────────────────────────────────────

class ScheduleCreate(BaseModel):
    station_id: uuid.UUID
    cron_expr: str
    grams: int
    active: bool = True


# Body schema for POST /stations/{id}/schedule — station_id comes from URL path
class ScheduleBody(BaseModel):
    cron_expr: str
    grams: int
    active: bool = True


class ScheduleOut(BaseModel):
    id: uuid.UUID
    station_id: uuid.UUID
    cron_expr: str
    grams: int
    active: bool

    model_config = {"from_attributes": True}


# ── Dispense command ──────────────────────────────────────────────────────────

class DispenseCommand(BaseModel):
    grams: int
    trigger: str = "manual"


# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


# ── WebSocket message types ───────────────────────────────────────────────────

class WSTelemetry(BaseModel):
    type: str = "telemetry"
    station_id: str
    food_pct: int
    battery_pct: int
    temp_c: float
    humidity_pct: float
    ts: str


class WSDetection(BaseModel):
    type: str = "detection"
    station_id: str
    cat_code: str
    confidence: float
    ts: str


class WSFeedEvent(BaseModel):
    type: str = "feed_event"
    station_id: str
    grams: int
    trigger: str
    donor: str | None
    ts: str


class WSAlert(BaseModel):
    type: str = "alert"
    station_id: str
    level: str
    message: str
    ts: str
