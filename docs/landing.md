# Landing Page

The landing page is a public-facing marketing site built with Next.js 14. It introduces the Stray platform, shows live station counts, and links visitors to the mobile app and donation flow.

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14 (App Router, standalone output) |
| Styling | Inline CSS-in-JS, shared `@stray/ui` package |
| API transport | Same-origin proxy `/api/backend/*` → FastAPI |

## Running locally

```bash
pnpm --filter landing dev   # starts on :3001
```

Or via Docker Compose:

```bash
docker compose up landing
# Landing listens on host port 3006
```

Environment variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| `API_URL` | `http://backend:8000` | Server-side API base (build-time rewrite target) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3004` | Legacy; not used by page components |

Browser calls go through the Next.js rewrite `/api/backend/*` → backend, never directly to the backend host.

## Page structure

```
app/
├── layout.tsx         # Metadata, fonts, global styles
├── globals.css
└── page.tsx           # Home page — assembles section components

components/
├── MHeader.tsx        # Sticky top navigation
├── Hero.tsx           # Hero section with live stats badge
├── HowItWorks.tsx     # 3-step explainer (scan → pay → feed)
├── ImpactStrip.tsx    # Aggregate stats: cats fed, stations online, donations
├── StationsSection.tsx # Live station list/map preview
└── Footer.tsx         # Links and project credit
```

## Sections

### MHeader
Sticky navigation bar. Links to the mobile app (`stray.heretichydra.xyz`) and the GitHub repository.

### Hero
Full-width hero with an animated orange radial glow. Displays a live "Stray is live" badge and a primary CTA button pointing to the mobile app. Stats (stations online, cats fed today) are fetched server-side from `/api/backend/stations` so the page ships with real numbers.

### HowItWorks
Three-card explainer:
1. Scan QR code at any feeder station
2. Pay NT$15–150 via mobile payment
3. Watch the cat eat live on camera

### ImpactStrip
Aggregate numbers pulled from the backend:
- Total cats identified across all stations
- Total food dispensed (kg)
- Active stations online right now

### StationsSection
Grid of station cards showing name, city, and status indicator (online / low_food / offline). Links each card to the station detail page on the mobile app.

### Footer
Attribution, GitHub link, NTUST course information.

## API usage

```ts
// apps/landing/lib/api.ts
// All calls use the /api/backend/* proxy path
fetchStations()          // GET /api/backend/stations
fetchStationStats()      // GET /api/backend/stations/stats  (if implemented)
```

## Docker

Internal port: **3001**. Exposed as **3006** in `docker-compose.yml`.

Public URL via Cloudflare Tunnel:
- `https://heretichydra.xyz`
- `https://www.heretichydra.xyz`
