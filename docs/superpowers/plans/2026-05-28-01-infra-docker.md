# Plan 01 — Monorepo Scaffold & Docker Infrastructure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the full pnpm monorepo with working Docker Compose orchestrating all 7 services (mosquitto, postgres, influxdb, backend, mobile, landing, admin).

**Architecture:** pnpm workspaces at the root manage `apps/*` and `packages/*`. Turborepo handles build caching. Docker Compose wires all services together on a shared bridge network. A dev override file enables hot-reload for all services.

**Tech Stack:** pnpm 9, Turborepo 2, Docker Compose v2, eclipse-mosquitto:2, postgres:16, influxdb:2.7, node:20-alpine, python:3.12-slim

---

## File Map

| File | Purpose |
|---|---|
| `package.json` | Root pnpm workspace definition |
| `pnpm-workspace.yaml` | Workspace glob patterns |
| `turbo.json` | Turborepo pipeline config |
| `.env.example` | All env vars with safe defaults |
| `.gitignore` | Node, Python, Docker ignores |
| `docker-compose.yml` | Production service definitions |
| `docker-compose.dev.yml` | Dev overrides (hot-reload, exposed ports) |
| `mosquitto/mosquitto.conf` | Production broker config |
| `mosquitto/mosquitto.dev.conf` | Dev broker config (verbose logging) |
| `mosquitto/data/.gitkeep` | Persist broker state |
| `mosquitto/log/.gitkeep` | Broker log dir |
| `backend/Dockerfile` | python:3.12-slim multi-stage |
| `backend/requirements.txt` | Python deps (placeholder — filled in Plan 02) |
| `backend/app/__init__.py` | Package marker |
| `backend/app/main.py` | Minimal FastAPI app (health endpoint only) |
| `apps/landing/package.json` | Next.js 14 app |
| `apps/landing/next.config.ts` | Standalone output |
| `apps/landing/Dockerfile` | Multi-stage Next.js build |
| `apps/mobile/package.json` | Next.js 14 app |
| `apps/mobile/next.config.ts` | Standalone output |
| `apps/mobile/Dockerfile` | Multi-stage Next.js build |
| `apps/admin/package.json` | Next.js 14 app |
| `apps/admin/next.config.ts` | Standalone output |
| `apps/admin/Dockerfile` | Multi-stage Next.js build |
| `packages/ui/package.json` | Shared component lib |
| `packages/ui/src/index.ts` | Empty barrel (filled in Plan 05) |

---

## Task 1: Root Monorepo Scaffold

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.gitignore`

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "stray",
  "version": "0.0.1",
  "private": true,
  "packageManager": "pnpm@9.1.0",
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "type-check": "turbo run type-check"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.5"
  }
}
```

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 3: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "type-check": {
      "dependsOn": ["^build"]
    }
  }
}
```

- [ ] **Step 4: Create `.gitignore`**

```gitignore
# Node
node_modules/
.next/
dist/
.turbo/

# Python
__pycache__/
*.py[cod]
.venv/
*.egg-info/

# Env
.env
.env.local
.env.*.local

# Docker volumes
mosquitto/data/*
mosquitto/log/*
!mosquitto/data/.gitkeep
!mosquitto/log/.gitkeep

# OS
.DS_Store
Thumbs.db
```

- [ ] **Step 5: Create `.env.example`**

```env
# PostgreSQL
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

# JWT (change before production)
JWT_SECRET=change-me-in-production
JWT_EXPIRE_HOURS=24

# Frontend (build-time — used by Next.js apps)
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

- [ ] **Step 6: Copy `.env.example` to `.env` for local dev**

```bash
cp .env.example .env
```

- [ ] **Step 7: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold monorepo root (pnpm + turbo)"
```

---

## Task 2: Mosquitto MQTT Broker Config

**Files:**
- Create: `mosquitto/mosquitto.conf`
- Create: `mosquitto/mosquitto.dev.conf`
- Create: `mosquitto/data/.gitkeep`
- Create: `mosquitto/log/.gitkeep`

- [ ] **Step 1: Create `mosquitto/mosquitto.conf` (production)**

```conf
# Listener
listener 1883
listener 9001
protocol websockets

# Persistence
persistence true
persistence_location /mosquitto/data/

# Logging
log_dest file /mosquitto/log/mosquitto.log
log_type error
log_type warning
log_type notice

# Security — allow anonymous for dev (lock down per-deployment)
allow_anonymous true
```

- [ ] **Step 2: Create `mosquitto/mosquitto.dev.conf` (development — verbose)**

```conf
listener 1883
listener 9001
protocol websockets

persistence true
persistence_location /mosquitto/data/

log_dest stdout
log_type all

allow_anonymous true
```

- [ ] **Step 3: Create placeholder dirs**

```bash
mkdir -p mosquitto/data mosquitto/log
touch mosquitto/data/.gitkeep mosquitto/log/.gitkeep
```

- [ ] **Step 4: Commit**

```bash
git add mosquitto/
git commit -m "chore: add Mosquitto MQTT broker config"
```

---

## Task 3: Backend Skeleton

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/requirements.txt`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`

- [ ] **Step 1: Create `backend/requirements.txt`**

```text
fastapi==0.111.0
uvicorn[standard]==0.30.0
sqlalchemy[asyncio]==2.0.30
asyncpg==0.29.0
alembic==1.13.1
pydantic-settings==2.2.1
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.9
aiomqtt==1.2.1
influxdb-client[async]==1.43.0
httpx==0.27.0
pytest==8.2.0
pytest-asyncio==0.23.7
pytest-mock==3.14.0
```

- [ ] **Step 2: Create `backend/app/__init__.py`**

```python
```
(empty file — marks directory as Python package)

- [ ] **Step 3: Create `backend/app/main.py` (skeleton with health check)**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Stray API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
```

- [ ] **Step 4: Create `backend/Dockerfile`**

```dockerfile
FROM python:3.12-slim AS base
WORKDIR /app

# Install deps in a separate layer for caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY app/ ./app/

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "chore: add backend skeleton with health endpoint"
```

---

## Task 4: Next.js App Scaffolds

**Files:**
- Create: `apps/landing/package.json`, `apps/landing/next.config.ts`, `apps/landing/Dockerfile`
- Create: `apps/mobile/package.json`, `apps/mobile/next.config.ts`, `apps/mobile/Dockerfile`
- Create: `apps/admin/package.json`, `apps/admin/next.config.ts`, `apps/admin/Dockerfile`
- Create: `packages/ui/package.json`, `packages/ui/src/index.ts`

- [ ] **Step 1: Create `apps/landing/package.json`**

```json
{
  "name": "@stray/landing",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p 3001",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@stray/ui": "workspace:*",
    "next": "14.2.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "lucide-react": "^0.378.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "typescript": "^5.4.5"
  }
}
```

- [ ] **Step 2: Create `apps/mobile/package.json`**

```json
{
  "name": "@stray/mobile",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@stray/ui": "workspace:*",
    "next": "14.2.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "lucide-react": "^0.378.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "typescript": "^5.4.5"
  }
}
```

- [ ] **Step 3: Create `apps/admin/package.json`**

```json
{
  "name": "@stray/admin",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3002",
    "build": "next build",
    "start": "next start -p 3002",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@stray/ui": "workspace:*",
    "next": "14.2.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "lucide-react": "^0.378.0",
    "jose": "^5.2.4"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "typescript": "^5.4.5"
  }
}
```

- [ ] **Step 4: Create `packages/ui/package.json`**

```json
{
  "name": "@stray/ui",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.3.1",
    "lucide-react": "^0.378.0"
  },
  "devDependencies": {
    "@types/react": "^18",
    "typescript": "^5.4.5"
  }
}
```

- [ ] **Step 5: Create `packages/ui/src/index.ts` (empty barrel)**

```typescript
// Filled in Plan 05 — Shared UI Package
export {};
```

- [ ] **Step 6: Create shared `next.config.ts` for all three apps**

Create `apps/landing/next.config.ts`:
```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@stray/ui'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

export default nextConfig;
```

Repeat identically for `apps/mobile/next.config.ts` and `apps/admin/next.config.ts`.

- [ ] **Step 7: Create shared `tsconfig.json` for all three apps**

Create `apps/landing/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Repeat identically for `apps/mobile/tsconfig.json` and `apps/admin/tsconfig.json`.

- [ ] **Step 8: Create minimal app entry points**

Create `apps/landing/app/layout.tsx`:
```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
```

Create `apps/landing/app/page.tsx`:
```tsx
export default function HomePage() {
  return <main><h1>Stray Landing — coming in Plan 06</h1></main>;
}
```

Repeat pattern for `apps/mobile/app/layout.tsx`, `apps/mobile/app/page.tsx`, `apps/admin/app/layout.tsx`, `apps/admin/app/page.tsx`.

- [ ] **Step 9: Create Dockerfiles for Next.js apps**

Create `apps/landing/Dockerfile` (same pattern for mobile and admin, change port):
```dockerfile
FROM node:20-alpine AS base
RUN corepack enable pnpm

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY apps/landing/package.json ./apps/landing/
COPY packages/ui/package.json ./packages/ui/
RUN pnpm install --frozen-lockfile

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @stray/landing build

# Runtime
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/landing/.next/standalone ./
COPY --from=builder /app/apps/landing/.next/static ./apps/landing/.next/static
COPY --from=builder /app/apps/landing/public ./apps/landing/public
EXPOSE 3001
CMD ["node", "apps/landing/server.js"]
```

Create `apps/mobile/Dockerfile` — same but replace `landing` → `mobile` and port `3001` → `3000`.
Create `apps/admin/Dockerfile` — same but replace `landing` → `admin` and port `3001` → `3002`.

- [ ] **Step 10: Install dependencies**

```bash
pnpm install
```

Expected: All workspace packages linked, `node_modules` at root + per-app.

- [ ] **Step 11: Commit**

```bash
git add apps/ packages/
git commit -m "chore: scaffold Next.js apps and shared UI package"
```

---

## Task 5: Docker Compose Wiring

**Files:**
- Create: `docker-compose.yml`
- Create: `docker-compose.dev.yml`

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
version: '3.9'

networks:
  stray_network:
    driver: bridge

volumes:
  postgres_data:
  influxdb_data:

services:
  mosquitto:
    image: eclipse-mosquitto:2
    restart: unless-stopped
    ports:
      - "1883:1883"
      - "9001:9001"
    volumes:
      - ./mosquitto/mosquitto.conf:/mosquitto/config/mosquitto.conf:ro
      - ./mosquitto/data:/mosquitto/data
      - ./mosquitto/log:/mosquitto/log
    networks:
      - stray_network

  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-stray}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-stray}
      POSTGRES_DB: ${POSTGRES_DB:-stray}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks:
      - stray_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U stray"]
      interval: 5s
      timeout: 5s
      retries: 5

  influxdb:
    image: influxdb:2.7
    restart: unless-stopped
    environment:
      DOCKER_INFLUXDB_INIT_MODE: setup
      DOCKER_INFLUXDB_INIT_USERNAME: admin
      DOCKER_INFLUXDB_INIT_PASSWORD: adminadmin
      DOCKER_INFLUXDB_INIT_ORG: ${INFLUX_ORG:-stray}
      DOCKER_INFLUXDB_INIT_BUCKET: ${INFLUX_BUCKET:-stray}
      DOCKER_INFLUXDB_INIT_ADMIN_TOKEN: ${INFLUX_TOKEN:-my-super-secret-token}
    volumes:
      - influxdb_data:/var/lib/influxdb2
    ports:
      - "8086:8086"
    networks:
      - stray_network
    healthcheck:
      test: ["CMD", "influx", "ping"]
      interval: 5s
      timeout: 5s
      retries: 10

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file: .env
    ports:
      - "8000:8000"
    networks:
      - stray_network
    depends_on:
      postgres:
        condition: service_healthy
      influxdb:
        condition: service_healthy
      mosquitto:
        condition: service_started

  mobile:
    build:
      context: .
      dockerfile: apps/mobile/Dockerfile
    restart: unless-stopped
    environment:
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:8000}
      NEXT_PUBLIC_WS_URL: ${NEXT_PUBLIC_WS_URL:-ws://localhost:8000/ws}
    ports:
      - "3000:3000"
    networks:
      - stray_network
    depends_on:
      - backend

  landing:
    build:
      context: .
      dockerfile: apps/landing/Dockerfile
    restart: unless-stopped
    environment:
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:8000}
    ports:
      - "3001:3001"
    networks:
      - stray_network
    depends_on:
      - backend

  admin:
    build:
      context: .
      dockerfile: apps/admin/Dockerfile
    restart: unless-stopped
    environment:
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:8000}
      NEXT_PUBLIC_WS_URL: ${NEXT_PUBLIC_WS_URL:-ws://localhost:8000/ws}
    ports:
      - "3002:3002"
    networks:
      - stray_network
    depends_on:
      - backend
```

- [ ] **Step 2: Create `docker-compose.dev.yml`**

```yaml
version: '3.9'

services:
  mosquitto:
    volumes:
      - ./mosquitto/mosquitto.dev.conf:/mosquitto/config/mosquitto.conf:ro

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    volumes:
      - ./backend/app:/app/app
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  mobile:
    build:
      context: .
      dockerfile: apps/mobile/Dockerfile.dev
    volumes:
      - ./apps/mobile:/app/apps/mobile
      - ./packages/ui:/app/packages/ui
    command: pnpm --filter @stray/mobile dev

  landing:
    build:
      context: .
      dockerfile: apps/landing/Dockerfile.dev
    volumes:
      - ./apps/landing:/app/apps/landing
      - ./packages/ui:/app/packages/ui
    command: pnpm --filter @stray/landing dev

  admin:
    build:
      context: .
      dockerfile: apps/admin/Dockerfile.dev
    volumes:
      - ./apps/admin:/app/apps/admin
      - ./packages/ui:/app/packages/ui
    command: pnpm --filter @stray/admin dev

  influxdb:
    ports:
      - "8086:8086"
```

- [ ] **Step 3: Create `Dockerfile.dev` for each Next.js app (shared pattern)**

Create `apps/mobile/Dockerfile.dev`:
```dockerfile
FROM node:20-alpine
RUN corepack enable pnpm
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY apps/mobile/package.json ./apps/mobile/
COPY packages/ui/package.json ./packages/ui/
RUN pnpm install
EXPOSE 3000
CMD ["pnpm", "--filter", "@stray/mobile", "dev"]
```

Create `apps/landing/Dockerfile.dev` — same, replace `mobile` → `landing`, port `3000` → `3001`.
Create `apps/admin/Dockerfile.dev` — same, replace `mobile` → `admin`, port `3000` → `3002`.

- [ ] **Step 4: Smoke-test infrastructure (Mosquitto + Postgres + Influx only)**

```bash
docker compose up mosquitto postgres influxdb -d
```

Expected output: 3 containers running.

```bash
docker compose ps
```

Expected: mosquitto, postgres, influxdb all show `Up (healthy)` or `Up`.

- [ ] **Step 5: Verify Mosquitto is reachable**

```bash
docker compose exec mosquitto mosquitto_pub -t test/hello -m "ping"
```

Expected: No error output.

- [ ] **Step 6: Bring everything down**

```bash
docker compose down
```

- [ ] **Step 7: Commit**

```bash
git add docker-compose.yml docker-compose.dev.yml apps/*/Dockerfile.dev
git commit -m "chore: Docker Compose wiring for all 7 services"
```

---

## Task 6: End-to-End Stack Smoke Test

- [ ] **Step 1: Build and start the full stack**

```bash
docker compose up --build -d
```

Expected: All 7 containers start. `backend` may take 30–60s for deps.

- [ ] **Step 2: Check backend health**

```bash
curl http://localhost:8000/health
```

Expected:
```json
{"status": "ok"}
```

- [ ] **Step 3: Check Next.js apps respond**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002
```

Expected: `200` for all three.

- [ ] **Step 4: Check InfluxDB UI**

Open `http://localhost:8086` in browser.
Expected: InfluxDB login/setup UI. Log in with `admin` / `adminadmin`.

- [ ] **Step 5: Bring down**

```bash
docker compose down
```

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "chore: verified full stack smoke test — all 7 services healthy"
```
