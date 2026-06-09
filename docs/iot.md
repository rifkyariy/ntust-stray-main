# IoT Firmware — ESP32 Stray Feeder

The firmware lives in `apps/iot/main.cpp` and is built with PlatformIO targeting `esp32dev`. It controls the physical feeder: food dispensing, sensor readings, OLED display, and MQTT communication.

## Hardware components

| Component | Part | GPIO |
|-----------|------|------|
| Servo motor (auger) | Generic SG90/MG996R | 16 |
| Temperature / humidity | DHT22 | 4 |
| Ultrasonic distance (food level) | HC-SR04 — Trig | 5 |
| Ultrasonic distance (food level) | HC-SR04 — Echo | 18 |
| OLED display | SSD1306 128×64 I²C — SDA | 21 |
| OLED display | SSD1306 128×64 I²C — SCL | 22 |
| Button | Tactile switch (pull-up, active LOW) | 25 |

### Wiring diagram

```
ESP32 Dev Board
│
├─ GPIO 16 ──────────────── Servo signal wire
│                           (5V power from separate supply or VIN)
│
├─ GPIO 4  ──────────────── DHT22 data pin
│                           (3.3V–5V, 10kΩ pull-up to VCC)
│
├─ GPIO 5  ──────────────── HC-SR04 TRIG
├─ GPIO 18 ──────────────── HC-SR04 ECHO
│                           (HC-SR04 runs on 5V; use a voltage divider on ECHO:
│                            ECHO → 1kΩ → GPIO 18 + 2kΩ → GND)
│
├─ GPIO 21 ──────────────── SSD1306 SDA  (I²C address 0x3C)
├─ GPIO 22 ──────────────── SSD1306 SCL
│                           (3.3V, 4.7kΩ pull-ups on SDA & SCL)
│
└─ GPIO 25 ──────────────── Button one leg → GND
                            (INPUT_PULLUP; button press pulls LOW)
```

## PlatformIO configuration (`apps/iot/platformio.ini`)

```ini
[env:esp32dev]
platform  = espressif32
board     = esp32dev
framework = arduino
lib_deps  =
    madhephaestus/ESP32Servo
    adafruit/Adafruit SSD1306
    adafruit/Adafruit GFX Library
    adafruit/DHT sensor library
    adafruit/Adafruit Unified Sensor
    knolleary/PubSubClient
    links2004/WebSockets @ ^2.4.0
    ricmoo/QRCode
monitor_speed = 115200
```

Flash with:
```bash
pio run -t upload
pio device monitor   # 115200 baud
```

## MQTT connectivity

The ESP32 connects to the cloud MQTT broker over **WebSocket-TLS (wss://)** via a Cloudflare Tunnel. This means it works from any WiFi network — no port forwarding or static IP required.

```
ESP32  →  wss://mqtt-stray.heretichydra.xyz:443
         (Cloudflare Tunnel)
              ↓
         Mosquitto :9001 (WebSocket listener inside Docker)
```

The `WsMqttClient` class wraps `links2004/WebSocketsClient` to implement the Arduino `Client` interface. `PubSubClient` uses it transparently and thinks it is talking to a plain TCP socket.

### MQTT topics

| Topic | Direction | Payload |
|-------|-----------|---------|
| `stray/{station_code}/telemetry` | ESP32 → broker | `{"station_code","servo_angle","temp_c","humidity_pct","food_pct","uptime_ms"}` |
| `stray/{station_code}/dispense` | broker → ESP32 | `{"grams": 100}` |
| `stray/{station_code}/show_qr` | broker → ESP32 | `{"url","amount_ntd","grams"}` |
| `stray/{station_code}/request_qr` | ESP32 → broker | _(empty, button press)_ |

Station code for the prototype: `NTUST-STR-01`

## Food dispensing

The auger mechanism is driven by a servo. Each 90° sweep dispenses approximately **50 g** of food. The servo bounces between 0° and 180° so the auger spins in alternating directions.

| Requested grams | Servo motion |
|----------------|-------------|
| 50 g | 0° → 90° |
| 100 g | 0° → 90° → 180° |
| 150 g | 0° → 90° → 180° → 90° |
| 200 g | 0° → 90° → 180° → 90° → 0° |

Dwell time at each stop: 600 ms (allows food to fall through before next spin).

## Food level sensing

The HC-SR04 is mounted above the food tank looking down. Distance is converted to a percentage:

```cpp
// kTankEmptyCm = 20.0  (sensor → empty tank bottom)
// kTankFullCm  =  2.0  (sensor → food surface when full)
float pct = (kTankEmptyCm - distCm) / (kTankEmptyCm - kTankFullCm) * 100.0f;
```

A food level below 25% triggers a `low_food` status broadcast.

## OLED screens

The 128×64 SSD1306 cycles through three screen states:

| State | Trigger | Content |
|-------|---------|---------|
| `SCREEN_MONITORING` | Default | Food bar, temp, humidity, WiFi IP, MQTT indicator |
| `SCREEN_QR` | `show_qr` MQTT message | Payment QR code + amount/grams info |
| `SCREEN_DEVICE_QR` | Button press | Station page QR + "Scan to view & donate!" |

Payment QR auto-dismisses after **5 minutes**. Button press while a QR is shown dismisses it immediately.

## Local web UI

The ESP32 runs a tiny HTTP server on port 80 (LAN-only). Visiting `http://<device-IP>/` shows a one-button page that triggers a quick 90° servo sweep for local testing. Not exposed through the Cloudflare Tunnel.

## Timing constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `kMqttPublishMs` | 10 000 ms | Telemetry publish interval |
| `kMqttReconnectMs` | 5 000 ms | MQTT reconnect back-off |
| `kWifiReconnectMs` | 10 000 ms | WiFi watchdog interval |
| `kSensorReadMs` | 5 000 ms | DHT22 + ultrasonic read interval |
| `kQrTimeoutMs` | 300 000 ms | Payment QR auto-dismiss timeout (5 min) |
| `kBtnDebounceMs` | 50 ms | Button debounce window |

## Building and flashing

1. Install [PlatformIO IDE](https://platformio.org/) or the PlatformIO Core CLI.
2. Open `apps/iot/` as a PlatformIO project.
3. Edit `kWifiSsid` / `kWifiPass` and `kMqttBroker` in `main.cpp`.
4. Run `pio run -t upload` with the ESP32 connected via USB.
5. Monitor with `pio device monitor` at 115200 baud.

## Offline fallback

If WiFi is unavailable at boot the device runs in offline mode: sensors are read, the OLED shows live data, and the local HTTP server is unavailable (no WiFi IP). MQTT features are skipped until WiFi reconnects.
