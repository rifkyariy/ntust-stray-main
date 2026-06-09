# NTUST Stray Platform — Comprehensive Project Report

**Date:** 2026-06-06  
**Repository:** `ntust-stray-main`  
**Type:** Full-stack IoT + AI + Web monorepo

---

## 1. Project Overview

**Stray** is a smart stray-cat care platform built at NTUST (National Taiwan University of Science and Technology). The system combines ESP32 IoT hardware, a custom YOLOv8 cat-detection AI service, a cloud-native backend, and three web frontends to create a community-driven, crowdfunded cat-feeding network across Taiwan.

**Core concept:** Automated feeders are mounted in public spaces. A citizen scans a QR code, pays NT$15, and the device dispenses food. A live camera feed shows the cat eating in real time. Cities and NGOs manage the station network via a web admin console.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interfaces                          │
│  Landing (3006)   Mobile (3005)   Admin (3007)             │
│  Next.js 14       Next.js 14      Next.js 14               │
└────────────┬─────────────┬────────────┬────────────────────┘
             │             │            │ REST + WebSocket
             └─────────────┴────────────┘
                           │
                    ┌──────▼──────┐
                    │  Backend    │  FastAPI (3004)
                    │  Python 3.12│
                    └──────┬──────┘
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
    ┌──────────┐   ┌──────────────┐  ┌──────────────┐
    │PostgreSQL│   │   InfluxDB   │  │  Mosquitto   │
    │(5433)    │   │   (8086)     │  │  MQTT (1883) │
    └──────────┘   └──────────────┘  └──────┬───────┘
                                            │ MQTT
                                     ┌──────▼───────┐
                                     │  ESP32 (IoT) │
                                     │  + HC-SR04   │
                                     │  + DHT11     │
                                     │  + Servo     │
                                     │  + SSD1306   │
                                     └──────────────┘
                   ┌──────────────┐
                   │  Detector    │  FastAPI (3008)
                   │  YOLOv8      │  catFinderV14.pt
                   └──────────────┘
```

---

## 3. Component Breakdown

### 3.1 IoT Firmware — `apps/iot/main.cpp` (ESP32)

**Hardware sensors/actuators:**

| Component | Pin | Function |
|---|---|---|
| Servo motor | GPIO 18 | Food dispensing — 90° per feed step |
| DHT11 | GPIO 32 | Temperature + humidity reading |
| HC-SR04 Ultrasonic | TRIG=25, ECHO=26 | Tank fill level (% food remaining) |
| SSD1306 OLED (128×64) | I2C SDA=21, SCL=22 | Live status display |
| PubSubClient (MQTT) | WiFi | Telemetry publishing |

**Behavior loop:**
- Reads DHT11 every 2 seconds, ultrasonic every 500ms
- Publishes telemetry JSON to `stray/NTUST/telemetry` every 10 seconds
- When dispensing, animates an OLED cat face with "Nom Nom Nom" text
- Hosts a local HTTP server (port 80) for direct browser-based control
- HTTP endpoints: `/` (status UI), `/set?angle=N`, `/debug`, `/calibrate`

**Calibration note:** The ultrasonic empty-tank distance constant (`kTankEmptyDistance = 20.0 cm`) is marked `TODO: needs calibration` — a known open issue.

---

### 3.2 AI Detector Service — `services/detector/`

A standalone FastAPI microservice wrapping a custom-trained YOLOv8 model.

| Aspect | Detail |
|---|---|
| Model | `catFinderV14_yoloWeights.pt` (custom-trained, ~V14 iteration) |
| Endpoint | `POST /detect` — accepts JPEG/PNG frame, returns bounding boxes + confidence |
| Config | `conf` threshold (default 0.45), `iou` threshold (default 0.45) via query params |
| Port | 3008 (external), 8001 (internal) |
| `GET /models` | Lists available `.pt` files, supports model switching via env var |
| Health | `GET /health` — Docker healthcheck |

The detector is stateless — each frame is submitted independently. The admin frontend calls it to overlay cat detection bounding boxes on the live stream view.

---

### 3.3 Backend — `backend/` (FastAPI + Python 3.12)

**Technology stack:**
- FastAPI with async SQLAlchemy (PostgreSQL via `asyncpg`)
- InfluxDB 2.7 for time-series sensor data
- `asyncio-mqtt` for bidirectional MQTT bridge
- `python-jose` (JWT HS256) + `bcrypt` for auth
- Alembic for database migrations

**REST API surface:**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/login` | — | Admin JWT login |
| GET | `/stations` | — | All stations with live status |
| GET | `/stations/{id}` | — | Single station detail |
| POST | `/stations` | Admin | Create station |
| PATCH | `/stations/{id}` | Admin | Update station |
| GET | `/stations/{id}/metrics` | — | InfluxDB time-series |
| POST | `/stations/{id}/dispense` | Admin | Trigger dispense via MQTT |
| POST | `/stations/{id}/schedule` | Admin | Set feed schedule via MQTT |
| POST | `/donations` | — | Record donation + optional dispense |
| GET | `/donations` | — | List donations |
| GET | `/events` | — | Recent feed events from InfluxDB |
| WS | `/ws` | — | Real-time WebSocket broadcast |

**Data models (PostgreSQL):**

| Model | Key fields |
|---|---|
| `Station` | UUID, `station_code`, city, lat/lng, status (online/low_food/offline), food%, battery% |
| `Donation` | UUID, station FK, `amount_ntd`, `donor_name`, `dispensed` flag |
| `Schedule` | UUID, station FK, `cron_expr`, grams, active |
| `Cat` | UUID, `cat_code` (e.g. `CAT-007`), `first_seen`, station FK |
| `AdminUser` | UUID, email (unique), `password_hash` |

**MQTT data flow:**
```
ESP32 → Mosquitto → backend/mqtt/client.py
                         ├─→ InfluxDB (telemetry time-series)
                         ├─→ PostgreSQL (station status update)
                         └─→ ws/manager.py (broadcast to all WS clients)
```

**Backend health status:** Currently marked `unhealthy` in Docker — likely a database migration or connection issue to investigate.

---

### 3.4 Frontend Apps

All three are **Next.js 14** apps with:
- Design system: `#f97316` orange primary, `#FDFBF7` cream background, Plus Jakarta Sans font
- Shared `packages/ui/` component library (Card, MetricTile, StatusDot, etc.)
- Lucide icons (2px stroke, inline SVG)
- Real-time via WebSocket for live telemetry updates

#### Landing Page — port 3006 (`apps/landing/`)

Single marketing page targeting the public:

| Section | Content |
|---|---|
| `MHeader` | Transparent nav + "Feed a cat — NT$15" CTA |
| `Hero` | Big headline, live-feed image, floating donation receipts, live stats |
| `HowItWorks` | 3-step flow: Scan → Schedule/Dispense → Pay |
| `ImpactStrip` | Live counters: total meals, NT$ raised, active stations |
| `StationsSection` | Card grid of all Taiwan stations with status pills |
| `Footer` | Mission, government collaboration note |

#### Mobile Dashboard — port 3005 (`apps/mobile/`)

Mobile-first (max-width 390px), public-facing:

| Route | Description |
|---|---|
| `/` | Station list — search + city filter + status pills |
| `/station/[id]` | Live camera feed, AI detection overlay, supply bars, temp/humidity, weekly chart + monthly heatmap |
| `/dispense/[id]` | Gram presets (50/100/150/200g), NT$ price, QR Pay button |
| `/schedule/[id]` | Time picker, repeat options (daily/weekdays/custom), gram preset |

Real-time: WebSocket messages animate food/battery bars and detection overlays.

#### Admin Console — port 3007 (`apps/admin/`)

Auth-protected (JWT in httpOnly cookie, Next.js middleware redirect):

| Route | Description |
|---|---|
| `/login` | Email + password form |
| `/` | KPI strip + stations map + activity feed + stations table |
| `/stations/[id]` | Full station detail with live controls |
| `/cats` | Cat registry with visit history |
| `/funding` | Donation ledger, NT$ per station |
| `/alerts` | Low food / battery / offline event log |

Key components:
- `KPIStrip` — 5 live metrics (stations online, dispensed today in kg, donated NT$, cats tracked, active alerts)
- `StationsMap` — SVG Taiwan map with color-coded pins (orange=online, yellow=low food, grey=offline)
- `ActivityFeed` — WebSocket-driven right-rail event ticker
- `StationDrawer` — Slide-in panel with camera, controls (dispense/schedule, auth-gated), supply bars, visitor log

---

## 4. Infrastructure (Docker Compose)

| Service | Image | External Port | Status |
|---|---|---|---|
| `mosquitto` | eclipse-mosquitto:2 | 1883, 9001 | Running |
| `postgres` | postgres:16 | 5433 | Running (healthy) |
| `influxdb` | influxdb:2.7 | 8086 | Running (healthy) |
| `backend` | ./backend | 3004 | Running (unhealthy) |
| `mobile` | ./apps/mobile | 3005 | Running |
| `landing` | ./apps/landing | 3006 | Running |
| `admin` | ./apps/admin | 3007 | Running |
| `detector` | ./services/detector | 3008 | Running (healthy) |

All services on `stray_network` bridge. Postgres and InfluxDB use named volumes for data persistence.

The dev override (`docker-compose.dev.yml`) adds hot-reload for backend + frontends and exposes InfluxDB UI at `:8086`.

---

## 5. Monorepo Structure

```
ntust-stray-main/
├── apps/
│   ├── landing/        Next.js 14 — marketing/crowdfunding (port 3006)
│   ├── mobile/         Next.js 14 — public station dashboard (port 3005)
│   ├── admin/          Next.js 14 — admin console (port 3007)
│   └── iot/            ESP32 C++ firmware (PlatformIO)
├── backend/            FastAPI — REST + WS + MQTT bridge (port 3004)
├── services/
│   └── detector/       FastAPI + YOLOv8 cat detection (port 3008)
├── packages/
│   └── ui/             Shared design tokens + React components
├── mosquitto/          MQTT broker config + data
├── docs/superpowers/   Design spec, implementation plans
├── docker-compose.yml
├── docker-compose.dev.yml
├── turbo.json          Turborepo task graph
└── pnpm-workspace.yaml
```

---

## 6. Key Technical Decisions

| Decision | Rationale |
|---|---|
| **InfluxDB for telemetry** | Sensor readings (temp, humidity, food%) are time-series — InfluxDB's Flux queries serve 1h/24h/7d windowed charts without complex SQL aggregations |
| **MQTT for device comms** | Lightweight, pub/sub model suits IoT constraints; bidirectional (ESP32 publishes, backend commands back) |
| **WebSocket broadcast** | All real-time UI (admin KPI strip, mobile detection overlay, activity feed) share one WS endpoint — backend fans out MQTT events to all connected browsers |
| **Separate detector service** | YOLOv8 inference is CPU/GPU intensive; isolating it as a separate container prevents it from blocking the API |
| **httpOnly JWT cookie** | Admin auth kept server-side to prevent XSS token theft; Next.js middleware handles redirects |
| **Turborepo** | Caches build artifacts across the monorepo; `pnpm` workspaces share `packages/ui` between all three Next.js apps |

---

## 7. Known Issues / Open Items

1. **Backend unhealthy** — `ntust-stray-main-backend-1` is showing `unhealthy` in Docker. Likely cause: database migration hasn't run (`alembic upgrade head`) or InfluxDB token mismatch.
2. **Ultrasonic calibration** — `kTankEmptyDistance = 20.0 cm` is a placeholder; the actual empty-tank reading needs physical measurement per deployment.
3. **MQTT subscribe handler** — `MqttCallback` in the ESP32 firmware is empty; incoming MQTT commands (dispense/cmd, schedule/set) are not yet wired up on the device side.
4. **Payment** — QR Pay is a UI placeholder; no actual payment gateway is integrated.
5. **Camera streaming** — Uses static image + simulated detection overlay; real RTSP/HLS streaming is out of scope.
6. **Battery %** — The ESP32 firmware publishes `servo_angle` but no actual battery reading; battery % in the backend likely stays at its seeded default.

---

## 8. Data Flow Summary

```
[Citizen scans QR]
      │
      ▼
[Mobile/Landing app]
  POST /donations → backend saves donation, publishes MQTT dispense cmd
      │
      ▼
[Mosquitto] → [ESP32] → servo spins, OLED shows "Nom Nom"
      │
      ▼
[ESP32 publishes dispense/ack + telemetry]
      │
      ▼
[Backend MQTT handler]
  → writes feed_event to InfluxDB
  → updates station in PostgreSQL
  → broadcasts to all WebSocket clients
      │
      ▼
[Admin console + mobile app update in real time]
```

---

## 9. Technology Stack Summary

| Layer | Technology |
|---|---|
| Firmware | C++ / Arduino / PlatformIO (ESP32) |
| AI | Python / YOLOv8 (Ultralytics) custom-trained model |
| Backend | Python 3.12 / FastAPI / SQLAlchemy async / Alembic |
| Databases | PostgreSQL 16 (relational) + InfluxDB 2.7 (time-series) |
| Messaging | Mosquitto MQTT 2.x + asyncio-mqtt |
| Frontend | Next.js 14 (App Router) / TypeScript / React |
| Build tooling | pnpm workspaces / Turborepo |
| Containerization | Docker Compose (8 services) |
| Auth | JWT HS256 (python-jose) + bcrypt |
