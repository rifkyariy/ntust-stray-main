# Admin Dashboard

The admin dashboard is a Next.js 14 web application for station operators and city administrators. It provides real-time monitoring, station management, dispense controls, and the live YOLO cat-detection feed.

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14 (App Router, standalone output) |
| Map | React-Leaflet (CSR-only, dynamically imported) |
| Real-time | WebSocket (`/ws` via backend) |
| API transport | Same-origin proxy rewrites (no NEXT_PUBLIC_* URLs) |
| Styling | Inline CSS-in-JS, shared `@stray/ui` package |

## Running locally

```bash
# From monorepo root
pnpm --filter admin dev        # starts on :3002
```

Or with Docker Compose (full stack):

```bash
docker compose up admin
# Admin listens on host port 3007
```

Environment variables (set in `.env` or `docker-compose.yml`):

| Variable | Default | Purpose |
|----------|---------|---------|
| `API_URL` | `http://backend:8000` | Build-time backend URL (server-side only) |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:3004/ws` | WebSocket endpoint shown to browser |
| `NEXT_PUBLIC_DETECTOR_URL` | `http://localhost:3008` | Detector endpoint shown to browser |

> **Note:** Browser calls never use these URLs directly. `next.config.mjs` rewrites `/detector/*` → detector service and `/api/backend/*` → FastAPI. Both destinations resolve over the Docker bridge network at build time.

## Same-origin proxy rewrites

```js
// apps/admin/next.config.mjs
{ source: '/detector/:path*',    destination: 'http://detector:8001/:path*' }
{ source: '/api/backend/:path*', destination: 'http://backend:8000/:path*' }
```

All browser API calls go through the Next.js server, not directly to backend/detector. This avoids CORS and keeps internal service addresses off the client.

## Page structure

```
app/
├── layout.tsx                   # Root layout — loads fonts
├── globals.css
├── login/
│   └── page.tsx                 # Admin login (JWT)
└── (dashboard)/
    ├── layout.tsx               # Sidebar + Topbar shell
    ├── page.tsx                 # Dashboard SSR shell
    └── DashboardClient.tsx      # Interactive dashboard (CSR)
```

## Key components

### DashboardClient
Main interactive view. Fetches stations from `/api/backend/stations` on mount, then subscribes to WebSocket messages via `useWebSocket`. Updates station state in place on `telemetry`, `detection`, `feed_event`, and `alert` messages.

### StationsMap (`components/StationsMap.tsx`)
Leaflet map rendered client-side only (SSR disabled via `dynamic()` with `ssr: false`). Pins are colored by station status:
- Orange → online
- Yellow → low_food
- Grey → offline

Clicking a pin opens `StationDrawer`.

### StationDrawer (`components/StationDrawer.tsx`)
Slide-in panel showing the selected station's telemetry, live YOLO feed, controls (dispense button, schedule editor), and recent activity.

### KPIStrip (`components/KPIStrip.tsx`)
Top bar showing aggregate counts: total stations, online count, total donations, cats fed today.

### ActivityFeed (`components/ActivityFeed.tsx`)
Live scrolling list of WebSocket events (detections, dispenses, alerts, donations).

### AddStationModal (`components/AddStationModal.tsx`)
Form to register a new feeder station. POSTs to `/api/backend/stations`.

## Authentication

Login submits to `/api/backend/auth/login`. On success the backend returns a JWT stored in a cookie. The Next.js `middleware.ts` checks the cookie on every dashboard route and redirects to `/login` when missing or expired.

```ts
// apps/admin/middleware.ts
// Protects all routes under (dashboard)
```

## WebSocket hook

```ts
// apps/admin/hooks/useWebSocket.ts
useWebSocket(onMessage: (msg: WSMessage) => void)
```

Connects to `NEXT_PUBLIC_WS_URL`. Reconnects automatically on close. Passes parsed JSON messages to the callback.

## YOLO live feed

The admin embeds the detector endpoint through the `/detector/*` proxy. Frames are POSTed to `/detector/detect` and detection bounding boxes are overlaid on the video element in the browser.

## Docker

```dockerfile
# apps/admin/Dockerfile — multi-stage, standalone Next.js output
FROM node:20-alpine AS builder
...
FROM node:20-alpine AS runner
COPY --from=builder /app/apps/admin/.next/standalone ./
```

Internal port: **3002**. Exposed as **3007** in `docker-compose.yml`.
