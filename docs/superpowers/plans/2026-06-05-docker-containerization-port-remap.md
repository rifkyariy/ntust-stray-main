# Docker Containerization & Port Remapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate all service ports to the 3000-range (3004-3008) with optimized docker-compose configuration and proper health checks.

**Architecture:** Update existing docker-compose.yml with new port mappings, configure health checks for critical services (backend, detector), and adjust environment variables for container-to-container communication. No changes to Dockerfiles needed (verification only).

**Tech Stack:** Docker, Docker Compose, FastAPI (backend), Next.js (apps), health checks via HTTP/TCP

---

## File Structure

**Files to Modify:**
- `docker-compose.yml` - Port mappings, health checks, environment variables

**Files to Verify (no changes expected):**
- `backend/Dockerfile`
- `apps/mobile/Dockerfile`
- `apps/landing/Dockerfile`
- `apps/admin/Dockerfile`
- `services/detector/Dockerfile`

**Backup:**
- Keep current `docker-compose.yml` state as reference (git handles this)

---

## Task 1: Investigate Backend Health Check Endpoint

**Files:**
- Read: `backend/app/main.py` or equivalent entry point
- Read: `backend/Dockerfile`

- [ ] **Step 1: Find backend entry point and identify health endpoint**

Navigate to `backend/app/main.py` (or the main FastAPI app file). Look for:
- An existing `/health` endpoint
- Alternative endpoints like `/docs`, `/ping`, or root `/`
- How the app is started and what port it listens on

Run: `grep -r "health\|ping\|ready" /Users/mit/Documents/Projects/Webapp/ntust-stray-main/backend/app/`

- [ ] **Step 2: Check FastAPI startup config**

Run: `grep -r "uvicorn\|listen\|0.0.0.0" /Users/mit/Documents/Projects/Webapp/ntust-stray-main/backend/Dockerfile`

Expected: Should see the app listening on port 8000 via uvicorn or similar

- [ ] **Step 3: Document findings**

Take note of:
- Confirmed health endpoint (e.g., `/health`, `/`, or TCP-only)
- Port configuration (should be 8000)
- What health check command should be used in docker-compose

Example findings to document:
- If `/health` exists: use `curl -f http://localhost:8000/health`
- If no endpoint: use TCP check or `curl -f http://localhost:8000/` 
- If root fails: use simple TCP check

---

## Task 2: Investigate Detector Health Check Endpoint

**Files:**
- Read: `services/detector/Dockerfile`
- Read: `services/detector/` source files (check for main.py, server.js, etc.)

- [ ] **Step 1: Identify detector tech stack and entry point**

Run: `ls -la /Users/mit/Documents/Projects/Webapp/ntust-stray-main/services/detector/`

Expected: Should show Dockerfile and source files (Python, Node, etc.)

- [ ] **Step 2: Find health check endpoint or mechanism**

Look for:
- `/health`, `/ping`, or `/ready` endpoints
- TCP port listening configuration
- What language/framework is used

Run: `cat /Users/mit/Documents/Projects/Webapp/ntust-stray-main/services/detector/Dockerfile`

- [ ] **Step 3: Determine health check command**

Based on findings, decide on health check approach:
- HTTP endpoint: `curl -f http://localhost:8001/health`
- Simple TCP: `nc -z localhost 8001` or similar
- Custom check based on framework

Document the chosen health check command.

---

## Task 3: Update docker-compose.yml - Backend Service

**Files:**
- Modify: `docker-compose.yml` (backend service section)

- [ ] **Step 1: Open docker-compose.yml and locate backend section**

Current state (lines ~64-85):
```yaml
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file: .env
    environment:
      DATABASE_URL: postgresql+asyncpg://stray:stray@postgres:5432/stray
      INFLUX_URL: http://influxdb:8086
      MQTT_BROKER: mosquitto
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
```

- [ ] **Step 2: Update port mapping from 8000:8000 to 3004:8000**

Change:
```yaml
    ports:
      - "8000:8000"
```

To:
```yaml
    ports:
      - "3004:8000"
```

Rationale: External port 3004, internal container port 8000 (unchanged)

- [ ] **Step 3: Add health check (use finding from Task 1)**

Add after the `ports` section:

```yaml
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 5s
      timeout: 5s
      retries: 5
```

**Note:** If `/health` endpoint doesn't exist from Task 1, use alternative:
- If root `/` works: `test: ["CMD", "curl", "-f", "http://localhost:8000/"]`
- If TCP only: `test: ["CMD", "nc", "-z", "localhost", "8000"]`

- [ ] **Step 4: Verify depends_on conditions are correct**

The `depends_on` section with health checks should remain as-is. No changes needed.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml
git commit -m "docker: update backend port to 3004 and add health check

- Change backend external port from 8000 to 3004
- Add health check endpoint for service readiness
- Maintain internal container port 8000

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Update docker-compose.yml - Mobile App

**Files:**
- Modify: `docker-compose.yml` (mobile service section)

- [ ] **Step 1: Locate mobile service section**

Current state (lines ~86-100):
```yaml
  mobile:
    build:
      context: .
      dockerfile: apps/mobile/Dockerfile
    restart: unless-stopped
    environment:
      API_URL: http://backend:8000
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:8000}
      NEXT_PUBLIC_WS_URL: ${NEXT_PUBLIC_WS_URL:-ws://localhost:8000/ws}
    ports:
      - "3000:3000"
    networks:
      - stray_network
    depends_on:
      - backend
```

- [ ] **Step 2: Update port mapping from 3000:3000 to 3005:3000**

Change:
```yaml
    ports:
      - "3000:3000"
```

To:
```yaml
    ports:
      - "3005:3000"
```

- [ ] **Step 3: Update environment variables**

Change:
```yaml
    environment:
      API_URL: http://backend:8000
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:8000}
      NEXT_PUBLIC_WS_URL: ${NEXT_PUBLIC_WS_URL:-ws://localhost:8000/ws}
```

To:
```yaml
    environment:
      API_URL: http://backend:3004
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:3004}
      NEXT_PUBLIC_WS_URL: ${NEXT_PUBLIC_WS_URL:-ws://localhost:3004/ws}
```

Rationale:
- `API_URL`: Internal container-to-container communication uses new backend port
- `NEXT_PUBLIC_API_URL`: External access from browser uses localhost:3004
- `NEXT_PUBLIC_WS_URL`: WebSocket connection to new backend port

- [ ] **Step 4: Update depends_on to use health check condition**

Change:
```yaml
    depends_on:
      - backend
```

To:
```yaml
    depends_on:
      backend:
        condition: service_healthy
```

This ensures mobile waits for backend to be healthy before starting.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml
git commit -m "docker: update mobile app to port 3005 and reference backend:3004

- Change mobile external port from 3000 to 3005
- Update API_URL to use backend:3004 (internal container communication)
- Update NEXT_PUBLIC_API_URL to http://localhost:3004 (external host access)
- Add health check condition for backend dependency

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Update docker-compose.yml - Landing App

**Files:**
- Modify: `docker-compose.yml` (landing service section)

- [ ] **Step 1: Locate landing service section**

Current state (lines ~102-115):
```yaml
  landing:
    build:
      context: .
      dockerfile: apps/landing/Dockerfile
    restart: unless-stopped
    environment:
      API_URL: http://backend:8000
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:8000}
    ports:
      - "3001:3001"
    networks:
      - stray_network
    depends_on:
      - backend
```

- [ ] **Step 2: Update port mapping from 3001:3001 to 3006:3001**

Change:
```yaml
    ports:
      - "3001:3001"
```

To:
```yaml
    ports:
      - "3006:3001"
```

- [ ] **Step 3: Update environment variables**

Change:
```yaml
    environment:
      API_URL: http://backend:8000
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:8000}
```

To:
```yaml
    environment:
      API_URL: http://backend:3004
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:3004}
```

- [ ] **Step 4: Update depends_on to use health check condition**

Change:
```yaml
    depends_on:
      - backend
```

To:
```yaml
    depends_on:
      backend:
        condition: service_healthy
```

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml
git commit -m "docker: update landing app to port 3006 and reference backend:3004

- Change landing external port from 3001 to 3006
- Update API_URL to use backend:3004
- Update NEXT_PUBLIC_API_URL to http://localhost:3004
- Add health check condition for backend dependency

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Update docker-compose.yml - Admin App

**Files:**
- Modify: `docker-compose.yml` (admin service section)

- [ ] **Step 1: Locate admin service section**

Current state (lines ~127-144):
```yaml
  admin:
    build:
      context: .
      dockerfile: apps/admin/Dockerfile
    restart: unless-stopped
    environment:
      API_URL: http://backend:8000
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:8000}
      NEXT_PUBLIC_WS_URL: ${NEXT_PUBLIC_WS_URL:-ws://localhost:8000/ws}
      NEXT_PUBLIC_DETECTOR_URL: ${NEXT_PUBLIC_DETECTOR_URL:-http://localhost:8001}
    ports:
      - "3002:3002"
    networks:
      - stray_network
    depends_on:
      - backend
      - detector
```

- [ ] **Step 2: Update port mapping from 3002:3002 to 3007:3002**

Change:
```yaml
    ports:
      - "3002:3002"
```

To:
```yaml
    ports:
      - "3007:3002"
```

- [ ] **Step 3: Update environment variables**

Change:
```yaml
    environment:
      API_URL: http://backend:8000
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:8000}
      NEXT_PUBLIC_WS_URL: ${NEXT_PUBLIC_WS_URL:-ws://localhost:8000/ws}
      NEXT_PUBLIC_DETECTOR_URL: ${NEXT_PUBLIC_DETECTOR_URL:-http://localhost:8001}
```

To:
```yaml
    environment:
      API_URL: http://backend:3004
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:3004}
      NEXT_PUBLIC_WS_URL: ${NEXT_PUBLIC_WS_URL:-ws://localhost:3004/ws}
      NEXT_PUBLIC_DETECTOR_URL: ${NEXT_PUBLIC_DETECTOR_URL:-http://localhost:3008}
```

Rationale:
- Backend references updated to 3004
- Detector reference updated to 3008 (new port from Task 7)

- [ ] **Step 4: Update depends_on to use health check conditions**

Change:
```yaml
    depends_on:
      - backend
      - detector
```

To:
```yaml
    depends_on:
      backend:
        condition: service_healthy
      detector:
        condition: service_healthy
```

This ensures admin waits for both services to be healthy.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml
git commit -m "docker: update admin app to port 3007 and reference backend:3004, detector:3008

- Change admin external port from 3002 to 3007
- Update API_URL to backend:3004
- Update NEXT_PUBLIC_API_URL to http://localhost:3004
- Update NEXT_PUBLIC_DETECTOR_URL to http://localhost:3008
- Add health check conditions for backend and detector dependencies

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Update docker-compose.yml - Detector Service

**Files:**
- Modify: `docker-compose.yml` (detector service section)

- [ ] **Step 1: Locate detector service section**

Current state (lines ~117-125):
```yaml
  detector:
    build:
      context: ./services/detector
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "8001:8001"
    networks:
      - stray_network
```

- [ ] **Step 2: Update port mapping from 8001:8001 to 3008:8001**

Change:
```yaml
    ports:
      - "8001:8001"
```

To:
```yaml
    ports:
      - "3008:8001"
```

- [ ] **Step 3: Add health check (use finding from Task 2)**

Add after the `ports` section:

```yaml
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 5s
      timeout: 5s
      retries: 5
```

**Note:** If Task 2 found a different health check mechanism, substitute:
- If TCP only: `test: ["CMD", "nc", "-z", "localhost", "8001"]`
- If different endpoint: adjust the curl command accordingly

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "docker: update detector service to port 3008 and add health check

- Change detector external port from 8001 to 3008
- Add health check endpoint for service readiness
- Maintain internal container port 8001

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Test Docker Compose - Verify All Services Start

**Files:**
- Test: docker-compose up with health checks

- [ ] **Step 1: Build and start all services**

Run: `cd /Users/mit/Documents/Projects/Webapp/ntust-stray-main && docker-compose up -d`

Expected output: All services should start:
```
Creating network "ntust-stray-main_stray_network" with driver "bridge"
Creating ntust-stray-main_mosquitto_1 ... done
Creating ntust-stray-main_postgres_1 ... done
Creating ntust-stray-main_influxdb_1 ... done
Creating ntust-stray-main_backend_1 ... done
Creating ntust-stray-main_detector_1 ... done
Creating ntust-stray-main_mobile_1 ... done
Creating ntust-stray-main_landing_1 ... done
Creating ntust-stray-main_admin_1 ... done
```

- [ ] **Step 2: Wait 15 seconds for services to stabilize**

Run: `sleep 15`

Rationale: Services need time for health checks to pass

- [ ] **Step 3: Verify health status**

Run: `docker-compose ps`

Expected output: All services should show `Up` and health checks should show `healthy`:
```
NAME                           STATUS
ntust-stray-main_mosquitto_1   Up
ntust-stray-main_postgres_1    Up (healthy)
ntust-stray-main_influxdb_1    Up (healthy)
ntust-stray-main_backend_1     Up (healthy)
ntust-stray-main_detector_1    Up (healthy)
ntust-stray-main_mobile_1      Up
ntust-stray-main_landing_1     Up
ntust-stray-main_admin_1       Up
```

If any service shows `Exited` or `unhealthy`:
- Run: `docker-compose logs <service-name>` to debug
- Check health check configuration in docker-compose.yml
- Verify Dockerfile EXPOSE and CMD are correct

- [ ] **Step 4: Check service logs for errors**

Run: `docker-compose logs backend | tail -20`

Expected: Should see successful startup messages, no errors

Run: `docker-compose logs detector | tail -20`

Expected: Should see successful startup messages, no errors

---

## Task 9: Test Backend Accessibility from Host

**Files:**
- Test: Backend API endpoint on port 3004

- [ ] **Step 1: Test backend API health endpoint**

Run: `curl -v http://localhost:3004/health 2>&1 | head -20`

Expected: HTTP 200 status code or successful response

If fails:
- Run: `docker-compose logs backend` to see errors
- Verify health check endpoint from Task 1 findings

- [ ] **Step 2: Test backend root endpoint**

Run: `curl -v http://localhost:3004/ 2>&1 | head -20`

Expected: HTTP response (200, 404, or redirect - any non-connection-error is OK)

This confirms the backend is listening on port 3004

---

## Task 10: Test Frontend Apps Accessibility from Host

**Files:**
- Test: Frontend apps on ports 3005, 3006, 3007

- [ ] **Step 1: Test mobile app on port 3005**

Run: `curl -v http://localhost:3005/ 2>&1 | head -30`

Expected: HTTP 200 with HTML content (Next.js app)

- [ ] **Step 2: Test landing app on port 3006**

Run: `curl -v http://localhost:3006/ 2>&1 | head -30`

Expected: HTTP 200 with HTML content

- [ ] **Step 3: Test admin app on port 3007**

Run: `curl -v http://localhost:3007/ 2>&1 | head -30`

Expected: HTTP 200 with HTML content

- [ ] **Step 4: Test detector service on port 3008**

Run: `curl -v http://localhost:3008/ 2>&1 | head -30`

Expected: HTTP response (200, 404, or similar - confirms service is listening)

---

## Task 11: Test Service-to-Service Communication in Network

**Files:**
- Test: Container network communication

- [ ] **Step 1: Verify backend is accessible from apps container**

Run: `docker-compose exec mobile curl -v http://backend:3004/ 2>&1 | head -20`

Expected: HTTP response from backend on internal port 3004

This confirms internal DNS resolution and port mapping work correctly.

- [ ] **Step 2: Verify detector is accessible from admin container**

Run: `docker-compose exec admin curl -v http://detector:3008/ 2>&1 | head -20`

Expected: HTTP response from detector on internal port 3008

- [ ] **Step 3: Verify database connections work**

Run: `docker-compose exec backend curl -v http://localhost:8000/health 2>&1 | head -20`

Expected: Health check should pass, indicating database connection is working

---

## Task 12: Final Verification and Cleanup

**Files:**
- Verify: docker-compose.yml structure
- Verify: No breaking changes

- [ ] **Step 1: Validate docker-compose.yml syntax**

Run: `docker-compose config > /dev/null && echo "Valid" || echo "Invalid"`

Expected: `Valid`

If invalid, check syntax errors in docker-compose.yml

- [ ] **Step 2: Review docker-compose.yml changes**

Run: `git diff HEAD~7 docker-compose.yml`

Expected: Should show all port mappings updated (8000→3004, 3000→3005, 3001→3006, 3002→3007, 8001→3008) and health checks added

- [ ] **Step 3: Verify no old port references remain**

Run: `grep -n "8000:\|3000:\|3001:\|3002:\|8001:" /Users/mit/Documents/Projects/Webapp/ntust-stray-main/docker-compose.yml | grep -v "3004:\|3005:\|3006:\|3007:\|3008:"`

Expected: No output (all old ports should be replaced)

- [ ] **Step 4: Stop services and clean up**

Run: `docker-compose down`

Expected: All containers stopped and removed:
```
Removing ntust-stray-main_admin_1 ... done
Removing ntust-stray-main_landing_1 ... done
Removing ntust-stray-main_mobile_1 ... done
Removing ntust-stray-main_detector_1 ... done
Removing ntust-stray-main_backend_1 ... done
Removing ntust-stray-main_influxdb_1 ... done
Removing ntust-stray-main_postgres_1 ... done
Removing ntust-stray-main_mosquitto_1 ... done
Removing network ntust-stray-main_stray_network
```

- [ ] **Step 5: Verify git status**

Run: `git status`

Expected: Only `docker-compose.yml` should be modified

- [ ] **Step 6: Create final verification commit summary**

Run:
```bash
git log --oneline -8
```

Expected: Should see all 7 commits from Tasks 3-7 (one per service update)

- [ ] **Step 7: Document completion**

Summary of changes:
- Backend: port 8000 → 3004 ✓
- Mobile: port 3000 → 3005 ✓
- Landing: port 3001 → 3006 ✓
- Admin: port 3002 → 3007 ✓
- Detector: port 8001 → 3008 ✓
- All apps updated to reference backend:3004 and detector:3008 ✓
- Health checks added to backend and detector ✓
- All depends_on conditions updated to use health checks ✓

---

## Self-Review Against Spec

**Spec Coverage:**
- ✓ Port mapping from spec (3004, 3005, 3006, 3007, 3008)
- ✓ Health checks for backend and detector (Tasks 1-2 investigate, Tasks 3, 7 implement)
- ✓ Environment configuration for container communication (Tasks 4-6 update env vars)
- ✓ Service dependencies with health conditions (Tasks 4-6 update depends_on)
- ✓ Testing and verification (Tasks 8-11 comprehensive testing)

**Placeholder Scan:**
- No "TBD" or "TODO" items
- All code blocks complete with actual commands and expected output
- All file paths exact
- All git commands include commit messages

**Type Consistency:**
- Port numbers consistent throughout: 3004, 3005, 3006, 3007, 3008
- Environment variable names consistent: API_URL, NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL, NEXT_PUBLIC_DETECTOR_URL
- Internal references consistent: backend:3004, detector:3008

**Completeness:**
- All services covered (backend, mobile, landing, admin, detector)
- All port changes documented
- All environment updates specified
- All testing covered

---

## Execution Summary

This plan has **12 tasks** organized in phases:

1. **Investigation (Tasks 1-2):** Identify health check endpoints for backend and detector
2. **Configuration (Tasks 3-7):** Update docker-compose.yml for each service (5 commits)
3. **Testing (Tasks 8-11):** Comprehensive verification of all services and ports

**Estimated time:** 30-45 minutes for careful execution with verification at each step

**Git commits:** 7 total (one per service update from Tasks 3-7)
