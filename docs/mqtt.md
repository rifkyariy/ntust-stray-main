# MQTT Service

MQTT is the real-time messaging backbone between the ESP32 feeders and the backend. The broker is **Eclipse Mosquitto 2**, running in Docker.

## Architecture overview

```
ESP32 (remote)
  └─ wss://mqtt-stray.heretichydra.xyz:443
        (Cloudflare Tunnel → Mosquitto :9001 WebSocket)

ESP32 (LAN)
  └─ tcp://mosquitto:1883  (direct Docker network TCP)

Backend (Python aiomqtt)
  └─ tcp://mosquitto:1883  (Docker internal network)
```

Remote ESP32 devices connect over WebSocket-TLS through the Cloudflare Tunnel. LAN devices and the backend connect directly to the raw TCP listener.

## Mosquitto configuration (`mosquitto/mosquitto.conf`)

```
listener 1883            # Raw TCP — for backend and LAN devices
listener 9001            # WebSocket — for remote ESP32 via Cloudflare
protocol websockets      # applies to port 9001 listener

persistence true
persistence_location /mosquitto/data/

log_dest file /mosquitto/log/mosquitto.log
log_type error
log_type warning
log_type notice

allow_anonymous true     # lock down per-deployment in production
```

### Ports

| Port | Protocol | Used by |
|------|----------|---------|
| 1883 | TCP MQTT | Backend (aiomqtt), LAN ESP32 |
| 9001 | WebSocket MQTT | Remote ESP32 via Cloudflare Tunnel |

## Topic schema

All topics follow the pattern `stray/{station_code}/{subtopic}`.

| Topic | Publisher | Subscriber | Payload |
|-------|-----------|-----------|---------|
| `stray/{code}/telemetry` | ESP32 | Backend | `{"station_code","servo_angle","temp_c","humidity_pct","food_pct","uptime_ms"}` |
| `stray/{code}/detection` | ESP32 | Backend | `{"cat_code","confidence"}` |
| `stray/{code}/dispense/ack` | ESP32 | Backend | `{"grams","trigger","cat_code","confidence"}` |
| `stray/{code}/request_qr` | ESP32 | Backend | _(empty — button press event)_ |
| `stray/{code}/dispense` | Backend | ESP32 | `{"grams": 100}` |
| `stray/{code}/show_qr` | Backend | ESP32 | `{"url","amount_ntd","grams"}` |

### Telemetry

Published by the ESP32 every 10 seconds. Carries live sensor data. The backend handler updates the PostgreSQL `stations` row and writes a point to InfluxDB `station_metrics`, then broadcasts a `telemetry` WebSocket event to all connected browsers.

### Detection

Published by the ESP32 when the camera-based detection pipeline identifies an animal (planned integration; currently simulated via the detector service in the admin dashboard). The backend upserts the `cats` table and broadcasts a `detection` WebSocket event.

### Dispense

Published by the **backend** to command the ESP32 to dispense food. Triggered by:
- A completed payment session (`/pay` endpoint)
- A scheduled feed (cron runner in `scheduler.py`)
- A manual dispense from the admin dashboard

### Show QR

Published by the **backend** to display a payment QR code on the ESP32's OLED. Triggered when:
- A payment session is created via `POST /payments/sessions` (admin/mobile app)
- The ESP32 button is pressed → `request_qr` → backend creates a session and publishes `show_qr`

### Request QR

Published by the **ESP32** when its physical button is pressed. The backend creates a `PaymentSession` with a default amount (NT$40 / 50g) and replies with `show_qr`.

### Dispense ACK

Published by the **ESP32** after food has been dispensed. The backend writes a `feed_event` to InfluxDB and broadcasts a `feed_event` WebSocket event.

## Backend MQTT client (`backend/app/mqtt/client.py`)

Uses `aiomqtt` (async) running as a background task started by FastAPI lifespan. Subscribes to `stray/+/telemetry`, `stray/+/detection`, `stray/+/dispense/ack`, `stray/+/request_qr`. Reconnects automatically on error with a 5 s back-off.

```python
async def mqtt_listener() -> None:
    while True:
        try:
            async with aiomqtt.Client(hostname=settings.mqtt_broker, port=settings.mqtt_port) as client:
                await client.subscribe("stray/+/telemetry")
                ...
                async for message in messages:
                    # dispatch to handlers
        except aiomqtt.MqttError:
            await asyncio.sleep(5)
```

## Backend MQTT publisher (`backend/app/mqtt/publisher.py`)

Provides `publish_dispense_command(station_code, grams, trigger)` and `publish_show_qr(station_code, url, amount_ntd, grams)`. Each function opens a short-lived `aiomqtt.Client`, publishes, and closes. Called as FastAPI `BackgroundTasks`.

## Development tips

- Use **MQTT Explorer** (GUI) or `mosquitto_sub -h localhost -p 1883 -t 'stray/#'` to watch all messages in real time.
- The Mosquitto dev config (`mosquitto/mosquitto.dev.conf`) disables persistence for faster container resets.
- `allow_anonymous true` is fine for local dev; add username/password auth before exposing port 9001 publicly without Cloudflare.

## Docker

```yaml
# docker-compose.yml excerpt
mosquitto:
  image: eclipse-mosquitto:2
  ports:
    - "1883:1883"
    - "9001:9001"
  volumes:
    - ./mosquitto/mosquitto.conf:/mosquitto/config/mosquitto.conf:ro
    - ./mosquitto/data:/mosquitto/data
    - ./mosquitto/log:/mosquitto/log
```

Mosquitto starts before the backend (`depends_on: mosquitto: condition: service_started`).
