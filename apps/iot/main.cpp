#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <DHT.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ESP32Servo.h>
#include <PubSubClient.h>
#include <WebSocketsClient.h>
#include <qrcode.h>

// ── WebSocket-over-TLS transport for PubSubClient ─────────────────────────────
// Wraps links2004/WebSocketsClient so PubSubClient sends MQTT binary frames
// through a TLS WebSocket connection (wss://).  Cloudflare Tunnel forwards those
// frames to Mosquitto's port-9001 WebSocket listener.
//
// Ring buffer absorbs bursts; static singleton avoids lambda-capture issues.

static constexpr size_t kWsBufSz = 512;

class WsMqttClient : public Client {
  WebSocketsClient _ws;
  uint8_t  _buf[kWsBufSz];
  size_t   _head = 0, _tail = 0;
  bool     _up   = false;

  size_t _avail() const { return (_tail - _head + kWsBufSz) % kWsBufSz; }
  void   _push(const uint8_t* p, size_t n) {
    for (size_t i = 0; i < n; i++) {
      size_t nx = (_tail + 1) % kWsBufSz;
      if (nx != _head) { _buf[_tail] = p[i]; _tail = nx; }
    }
  }

  static WsMqttClient* _inst;
  static void _cb(WStype_t t, uint8_t* p, size_t l) {
    if (!_inst) return;
    if (t == WStype_CONNECTED)    _inst->_up = true;
    if (t == WStype_DISCONNECTED) _inst->_up = false;
    if (t == WStype_BIN)          _inst->_push(p, l);
  }

public:
  WsMqttClient() { _inst = this; _ws.onEvent(_cb); }

  // Called by PubSubClient to open the connection
  int connect(IPAddress, uint16_t) override { return 0; }
  int connect(const char* host, uint16_t port) override {
    _up = false; _head = _tail = 0;
    // path="/", protocol="mqtt" → Mosquitto accepts this handshake
    _ws.beginSSL(host, (uint16_t)port, "/", "", "mqtt");
    unsigned long t = millis();
    while (!_up && millis() - t < 8000) { _ws.loop(); delay(10); }
    return _up ? 1 : 0;
  }

  size_t write(uint8_t b)                     override { return write(&b, 1); }
  size_t write(const uint8_t* buf, size_t sz) override { _ws.sendBIN(buf, sz); return sz; }
  int    available()                          override { _ws.loop(); return (int)_avail(); }
  int    peek()                               override { return _avail() ? _buf[_head] : -1; }
  int    read()                               override {
    if (!_avail()) return -1;
    uint8_t b = _buf[_head]; _head = (_head + 1) % kWsBufSz; return b;
  }
  int read(uint8_t* buf, size_t sz) override {
    _ws.loop();
    size_t n = min(sz, _avail());
    for (size_t i = 0; i < n; i++) { buf[i] = _buf[_head]; _head = (_head + 1) % kWsBufSz; }
    return (int)n;
  }
  void    flush()     override {}
  void    stop()      override { _ws.disconnect(); _up = false; }
  uint8_t connected() override { return _up ? 1 : 0; }
  operator bool()     override { return _up; }
  void    tick()               { _ws.loop(); }   // call every loop() iteration
};

WsMqttClient* WsMqttClient::_inst = nullptr;

// ── Pin map ───────────────────────────────────────────────────────────────────
static const int kServoPin       = 16;
static const int kDhtPin         = 4;
static const int kUltraTrig      = 5;
static const int kUltraEcho      = 18;
static const int kOledSda        = 21;
static const int kOledScl        = 22;
static const int kBtnPin         = 25;  // pull-up, active LOW

// ── Ultrasonic tank calibration ───────────────────────────────────────────────
// kTankEmptyCm = distance when tank is empty (sensor sees bottom)
// kTankFullCm  = distance when tank is full (food near sensor)
static const float kTankEmptyCm = 20.0f;
static const float kTankFullCm  =  2.0f;

// ── OLED ──────────────────────────────────────────────────────────────────────
Adafruit_SSD1306 oled(128, 64, &Wire, -1);
static bool oledOk = false;

// ── DHT22 ─────────────────────────────────────────────────────────────────────
DHT dht(kDhtPin, DHT22);

// ── WiFi ──────────────────────────────────────────────────────────────────────
// static const char *kWifiSsid = "Mitlab703";
// static const char *kWifiPass = "Mitlab703-2";
static const char *kWifiSsid = "Kryif";
static const char *kWifiPass = "rrrrrrrr";

// ── MQTT & Station ────────────────────────────────────────────────────────────
// Connects via WebSocket-over-TLS through the Cloudflare Tunnel.
// Cloudflare forwards wss://mqtt-stray.heretichydra.xyz:443  →  localhost:9001
// (Mosquitto WebSocket listener).  Works from any network — no public IP needed.
static const bool  kMqttEnabled  = true;
static const char *kMqttBroker   = "mqtt-stray.heretichydra.xyz";
static const int   kMqttPort     = 443;
static const char *kStationCode  = "NTUST-STR-01";
static const char *kMqttClientId = "stray-feeder-ntust-str-01";

static char kTopicTelemetry[64];
static char kTopicDispense[64];
static char kTopicShowQr[64];
static char kTopicRequestQr[64];  // kept for backend-triggered payment QR flow

// Device QR — shown when button is pressed; links to the station's public page
static const char *kStationPageUrl = "https://stray.heretichydra.xyz/station/49ad9790-9325-4002-a364-973acf5d725e";

WsMqttClient wsMqttClient;
PubSubClient mqttClient(wsMqttClient);
WebServer    webServer(80);

static const unsigned long kMqttPublishMs   = 10000;
static const unsigned long kMqttReconnectMs =  5000;
static const unsigned long kWifiReconnectMs = 10000;
static const unsigned long kSensorReadMs    =  5000;  // DHT + ultrasonic every 5 s
static const unsigned long kQrTimeoutMs     = 300000; // return to monitoring after 5 min

unsigned long lastMqttPublish   = 0;
unsigned long lastMqttReconnect = 0;
unsigned long lastWifiReconnect = 0;
unsigned long lastSensorRead    = 0;
unsigned long qrShownAt         = 0;
unsigned long servoReturnAt     = 0;

static int           btnLastState    = HIGH;
static unsigned long btnLastChangeMs = 0;
static bool          btnArmed        = true;
static const unsigned long kBtnDebounceMs = 50;

// ── Servo ─────────────────────────────────────────────────────────────────────
// Each 90° sweep dispenses kGramsPerStep grams.  The auger bounces at 0° and
// 180° so direction alternates after every 2 consecutive spins in one direction.
//   50g  → 1 spin right  (0→90)
//  100g  → 2 spins right (0→90→180)
//  150g  → 2 right + 1 left (0→90→180→90)
//  200g  → 2 right + 2 left (0→90→180→90→0)
static const int kGramsPerStep = 50;   // grams per 90° spin
static const int kSpinStep     = 90;   // degrees per spin
static const int kSpinHoldMs   = 600;  // ms to dwell at each stop (servo settle + food fall)
static const int kMinAngle     = 0;
static const int kMaxAngle     = 180;

Servo servo;
int currentAngle = 0;
int spinDir      = 1;   // +1 = right (increasing angle), -1 = left; persists between calls

// ── Sensor values (updated every kSensorReadMs) ────────────────────────────────
float g_tempC    = 28.0f;
float g_humidity = 70.0f;
int   g_foodPct  = 0;

// ── OLED screen state ─────────────────────────────────────────────────────────
enum OledState { SCREEN_MONITORING, SCREEN_QR, SCREEN_DEVICE_QR };
OledState oledState = SCREEN_MONITORING;

// QR screen data
char qrUrl[128]       = "";
float qrAmountNtd     = 0.0f;
int   qrGrams         = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────
static int ClampAngle(int a) { return constrain(a, kMinAngle, kMaxAngle); }

static float ReadUltrasonicCm() {
  digitalWrite(kUltraTrig, LOW);  delayMicroseconds(2);
  digitalWrite(kUltraTrig, HIGH); delayMicroseconds(10);
  digitalWrite(kUltraTrig, LOW);
  long dur = pulseIn(kUltraEcho, HIGH, 30000);
  if (dur == 0) return -1.0f;
  return dur * 0.0343f / 2.0f;
}

static int DistanceToFoodPct(float cm) {
  if (cm < 0) return g_foodPct;
  float pct = (kTankEmptyCm - cm) / (kTankEmptyCm - kTankFullCm) * 100.0f;
  return (int)constrain(pct, 0.0f, 100.0f);
}

static void ReadSensors() {
  // Dummy DHT: drift ±0.3°C and ±1.5% RH each read, clamped to realistic outdoor range
  g_tempC    = constrain(g_tempC    + random(-3, 4) * 0.1f, 22.0f, 36.0f);
  g_humidity = constrain(g_humidity + random(-3, 4) * 0.5f, 55.0f, 88.0f);

  float dist = ReadUltrasonicCm();
  g_foodPct  = DistanceToFoodPct(dist);

  Serial.printf("[DATA] Temp=%.1fC  Hum=%.0f%%  Food=%d%%  Dist=%.1fcm  Uptime=%lus\n",
                g_tempC, g_humidity, g_foodPct, dist, millis() / 1000);
}

// ── OLED drawing ──────────────────────────────────────────────────────────────
static void DrawProgressBar(int x, int y, int w, int h, int pct) {
  oled.drawRect(x, y, w, h, SSD1306_WHITE);
  int filled = (pct * (w - 2)) / 100;
  if (filled > 0) oled.fillRect(x + 1, y + 1, filled, h - 2, SSD1306_WHITE);
}

static void OledDrawMonitoring() {
  if (!oledOk) return;
  oled.clearDisplay();
  oled.setTextSize(1);

  // ── Inverted header bar ───────────────────────────────────────────────────
  oled.fillRect(0, 0, 128, 11, SSD1306_WHITE);
  oled.setTextColor(SSD1306_BLACK);
  oled.setCursor(2, 2);
  oled.print("STRAY FEEDER");
  oled.setCursor(92, 2);
  oled.print(kStationCode + 6);  // "STR-01"
  oled.setTextColor(SSD1306_WHITE);

  // ── Food level ───────────────────────────────────────────────────────────
  oled.setCursor(0, 14);
  oled.print("FOOD");
  DrawProgressBar(28, 14, 76, 9, g_foodPct);
  char pctBuf[6]; snprintf(pctBuf, sizeof(pctBuf), "%d%%", g_foodPct);
  oled.setCursor(108, 14);
  oled.print(pctBuf);

  // ── Temp + humidity ───────────────────────────────────────────────────────
  oled.setCursor(0, 27);
  oled.printf("%.1fC", g_tempC);
  oled.setCursor(68, 27);
  oled.printf("%.0f%% RH", g_humidity);

  // ── Divider ───────────────────────────────────────────────────────────────
  oled.drawLine(0, 37, 127, 37, SSD1306_WHITE);

  // ── WiFi IP + MQTT status indicator ──────────────────────────────────────
  oled.setCursor(0, 40);
  if (WiFi.isConnected()) {
    oled.print(WiFi.localIP().toString());
  } else {
    oled.print("WiFi: offline");
  }
  // Small 5×5 square: filled = MQTT connected, outline = disconnected
  if (kMqttEnabled && mqttClient.connected()) {
    oled.fillRect(120, 40, 6, 6, SSD1306_WHITE);
  } else {
    oled.drawRect(120, 40, 6, 6, SSD1306_WHITE);
  }

  // ── Station code ──────────────────────────────────────────────────────────
  oled.setCursor(0, 52);
  oled.print(kStationCode);

  oled.display();
}

static void OledDrawQR() {
  if (!oledOk) return;

  QRCode qrcode;
  uint8_t buf[250];
  qrcode_initText(&qrcode, buf, 3, ECC_LOW, qrUrl);

  oled.clearDisplay();

  // Left zone: white background + QR centred (same layout as device QR)
  oled.fillRect(0, 0, 62, 64, SSD1306_WHITE);
  const int scale = 2;
  const int qr_x0 = (62 - qrcode.size * scale) / 2;
  const int qr_y0 = (64 - qrcode.size * scale) / 2;
  for (int r = 0; r < qrcode.size; r++)
    for (int c = 0; c < qrcode.size; c++)
      if (qrcode_getModule(&qrcode, c, r))
        oled.fillRect(qr_x0 + c * scale, qr_y0 + r * scale, scale, scale, SSD1306_BLACK);

  oled.drawLine(63, 0, 63, 63, SSD1306_WHITE);

  // Right zone: payment info (white text on black)
  char amountStr[12];
  char gramsStr[10];
  snprintf(amountStr, sizeof(amountStr), "NT$%.0f", qrAmountNtd);
  snprintf(gramsStr,  sizeof(gramsStr),  "%dg",     qrGrams);

  oled.setTextColor(SSD1306_WHITE);
  oled.setTextSize(1);
  oled.setCursor(66, 2);
  oled.print("Stray");
  oled.setCursor(66, 12);
  oled.print("Feeder");
  oled.drawLine(64, 22, 127, 22, SSD1306_WHITE);
  oled.setCursor(66, 26);
  oled.print("Scan to");
  oled.setCursor(66, 36);
  oled.print("pay!");
  oled.setCursor(66, 46);
  oled.print(amountStr);
  oled.setCursor(66, 57);
  oled.print(gramsStr);

  oled.display();
}

static void OledStatus(const char *line1, const char *line2 = nullptr) {
  if (!oledOk) return;
  oled.clearDisplay();
  oled.setTextSize(1);
  oled.setTextColor(SSD1306_WHITE);
  oled.setCursor(0, 20);
  oled.println(line1);
  if (line2) { oled.setCursor(0, 34); oled.println(line2); }
  oled.display();
}

static void ShowQR(const char *url, float amount, int grams) {
  strncpy(qrUrl, url, sizeof(qrUrl) - 1);
  qrAmountNtd = amount;
  qrGrams     = grams;
  qrShownAt   = millis();
  oledState   = SCREEN_QR;
  Serial.printf("[QR ] Showing: NT$%.0f  %dg  url=%s\n", amount, grams, url);
  OledDrawQR();
}

static void OledDrawDeviceQR() {
  if (!oledOk) return;

  QRCode qrcode;
  uint8_t buf[250];
  qrcode_initText(&qrcode, buf, 3, ECC_LOW, qrUrl);

  oled.clearDisplay();

  // Left zone: white background + QR
  oled.fillRect(0, 0, 62, 64, SSD1306_WHITE);
  const int scale = 2;
  const int qr_x0 = (62 - qrcode.size * scale) / 2;
  const int qr_y0 = (64 - qrcode.size * scale) / 2;
  for (int r = 0; r < qrcode.size; r++)
    for (int c = 0; c < qrcode.size; c++)
      if (qrcode_getModule(&qrcode, c, r))
        oled.fillRect(qr_x0 + c * scale, qr_y0 + r * scale, scale, scale, SSD1306_BLACK);

  oled.drawLine(63, 0, 63, 63, SSD1306_WHITE);

  // Right zone: station info
  oled.setTextColor(SSD1306_WHITE);
  oled.setTextSize(1);
  oled.setCursor(66, 2);
  oled.print("Stray");
  oled.setCursor(66, 12);
  oled.print("Feeder");
  oled.drawLine(64, 22, 127, 22, SSD1306_WHITE);
  oled.setCursor(66, 26);
  oled.print("Scan to");
  oled.setCursor(66, 36);
  oled.print("view &");
  oled.setCursor(66, 46);
  oled.print("donate!");
  oled.setCursor(66, 57);
  oled.setTextSize(1);
  oled.print(kStationCode + 6);  // "STR-01"

  oled.display();
}

static void ShowDeviceQR() {
  strncpy(qrUrl, kStationPageUrl, sizeof(qrUrl) - 1);
  qrShownAt = millis();
  oledState = SCREEN_DEVICE_QR;
  Serial.printf("[QR ] Device QR: %s\n", kStationPageUrl);
  OledDrawDeviceQR();
}

// ── Servo ─────────────────────────────────────────────────────────────────────
static void DispenseFeed(int grams) {
  // Don't interrupt a QR mid-display at the start (avoids flicker when show_qr
  // and dispense arrive in the same MQTT burst).  After dispensing completes,
  // the payment QR is always dismissed; the device-info QR is left alone.
  bool paymentQr = (oledState == SCREEN_QR);
  bool deviceQr  = (oledState == SCREEN_DEVICE_QR);

  if (!paymentQr && !deviceQr) {
    oledState = SCREEN_MONITORING;
    OledStatus("Dispensing!", (String(grams) + "g on the way").c_str());
  }

  int spins = max(1, grams / kGramsPerStep);
  Serial.printf("[DISP] %dg → %d spin(s)  start=%d°  dir=%+d  paymentQr=%d\n",
                grams, spins, currentAngle, spinDir, (int)paymentQr);

  for (int i = 0; i < spins; i++) {
    int next = currentAngle + spinDir * kSpinStep;
    if (next >= kMaxAngle) { next = kMaxAngle; spinDir = -1; }
    else if (next <= kMinAngle) { next = kMinAngle; spinDir =  1; }
    servo.write(next);
    currentAngle = next;
    delay(kSpinHoldMs);
  }

  Serial.printf("[DISP] Done → final=%d°  dir=%+d\n", currentAngle, spinDir);

  // Dismiss payment QR after food is dispensed; device QR stays up
  if (!deviceQr) {
    oledState = SCREEN_MONITORING;
    OledDrawMonitoring();
  }
}

// ── MQTT ──────────────────────────────────────────────────────────────────────
// Finds key regardless of whether JSON has spaces around ':' (compact or pretty)
static int _jsonKeyIdx(const String &json, const char *key, int &keyEndOffset) {
  String k1 = String("\"") + key + "\":";   // compact
  String k2 = String("\"") + key + "\": ";  // one space
  int idx = json.indexOf(k1);
  if (idx >= 0) { keyEndOffset = k1.length(); return idx; }
  idx = json.indexOf(k2);
  if (idx >= 0) { keyEndOffset = k2.length(); return idx; }
  return -1;
}

static void ParseJsonStr(const String &json, const char *key, char *out, int outLen) {
  int klen = 0;
  int idx  = _jsonKeyIdx(json, key, klen);
  if (idx < 0) return;
  int start = idx + klen;
  if (json[start] != '"') return;
  start++;
  int end = json.indexOf('"', start);
  if (end < 0) return;
  json.substring(start, end).toCharArray(out, outLen);
}

static float ParseJsonFloat(const String &json, const char *key) {
  int klen = 0;
  int idx  = _jsonKeyIdx(json, key, klen);
  if (idx < 0) return 0.0f;
  return json.substring(idx + klen).toFloat();
}

static int ParseJsonInt(const String &json, const char *key) {
  int klen = 0;
  int idx  = _jsonKeyIdx(json, key, klen);
  if (idx < 0) return 0;
  return json.substring(idx + klen).toInt();
}

static void MqttCallback(char *topic, byte *payload, unsigned int length) {
  String msg;
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  Serial.printf("MQTT [%s]: %s\n", topic, msg.c_str());

  if (strcmp(topic, kTopicDispense) == 0) {
    int grams = ParseJsonInt(msg, "grams");
    if (grams <= 0) grams = 100;
    DispenseFeed(grams);
  } else if (strcmp(topic, kTopicShowQr) == 0) {
    char url[128] = "";
    ParseJsonStr(msg, "url", url, sizeof(url));
    float amount = ParseJsonFloat(msg, "amount_ntd");
    int   grams  = ParseJsonInt(msg, "grams");
    if (url[0] != '\0') ShowQR(url, amount, grams);
  }
}

static bool EnsureMqttConnected() {
  if (mqttClient.connected()) return true;
  if (!WiFi.isConnected()) return false;
  Serial.printf("Connecting MQTT to %s:%d...\n", kMqttBroker, kMqttPort);
  if (mqttClient.connect(kMqttClientId)) {
    Serial.println("MQTT connected");
    mqttClient.setCallback(MqttCallback);
    mqttClient.subscribe(kTopicDispense);
    mqttClient.subscribe(kTopicShowQr);
    Serial.printf("Subscribed to %s + %s\n", kTopicDispense, kTopicShowQr);
    return true;
  }
  Serial.printf("MQTT failed rc=%d\n", mqttClient.state());
  return false;
}

static void PublishTelemetry() {
  if (!EnsureMqttConnected()) return;
  char payload[256];
  snprintf(payload, sizeof(payload),
    "{\"station_code\":\"%s\",\"servo_angle\":%d,\"temp_c\":%.1f,"
    "\"humidity_pct\":%.1f,\"food_pct\":%d,\"uptime_ms\":%lu}",
    kStationCode, currentAngle, g_tempC, g_humidity, g_foodPct, millis());
  if (mqttClient.publish(kTopicTelemetry, payload))
    Serial.printf("Telemetry: %s\n", payload);
  else
    Serial.println("Telemetry publish failed");
}

// ── Web UI ────────────────────────────────────────────────────────────────────
static const char kHtmlPage[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Stray Feeder</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0f0f14;
      color: #e8e8f0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2rem;
    }
    h1 { font-size: 1.5rem; font-weight: 600; letter-spacing: 0.04em; }
    #btn {
      background: #d95f2b;
      color: #fff;
      border: none;
      padding: 1rem 3rem;
      font-size: 1.15rem;
      font-weight: 600;
      border-radius: 12px;
      cursor: pointer;
      transition: background 0.15s, opacity 0.15s;
    }
    #btn:hover:not(:disabled) { background: #c0501f; }
    #btn:disabled { opacity: 0.45; cursor: default; }
    #status { font-size: 0.9rem; color: #888; min-height: 1.2em; }
  </style>
</head>
<body>
  <h1>Stray Feeder</h1>
  <button id="btn" onclick="dispense()">Dispense</button>
  <p id="status">Ready</p>
  <script>
    function dispense() {
      const btn = document.getElementById('btn');
      const st  = document.getElementById('status');
      btn.disabled = true;
      st.textContent = 'Dispensing...';
      fetch('/dispense')
        .then(r => r.ok ? r.text() : Promise.reject(r.status))
        .then(() => {
          st.textContent = 'Done!';
          setTimeout(() => { st.textContent = 'Ready'; btn.disabled = false; }, 2000);
        })
        .catch(e => {
          st.textContent = 'Error ' + e;
          btn.disabled = false;
        });
    }
  </script>
</body>
</html>
)rawliteral";

static void WebHandleRoot() {
  webServer.send_P(200, "text/html", kHtmlPage);
}

static void WebHandleDispense() {
  servo.write(90);
  currentAngle  = 90;
  servoReturnAt = millis() + 1000;  // return to 0° after 1 s
  Serial.println("[WEB] Dispense → 90° (returning in 1s)");
  OledStatus("Web dispense", "Rotating 90deg");
  webServer.send(200, "text/plain", "ok");
}

static void WebSetupRoutes() {
  webServer.on("/",         HTTP_GET, WebHandleRoot);
  webServer.on("/dispense", HTTP_GET, WebHandleDispense);
  webServer.onNotFound([]() { webServer.send(404, "text/plain", "Not found"); });
  webServer.begin();
}

// ── Button ────────────────────────────────────────────────────────────────────
static void CheckButton() {
  int state        = digitalRead(kBtnPin);
  unsigned long now = millis();

  if (state != btnLastState) {
    btnLastChangeMs = now;
    btnLastState    = state;
  }

  if (btnArmed && state == LOW && (now - btnLastChangeMs) >= kBtnDebounceMs) {
    btnArmed = false;
    if (oledState == SCREEN_QR || oledState == SCREEN_DEVICE_QR) {
      // Dismiss QR → go back to monitoring
      Serial.println("[BTN] Pressed — dismissing QR");
      oledState = SCREEN_MONITORING;
      OledDrawMonitoring();
    } else {
      // Show station page QR code
      Serial.println("[BTN] Pressed — showing device QR");
      ShowDeviceQR();
    }
  }
  if (!btnArmed && state == HIGH && (now - btnLastChangeMs) >= kBtnDebounceMs) {
    btnArmed = true;
  }
}

// ── setup ─────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Serial.println("\n=== Stray Feeder v2 ===");

  // OLED
  Wire.begin(kOledSda, kOledScl);
  oledOk = oled.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  if (!oledOk) Serial.println("OLED init failed");
  else OledStatus("Stray Feeder", "Starting...");

  // MQTT topic strings
  snprintf(kTopicTelemetry, sizeof(kTopicTelemetry), "stray/%s/telemetry",   kStationCode);
  snprintf(kTopicDispense,  sizeof(kTopicDispense),  "stray/%s/dispense",    kStationCode);
  snprintf(kTopicShowQr,    sizeof(kTopicShowQr),    "stray/%s/show_qr",     kStationCode);
  snprintf(kTopicRequestQr, sizeof(kTopicRequestQr), "stray/%s/request_qr",  kStationCode);

  // DHT22
  dht.begin();

  // HC-SR04
  pinMode(kUltraTrig, OUTPUT);
  pinMode(kUltraEcho, INPUT);

  // Button
  pinMode(kBtnPin, INPUT_PULLUP);

  // Initial sensor read
  delay(2000);  // DHT22 warm-up
  ReadSensors();

  // Servo — home to 0° on startup, no test sweep
  servo.setPeriodHertz(50);
  servo.attach(kServoPin, 500, 2400);
  if (servo.attached()) {
    servo.write(0);
    currentAngle = 0;
    Serial.println("Servo ready");
  } else {
    Serial.printf("Servo attach FAILED on GPIO %d\n", kServoPin);
  }

  // WiFi
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  WiFi.begin(kWifiSsid, kWifiPass);
  OledStatus("Connecting WiFi", kWifiSsid);
  Serial.print("Connecting to WiFi");
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(500); Serial.print('.');
  }
  Serial.println();

  if (WiFi.isConnected()) {
    Serial.printf("WiFi: %s\n", WiFi.localIP().toString().c_str());
    WebSetupRoutes();
    Serial.printf("Web UI: http://%s\n", WiFi.localIP().toString().c_str());
    if (kMqttEnabled) {
      mqttClient.setServer(kMqttBroker, kMqttPort);
      EnsureMqttConnected();
    }
  } else {
    Serial.println("WiFi failed — running offline");
  }

  // Show monitoring screen
  OledDrawMonitoring();
  Serial.println("Setup done.");
}

// ── loop ──────────────────────────────────────────────────────────────────────
void loop() {
  webServer.handleClient();
  CheckButton();
  unsigned long now = millis();

  // Return servo to 0° after web dispense
  if (servoReturnAt > 0 && now >= servoReturnAt) {
    servoReturnAt = 0;
    servo.write(0);
    currentAngle = 0;
    spinDir      = 1;
    Serial.println("[WEB] Servo returned to 0°");
    if (oledState == SCREEN_MONITORING) OledDrawMonitoring();
  }

  // WiFi watchdog
  if (!WiFi.isConnected() && now - lastWifiReconnect >= kWifiReconnectMs) {
    lastWifiReconnect = now;
    Serial.println("WiFi lost — reconnecting...");
    WiFi.disconnect();
    WiFi.begin(kWifiSsid, kWifiPass);
  }

  // MQTT keep-alive + publish
  if (kMqttEnabled && WiFi.isConnected()) {
    wsMqttClient.tick();   // pump WebSocket frames every iteration
    if (mqttClient.connected()) {
      mqttClient.loop();
    } else if (now - lastMqttReconnect >= kMqttReconnectMs) {
      lastMqttReconnect = now;
      EnsureMqttConnected();
    }
    if (now - lastMqttPublish >= kMqttPublishMs) {
      lastMqttPublish = now;
      PublishTelemetry();
    }
  }

  // Sensor reads + OLED refresh
  if (now - lastSensorRead >= kSensorReadMs) {
    lastSensorRead = now;
    ReadSensors();
    if (oledState == SCREEN_MONITORING) OledDrawMonitoring();
  }

  // QR timeout → return to monitoring.
  // Use millis() here (not the stale `now` captured at loop top) to avoid
  // unsigned underflow when qrShownAt was set later in this same iteration.
  {
    unsigned long freshNow = millis();
    if (oledState == SCREEN_QR && freshNow - qrShownAt >= kQrTimeoutMs) {
      Serial.println("[QR ] Timeout — returning to monitoring");
      oledState = SCREEN_MONITORING;
      OledDrawMonitoring();
    }
    if (oledState == SCREEN_DEVICE_QR && freshNow - qrShownAt >= 300000UL) {
      oledState = SCREEN_MONITORING;
      OledDrawMonitoring();
    }
  }
}
