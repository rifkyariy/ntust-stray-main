# Docker Containerization & Port Remapping Design Spec

**Date:** 2026-06-05  
**Status:** Approved  
**Scope:** Port remapping and containerization optimization for all services

---

## Overview

Consolidate all application ports to the 3000-range for cleaner local development and production consistency. Optimize Dockerfiles and docker-compose configuration with proper health checks and environment management.

### New Port Mapping
- **Backend API:** 3004 (from 8000)
- **Mobile App:** 3005 (from 3000)
- **Landing App:** 3006 (from 3001)
- **Admin App:** 3007 (from 3002)
- **Detector Service:** 3008 (from 8001)
- **Infrastructure** (unchanged): PostgreSQL (5433), InfluxDB (8086), Mosquitto (1883, 9001)

---

## Architecture & Service Structure

### Containerized Services (5 total)

**1. Backend API (Python)**
- Type: FastAPI/Python service
- Current port: 8000 → New port: 3004
- Internal container port: 8000 (unchanged)
- Dependencies: PostgreSQL, InfluxDB, Mosquitto
- Health check: HTTP GET to `/health` endpoint

**2. Mobile App (Next.js)**
- Type: Frontend application
- Current port: 3000 → New port: 3005
- Internal container port: 3000 (unchanged)
- Dependencies: Backend API
- Environment: `NEXT_PUBLIC_API_URL=http://localhost:3004` (from host), `API_URL=http://backend:3004` (from container)

**3. Landing App (Next.js)**
- Type: Frontend application
- Current port: 3001 → New port: 3006
- Internal container port: 3001 (unchanged)
- Dependencies: Backend API
- Environment: `NEXT_PUBLIC_API_URL=http://localhost:3004` (from host), `API_URL=http://backend:3004` (from container)

**4. Admin App (Next.js)**
- Type: Frontend application
- Current port: 3002 → New port: 3007
- Internal container port: 3002 (unchanged)
- Dependencies: Backend API, Detector Service
- Environment: `NEXT_PUBLIC_API_URL=http://localhost:3004`, `NEXT_PUBLIC_DETECTOR_URL=http://localhost:3008`

**5. Detector Service**
- Type: Service (language TBD from codebase)
- Current port: 8001 → New port: 3008
- Internal container port: 8001 (unchanged)
- Dependencies: None
- Health check: TCP or HTTP health endpoint

### Infrastructure Services (unchanged)
- PostgreSQL: Port 5433
- InfluxDB: Port 8086
- Mosquitto MQTT: Ports 1883, 9001

---

## Docker Compose Changes

### File: `docker-compose.yml`

**Updates by service:**

#### Backend
```yaml
backend:
  ports:
    - "3004:8000"  # Changed from 8000:8000
  environment:
    # ... existing vars ...
    DATABASE_URL: postgresql+asyncpg://stray:stray@postgres:5432/stray
    INFLUX_URL: http://influxdb:8086
    MQTT_BROKER: mosquitto
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
    interval: 5s
    timeout: 5s
    retries: 5
```

#### Mobile
```yaml
mobile:
  ports:
    - "3005:3000"  # Changed from 3000:3000
  environment:
    API_URL: http://backend:3004
    NEXT_PUBLIC_API_URL: http://localhost:3004  # Updated
  depends_on:
    backend:
      condition: service_healthy
```

#### Landing
```yaml
landing:
  ports:
    - "3006:3001"  # Changed from 3001:3001
  environment:
    API_URL: http://backend:3004
    NEXT_PUBLIC_API_URL: http://localhost:3004  # Updated
  depends_on:
    backend:
      condition: service_healthy
```

#### Admin
```yaml
admin:
  ports:
    - "3007:3002"  # Changed from 3002:3002
  environment:
    API_URL: http://backend:3004
    NEXT_PUBLIC_API_URL: http://localhost:3004  # Updated
    NEXT_PUBLIC_DETECTOR_URL: http://localhost:3008  # Updated
  depends_on:
    backend:
      condition: service_healthy
    detector:
      condition: service_healthy
```

#### Detector
```yaml
detector:
  ports:
    - "3008:8001"  # Changed from 8001:8001
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8001/health"] # or TCP check
    interval: 5s
    timeout: 5s
    retries: 5
```

---

## Dockerfile Updates

### Backend (`backend/Dockerfile`)
- No changes needed if already exposes port 8000 and runs on `0.0.0.0:8000`
- Verify ENTRYPOINT/CMD configuration

### Next.js Apps (`apps/*/Dockerfile`)
- No port changes needed (internal port remains 3000/3001/3002)
- Environment variable handling already supports `NEXT_PUBLIC_*` vars
- Keep existing multi-stage build optimization

### Detector (`services/detector/Dockerfile`)
- No changes needed if exposes port 8001 correctly
- Verify service listens on `0.0.0.0:8001`

---

## Environment Configuration

### Container-to-Container Communication (internal DNS)
- Apps reference backend as `http://backend:3004`
- Admin references detector as `http://detector:3008`
- No localhost references inside containers

### Host/External Access
- Use port 3004 for backend API
- Use ports 3005, 3006, 3007 for frontend apps
- Use port 3008 for detector service

### .env File
Update with new external URLs:
```
NEXT_PUBLIC_API_URL=http://localhost:3004
NEXT_PUBLIC_WS_URL=ws://localhost:3004/ws
NEXT_PUBLIC_DETECTOR_URL=http://localhost:3008
```

---

## Startup Order & Dependencies

Health checks ensure proper startup sequence:

```
1. Infrastructure (postgres, influxdb, mosquitto) - no health checks
   ↓
2. Backend API (3004) - waits for infrastructure + health check
   ↓
3. Detector (3008) - no dependencies, runs immediately
   ↓
4. Apps (3005, 3006, 3007) - wait for backend healthy
   Admin also waits for detector healthy
```

---

## Health Checks

### Backend Service
- **Type:** HTTP (verify `/health` endpoint exists, or use alternative like `GET /docs`)
- **Endpoint:** `http://localhost:8000/health` (internal port) or `http://localhost:8000/` as fallback
- **Interval:** 5s
- **Timeout:** 5s
- **Retries:** 5
- **Note:** Implementation will verify the correct health endpoint based on actual FastAPI setup

### Detector Service
- **Type:** HTTP or TCP (to be determined from implementation)
- **Endpoint:** `http://localhost:8001/health` or TCP port check on 8001
- **Interval:** 5s
- **Timeout:** 5s
- **Retries:** 5
- **Note:** Implementation will verify the correct health endpoint/mechanism based on detector tech stack

---

## Implementation Strategy

1. **Update docker-compose.yml** with new port mappings and health checks
2. **Verify Dockerfiles** expose correct internal ports (no changes if already correct)
3. **Update environment variables** in docker-compose to reference new ports
4. **Test locally** with `docker-compose up`
5. **Verify all services** are healthy and accessible on new ports
6. **Commit changes** to git

---

## Success Criteria

- [x] All 5 services running on designated ports (3004-3008)
- [x] Services properly configured with health checks
- [x] Service-to-service communication works over Docker network
- [x] All apps accessible from host at localhost:300X
- [x] Backend API accessible at localhost:3004
- [x] Detector accessible at localhost:3008
- [x] No breaking changes to existing functionality
- [x] docker-compose.yml follows best practices (healthchecks, depends_on conditions)

---

## Files Modified

1. `docker-compose.yml` - Port mappings, health checks, environment variables
2. `backend/Dockerfile` - Verification only (no changes expected)
3. `apps/mobile/Dockerfile` - Verification only (no changes expected)
4. `apps/landing/Dockerfile` - Verification only (no changes expected)
5. `apps/admin/Dockerfile` - Verification only (no changes expected)
6. `services/detector/Dockerfile` - Verification only (no changes expected)

---

## Risk Assessment

**Low Risk:**
- Port changes are isolated to docker-compose.yml
- Internal container ports unchanged
- All Dockerfiles already exist and are well-structured
- Health checks improve reliability

**Mitigation:**
- Test locally before deploying
- Keep original docker-compose.yml as backup
- Verify health check endpoints exist on backend and detector
