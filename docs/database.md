# Databases — PostgreSQL & InfluxDB

The platform uses two databases with complementary roles:

| Database | Role | Port |
|----------|------|------|
| **PostgreSQL 16** | Relational state — stations, donations, schedules, users | 5433 (host) / 5432 (container) |
| **InfluxDB 2.7** | Time-series telemetry — sensor readings, feed events, donation events | 8086 |

---

## PostgreSQL

### Connection

```
postgresql+asyncpg://stray:stray@postgres:5432/stray
```

Override via `DATABASE_URL` in `.env`. The backend uses SQLAlchemy async with `asyncpg`.

### Schema

#### `stations`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | auto |
| `station_code` | VARCHAR(20) UNIQUE | e.g. `NTUST-STR-01` |
| `name` | VARCHAR(200) | |
| `city` | VARCHAR(100) | |
| `district` | VARCHAR(100) | |
| `lat` / `lng` | FLOAT | Map coordinates |
| `status` | ENUM `online \| low_food \| offline` | Updated by MQTT telemetry handler |
| `food_pct` | INTEGER | 0–100, updated every 10 s from ESP32 |
| `battery_pct` | INTEGER | 0–100 |
| `temp_c` | FLOAT | Ambient temperature |
| `humidity_pct` | FLOAT | Relative humidity |
| `installed_at` | DATETIME | |
| `image_url` | VARCHAR(500) nullable | |

#### `donations`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `station_id` | UUID FK → stations | |
| `amount_ntd` | NUMERIC(10,2) | Donation amount in New Taiwan Dollars |
| `donor_name` | VARCHAR(100) nullable | Optional display name |
| `grams` | INTEGER nullable | Food dispensed |
| `dispensed` | BOOLEAN | Set `true` after servo fires |
| `payment_session_id` | UUID FK → payment_sessions nullable | |
| `created_at` | DATETIME | |

#### `payment_sessions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `short_id` | VARCHAR(8) UNIQUE | 6-char hex, used in QR URL |
| `station_id` | UUID FK → stations | |
| `donor_name` | VARCHAR(100) nullable | |
| `amount_ntd` | NUMERIC(10,2) | |
| `grams` | INTEGER | |
| `status` | ENUM `pending \| paid \| expired` | |
| `created_at` | DATETIME | |
| `paid_at` | DATETIME nullable | Set when `/pay` is called |

#### `schedules`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `station_id` | UUID FK → stations | |
| `cron_expr` | VARCHAR(100) | Standard 5-field cron |
| `grams` | INTEGER | Amount to dispense on trigger |
| `active` | BOOLEAN | Soft disable without deleting |

#### `cats`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `cat_code` | VARCHAR(20) UNIQUE | e.g. `CAT-001`, assigned by detection pipeline |
| `first_seen` | DATETIME | |
| `station_id` | UUID FK → stations nullable | Last station where detected |

#### `admin_users`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `email` | VARCHAR(200) UNIQUE | |
| `name` | VARCHAR(100) | |
| `password_hash` | VARCHAR(200) | bcrypt |
| `created_at` | DATETIME | |

### Migrations (Alembic)

```bash
cd backend
alembic upgrade head          # apply all migrations
alembic revision --autogenerate -m "description"   # generate new migration
```

Migration scripts live in `backend/app/db/migrations/versions/`:
- `001_initial.py` — creates all core tables
- `002_payment_sessions.py` — adds payment_sessions + Donation FK
- `003_payment_session_donor_name.py` — adds donor_name to payment_sessions

### Healthcheck

Docker Compose waits for `pg_isready -U stray` before starting the backend.

---

## InfluxDB

### Connection

```
http://influxdb:8086
Token: my-super-secret-token   (set INFLUX_TOKEN in .env for production)
Org:   stray
Bucket: stray
```

### Measurements

#### `station_metrics`

Written every time a telemetry MQTT message arrives (~every 10 seconds per station).

| Field/Tag | Type | Notes |
|-----------|------|-------|
| `station_id` | tag | Station code string |
| `city` | tag | City name |
| `food_pct` | field (int) | |
| `battery_pct` | field (int) | |
| `temp_c` | field (float) | |
| `humidity_pct` | field (float) | |

Example Flux query:
```flux
from(bucket: "stray")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "station_metrics")
  |> filter(fn: (r) => r.station_id == "NTUST-STR-01")
  |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
```

#### `feed_events`

Written when a dispense acknowledgement (`dispense/ack`) arrives over MQTT.

| Field/Tag | Type | Notes |
|-----------|------|-------|
| `station_id` | tag | |
| `cat_code` | tag | Which cat triggered the feed |
| `trigger` | tag | `"donation"`, `"schedule"`, `"manual"` |
| `grams_dispensed` | field (int) | |
| `confidence` | field (float) | Detection confidence score |

#### `donation_events`

Written when a payment session is confirmed (`/pay` endpoint).

| Field/Tag | Type | Notes |
|-----------|------|-------|
| `station_id` | tag | |
| `amount_ntd` | field (float) | |
| `donor_name` | field (string) | `"Anonymous"` if not provided |

### Backend InfluxDB access

- **Writer** (`backend/app/influx/writer.py`): `write_telemetry()`, `write_feed_event()`, `write_donation_event()` — each opens an async client, writes a point, and closes.
- **Queries** (`backend/app/influx/queries.py`): `get_station_metrics(station_id, range_str)` and `get_recent_feed_events(station_id, limit)` — used by the `/metrics` API route.

### InfluxDB UI

The InfluxDB web UI is available at `http://localhost:8086` (not tunnelled). Use it to browse data, build Flux queries, and create dashboards during development.

---

## Environment variables summary

```env
# PostgreSQL
DATABASE_URL=postgresql+asyncpg://stray:stray@postgres:5432/stray
POSTGRES_USER=stray
POSTGRES_PASSWORD=stray
POSTGRES_DB=stray

# InfluxDB
INFLUX_URL=http://influxdb:8086
INFLUX_TOKEN=my-super-secret-token
INFLUX_ORG=stray
INFLUX_BUCKET=stray
```
