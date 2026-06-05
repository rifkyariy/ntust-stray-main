# Plan 02 — Backend Foundation (FastAPI + PostgreSQL + Auth)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the FastAPI app foundation: config, PostgreSQL models, Alembic migrations, async session, JWT auth endpoint, and admin user seeding.

**Architecture:** pydantic-settings reads `.env`. SQLAlchemy 2.0 async ORM with asyncpg driver. Alembic manages migrations. Auth uses bcrypt + python-jose JWT. All endpoints are async.

**Tech Stack:** FastAPI 0.111, SQLAlchemy 2.0 async, asyncpg, Alembic 1.13, pydantic-settings 2, passlib[bcrypt], python-jose, pytest-asyncio, httpx

**Prerequisite:** Plan 01 complete — Docker Compose running, `backend/requirements.txt` exists.

---

## File Map

| File | Purpose |
|---|---|
| `backend/app/core/config.py` | pydantic-settings — reads all env vars |
| `backend/app/core/schemas.py` | Pydantic request/response models shared across API |
| `backend/app/core/security.py` | bcrypt hashing + JWT sign/verify |
| `backend/app/db/models.py` | SQLAlchemy ORM: Station, Donation, Schedule, Cat, AdminUser |
| `backend/app/db/session.py` | Async engine factory + `get_db` dependency |
| `backend/app/db/seed.py` | Seeds first admin user + Taiwan station fixtures |
| `backend/app/api/auth.py` | `POST /auth/login` router |
| `backend/app/main.py` | Updated: include auth router + lifespan |
| `backend/alembic.ini` | Alembic config pointing to `app/db/migrations` |
| `backend/app/db/migrations/env.py` | Alembic async env |
| `backend/app/db/migrations/versions/001_initial.py` | First migration — all tables |
| `backend/tests/conftest.py` | pytest fixtures: async engine, test client |
| `backend/tests/test_auth.py` | Tests for login endpoint |
| `backend/pytest.ini` | asyncio mode = auto |

---

## Task 1: Config & Core Schemas

**Files:**
- Create: `backend/app/core/__init__.py`
- Create: `backend/app/core/config.py`
- Create: `backend/app/core/schemas.py`

- [ ] **Step 1: Create `backend/app/core/__init__.py`** (empty)

```python
```

- [ ] **Step 2: Create `backend/app/core/config.py`**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://stray:stray@postgres:5432/stray"
    influx_url: str = "http://influxdb:8086"
    influx_token: str = "my-super-secret-token"
    influx_org: str = "stray"
    influx_bucket: str = "stray"
    mqtt_broker: str = "mosquitto"
    mqtt_port: int = 1883
    jwt_secret: str = "change-me-in-production"
    jwt_expire_hours: int = 24


settings = Settings()
```

- [ ] **Step 3: Create `backend/app/core/schemas.py`**

```python
from __future__ import annotations
import uuid
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, EmailStr


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


class DonationOut(BaseModel):
    id: uuid.UUID
    station_id: uuid.UUID
    amount_ntd: float
    donor_name: str | None
    dispensed: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Schedule ──────────────────────────────────────────────────────────────────

class ScheduleCreate(BaseModel):
    station_id: uuid.UUID
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
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/core/
git commit -m "feat(backend): config + core schemas"
```

---

## Task 2: SQLAlchemy Models

**Files:**
- Create: `backend/app/db/__init__.py`
- Create: `backend/app/db/models.py`
- Create: `backend/app/db/session.py`

- [ ] **Step 1: Create `backend/app/db/__init__.py`** (empty)

```python
```

- [ ] **Step 2: Create `backend/app/db/models.py`**

```python
from __future__ import annotations
import uuid
from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import String, Float, Integer, Boolean, DateTime, Enum, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


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

    donations: Mapped[list[Donation]] = relationship(back_populates="station", cascade="all, delete-orphan")
    schedules: Mapped[list[Schedule]] = relationship(back_populates="station", cascade="all, delete-orphan")


class Donation(Base):
    __tablename__ = "donations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    station_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stations.id"), nullable=False)
    amount_ntd: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    donor_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    dispensed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    station: Mapped[Station] = relationship(back_populates="donations")


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
```

- [ ] **Step 3: Create `backend/app/db/session.py`**

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import settings

engine = create_async_engine(settings.database_url, echo=False)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncSession:  # type: ignore[return]
    async with AsyncSessionLocal() as session:
        yield session
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/db/
git commit -m "feat(backend): SQLAlchemy models + async session"
```

---

## Task 3: Alembic Migrations

**Files:**
- Create: `backend/alembic.ini`
- Create: `backend/app/db/migrations/__init__.py`
- Create: `backend/app/db/migrations/env.py`
- Create: `backend/app/db/migrations/script.py.mako`
- Create: `backend/app/db/migrations/versions/001_initial.py`

- [ ] **Step 1: Create `backend/alembic.ini`**

```ini
[alembic]
script_location = app/db/migrations
prepend_sys_path = .
sqlalchemy.url = postgresql+asyncpg://stray:stray@localhost:5432/stray

[loggers]
keys = root,sqlalchemy,alembic
[handlers]
keys = console
[formatters]
keys = generic
[logger_root]
level = WARN
handlers = console
[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine
[logger_alembic]
level = INFO
handlers =
qualname = alembic
[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic
[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

- [ ] **Step 2: Create `backend/app/db/migrations/env.py`**

```python
import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context
from app.db.models import Base
from app.core.config import settings

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 3: Create `backend/app/db/migrations/script.py.mako`**

```mako
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

revision: str = ${repr(up_revision)}
down_revision: Union[str, None] = ${repr(down_revision)}
branch_labels: Union[str, Sequence[str], None] = ${repr(branch_labels)}
depends_on: Union[str, Sequence[str], None] = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
```

- [ ] **Step 4: Create `backend/app/db/migrations/versions/001_initial.py`**

```python
"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-05-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE TYPE stationstatus AS ENUM ('online', 'low_food', 'offline')")

    op.create_table(
        'stations',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('station_code', sa.String(20), nullable=False, unique=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('city', sa.String(100), nullable=False),
        sa.Column('district', sa.String(100), nullable=False),
        sa.Column('lat', sa.Float(), nullable=False),
        sa.Column('lng', sa.Float(), nullable=False),
        sa.Column('status', sa.Enum('online', 'low_food', 'offline', name='stationstatus'), nullable=False, server_default='offline'),
        sa.Column('food_pct', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('battery_pct', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('temp_c', sa.Float(), nullable=False, server_default='0'),
        sa.Column('humidity_pct', sa.Float(), nullable=False, server_default='0'),
        sa.Column('installed_at', sa.DateTime(), nullable=False),
        sa.Column('image_url', sa.String(500), nullable=True),
    )
    op.create_index('ix_stations_station_code', 'stations', ['station_code'])

    op.create_table(
        'donations',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('station_id', UUID(as_uuid=True), sa.ForeignKey('stations.id'), nullable=False),
        sa.Column('amount_ntd', sa.Numeric(10, 2), nullable=False),
        sa.Column('donor_name', sa.String(100), nullable=True),
        sa.Column('dispensed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    op.create_table(
        'schedules',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('station_id', UUID(as_uuid=True), sa.ForeignKey('stations.id'), nullable=False),
        sa.Column('cron_expr', sa.String(100), nullable=False),
        sa.Column('grams', sa.Integer(), nullable=False),
        sa.Column('active', sa.Boolean(), nullable=False, server_default='true'),
    )

    op.create_table(
        'cats',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('cat_code', sa.String(20), nullable=False, unique=True),
        sa.Column('first_seen', sa.DateTime(), nullable=False),
        sa.Column('station_id', UUID(as_uuid=True), sa.ForeignKey('stations.id'), nullable=True),
    )
    op.create_index('ix_cats_cat_code', 'cats', ['cat_code'])

    op.create_table(
        'admin_users',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(200), nullable=False, unique=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('password_hash', sa.String(200), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_admin_users_email', 'admin_users', ['email'])


def downgrade() -> None:
    op.drop_table('admin_users')
    op.drop_table('cats')
    op.drop_table('schedules')
    op.drop_table('donations')
    op.drop_table('stations')
    op.execute('DROP TYPE stationstatus')
```

- [ ] **Step 5: Start postgres only and run migrations**

```bash
docker compose up postgres -d
# Wait for healthy
docker compose exec backend alembic upgrade head
```

If running outside Docker: `cd backend && alembic upgrade head`

Expected: Tables created, no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/alembic.ini backend/app/db/migrations/
git commit -m "feat(backend): Alembic migrations — initial schema"
```

---

## Task 4: Security (bcrypt + JWT)

**Files:**
- Create: `backend/app/core/security.py`

- [ ] **Step 1: Create `backend/app/core/security.py`**

```python
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.db.session import get_db
from app.db.models import AdminUser

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=settings.jwt_expire_hours)
    return jwt.encode(
        {"sub": subject, "exp": expire},
        settings.jwt_secret,
        algorithm="HS256",
    )


def decode_token(token: str) -> str:
    """Returns email (subject) or raises HTTPException."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        sub: str = payload.get("sub", "")
        if not sub:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return sub
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


async def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> AdminUser:
    email = decode_token(credentials.credentials)
    result = await db.execute(select(AdminUser).where(AdminUser.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin not found")
    return user
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/core/security.py
git commit -m "feat(backend): bcrypt + JWT security helpers"
```

---

## Task 5: Auth API Endpoint

**Files:**
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/api/auth.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Write the failing test first**

Create `backend/tests/__init__.py` (empty), `backend/tests/conftest.py`:

```python
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.main import app
from app.db.models import Base, AdminUser
from app.db.session import get_db
from app.core.security import hash_password

TEST_DB_URL = "sqlite+aiosqlite:///./test.db"

test_engine = create_async_engine(TEST_DB_URL, echo=False)
TestSessionLocal = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session():
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def admin_user(db_session):
    user = AdminUser(
        email="admin@stray.tw",
        name="Test Admin",
        password_hash=hash_password("testpass123"),
    )
    db_session.add(user)
    await db_session.commit()
    return user
```

- [ ] **Step 2: Create `backend/tests/test_auth.py`**

```python
import pytest


@pytest.mark.asyncio
async def test_login_success(client, admin_user):
    response = await client.post("/auth/login", json={
        "email": "admin@stray.tw",
        "password": "testpass123",
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(client, admin_user):
    response = await client.post("/auth/login", json={
        "email": "admin@stray.tw",
        "password": "wrongpassword",
    })
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_unknown_email(client):
    response = await client.post("/auth/login", json={
        "email": "nobody@stray.tw",
        "password": "anything",
    })
    assert response.status_code == 401
```

- [ ] **Step 3: Create `backend/pytest.ini`**

```ini
[pytest]
asyncio_mode = auto
```

Add `aiosqlite` to `requirements.txt`:
```text
aiosqlite==0.20.0
```

- [ ] **Step 4: Run test — verify it fails**

```bash
cd backend && pip install -r requirements.txt
pytest tests/test_auth.py -v
```

Expected: `FAILED` — `ImportError: cannot import name 'auth'` (router not yet created).

- [ ] **Step 5: Create `backend/app/api/__init__.py`** (empty)

```python
```

- [ ] **Step 6: Create `backend/app/api/auth.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.db.models import AdminUser
from app.core.schemas import LoginRequest, TokenResponse
from app.core.security import verify_password, create_access_token
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    result = await db.execute(select(AdminUser).where(AdminUser.email == body.email))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token(subject=user.email)
    return TokenResponse(
        access_token=token,
        expires_in=settings.jwt_expire_hours * 3600,
    )
```

- [ ] **Step 7: Update `backend/app/main.py`**

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Plans 03 will add MQTT startup here
    yield


app = FastAPI(title="Stray API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
```

- [ ] **Step 8: Run tests — verify they pass**

```bash
pytest tests/test_auth.py -v
```

Expected:
```
PASSED tests/test_auth.py::test_login_success
PASSED tests/test_auth.py::test_login_wrong_password
PASSED tests/test_auth.py::test_login_unknown_email
```

- [ ] **Step 9: Commit**

```bash
git add backend/
git commit -m "feat(backend): POST /auth/login with JWT — tests green"
```

---

## Task 6: Admin Seed Script

**Files:**
- Create: `backend/app/db/seed.py`

- [ ] **Step 1: Create `backend/app/db/seed.py`**

```python
"""
Seed script — creates first admin user + Taiwan station fixtures.

Usage:
  docker compose run --rm backend python -m app.db.seed
"""
import asyncio
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from app.core.config import settings
from app.core.security import hash_password
from app.db.models import Base, AdminUser, Station, StationStatus

engine = create_async_engine(settings.database_url, echo=False)
SessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

STATIONS = [
    {"code": "F-TPE-01", "name": "Ximending Station",      "city": "Taipei",    "district": "Wanhua",    "lat": 25.0424, "lng": 121.5083, "food": 91, "batt": 100},
    {"code": "F-TPE-02", "name": "Zhongshan MRT",          "city": "Taipei",    "district": "Zhongshan", "lat": 25.0525, "lng": 121.5231, "food": 67, "batt": 88},
    {"code": "F-TPE-03", "name": "Daan Park East Gate",    "city": "Taipei",    "district": "Da'an",     "lat": 25.0298, "lng": 121.5436, "food": 18, "batt": 73},
    {"code": "F-TPE-04", "name": "Longshan Temple",        "city": "Taipei",    "district": "Wanhua",    "lat": 25.0373, "lng": 121.4997, "food": 84, "batt": 95},
    {"code": "F-TPE-05", "name": "Shilin Night Market",    "city": "Taipei",    "district": "Shilin",    "lat": 25.0879, "lng": 121.5244, "food": 72, "batt": 100},
    {"code": "F-TPE-06", "name": "Songshan Raohe St.",     "city": "Taipei",    "district": "Songshan",  "lat": 25.0507, "lng": 121.5776, "food":  0, "batt":   0},
    {"code": "F-TNN-01", "name": "Anping Old Fort",        "city": "Tainan",    "district": "Anping",    "lat": 22.9966, "lng": 120.1614, "food": 56, "batt": 67},
    {"code": "F-TNN-02", "name": "Chihkan Tower",          "city": "Tainan",    "district": "West Dist.", "lat": 22.9989, "lng": 120.2023, "food": 88, "batt": 100},
    {"code": "F-KHH-01", "name": "Liuhe Night Market",    "city": "Kaohsiung", "district": "Xinxing",   "lat": 22.6292, "lng": 120.3030, "food": 41, "batt": 81},
    {"code": "F-KHH-02", "name": "Cijin Island Ferry",    "city": "Kaohsiung", "district": "Cijin",     "lat": 22.6108, "lng": 120.2691, "food": 79, "batt": 92},
    {"code": "F-TCH-01", "name": "Fengjia Night Market",  "city": "Taichung",  "district": "Xitun",     "lat": 24.1636, "lng": 120.6437, "food": 94, "batt": 100},
    {"code": "F-TCH-02", "name": "Calligraphy Greenway",  "city": "Taichung",  "district": "West Dist.", "lat": 24.1477, "lng": 120.6716, "food": 31, "batt": 54},
    {"code": "F-TCH-03", "name": "National Museum of Fine Arts", "city": "Taichung", "district": "North Dist.", "lat": 24.1540, "lng": 120.6726, "food": 14, "batt": 88},
    {"code": "F-TPE-07", "name": "Beitou Hot Spring Park","city": "Taipei",    "district": "Beitou",    "lat": 25.1349, "lng": 121.5061, "food": 62, "batt": 78},
]


async def seed() -> None:
    async with SessionLocal() as db:
        # Admin user
        result = await db.execute(select(AdminUser).where(AdminUser.email == "admin@stray.tw"))
        if result.scalar_one_or_none() is None:
            db.add(AdminUser(
                email="admin@stray.tw",
                name="Stray Admin",
                password_hash=hash_password("stray2026"),
            ))
            print("Created admin: admin@stray.tw / stray2026")
        else:
            print("Admin already exists — skipping")

        # Stations
        for s in STATIONS:
            result = await db.execute(select(Station).where(Station.station_code == s["code"]))
            if result.scalar_one_or_none() is None:
                status = StationStatus.offline if s["food"] == 0 else (
                    StationStatus.low_food if s["food"] < 25 else StationStatus.online
                )
                db.add(Station(
                    station_code=s["code"],
                    name=s["name"],
                    city=s["city"],
                    district=s["district"],
                    lat=s["lat"],
                    lng=s["lng"],
                    status=status,
                    food_pct=s["food"],
                    battery_pct=s["batt"],
                    temp_c=26.0,
                    humidity_pct=65.0,
                    installed_at=datetime.utcnow(),
                ))
        await db.commit()
        print(f"Seeded {len(STATIONS)} stations")


if __name__ == "__main__":
    asyncio.run(seed())
```

- [ ] **Step 2: Run seed inside Docker**

```bash
docker compose up postgres -d
# Wait for healthy, then:
docker compose run --rm backend python -m app.db.seed
```

Expected:
```
Created admin: admin@stray.tw / stray2026
Seeded 14 stations
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/db/seed.py
git commit -m "feat(backend): seed script — admin user + 14 Taiwan stations"
```
