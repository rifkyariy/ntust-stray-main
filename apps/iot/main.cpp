#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ESP32Servo.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>

// ── WiFi ──────────────────────────────────────────────────────────────────────
// static const char *kWifiSsid = "OJOKEPO";
// static const char *kWifiPass = "mitlab910";
static const char *kWifiSsid = "Kryif";
static const char *kWifiPass = "rrrrrrrr";

// ── Servo ─────────────────────────────────────────────────────────────────────
static const int kServoPin = 18;
static const int kMinAngle = 0;
static const int kMaxAngle = 180;
static const int kFeedStep = 90;  // degrees per 1 feed spin

// ── OLED (128×64 SSD1306, I2C SDA=21 SCL=22) ─────────────────────────────────
static const int kOledWidth  = 128;
static const int kOledHeight = 64;
static const int kOledAddr   = 0x3C;
Adafruit_SSD1306 display(kOledWidth, kOledHeight, &Wire, -1);

// ── DHT11 (data pin = 32) ─────────────────────────────────────────────────────
static const int kDhtPin = 32;
DHT dht(kDhtPin, DHT11);
static const unsigned long kDhtIntervalMs = 2000;  // DHT11 min sample interval
float temperature = NAN;
float humidity    = NAN;
unsigned long lastDhtMs = 0;

// ── Feeding animation timing ───────────────────────────────────────────────────
static const unsigned long kAnimIntervalMs     = 350;
static const unsigned long kFeedAnimDurationMs = 2500;

// ── Runtime state ─────────────────────────────────────────────────────────────
WebServer server(80);
Servo servo;
int currentAngle         = 0;
bool isFeeding           = false;
unsigned long feedingStartMs = 0;
unsigned long lastAnimMs     = 0;
int animFrame                = 0;

// ── OLED drawing ──────────────────────────────────────────────────────────────
static void DrawNormalScreen() {
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);

  // ── Row 0: title ────────────────────────────────────────────────────────────
  display.setCursor(2, 0);
  display.print("* Stray Feeder *");
  display.drawFastHLine(0, 10, 128, SSD1306_WHITE);

  // ── Row 1: feeds + angle on one line ────────────────────────────────────────
  int feeds    = currentAngle / kFeedStep;
  int maxFeeds = kMaxAngle / kFeedStep;
  display.setCursor(2, 13);
  display.print("Feed:");
  display.print(feeds);
  display.print("/");
  display.print(maxFeeds);
  display.setCursor(74, 13);
  display.print("Ang:");
  display.print(currentAngle);
  display.print("d");
  display.drawFastHLine(0, 23, 128, SSD1306_WHITE);

  // ── Row 2: temperature + humidity ───────────────────────────────────────────
  display.setCursor(2, 26);
  display.print("Temp:");
  if (isnan(temperature)) {
    display.print("--");
  } else {
    display.print((int)temperature);
    display.print("C");
  }
  display.setCursor(68, 26);
  display.print("Hum:");
  if (isnan(humidity)) {
    display.print("--");
  } else {
    display.print((int)humidity);
    display.print("%");
  }
  display.drawFastHLine(0, 36, 128, SSD1306_WHITE);

  // ── Row 3: WiFi status ──────────────────────────────────────────────────────
  display.setCursor(2, 39);
  display.print("WiFi:");
  display.setCursor(32, 39);
  if (WiFi.status() == WL_CONNECTED) {
    display.print("Connected");
  } else {
    display.print("No connection");
  }

  // ── Row 4: IP address ───────────────────────────────────────────────────────
  display.setCursor(2, 50);
  if (WiFi.status() == WL_CONNECTED) {
    display.print(WiFi.localIP().toString());
  } else {
    display.print("Connecting...");
  }
}

// Draw an animated cat face (white filled head, black features).
// frame even = eyes open; frame odd = happy squint + open mouth (nom).
static void DrawCatFace(int frame) {
  const int cx = 64, cy = 27, r = 16;
  bool eyesOpen  = (frame % 2 == 0);
  bool mouthOpen = (frame % 2 == 1);

  // ── Ears (white filled, black inner mark) ────────────────────────────────
  display.fillTriangle(48, 20, 54,  5, 62, 18, SSD1306_WHITE);   // left ear
  display.fillTriangle(66, 18, 74,  5, 80, 20, SSD1306_WHITE);   // right ear
  display.fillTriangle(50, 19, 54,  9, 60, 17, SSD1306_BLACK);   // left inner
  display.fillTriangle(68, 17, 74,  9, 78, 19, SSD1306_BLACK);   // right inner

  // ── Head ─────────────────────────────────────────────────────────────────
  display.fillCircle(cx, cy, r, SSD1306_WHITE);

  // ── Eyes ─────────────────────────────────────────────────────────────────
  if (eyesOpen) {
    display.fillCircle(57, 24, 3, SSD1306_BLACK);
    display.fillCircle(71, 24, 3, SSD1306_BLACK);
    display.drawPixel(58, 23, SSD1306_WHITE);   // left shine
    display.drawPixel(72, 23, SSD1306_WHITE);   // right shine
  } else {
    // Happy squint (^ ^ shape)
    display.drawLine(54, 25, 60, 23, SSD1306_BLACK);
    display.drawLine(54, 25, 60, 25, SSD1306_BLACK);
    display.drawLine(68, 23, 74, 25, SSD1306_BLACK);
    display.drawLine(68, 25, 74, 25, SSD1306_BLACK);
  }

  // ── Nose (tiny inverted triangle) ────────────────────────────────────────
  display.fillTriangle(63, 30, 65, 30, 64, 32, SSD1306_BLACK);

  // ── Mouth ────────────────────────────────────────────────────────────────
  if (mouthOpen) {
    display.drawLine(64, 33, 60, 37, SSD1306_BLACK);
    display.drawLine(64, 33, 68, 37, SSD1306_BLACK);
    display.drawLine(60, 37, 68, 37, SSD1306_BLACK);  // bottom — open mouth
  } else {
    display.drawLine(64, 33, 60, 36, SSD1306_BLACK);
    display.drawLine(64, 33, 68, 36, SSD1306_BLACK);
  }

  // ── Whiskers (WHITE — visible on black background outside the face) ───────
  display.drawLine(47, 24, 30, 20, SSD1306_WHITE);
  display.drawLine(47, 27, 30, 27, SSD1306_WHITE);
  display.drawLine(47, 30, 30, 34, SSD1306_WHITE);
  display.drawLine(81, 24, 98, 20, SSD1306_WHITE);
  display.drawLine(81, 27, 98, 27, SSD1306_WHITE);
  display.drawLine(81, 30, 98, 34, SSD1306_WHITE);
}

static void DrawFeedingScreen() {
  DrawCatFace(animFrame);

  // Cycling "Nom" text at the bottom
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  int nomCount = (animFrame % 3) + 1;
  // pixel widths: "Nom"=18  "Nom Nom"=42  "Nom Nom Nom"=66
  const int kNomWidths[] = {18, 42, 66};
  display.setCursor(64 - kNomWidths[nomCount - 1] / 2, 54);
  for (int i = 0; i < nomCount; i++) {
    if (i > 0) display.print(" ");
    display.print("Nom");
  }
}

static void UpdateDisplay() {
  display.clearDisplay();
  if (isFeeding) {
    DrawFeedingScreen();
  } else {
    DrawNormalScreen();
  }
  display.display();
}

// ── Misc helpers ──────────────────────────────────────────────────────────────
static int ClampAngle(int angle) {
  if (angle < kMinAngle) return kMinAngle;
  if (angle > kMaxAngle) return kMaxAngle;
  return angle;
}

static const char *WifiStatusString(wl_status_t status) {
  switch (status) {
    case WL_CONNECTED:       return "connected";
    case WL_NO_SSID_AVAIL:   return "no-ssid";
    case WL_CONNECT_FAILED:  return "connect-failed";
    case WL_CONNECTION_LOST: return "lost";
    case WL_DISCONNECTED:    return "disconnected";
    default:                 return "unknown";
  }
}

// ── HTTP handlers ─────────────────────────────────────────────────────────────
static void HandleRoot() {
  const char kHtml[] =
    "<!doctype html><html><head>"
    "<meta name='viewport' content='width=device-width, initial-scale=1'>"
    "<title>Stray Feeder</title>"
    "<style>"
    "body{font-family:Arial,sans-serif;max-width:420px;margin:32px auto;padding:0 12px;line-height:1.5;background:#f5f5f5;}"
    "h2{text-align:center;margin-bottom:4px;}"
    ".subtitle{text-align:center;color:#666;font-size:.9em;margin-bottom:20px;}"
    ".status-box{background:#fff;border:1px solid #ddd;border-radius:10px;padding:16px;text-align:center;margin-bottom:20px;}"
    ".feed-count{font-size:2.6em;font-weight:700;color:#2a7;}"
    ".feed-label{color:#555;font-size:.95em;margin-top:2px;}"
    ".angle-small{color:#999;font-size:.8em;margin-top:4px;}"
    ".btn-row{display:flex;gap:10px;margin-bottom:12px;}"
    ".btn{flex:1;padding:14px 0;font-size:1.05em;font-weight:700;border:none;"
    "border-radius:10px;cursor:pointer;transition:opacity .15s;}"
    ".btn:active{opacity:.7;}"
    ".btn-feed{background:#2a7;color:#fff;}"
    ".btn-feed2{background:#38a;color:#fff;}"
    ".btn-reset{background:#e55;color:#fff;}"
    ".btn:disabled{background:#ccc;cursor:default;}"
    ".card{background:#fff;border:1px solid #ddd;border-radius:8px;padding:12px 14px;margin-top:16px;font-size:.88em;}"
    ".card div{display:flex;justify-content:space-between;padding:2px 0;}"
    ".label{font-weight:700;color:#444;}"
    ".toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);"
    "background:#333;color:#fff;padding:8px 18px;border-radius:20px;font-size:.9em;"
    "opacity:0;transition:opacity .3s;pointer-events:none;}"
    ".toast.show{opacity:1;}"
    ".env-row{display:flex;gap:10px;margin-bottom:16px;}"
    ".env-card{flex:1;background:#fff;border:1px solid #ddd;border-radius:10px;padding:14px 8px;text-align:center;}"
    ".env-icon{font-size:1.6em;margin-bottom:4px;}"
    ".env-val{font-size:2.2em;font-weight:700;color:#333;}"
    ".env-unit{font-size:1em;font-weight:400;color:#888;}"
    ".env-lbl{font-size:.75em;color:#aaa;margin-top:3px;}"
    "</style></head><body>"
    "<h2>&#x1F43E; Stray Feeder</h2>"
    "<p class='subtitle'>1 feed = 90&deg; spin</p>"

    "<div class='status-box'>"
    "  <div class='feed-count'><span id='feedNum'>0</span> / 2</div>"
    "  <div class='feed-label'>feeds dispensed this cycle</div>"
    "  <div class='angle-small'>Servo angle: <span id='anglePx'>0</span>&deg;</div>"
    "</div>"

    "<div class='env-row'>"
    "  <div class='env-card'>"
    "    <div class='env-icon'>&#x1F321;</div>"
    "    <div><span class='env-val' id='tempBig'>--</span><span class='env-unit'>&deg;C</span></div>"
    "    <div class='env-lbl'>Temperature</div>"
    "  </div>"
    "  <div class='env-card'>"
    "    <div class='env-icon'>&#x1F4A7;</div>"
    "    <div><span class='env-val' id='humBig'>--</span><span class='env-unit'>%</span></div>"
    "    <div class='env-lbl'>Humidity</div>"
    "  </div>"
    "</div>"

    "<div class='btn-row'>"
    "  <button class='btn btn-feed' id='btn1' onclick='feed(1)'>Feed &#xD7;1<br><small>+90&deg;</small></button>"
    "  <button class='btn btn-feed2' id='btn2' onclick='feed(2)'>Feed &#xD7;2<br><small>+180&deg;</small></button>"
    "</div>"
    "<button class='btn btn-reset' style='width:100%;margin-bottom:4px;' onclick='reset()'>&#x21BA; Reset (0&deg;)</button>"

    "<div class='card'>"
    "  <div><span class='label'>WiFi</span><span id='wifi'>-</span></div>"
    "  <div><span class='label'>IP</span><span id='ip'>-</span></div>"
    "  <div><span class='label'>RSSI</span><span id='rssi'>-</span></div>"
    "  <div><span class='label'>Servo pin</span><span id='pin'>-</span></div>"
    "  <div><span class='label'>Temperature</span><span id='temp'>-</span></div>"
    "  <div><span class='label'>Humidity</span><span id='hum'>-</span></div>"
    "</div>"
    "<div class='toast' id='toast'></div>"

    "<script>"
    "const STEP=90,MAX=180;"
    "let curAngle=0;"

    "function showToast(msg){"
    "  const t=document.getElementById('toast');"
    "  t.textContent=msg;t.classList.add('show');"
    "  setTimeout(()=>t.classList.remove('show'),1800);"
    "}"

    "function updateUI(angle){"
    "  curAngle=angle;"
    "  document.getElementById('feedNum').textContent=Math.round(angle/STEP);"
    "  document.getElementById('anglePx').textContent=angle;"
    "  document.getElementById('btn1').disabled=(angle+STEP>MAX);"
    "  document.getElementById('btn2').disabled=(angle+2*STEP>MAX);"
    "}"

    "async function send(angle){"
    "  try{"
    "    const r=await fetch('/set?angle='+angle);"
    "    if(r.ok){const v=parseInt(await r.text());updateUI(v);}"
    "  }catch(e){showToast('Error: '+e.message);}"
    "}"

    "function feed(times){"
    "  const target=Math.min(curAngle+times*STEP,MAX);"
    "  send(target);"
    "  showToast('Feeding \xd7'+times+'...');"
    "}"

    "function reset(){"
    "  send(0);"
    "  showToast('Reset to home');"
    "}"

    "async function refresh(){"
    "  try{"
    "    const r=await fetch('/debug');if(!r.ok)return;"
    "    const d=await r.json();"
    "    document.getElementById('wifi').textContent=d.wifi;"
    "    document.getElementById('ip').textContent=d.ip;"
    "    document.getElementById('rssi').textContent=d.rssi+' dBm';"
    "    document.getElementById('pin').textContent=d.pin;"
    "    document.getElementById('temp').textContent=d.temp!==null?d.temp+' °C':'--';"
    "    document.getElementById('hum').textContent=d.hum!==null?d.hum+' %':'--';"
    "    document.getElementById('tempBig').textContent=d.temp!==null?d.temp:'--';"
    "    document.getElementById('humBig').textContent=d.hum!==null?d.hum:'--';"
    "    updateUI(d.angle);"
    "  }catch(e){}"
    "}"
    "setInterval(refresh,2000);refresh();"
    "</script></body></html>";

  server.send(200, "text/html", kHtml);
}

static void HandleSet() {
  if (!server.hasArg("angle")) {
    server.send(400, "text/plain", "Missing angle");
    return;
  }
  int requested = server.arg("angle").toInt();
  int snapped   = (requested / kFeedStep) * kFeedStep;
  currentAngle  = ClampAngle(snapped);
  servo.write(currentAngle);

  // Start feeding animation
  isFeeding      = true;
  animFrame      = 0;
  feedingStartMs = millis();
  UpdateDisplay();

  server.send(200, "text/plain", String(currentAngle));
}

static void HandleStatus() {
  server.send(200, "text/plain", String(currentAngle));
}

static void HandleDebug() {
  wl_status_t status = WiFi.status();
  String json = "{";
  json += "\"wifi\":\""  + String(WifiStatusString(status)) + "\",";
  json += "\"ip\":\""    + WiFi.localIP().toString()        + "\",";
  json += "\"rssi\":\""  + String(WiFi.RSSI())              + "\",";
  json += "\"pin\":"     + String(kServoPin)                + ",";
  json += "\"angle\":"   + String(currentAngle)             + ",";
  json += "\"temp\":"    + (isnan(temperature) ? String("null") : String(temperature, 1)) + ",";
  json += "\"hum\":"     + (isnan(humidity)    ? String("null") : String(humidity, 1));
  json += "}";
  server.send(200, "application/json", json);
}

// ── setup ─────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);

  // DHT11
  dht.begin();

  // OLED — splash screen while WiFi connects
  Wire.begin();
  if (!display.begin(SSD1306_SWITCHCAPVCC, kOledAddr)) {
    Serial.println("SSD1306 init failed — check wiring/address");
  }
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(16, 20);
  display.print("* Stray Feeder *");
  display.setCursor(24, 34);
  display.print("Starting WiFi...");
  display.display();

  // Servo home position
  servo.setPeriodHertz(50);
  servo.attach(kServoPin, 500, 2400);
  servo.write(currentAngle);

  // WiFi (20 s timeout)
  WiFi.mode(WIFI_STA);
  WiFi.begin(kWifiSsid, kWifiPass);
  Serial.print("Connecting to WiFi");

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(500);
    Serial.print('.');
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.printf("Connected. IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\nWiFi connect failed — running offline.");
  }

  server.on("/",       HandleRoot);
  server.on("/set",    HandleSet);
  server.on("/status", HandleStatus);
  server.on("/debug",  HandleDebug);
  server.begin();

  UpdateDisplay();
}

// ── loop ──────────────────────────────────────────────────────────────────────
void loop() {
  server.handleClient();

  unsigned long now = millis();

  // Read DHT11 every 2 s
  if (now - lastDhtMs >= kDhtIntervalMs) {
    lastDhtMs   = now;
    float t     = dht.readTemperature();
    float h     = dht.readHumidity();
    if (!isnan(t)) temperature = t;
    if (!isnan(h)) humidity    = h;
    Serial.printf("Temp: %.1f C  Hum: %.1f%%\n", temperature, humidity);
    if (!isFeeding) UpdateDisplay();
  }

  // End feeding animation after duration
  if (isFeeding && now - feedingStartMs >= kFeedAnimDurationMs) {
    isFeeding = false;
    UpdateDisplay();
  }

  // Animate OLED while feeding
  if (isFeeding && now - lastAnimMs >= kAnimIntervalMs) {
    lastAnimMs = now;
    animFrame++;
    UpdateDisplay();
  }
}
