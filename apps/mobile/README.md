# @stray/mobile

Mobile-first web app for members of the public interacting with Stray feeding stations. Built with Next.js 14 App Router, running on port **3000**.

## Features

| Route | Description |
|---|---|
| `/` | Station list — all stations with live status badges |
| `/station/[id]` | Station detail — food level, battery, temperature, last dispense |
| `/dispense/[id]` | Trigger an immediate dispense (for authorised donors) |
| `/schedule/[id]` | View and set automatic feeding schedules |

No login is required for browsing. Dispense actions are linked to donation records.

## Stack

- **Next.js 14** — App Router, server components, `output: standalone`
- **@stray/ui** — shared icon/component library (workspace package)
- Designed for mobile viewports; sticky top bar, touch-friendly tap targets

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend REST API base URL |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:8000/ws` | WebSocket endpoint for live station updates |

## Development

```bash
# from monorepo root
pnpm --filter @stray/mobile dev
# or via Docker Compose
docker compose -f docker-compose.yml -f docker-compose.dev.yml up mobile
```

App starts at `http://localhost:3000`.

## Production Build

```bash
pnpm --filter @stray/mobile build
```

## Docker

```bash
docker compose build mobile
docker compose up mobile
```

## Real-time Updates

The station list and detail pages subscribe to the WebSocket at `NEXT_PUBLIC_WS_URL`. Incoming telemetry messages update food level, battery, temperature, and humidity without a page refresh.
