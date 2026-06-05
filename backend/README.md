# Stray Backend

FastAPI async REST API for the Stray smart feeding station network. Runs on port **8000**.

## Architecture

```
HTTP clients / admin / mobile
        │
   FastAPI (port 8000)
        │
   ┌────┴────┐
PostgreSQL  InfluxDB      MQTT (Mosquitto)
(stations,  (telemetry    ┌──────────────┐
 donations,  time-series) │ stray/+/telemetry
 cats,                    │ stray/+/detection
 schedules,               │ stray/+/dispense/ack
 auth)                    └──────────────┘
        │
   WebSocket broadcasts → admin / mobile clients
```

## API Endpoints

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | — | Email + password login, returns JWT |

### Stations
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/stations` | — | List all stations (optional `?city=`) |
| GET | `/stations/{id}` | — | Get single station |
| POST | `/stations` | — | Create station |
| PATCH | `/stations/{id}` | — | Update station fields |

### Controls (admin JWT required)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/stations/{id}/dispense` | JWT | Trigger immediate dispense via MQTT |
| POST | `/stations/{id}/schedule` | JWT | Create/update feeding schedule |

### Metrics
| Method | Path | Description |
|---|---|---|
| GET | `/stations/{id}/metrics?range=1h` | Telemetry time-series from InfluxDB (`1h`, `24h`, `7d`) |

### Events & Donations
| Method | Path | Description |
|---|---|---|
| GET/POST | `/stations/{id}/events` | Detection events |
| GET/POST | `/stations/{id}/donations` | Donation records |

### WebSocket
| Path | Description |
|---|---|
| `/ws` | Broadcast channel — emits telemetry, detection, and alert messages to all connected clients |

### Health
```
GET /health  →  {"status": "ok"}
```

## Data Models

| Table | Key Fields |
|---|---|
| `stations` | `station_code`, `name`, `city`, `lat/lng`, `status`, `food_pct`, `battery_pct`, `temp_c`, `humidity_pct` |
| `donations` | `station_id`, `amount_ntd`, `donor_name`, `dispensed` |
| `schedules` | `station_id`, `cron_expr`, `grams`, `active` |
| `cats` | `cat_code`, `first_seen`, `station_id` |
| `admin_users` | `email`, `name`, `password_hash` |

## MQTT Topics

Stations publish to:
- `stray/{station_code}/telemetry` — food/battery/temp/humidity readings
- `stray/{station_code}/detection` — animal detection events
- `stray/{station_code}/dispense/ack` — confirmation of dispense command

The backend subscribes to all three and fans out to connected WebSocket clients.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://stray:stray@postgres:5432/stray` | Async PostgreSQL DSN |
| `INFLUX_URL` | `http://influxdb:8086` | InfluxDB base URL |
| `INFLUX_TOKEN` | `my-super-secret-token` | InfluxDB auth token |
| `INFLUX_ORG` | `stray` | InfluxDB organisation |
| `INFLUX_BUCKET` | `stray` | InfluxDB bucket |
| `MQTT_BROKER` | `mosquitto` | MQTT broker hostname |
| `MQTT_PORT` | `1883` | MQTT broker port |
| `JWT_SECRET` | `change-me-in-production` | HMAC secret for JWT signing |
| `JWT_EXPIRE_HOURS` | `24` | Token lifetime in hours |

## Development

```bash
# from monorepo root
docker compose -f docker-compose.yml -f docker-compose.dev.yml up backend
```

Hot-reload is enabled via `--reload` flag in `docker-compose.dev.yml`.

Interactive API docs: `http://localhost:8000/docs`

## Database Migrations

Migrations live in `app/db/migrations/versions/`. Run via Alembic:

```bash
# inside the backend container
alembic upgrade head
```

Seed data (default admin user, sample stations):

```bash
python -m app.db.seed
```

## Production

```bash
docker compose build backend
docker compose up backend
```

The backend waits for PostgreSQL and InfluxDB to be healthy before starting (see `depends_on` in `docker-compose.yml`).
