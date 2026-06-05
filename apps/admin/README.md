# @stray/admin

Operator dashboard for the Stray smart feeding station network. Built with Next.js 14 App Router, running on port **3002**.

## Features

| Route | Description |
|---|---|
| `/` | Overview — KPI tiles, live station map (Leaflet), recent alerts |
| `/stations` | Station list with status, food/battery levels |
| `/stations/[id]` | Station detail — telemetry charts, dispense controls, schedules |
| `/cats` | Registered cat log |
| `/funding` | Donation records per station |
| `/alerts` | System alerts feed |
| `/stream` | Live camera feed with real-time YOLOv8 animal detection |
| `/login` | Credential login (sets `stray_admin_token` cookie) |

All routes except `/login` and `/api/auth/*` require a valid `stray_admin_token` cookie (enforced by `middleware.ts`).

## Stack

- **Next.js 14** — App Router, server components, `output: standalone`
- **React Leaflet** — interactive station map
- **WebSocket** — live telemetry via `NEXT_PUBLIC_WS_URL`
- **@stray/ui** — shared icon/component library (workspace package)

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend REST API base URL |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:8000/ws` | WebSocket endpoint |
| `NEXT_PUBLIC_DETECTOR_URL` | `http://localhost:8001` | YOLOv8 detector service URL |

## Development

```bash
# from monorepo root
pnpm --filter @stray/admin dev
# or via Docker Compose
docker compose -f docker-compose.yml -f docker-compose.dev.yml up admin
```

App starts at `http://localhost:3002`.

Default admin credentials are seeded by the backend (`backend/app/db/seed.py`).

## Production Build

```bash
pnpm --filter @stray/admin build
```

The standalone output is served by `node apps/admin/server.js` inside the Docker image.

## Docker

```bash
# build image only
docker compose build admin

# start with all dependencies
docker compose up admin
```

The Dockerfile performs a two-stage build: **builder** compiles the Next.js app, **runner** copies the standalone output and `public/` (including `video/dummy.mp4` for the stream demo).

## Stream Page

The `/stream` page captures video frames every 500 ms and posts them as JPEG blobs to `NEXT_PUBLIC_DETECTOR_URL/detect`. Bounding boxes are drawn from the normalised coordinates returned by the detector. When the detector service is offline the page still works — video plays and the feed panel shows an offline notice.

Switch between **Demo Video** (`/video/dummy.mp4`) and **ESP-Cam** (MJPEG URL input) using the source toggle.
