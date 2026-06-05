# @stray/landing

Public-facing landing page for the Stray project. Built with Next.js 14 App Router, running on port **3001**.

## Purpose

Introduces the Stray smart stray-cat feeding station network to the public. Covers the project mission, how stations work, and donation call-to-action. No authentication required.

## Stack

- **Next.js 14** — App Router, `output: standalone`
- **@stray/ui** — shared design tokens and components (workspace package)
- Design system: cream background (`#FDFBF7`), orange-500 (`#f97316`) accents, Plus Jakarta Sans

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend API base URL (used for station counts / live stats) |

## Development

```bash
# from monorepo root
pnpm --filter @stray/landing dev
# or via Docker Compose
docker compose -f docker-compose.yml -f docker-compose.dev.yml up landing
```

App starts at `http://localhost:3001`.

## Production Build

```bash
pnpm --filter @stray/landing build
```

## Docker

```bash
docker compose build landing
docker compose up landing
```
