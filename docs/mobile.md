# Mobile App

The mobile app is a Next.js 14 web application optimised for phone screen sizes. It is the primary citizen-facing interface: browsing feeder stations, making donations, triggering food dispensing, and monitoring live cat detections.

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14 (App Router, standalone output) |
| Real-time | WebSocket (`/ws` via backend) |
| API transport | Same-origin proxy `/api/backend/*` → FastAPI |
| Styling | Inline CSS-in-JS, shared `@stray/ui` package |

## Running locally

```bash
pnpm --filter mobile dev   # starts on :3000
```

Or via Docker Compose:

```bash
docker compose up mobile
# Mobile app listens on host port 3005
```

Environment variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| `API_URL` | `http://backend:8000` | Server-side API base |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3004` | Fallback reference |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:3004/ws` | WebSocket endpoint for browser |

## Page structure

```
app/
├── layout.tsx                   # Global layout — fonts, viewport meta
├── globals.css
└── page.tsx                     # Station list (SSR)

components/
├── StationList.tsx              # Grid of station cards
├── StationCard.tsx              # Individual station preview card
├── StationDetailClient.tsx      # Station detail view (CSR + WebSocket)
├── DetectionFeed.tsx            # Live camera feed + detection overlay
├── SupplyLevels.tsx             # Food %, battery %, temp, humidity tiles
├── WeeklyBarChart.tsx           # Donations per day (last 7 days)
├── MonthlyHeatmap.tsx           # Donations calendar heatmap (last 90 days)
├── FeedSheet.tsx                # Donation bottom-sheet (select grams, pay)
├── DispenseSheet.tsx            # Dispense confirmation sheet
├── ScheduleSheet.tsx            # Schedule viewer
├── ScheduleBottomSheet.tsx      # Add / edit feeding schedule
└── DayDetailSheet.tsx           # Tap a heatmap day → list donations that day
```

## Station list page

Rendered server-side. Fetches all stations from `/api/backend/stations` at request time so the list is always fresh. Each card shows:
- Station name and city/district
- Status indicator (online / low_food / offline)
- Food level percentage

## Station detail page

`StationDetailClient` is the interactive hub for one station. It:

1. Connects to the WebSocket and filters messages by `station_code`.
2. Updates telemetry state (food %, temp, humidity) in real time on `telemetry` messages.
3. Updates `latestDetection` on `detection` messages — `DetectionFeed` overlays the bounding box.
4. Fetches 90 days of daily donation counts on mount (and after each donation) to populate `WeeklyBarChart` and `MonthlyHeatmap`.

### WebSocket message types handled

| `type` | Effect |
|--------|--------|
| `telemetry` | Updates food_pct, battery_pct, temp_c, humidity_pct, status |
| `detection` | Stores latest detection for overlay rendering |

## Donation flow

1. Visitor taps **Feed a cat** → `FeedSheet` opens.
2. Chooses a donation amount (NT$15 / NT$30 / NT$50 / custom).
3. App calls `POST /api/backend/payments/sessions` with `{station_id, amount_ntd, grams}`.
4. Backend creates a `PaymentSession`, generates a `short_id`, and publishes `show_qr` to the station's OLED.
5. App navigates to `/payment/{short_id}` — a QR-code scan / simulated payment page.
6. Confirming payment calls `POST /api/backend/payments/sessions/{id}/pay`.
7. Backend marks the session `paid`, creates a `Donation` record, and publishes `dispense` to the station.
8. The ESP32 receives the dispense command and turns the servo.

## Payment page (`/payment/[short_id]`)

Lookup: `GET /api/backend/payments/sessions/by-short/{short_id}`

Shows amount, station name, and a confirm button. In production this page would integrate a real payment SDK (LINE Pay / ECPay). Currently the confirm button calls the `/pay` endpoint directly (demo mode).

## Feeding schedule bottom sheet

`ScheduleBottomSheet` lists existing cron schedules for the station and allows adding new ones. Calls:
- `GET /api/backend/stations/{id}/schedules`
- `POST /api/backend/stations/{id}/schedules`
- `DELETE /api/backend/stations/{id}/schedules/{schedule_id}`

## WebSocket hook

```ts
// apps/mobile/hooks/useWebSocket.ts
useWebSocket(onMessage: (msg: WSMessage) => void)
```

Connects to `NEXT_PUBLIC_WS_URL`. Auto-reconnects on close. Fires `onMessage` for every parsed JSON frame.

## Docker

Internal port: **3000**. Exposed as **3005** in `docker-compose.yml`.

Public URL via Cloudflare Tunnel: `https://stray.heretichydra.xyz`
