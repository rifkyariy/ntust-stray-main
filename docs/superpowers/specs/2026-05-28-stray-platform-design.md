# Stray Platform — Design Spec
_Date: 2026-05-28_

## Overview

**Stray** is a smart automatic stray-cat feeder system backed by community crowdfunding. Hardware feeders (ESP32-based) mount on walls, detect cats via camera + AI, and dispense food. The public can scan a QR code at any station, pay NT$15, and watch a cat eat on a live camera feed. City governments and NGOs manage the station network via a web admin console.

This spec covers the full platform implementation: three Next.js apps, a Python FastAPI backend, PostgreSQL + InfluxDB databases, a Mosquitto MQTT broker, all orchestrated via Docker Compose.

---

## Design Source

The visual design is fully specified in the **Stray Design System** bundle (fetched from `https://api.anthropic.com/v1/design/h/IlpM9-vNkTHN6YegcDU6VQ`). Extracted to:
```
docs/superpowers/design-extracted/stray-design-system/
├── project/colors_and_type.css       — full CSS token system
├── project/ui_kits/dashboard/        — mobile app JSX components
├── project/ui_kits/admin/            — admin console JSX components
├── project/ui_kits/marketing/        — landing page JSX components
├── project/assets/                   — logos, paw-print PNG
└── project/README.md                 — visual foundations, voice & tone
```

All UI must match the design system pixel-precisely. Key tokens:
- **Primary colour:** `#f97316` (orange-500)
- **Background:** `#FDFBF7` (cream)
- **Font:** Plus Jakarta Sans (display/body) + JetBrains Mono (data/IDs)
- **Icons:** Lucide (inline SVG, 2px stroke)
- **Currency:** NT$ throughout
- **Locale:** Taiwan — cities: Taipei, Tainan, Kaohsiung, Taichung

---

## Monorepo Structure

```
stray/
├── apps/
│   ├── mobile/          # Next.js 14 — public user dashboard
│   ├── landing/         # Next.js 14 — marketing / crowdfunding landing page
│   └── admin/           # Next.js 14 — web admin console (auth-protected)
├── backend/             # Python FastAPI
├── assets/              # Shared logos, images, paw-print PNG
├── packages/
│   └── ui/              # Shared design tokens CSS + Lucide re-exports
├── docker-compose.yml
├── docker-compose.dev.yml
└── .env.example
```

---

## Services (Docker Compose)

| Service | Image | Ports | Purpose |
|---|---|---|---|
| `mosquitto` | eclipse-mosquitto:2 | 1883, 9001 | MQTT broker — ESP32 publishes here |
| `postgres` | postgres:16 | 5432 | Relational data (stations, donations, schedules, cats, admin users) |
| `influxdb` | influxdb:2.7 | 8086 | Time-series sensor readings + feed events |
| `backend` | ./backend | 8000 | FastAPI — REST API + WebSocket + MQTT bridge |
| `mobile` | ./apps/mobile | 3000 | Public user dashboard |
| `landing` | ./apps/landing | 3001 | Marketing / crowdfunding landing page |
| `admin` | ./apps/admin | 3002 | Admin console |

All services share a `stray_network` bridge network. Backend depends on postgres, influxdb, mosquitto. Frontend apps depend on backend.

---

## Frontend Apps

### `apps/landing` — Marketing / Crowdfunding Landing Page
**Route:** `/` (single page)

**Sections:**
1. `MHeader` — transparent nav: "How it works", "Stations", "For Cities", "Impact" + orange CTA "Feed a cat — NT$15"
2. `Hero` — 72px headline "Feed the cats your city forgot.", live-feed photo stack with green AI detection overlay, floating donation + dispense receipt cards, stats strip (meals funded, cities live, cats fed) — all polled from API
3. `HowItWorks` — 3-step: Scan QR at station → Choose dispense now or schedule → Pay NT$15
4. `ImpactStrip` — live counters from API: total meals, total NT$ raised, active stations
5. `StationsSection` — card grid of Taiwan stations, status pills
6. `Footer` — mission statement, government collaboration note, links

**Data:** Static + polling `GET /stations` and `GET /events` for live counters. No WebSocket needed.

---

### `apps/mobile` — Public User Dashboard
**Max-width:** 390px centered. Mobile-first.

**Routes:**

| Route | Description |
|---|---|
| `/` | Station list — search input, city filter, status pills (online/low food/offline) |
| `/station/[id]` | Live feed screen — camera with detection bbox overlay, LIVE badge, supply levels (food %, battery %), temp + humidity tiles, weekly bar chart (tap day → log detail), monthly heatmap calendar |
| `/dispense/[id]` | Dispense sheet — gram presets (50g / 100g / 150g / 200g), price in NT$, QR Pay button |
| `/schedule/[id]` | Schedule sheet — time picker (24h), repeat (daily/weekdays/custom), gram preset, confirm |

**Real-time:** WebSocket connection to `ws://backend/ws`. Updates:
- Food % and battery % bars animate on `telemetry` messages
- Detection overlay appears on `detection` messages (cat_code + confidence label)
- Feed events logged in activity strip

---

### `apps/admin` — Web Admin Console
**Auth-protected.** JWT stored in `httpOnly` cookie. Next.js middleware redirects unauthenticated users to `/login`.

**Routes:**

| Route | Description |
|---|---|
| `/login` | Email + password form, cream background, orange submit button |
| `/` or `/stations` | Main dashboard — KPI strip + map + activity feed + stations table |
| `/stations/[id]` | Full station detail — same as StationDrawer but full page |
| `/cats` | Cat registry — list of tracked cats with visit history |
| `/funding` | Donation ledger — table of all donations, total NT$ per station |
| `/alerts` | Alert log — low food, battery, offline events |

**Components:**

| Component | Description |
|---|---|
| `Sidebar` | Fixed 240px — logo, nav items (Overview, Stations, Cats, Funding, Cities, Alerts with badge), system status tile (MQTT latency, uptime) |
| `Topbar` | Search bar, city filter dropdown (Taipei/Tainan/Kaohsiung/Taichung/All), Add Station button, notification bell, admin avatar |
| `KPIStrip` | 5 metric tiles: Stations online, Dispensed today (kg), Donated today (NT$), Cats tracked, Active alerts |
| `StationsMap` | SVG map with clickable pins — orange=online, yellow=low food, grey=offline. Click → opens StationDrawer |
| `ActivityFeed` | Right-rail live ticker — WebSocket-driven: donations, dispense events, alerts |
| `StationsTable` | Sortable — Station ID, name, status pill, food bar, battery bar, cats today, NT$ funded today, last visit, Open button |
| `StationDrawer` | Slide-in panel — live camera iframe/img, Dispense Now + Schedule controls (auth-gated), supply bars, temp/humidity tiles, today stats (NT$ funded, visits, unique cats), recent visitor log (CAT-ID, time, grams, confidence %) |

**Real-time:** WebSocket connection updates KPI strip, activity feed, station status dots, and supply bars continuously.

---

## Backend (FastAPI)

### Directory Structure
```
backend/
├── app/
│   ├── main.py              # App factory, lifespan (starts MQTT listener), CORS
│   ├── api/
│   │   ├── auth.py          # POST /auth/login
│   │   ├── stations.py      # GET /stations, GET /stations/{id}, POST, PATCH
│   │   ├── donations.py     # POST /donations, GET /donations
│   │   ├── controls.py      # POST /stations/{id}/dispense, /schedule (auth-required)
│   │   ├── events.py        # GET /events (recent from InfluxDB)
│   │   └── metrics.py       # GET /stations/{id}/metrics?range=1h|24h|7d
│   ├── ws/
│   │   ├── router.py        # WS /ws endpoint
│   │   └── manager.py       # ConnectionManager — connect/disconnect/broadcast
│   ├── mqtt/
│   │   ├── client.py        # asyncio-mqtt subscriber, background task in lifespan
│   │   └── handlers.py      # on_telemetry, on_detection, on_dispense_ack
│   ├── db/
│   │   ├── models.py        # SQLAlchemy ORM models
│   │   ├── session.py       # Async engine, get_db dependency
│   │   └── migrations/      # Alembic migrations
│   ├── influx/
│   │   ├── writer.py        # write_telemetry, write_feed_event, write_donation
│   │   └── queries.py       # get_station_metrics, get_feed_history
│   └── core/
│       ├── config.py        # pydantic-settings — reads .env
│       ├── schemas.py       # Pydantic request/response models
│       └── security.py      # bcrypt hashing, JWT sign/verify (python-jose)
├── requirements.txt
├── Dockerfile
└── alembic.ini
```

### REST API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | — | Returns JWT access token |
| GET | `/stations` | — | List all stations with current status |
| GET | `/stations/{id}` | — | Single station detail |
| POST | `/stations` | Admin | Create station |
| PATCH | `/stations/{id}` | Admin | Update station |
| GET | `/stations/{id}/metrics` | — | InfluxDB time-series (range param) |
| POST | `/stations/{id}/dispense` | Admin | Publish MQTT dispense command |
| POST | `/stations/{id}/schedule` | Admin | Publish MQTT schedule command |
| POST | `/donations` | — | Record donation, optionally trigger dispense |
| GET | `/donations` | — | List donations (filter by station) |
| GET | `/events` | — | Recent feed events from InfluxDB |
| WS | `/ws` | — | WebSocket — broadcasts all real-time messages |

### WebSocket Message Schema
```json
// Sensor telemetry (from MQTT stray/{id}/telemetry)
{ "type": "telemetry", "station_id": "F-TPE-01", "food_pct": 72, "battery_pct": 95, "temp_c": 26.1, "humidity_pct": 68, "ts": "2026-05-28T10:00:00Z" }

// Cat detection (from MQTT stray/{id}/detection)
{ "type": "detection", "station_id": "F-TPE-01", "cat_code": "CAT-007", "confidence": 0.96, "ts": "..." }

// Feed event (from MQTT stray/{id}/dispense/ack)
{ "type": "feed_event", "station_id": "F-TPE-01", "grams": 120, "trigger": "donation", "donor": "Marta R.", "ts": "..." }

// Alert
{ "type": "alert", "station_id": "F-TPE-01", "level": "warning", "message": "Food at 14%", "ts": "..." }
```

### MQTT Topic Schema
```
# ESP32 publishes:
stray/{station_id}/telemetry     → { food_pct, battery_pct, temp_c, humidity_pct }
stray/{station_id}/detection     → { cat_code, confidence, bbox }
stray/{station_id}/dispense/ack  → { grams, trigger, ts }

# Backend publishes (commands to device):
stray/{station_id}/dispense/cmd  → { grams, trigger }
stray/{station_id}/schedule/set  → { cron_expr, grams, active }
```

### Data Flow
```
ESP32 ──MQTT──► Mosquitto ──subscribe──► backend/mqtt/client.py
                                              │
                              ┌───────────────┼───────────────┐
                              ▼               ▼               ▼
                         InfluxDB       PostgreSQL       ws/manager
                       (telemetry)    (status update)   (broadcast)
                                                             │
                                                    ◄── all WS clients
                                               (admin, mobile apps)
```

---

## Data Models

### PostgreSQL (SQLAlchemy)

```python
# Station
id: UUID, station_code: str, name: str, city: str, district: str
lat: float, lng: float, status: Enum(online/low_food/offline)
food_pct: int, battery_pct: int, temp_c: float, humidity_pct: float
installed_at: datetime, image_url: str

# Donation
id: UUID, station_id: FK, amount_ntd: Decimal
donor_name: str (nullable), dispensed: bool, created_at: datetime

# Schedule
id: UUID, station_id: FK, cron_expr: str, grams: int, active: bool

# Cat
id: UUID, cat_code: str, first_seen: datetime, station_id: FK (first seen at)

# AdminUser
id: UUID, email: str (unique), name: str, password_hash: str, created_at: datetime
```

### InfluxDB (Measurements)

```
measurement: station_metrics
  tags:    station_id, city
  fields:  food_pct (int), battery_pct (int), temp_c (float), humidity_pct (float)

measurement: feed_events
  tags:    station_id, cat_code, trigger
  fields:  grams_dispensed (int), confidence (float)

measurement: donation_events
  tags:    station_id
  fields:  amount_ntd (float), donor_name (str)
```

---

## Authentication

**Scope:** Admin console only. All public endpoints (stations, metrics, WebSocket, donations) remain open.

**Implementation:**
- `POST /auth/login` → verifies bcrypt password → returns JWT (HS256, 24h expiry)
- Admin Next.js app stores JWT in `httpOnly` cookie via `Set-Cookie` header
- Next.js `middleware.ts` checks cookie on every request to `/` (except `/login`) — redirects to `/login` if missing/invalid
- Protected backend endpoints use `Depends(get_current_admin)` — decodes JWT, looks up admin user
- Admin seeded via Alembic migration or CLI script (`python -m app.db.seed`)

---

## Docker Configuration

### `docker-compose.yml` (production)
- All services on `stray_network`
- Postgres + InfluxDB with named volumes for persistence
- Backend: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- Next.js apps: `next start` (built image, standalone output)
- Mosquitto: custom `mosquitto.conf` (allow anonymous for dev, persistent sessions)

### `docker-compose.dev.yml` (development override)
- Backend: `uvicorn app.main:app --reload` with source volume mount
- Next.js apps: `next dev` with source volume mounts
- Exposes InfluxDB UI at `:8086`
- Optional pgAdmin at `:5050`

### Dockerfiles
- **Backend:** `python:3.12-slim` → `pip install -r requirements.txt` → `uvicorn`
- **Next.js apps:** multi-stage — `node:20-alpine` build stage → `next build` with `output: 'standalone'` → minimal runtime stage copying `.next/standalone`

### `.env.example`
```env
# Postgres
POSTGRES_USER=stray
POSTGRES_PASSWORD=stray
POSTGRES_DB=stray
DATABASE_URL=postgresql+asyncpg://stray:stray@postgres:5432/stray

# InfluxDB
INFLUX_URL=http://influxdb:8086
INFLUX_TOKEN=my-super-secret-token
INFLUX_ORG=stray
INFLUX_BUCKET=stray

# MQTT
MQTT_BROKER=mosquitto
MQTT_PORT=1883

# JWT
JWT_SECRET=change-me-in-production
JWT_EXPIRE_HOURS=24

# Frontend (build-time)
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

---

## Design System Rules (implementation reference)

All frontends must follow these rules from `colors_and_type.css` and the design README:

| Rule | Value |
|---|---|
| Page background | `#FDFBF7` (cream) |
| Card background | `#ffffff` with `1px solid #f1f5f9` border |
| Primary colour | `#f97316` |
| Heading font | Plus Jakarta Sans 700–900 |
| Data/ID font | JetBrains Mono 700 |
| Primary card radius | 24px |
| CTA shadow | `0 4px 15px rgba(249,115,22,0.4)` |
| Status dot glow | `0 0 8px <color>` |
| Animate sheets | `cubic-bezier(0.32, 0.72, 0, 1)` 300ms |
| Icons | Lucide (2px stroke, inline SVG) |
| No emoji | Anywhere |
| Currency | NT$ |
| Cat/station IDs | UPPERCASE monospace: `CAT-007`, `F-TPE-01` |
| Detection overlay | `#4ade80` (mint-green — machine signal) |

---

## Out of Scope (for now)

- Real camera streaming (use static image + detection overlay simulation)
- Payment processing (QR Pay is UI-only placeholder)
- Push notifications
- Multi-role admin (all admins have equal access)
- Mobile native app (PWA via Next.js is sufficient)
