  /*
    Heartware - Automatic Medication Dispenser
    Target board: Waveshare ESP32-C6-LCD-1.47
    Display: 172x320 ST7789 (landscape 320x172)

    REQUIRED ARDUINO LIBRARIES:
      1) Adafruit GFX Library
      2) Adafruit ST7735 and ST7789 Library
      3) ESP32Servo

    BOARD:
      Tools -> Board -> ESP32 Arduino -> ESP32C6 Dev Module

    WAVESHARE LCD PINS:
      MOSI   GPIO 6
      SCLK   GPIO 7
      CS     GPIO 14
      DC     GPIO 15
      RST    GPIO 21
      BL     GPIO 22

    SERVO PINS (same as the original Heartware firmware):
      Chamber 1 -> GPIO 5
      Chamber 2 -> GPIO 4
      Chamber 3 -> GPIO 3

    IMPORTANT:
      GPIO4/GPIO5 are also wired to the onboard microSD socket.
      Do not insert/use a microSD card while using these pins for servos.

    BLE:
      Device Name: ESP32_Test
      Service UUID: 41200547-118c-4580-926f-6380e3a521b5
      Characteristic UUID: 2a75981f-0e72-4bb1-943b-5d568704b20a
  */

  #include <Arduino.h>
  #include <SPI.h>
  #include <Adafruit_GFX.h>
  #include <Adafruit_ST7789.h>
  #include <ESP32Servo.h>

  #include <BLEDevice.h>
  #include <BLEServer.h>
  #include <BLEUtils.h>
  #include <BLE2902.h>

  // ============================================================
  // Waveshare ESP32-C6-LCD-1.47 display configuration
  // ============================================================
  #define LCD_MOSI  6
  #define LCD_SCLK  7
  #define LCD_CS    14
  #define LCD_DC    15
  #define LCD_RST   21
  #define LCD_BL    22

  #define LCD_NATIVE_WIDTH   172
  #define LCD_NATIVE_HEIGHT  320

  // Landscape after setRotation(1)
  #define SCREEN_WIDTH   320
  #define SCREEN_HEIGHT  172

  Adafruit_ST7789 tft = Adafruit_ST7789(&SPI, LCD_CS, LCD_DC, LCD_RST);
  bool displayAvailable = false;

  // Candidate pins to pulse when actuating servo.
  // On Waveshare ESP32-C6-LCD-1.47:
  // Display pins: LCD_MOSI (6), LCD_SCLK (7), LCD_CS (14), LCD_DC (15), LCD_RST (21), LCD_BL (22)
  // Available exposed/usable GPIO pins: 0, 1, 2, 3, 4, 5, 8, 9, 18, 19, 20, 23
  const int ALL_SERVO_PINS[] = {0, 1, 2, 3, 4, 5, 8, 9, 18, 19, 20, 23};
  const int NUM_SERVO_PINS = sizeof(ALL_SERVO_PINS) / sizeof(ALL_SERVO_PINS[0]);

  #define NUM_CHAMBERS 3
  #define DEFAULT_DISPENSE_ANGLE 147
  #define DEFAULT_REST_ANGLE 0

  // ============================================================
  // BLE configuration
  // ============================================================
  #define SERVICE_UUID        "41200547-118c-4580-926f-6380e3a521b5"
  #define CHARACTERISTIC_UUID "2a75981f-0e72-4bb1-943b-5d568704b20a"

  BLEServer *pServer = nullptr;
  BLECharacteristic *pServoCharacteristic = nullptr;
  bool deviceConnected = false;
  bool oldDeviceConnected = false;

  // ============================================================
  // Data models
  // ============================================================
  struct ChamberData {
    int id;
    int pin;
    Servo servo;
    int requests;
    bool active;
    String pillName;
    int stock;
    int maxCapacity;
    int totalDispensed;
    int dispenseAngle;
    int restAngle;
    int stepDelayMs;
  };

  struct DeviceStats {
    unsigned long totalDispensed;
    unsigned long lastDispenseMillis;
    int lastDispensedBottle;
    String lastDispensedPill;
    unsigned long bootMillis;
    int batteryPercent;
    float batteryVoltage;
  };

  DeviceStats stats = {
    0,
    0,
    0,
    "None",
    0,
    98,
    4.12f
  };

  // Helper function to send servo pulse (microsecond pulse at 50Hz) to all candidate GPIO pins
  // so any connected servo on any pin responds!
  void pulseAllServoPins(int angle, int pulseCount = 15) {
    // Convert angle (0-180) to microseconds (500us - 2400us)
    int pulseWidthUs = 500 + ((long)angle * 1900) / 180;
    int periodUs = 20000; // 50Hz = 20,000us
    int lowTimeUs = periodUs - pulseWidthUs;

    for (int p = 0; p < NUM_SERVO_PINS; p++) {
      pinMode(ALL_SERVO_PINS[p], OUTPUT);
    }

    for (int i = 0; i < pulseCount; i++) {
      for (int p = 0; p < NUM_SERVO_PINS; p++) {
        digitalWrite(ALL_SERVO_PINS[p], HIGH);
      }
      delayMicroseconds(pulseWidthUs);
      for (int p = 0; p < NUM_SERVO_PINS; p++) {
        digitalWrite(ALL_SERVO_PINS[p], LOW);
      }
      delayMicroseconds(lowTimeUs);
    }
  }

  // Drive a servo movement across all candidate pins to ensure whatever pin the servo is on actuates
  void driveAllServos(int startAngle, int targetAngle, int stepDelayMs = 15) {
    int step = (targetAngle >= startAngle) ? 3 : -3;
    int currentAngle = startAngle;
    while (true) {
      if ((step > 0 && currentAngle >= targetAngle) || (step < 0 && currentAngle <= targetAngle)) {
        currentAngle = targetAngle;
        pulseAllServoPins(currentAngle, 6);
        break;
      }
      pulseAllServoPins(currentAngle, 2);
      currentAngle += step;
      delay(stepDelayMs);
    }
  }

  // ============================================================
  // Servo manager
  // ============================================================
  class ServoHandler {
  public:
    ChamberData chambers[NUM_CHAMBERS];

    ServoHandler() {
      configureChamber(0, 1, 5, "Aspirin 81mg", 28, 30);
      configureChamber(1, 2, 4, "Lisinopril 10mg", 18, 30);
      configureChamber(2, 3, 3, "Amoxicillin 500", 25, 30);
    }

    void configureChamber(int index, int id, int pin, const char *name,
                          int stock, int capacity) {
      chambers[index].id = id;
      chambers[index].pin = pin;
      chambers[index].requests = 0;
      chambers[index].active = false;
      chambers[index].pillName = name;
      chambers[index].stock = stock;
      chambers[index].maxCapacity = capacity;
      chambers[index].totalDispensed = 0;
      chambers[index].dispenseAngle = DEFAULT_DISPENSE_ANGLE;
      chambers[index].restAngle = DEFAULT_REST_ANGLE;
      chambers[index].stepDelayMs = 10;
    }

    void setServoConfig(int bottleId, int angle, int stepDelayMs) {
      if (bottleId < 1 || bottleId > NUM_CHAMBERS) return;
      if (angle >= 30 && angle <= 180) chambers[bottleId - 1].dispenseAngle = angle;
      if (stepDelayMs >= 2 && stepDelayMs <= 50) chambers[bottleId - 1].stepDelayMs = stepDelayMs;
      Serial.printf("[CONFIG] Bottle #%d angle=%d°, stepDelay=%dms\n",
                    bottleId,
                    chambers[bottleId - 1].dispenseAngle,
                    chambers[bottleId - 1].stepDelayMs);
    }

    void init() {
      Serial.println("[SERVOS] Initializing candidate servo pins...");
      // Bring all candidate servo pins to rest position (0 degrees)
      driveAllServos(DEFAULT_REST_ANGLE, DEFAULT_REST_ANGLE, 5);
      Serial.println("[SERVOS] Ready across all candidate pins at rest position.");
    }

    void queueRequest(int bottleId) {
      if (bottleId < 1 || bottleId > NUM_CHAMBERS) return;

      int idx = bottleId - 1;
      chambers[idx].requests++;

      Serial.printf("[DISPENSE] Queued Bottle #%d (%s). Pending: %d\n",
                    bottleId,
                    chambers[idx].pillName.c_str(),
                    chambers[idx].requests);
    }

    bool hasPendingRequests() {
      for (int i = 0; i < NUM_CHAMBERS; i++) {
        if (chambers[i].requests > 0) return true;
      }
      return false;
    }

    void setPillName(int bottleId, const String &name) {
      if (bottleId < 1 || bottleId > NUM_CHAMBERS) return;
      chambers[bottleId - 1].pillName = name;
      Serial.printf("[CONFIG] Bottle #%d name: %s\n", bottleId, name.c_str());
    }

    void refill(int bottleId, int count) {
      if (bottleId < 1 || bottleId > NUM_CHAMBERS) return;
      if (count < 0) count = 0;

      chambers[bottleId - 1].stock = count;
      Serial.printf("[REFILL] Bottle #%d -> %d pills\n", bottleId, count);
    }
  };

  ServoHandler servoHandler;

  // ============================================================
  // Display manager
  // ============================================================
  class DisplayManager {
  private:
    int idlePage = 0;
    unsigned long lastPageSwitch = 0;
    const unsigned long PAGE_DURATION_MS = 4000;
    bool dirty = false;
    GFXcanvas16 *canvas = nullptr;

    String clipped(const String &s, int maxChars) {
      if ((int)s.length() <= maxChars) return s;
      return s.substring(0, maxChars - 1) + ".";
    }

    // Draw into high-speed RAM canvas if available, fallback to tft directly
    Adafruit_GFX &gfx() {
      if (canvas != nullptr) return *canvas;
      return tft;
    }

    // Push completed offscreen frame to LCD in a single burst (no tearing / no visible line)
    void flush() {
      if (!displayAvailable) return;
      if (canvas != nullptr && canvas->getBuffer() != nullptr) {
        tft.drawRGBBitmap(0, 0, canvas->getBuffer(), SCREEN_WIDTH, SCREEN_HEIGHT);
      }
    }

  public:
    void markDirty() {
      dirty = true;
    }

    void init() {
      Serial.println("[LCD] Initializing Waveshare ST7789...");

      // Keep backlight around 50%.
      pinMode(LCD_BL, OUTPUT);
      analogWrite(LCD_BL, 128);

      // Hardware SPI used by the onboard LCD.
      SPI.begin(LCD_SCLK, -1, LCD_MOSI, LCD_CS);

      tft.init(LCD_NATIVE_WIDTH, LCD_NATIVE_HEIGHT);
      tft.setSPISpeed(40000000UL); // High-speed 40 MHz SPI to eliminate refresh latency
      tft.setRotation(1);          // 320 x 172 landscape
      tft.setTextWrap(false);
      tft.fillScreen(ST77XX_BLACK);

      // Allocate 320x172 16-bit double buffer canvas in SRAM (~107.5 KB)
      // Eliminates scanline tearing, visible clearing lines, and element-by-element pop-in
      canvas = new GFXcanvas16(SCREEN_WIDTH, SCREEN_HEIGHT);
      if (canvas != nullptr && canvas->getBuffer() != nullptr) {
        canvas->setTextWrap(false);
        Serial.printf("[LCD] Double-buffering enabled (%dx%d, %u bytes)\n",
                      SCREEN_WIDTH, SCREEN_HEIGHT,
                      (unsigned int)(SCREEN_WIDTH * SCREEN_HEIGHT * sizeof(uint16_t)));
      } else {
        if (canvas) {
          delete canvas;
          canvas = nullptr;
        }
        Serial.println("[LCD] Warning: Canvas buffer allocation failed, falling back to direct rendering.");
      }

      displayAvailable = true;
      Serial.printf("[LCD] Ready: %dx%d\n", tft.width(), tft.height());

      showSplashScreen();
    }

    void drawHeader(const char *title) {
      if (!displayAvailable) return;
      Adafruit_GFX &g = gfx();

      g.fillRect(0, 0, SCREEN_WIDTH, 27, ST77XX_BLUE);
      g.setTextColor(ST77XX_WHITE);
      g.setTextSize(2);
      g.setCursor(8, 6);
      g.print(title);

      g.setTextSize(1);
      if (deviceConnected) {
        g.fillCircle(284, 13, 5, ST77XX_GREEN);
        g.setCursor(294, 9);
        g.print("BLE");
      } else {
        g.drawCircle(284, 13, 5, ST77XX_WHITE);
        g.setCursor(294, 9);
        g.print("ADV");
      }
    }

    void showSplashScreen() {
      if (!displayAvailable) return;
      Adafruit_GFX &g = gfx();

      g.fillScreen(ST77XX_BLACK);
      g.drawRoundRect(18, 18, 284, 136, 14, ST77XX_CYAN);
      g.drawRoundRect(22, 22, 276, 128, 12, ST77XX_BLUE);

      // Simple heart icon
      g.fillCircle(61, 66, 13, ST77XX_RED);
      g.fillCircle(82, 66, 13, ST77XX_RED);
      g.fillTriangle(49, 72, 94, 72, 72, 102, ST77XX_RED);

      g.setTextColor(ST77XX_WHITE);
      g.setTextSize(3);
      g.setCursor(111, 46);
      g.print("HEARTWARE");

      g.setTextColor(ST77XX_CYAN);
      g.setTextSize(2);
      g.setCursor(111, 82);
      g.print("Smart Dispenser");

      g.setTextColor(ST77XX_GREEN);
      g.setTextSize(1);
      g.setCursor(111, 112);
      g.print("ESP32-C6 / BLE READY");

      flush();
      delay(1400);
    }

    void showDispensing(int bottleId, const char *pillName, int step) {
      if (!displayAvailable) return;
      Adafruit_GFX &g = gfx();

      g.fillScreen(ST77XX_BLACK);

      g.fillRect(0, 0, SCREEN_WIDTH, 34, ST77XX_RED);
      g.setTextColor(ST77XX_WHITE);
      g.setTextSize(2);
      g.setCursor(74, 9);
      g.print("DISPENSING");

      g.setTextColor(ST77XX_YELLOW);
      g.setTextSize(3);
      g.setCursor(12, 48);
      g.printf("BOTTLE #%d", bottleId);

      g.setTextColor(ST77XX_WHITE);
      g.setTextSize(2);
      g.setCursor(12, 86);
      g.print(clipped(String(pillName), 22));

      // Progress bar
      const int barX = 12;
      const int barY = 121;
      const int barW = 296;
      const int barH = 20;

      g.drawRoundRect(barX, barY, barW, barH, 5, ST77XX_WHITE);
      int innerW = map(constrain(step, 0, 100), 0, 100, 0, barW - 6);
      if (innerW > 0) {
        g.fillRoundRect(barX + 3, barY + 3, innerW, barH - 6, 3, ST77XX_GREEN);
      }

      g.setTextColor(ST77XX_CYAN);
      g.setTextSize(1);
      g.setCursor(12, 153);
      if (step < 50) {
        g.print("Actuating servo...");
      } else if (step < 100) {
        g.print("Dropping medication...");
      } else {
        g.print("Returning servo to rest...");
      }

      flush();
    }

    void showDispenseComplete(int bottleId, const char *pillName, int stockLeft) {
      if (!displayAvailable) return;
      Adafruit_GFX &g = gfx();

      g.fillScreen(ST77XX_BLACK);
      drawHeader("DISPENSE SUCCESS");

      // Green check mark
      g.drawLine(20, 63, 34, 78, ST77XX_GREEN);
      g.drawLine(34, 78, 61, 48, ST77XX_GREEN);
      g.drawLine(21, 64, 34, 77, ST77XX_GREEN);
      g.drawLine(35, 77, 60, 49, ST77XX_GREEN);

      g.setTextColor(ST77XX_GREEN);
      g.setTextSize(3);
      g.setCursor(78, 48);
      g.printf("BOTTLE #%d OK", bottleId);

      g.setTextColor(ST77XX_WHITE);
      g.setTextSize(2);
      g.setCursor(78, 84);
      g.print(clipped(String(pillName), 19));

      g.setTextColor(stockLeft <= 4 ? ST77XX_RED : ST77XX_CYAN);
      g.setCursor(78, 111);
      g.printf("Remaining: %d", stockLeft);

      g.fillRect(0, 146, SCREEN_WIDTH, 26, ST77XX_BLUE);
      g.setTextColor(ST77XX_WHITE);
      g.setTextSize(1);
      g.setCursor(91, 155);
      g.print("TAKE WITH WATER");

      flush();
    }

    void showPageInventory() {
      if (!displayAvailable) return;
      Adafruit_GFX &g = gfx();

      g.fillScreen(ST77XX_BLACK);
      drawHeader("HEARTWARE");

      g.setTextSize(1);
      g.setTextColor(ST77XX_CYAN);
      g.setCursor(10, 35);
      g.print("CHAMBER");
      g.setCursor(72, 35);
      g.print("MEDICATION");
      g.setCursor(260, 35);
      g.print("STOCK");
      g.drawLine(8, 47, 312, 47, ST77XX_BLUE);

      for (int i = 0; i < NUM_CHAMBERS; i++) {
        ChamberData &c = servoHandler.chambers[i];
        int y = 58 + (i * 31);

        g.setTextSize(2);
        g.setTextColor(ST77XX_YELLOW);
        g.setCursor(15, y);
        g.printf("#%d", c.id);

        g.setTextColor(ST77XX_WHITE);
        g.setCursor(72, y);
        g.print(clipped(c.pillName, 14));

        if (c.stock <= 4) {
          g.setTextColor(ST77XX_RED);
        } else {
          g.setTextColor(ST77XX_GREEN);
        }
        g.setCursor(267, y);
        g.printf("%d", c.stock);
      }

      g.setTextSize(1);
      g.setTextColor(ST77XX_CYAN);
      g.setCursor(10, 159);
      g.print("BLE commands: 1 / 2 / 3 / 123");

      flush();
    }

    void showPageAnalytics() {
      if (!displayAvailable) return;
      Adafruit_GFX &g = gfx();

      g.fillScreen(ST77XX_BLACK);
      drawHeader("DISPENSE ANALYTICS");

      g.setTextColor(ST77XX_WHITE);
      g.setTextSize(2);
      g.setCursor(14, 42);
      g.printf("Total dispensed: %lu", stats.totalDispensed);

      g.setTextColor(ST77XX_CYAN);
      g.setCursor(14, 72);
      g.printf("B1:%d   B2:%d   B3:%d",
                servoHandler.chambers[0].totalDispensed,
                servoHandler.chambers[1].totalDispensed,
                servoHandler.chambers[2].totalDispensed);

      g.setTextColor(ST77XX_WHITE);
      g.setTextSize(1);
      g.setCursor(14, 112);

      if (stats.lastDispensedBottle > 0) {
        unsigned long elapsedSec = (millis() - stats.lastDispenseMillis) / 1000UL;
        g.printf("Last: Bottle #%d - %s", stats.lastDispensedBottle,
                  clipped(stats.lastDispensedPill, 24).c_str());
        g.setCursor(14, 128);
        if (elapsedSec < 60) {
          g.printf("Completed %lu sec ago", elapsedSec);
        } else {
          g.printf("Completed %lu min ago", elapsedSec / 60UL);
        }
      } else {
        g.print("Last dispense: none yet");
      }

      g.fillRect(0, 149, SCREEN_WIDTH, 23, ST77XX_GREEN);
      g.setTextColor(ST77XX_BLACK);
      g.setCursor(105, 157);
      g.print("SYSTEM READY");

      flush();
    }

    void showPageHardware() {
      if (!displayAvailable) return;
      Adafruit_GFX &g = gfx();

      g.fillScreen(ST77XX_BLACK);
      drawHeader("SYSTEM TELEMETRY");

      uint32_t freeHeapKB = ESP.getFreeHeap() / 1024;
      unsigned long uptimeSec = millis() / 1000UL;
      unsigned long h = uptimeSec / 3600UL;
      unsigned long m = (uptimeSec % 3600UL) / 60UL;
      unsigned long s = uptimeSec % 60UL;

      g.setTextSize(2);
      g.setTextColor(ST77XX_WHITE);
      g.setCursor(16, 44);
      g.printf("Free RAM: %lu KB", (unsigned long)freeHeapKB);

      g.setCursor(16, 72);
      g.printf("Uptime: %02lu:%02lu:%02lu", h, m, s);

      g.setCursor(16, 100);
      g.printf("Battery: %d%%  %.2fV", stats.batteryPercent, stats.batteryVoltage);

      g.setCursor(16, 128);
      g.setTextColor(deviceConnected ? ST77XX_GREEN : ST77XX_YELLOW);
      g.printf("BLE: %s", deviceConnected ? "CONNECTED" : "ADVERTISING");

      g.setTextSize(1);
      g.setTextColor(ST77XX_CYAN);
      g.setCursor(16, 156);
      g.print("Waveshare ESP32-C6-LCD-1.47 / ST7789");

      flush();
    }

    void updateIdleLoop() {
      if (!displayAvailable) return;

      unsigned long now = millis();
      bool pageChanged = false;

      if (now - lastPageSwitch >= PAGE_DURATION_MS) {
        lastPageSwitch = now;
        idlePage = (idlePage + 1) % 3;
        pageChanged = true;
      }

      static int lastRenderedPage = -1;
      static bool lastBleState = false;
      static unsigned long lastRefresh = 0;

      bool bleChanged = (deviceConnected != lastBleState);

      // Page 2 (Hardware Telemetry) has an uptime seconds counter, so refresh once per second.
      // Static pages (Inventory and Analytics) only refresh on page transitions, BLE state changes,
      // or when data is updated (markDirty).
      bool telemetryTick = (idlePage == 2 && (now - lastRefresh >= 1000));

      if (!pageChanged && !bleChanged && !dirty && !telemetryTick && (lastRenderedPage != -1)) {
        return;
      }

      dirty = false;
      lastRenderedPage = idlePage;
      lastBleState = deviceConnected;
      lastRefresh = now;

      switch (idlePage) {
        case 0: showPageInventory(); break;
        case 1: showPageAnalytics(); break;
        case 2: showPageHardware(); break;
      }
    }
  };

  DisplayManager displayManager;

  // ============================================================
  // Dispense execution
  // ============================================================
  void sendBleNotification(const String &message) {
    if (!deviceConnected || pServoCharacteristic == nullptr) return;

    pServoCharacteristic->setValue(message.c_str());
    pServoCharacteristic->notify();
  }

  void executeDispenseCycle() {
    for (int i = 0; i < NUM_CHAMBERS; i++) {
      ChamberData &chamber = servoHandler.chambers[i];

      while (chamber.requests > 0) {
        Serial.printf("[CYCLE] Bottle #%d (%s) starting...\n",
                      chamber.id, chamber.pillName.c_str());

        chamber.active = true;

        // Phase 1 - move to dispense angle across all candidate PWM servo pins
        displayManager.showDispensing(chamber.id, chamber.pillName.c_str(), 20);
        driveAllServos(chamber.restAngle, chamber.dispenseAngle, chamber.stepDelayMs > 0 ? chamber.stepDelayMs : 8);
        pulseAllServoPins(chamber.dispenseAngle, 20);

        displayManager.showDispensing(chamber.id, chamber.pillName.c_str(), 65);
        delay(300);

        // Phase 2 - return to rest across all candidate PWM servo pins
        displayManager.showDispensing(chamber.id, chamber.pillName.c_str(), 90);
        driveAllServos(chamber.dispenseAngle, chamber.restAngle, chamber.stepDelayMs > 0 ? chamber.stepDelayMs : 8);
        pulseAllServoPins(chamber.restAngle, 20);
        displayManager.showDispensing(chamber.id, chamber.pillName.c_str(), 100);
        delay(200);

        // Phase 3 - update state
        if (chamber.stock > 0) chamber.stock--;
        chamber.totalDispensed++;
        chamber.requests--;
        chamber.active = false;

        stats.totalDispensed++;
        stats.lastDispenseMillis = millis();
        stats.lastDispensedBottle = chamber.id;
        stats.lastDispensedPill = chamber.pillName;

        Serial.printf("[CYCLE] Bottle #%d complete. Remaining: %d\n",
                      chamber.id, chamber.stock);

        // Phase 4 - display completion
        displayManager.showDispenseComplete(
          chamber.id,
          chamber.pillName.c_str(),
          chamber.stock
        );

        String notifyMsg = "DISPENSED:BOTTLE_" + String(chamber.id) +
                          ":REMAIN_" + String(chamber.stock);
        sendBleNotification(notifyMsg);

        delay(1200);

        if (chamber.requests > 0 || servoHandler.hasPendingRequests()) {
          delay(300);
        }
      }
    }

    // Ensure idle screen refreshes immediately with updated stock numbers
    displayManager.markDirty();
  }

  // ============================================================
  // BLE callbacks
  // ============================================================
  class ServerCallbacks : public BLEServerCallbacks {
    void onConnect(BLEServer *server) override {
      deviceConnected = true;
      Serial.println("[BLE] Client connected.");
    }

    void onDisconnect(BLEServer *server) override {
      deviceConnected = false;
      Serial.println("[BLE] Client disconnected.");
    }
  };

  class ServoCallbacks : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) override {
      String value = pCharacteristic->getValue();
      value.trim();

      Serial.print("[BLE RX] ");
      Serial.println(value);

      if (value.length() == 0) return;

      // PING -> PONG
      if (value == "PING") {
        pCharacteristic->setValue("PONG");
        pCharacteristic->notify();
        return;
      }

      // STATUS -> telemetry
      if (value == "STATUS") {
        char statusBuf[160];
        snprintf(statusBuf, sizeof(statusBuf),
                "STATUS:OK;BAT:%d%%;B1:%d;B2:%d;B3:%d;TOTAL:%lu",
                stats.batteryPercent,
                servoHandler.chambers[0].stock,
                servoHandler.chambers[1].stock,
                servoHandler.chambers[2].stock,
                stats.totalDispensed);

        pCharacteristic->setValue(statusBuf);
        pCharacteristic->notify();
        return;
      }

      // NAME:<id>:<name>
      if (value.startsWith("NAME:")) {
        int firstColon = value.indexOf(':');
        int secondColon = value.indexOf(':', firstColon + 1);

        if (secondColon > 0) {
          int id = value.substring(firstColon + 1, secondColon).toInt();
          String medName = value.substring(secondColon + 1);
          medName.trim();

          if (id >= 1 && id <= NUM_CHAMBERS && medName.length() > 0) {
            servoHandler.setPillName(id, medName);
            displayManager.markDirty();
            pCharacteristic->setValue("ACK:NAME_UPDATED");
          } else {
            pCharacteristic->setValue("ERR:BAD_NAME_COMMAND");
          }
          pCharacteristic->notify();
          return;
        }
      }

      // REFILL:<id>:<count>
      if (value.startsWith("REFILL:")) {
        int firstColon = value.indexOf(':');
        int secondColon = value.indexOf(':', firstColon + 1);

        if (secondColon > 0) {
          int id = value.substring(firstColon + 1, secondColon).toInt();
          int count = value.substring(secondColon + 1).toInt();

          if (id >= 1 && id <= NUM_CHAMBERS && count >= 0) {
            servoHandler.refill(id, count);
            displayManager.markDirty();
            pCharacteristic->setValue("ACK:REFILLED");
          } else {
            pCharacteristic->setValue("ERR:BAD_REFILL_COMMAND");
          }
          pCharacteristic->notify();
          return;
        }
      }

      // CALIBRATE:<id>:<angle>:<speed>
      if (value.startsWith("CALIBRATE:")) {
        int firstColon = value.indexOf(':');
        int secondColon = value.indexOf(':', firstColon + 1);
        int thirdColon = value.indexOf(':', secondColon + 1);

        if (secondColon > 0) {
          int id = value.substring(firstColon + 1, secondColon).toInt();
          int angle = thirdColon > 0
            ? value.substring(secondColon + 1, thirdColon).toInt()
            : value.substring(secondColon + 1).toInt();
          int speed = thirdColon > 0 ? value.substring(thirdColon + 1).toInt() : 10;

          if (id >= 1 && id <= NUM_CHAMBERS && angle >= 30 && angle <= 180) {
            servoHandler.setServoConfig(id, angle, speed);
            // Execute calibration test sweep: rest -> angle -> rest
            driveAllServos(DEFAULT_REST_ANGLE, angle, speed);
            delay(200);
            driveAllServos(angle, DEFAULT_REST_ANGLE, speed);
            pCharacteristic->setValue("ACK:CALIBRATE_OK");
          } else {
            pCharacteristic->setValue("ERR:BAD_CALIBRATE_PARAMS");
          }
          pCharacteristic->notify();
          return;
        }
      }

      // CONFIG:SERVO:<id>:<angle>:<speed>
      if (value.startsWith("CONFIG:SERVO:")) {
        int firstColon = value.indexOf(':', 7); // after CONFIG:
        int secondColon = value.indexOf(':', firstColon + 1);
        int thirdColon = value.indexOf(':', secondColon + 1);

        if (secondColon > 0 && thirdColon > 0) {
          int id = value.substring(secondColon + 1, thirdColon).toInt();
          int angle = value.substring(thirdColon + 1).toInt();
          // Check if speed follows
          int fourthColon = value.indexOf(':', thirdColon + 1);
          int speed = 10;
          if (fourthColon > 0) {
            angle = value.substring(thirdColon + 1, fourthColon).toInt();
            speed = value.substring(fourthColon + 1).toInt();
          }
          if (id >= 1 && id <= NUM_CHAMBERS) {
            servoHandler.setServoConfig(id, angle, speed);
            pCharacteristic->setValue("ACK:CONFIG_SERVO_OK");
          } else {
            pCharacteristic->setValue("ERR:BAD_SERVO_CONFIG");
          }
          pCharacteristic->notify();
          return;
        }
      }

      // Dispense commands: "1", "2", "3", "123", "11", etc.
      int queuedCount = 0;

      for (size_t i = 0; i < value.length(); i++) {
        char c = value[i];
        if (c >= '1' && c <= '3') {
          servoHandler.queueRequest(c - '0');
          queuedCount++;
        }
      }

      if (queuedCount > 0) {
        String ack = "ACK:" + value;
        pCharacteristic->setValue(ack.c_str());
        pCharacteristic->notify();
        Serial.printf("[BLE TX] %s\n", ack.c_str());
      } else {
        pCharacteristic->setValue("ERR:UNKNOWN_COMMAND");
        pCharacteristic->notify();
      }
    }
  };

  // ============================================================
  // Setup
  // ============================================================
  void setup() {
    Serial.begin(115200);
    delay(300);

    Serial.println();
    Serial.println("============================================");
    Serial.println(" HEARTWARE - Waveshare ESP32-C6-LCD-1.47");
    Serial.println("============================================");

    // LCD first so startup progress is visible.
    displayManager.init();

    // Servos.
    servoHandler.init();

    // BLE.
    Serial.println("[BLE] Starting BLE server...");
    BLEDevice::init("ESP32_Test");

    pServer = BLEDevice::createServer();
    pServer->setCallbacks(new ServerCallbacks());

    BLEService *pService = pServer->createService(SERVICE_UUID);

    pServoCharacteristic = pService->createCharacteristic(
      CHARACTERISTIC_UUID,
      BLECharacteristic::PROPERTY_READ |
      BLECharacteristic::PROPERTY_WRITE |
      BLECharacteristic::PROPERTY_NOTIFY
    );

    pServoCharacteristic->setValue("HEARTWARE:READY");
    pServoCharacteristic->addDescriptor(new BLE2902());
    pServoCharacteristic->setCallbacks(new ServoCallbacks());

    pService->start();

    BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    pAdvertising->setMinPreferred(0x06);
    pAdvertising->setMaxPreferred(0x12);
    pAdvertising->start();

    stats.bootMillis = millis();

    Serial.println("[INIT] Setup complete.");
    Serial.println("[INIT] BLE name: ESP32_Test");
    Serial.println("[INIT] Waiting for commands...");
  }

  // ============================================================
  // Main loop
  // ============================================================
  void loop() {
    if (servoHandler.hasPendingRequests()) {
      executeDispenseCycle();
    } else {
      displayManager.updateIdleLoop();
    }

    // Restart advertising after a disconnect.
    if (!deviceConnected && oldDeviceConnected) {
      delay(300);
      pServer->startAdvertising();
      Serial.println("[BLE] Advertising restarted.");
      oldDeviceConnected = false;
    }

    if (deviceConnected && !oldDeviceConnected) {
      oldDeviceConnected = true;
    }

    delay(20);
  }
