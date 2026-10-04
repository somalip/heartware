/*
 * Heartware - Automatic Medication Dispenser ESP32 Firmware
 * -----------------------------------------------------------------------
 * Hardware:
 *   - ESP32 Development Board
 *   - I2C OLED Display (SSD1306, 128x64 or 128x32)
 *       SDA -> GPIO 21 (Default ESP32 Wire)
 *       SCL -> GPIO 22 (Default ESP32 Wire)
 *       I2C Address -> 0x3C (or 0x3D)
 *   - 3x Micro Servos (SG90 / MG90S) for Pill Chambers 1, 2, 3
 *       Chamber 1 -> GPIO 5
 *       Chamber 2 -> GPIO 4
 *       Chamber 3 -> GPIO 3
 *
 * Required Arduino Libraries (Install via Arduino Library Manager):
 *   1. "Adafruit SSD1306" by Adafruit
 *   2. "Adafruit GFX Library" by Adafruit
 *   3. "ESP32Servo" by Kevin Harrington
 *
 * BLE GATT Configuration:
 *   - Device Name: "ESP32_Test" (matches Heartware PWA BLE discovery)
 *   - Service UUID: 41200547-118c-4580-926f-6380e3a521b5
 *   - Characteristic UUID: 2a75981f-0e72-4bb1-943b-5d568704b20a
 *   - Supports Read, Write, and Notify with BLE2902 descriptor
 *   - Protocol:
 *       "1", "2", "3"   -> Dispense corresponding pill bottle
 *       "123", "11"     -> Chained multi-pill sequence
 *       "PING"          -> Heartbeat probe, returns "PONG"
 *       "STATUS"        -> Returns battery, telemetry, and chamber counts
 *       "NAME:<id>:<name>" -> Configure pill label (e.g. "NAME:1:Aspirin")
 *       "REFILL:<id>:<n>"  -> Refill chamber stock count (e.g. "REFILL:1:30")
 * -----------------------------------------------------------------------
 */

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ESP32Servo.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// =======================================================================
// Hardware & Display Configuration
// =======================================================================
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
#define SCREEN_ADDRESS 0x3C
#define SCREEN_ADDRESS_ALT 0x3D

#define I2C_SDA_PIN 21
#define I2C_SCL_PIN 22

#define SERVO_PIN_1 5
#define SERVO_PIN_2 4
#define SERVO_PIN_3 3

#define NUM_CHAMBERS 3
#define DEFAULT_DISPENSE_ANGLE 127
#define DEFAULT_REST_ANGLE 0

#define SERVICE_UUID        "41200547-118c-4580-926f-6380e3a521b5"
#define CHARATERISTIC_UUID  "2a75981f-0e72-4bb1-943b-5d568704b20a"

// Display instance
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
bool displayAvailable = false;

// BLE instances
BLEServer *pServer = NULL;
BLECharacteristic *pServoCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;

// =======================================================================
// Custom Bitmap Icons (1-bit XBM / monochrome)
// =======================================================================
// Heart Icon (11x10)
const unsigned char PROGMEM icon_heart[] = {
  0b01100110, 0b00000000,
  0b11111111, 0b00000000,
  0b11111111, 0b00000000,
  0b11111111, 0b00000000,
  0b01111110, 0b00000000,
  0b00111100, 0b00000000,
  0b00011000, 0b00000000,
  0b00000000, 0b00000000
};

// Bluetooth Icon (7x10)
const unsigned char PROGMEM icon_bluetooth[] = {
  0b00100000,
  0b01101000,
  0b00110000,
  0b00101000,
  0b00100000,
  0b00101000,
  0b00110000,
  0b01101000,
  0b00100000,
  0b00000000
};

// Pill Capsule Icon (14x8)
const unsigned char PROGMEM icon_pill[] = {
  0b00111111, 0b11000000,
  0b01111111, 0b11100000,
  0b11111001, 0b11110000,
  0b11111001, 0b11110000,
  0b11111001, 0b11110000,
  0b11111001, 0b11110000,
  0b01111111, 0b11100000,
  0b00111111, 0b11000000
};

// Checkmark Icon (12x10)
const unsigned char PROGMEM icon_check[] = {
  0b00000000, 0b00000000,
  0b00000000, 0b01000000,
  0b00000000, 0b11000000,
  0b00000001, 0b10000000,
  0b00000011, 0b00000000,
  0b10000110, 0b00000000,
  0b11001100, 0b00000000,
  0b01111000, 0b00000000,
  0b00110000, 0b00000000,
  0b00000000, 0b00000000
};

// =======================================================================
// Data Structures & Models
// =======================================================================
struct ChamberData {
  int id;                     // Bottle number (1, 2, 3)
  int pin;                    // Servo GPIO pin
  Servo servo;                // Servo instance
  int requests;               // Pending dispense queue
  bool active;                // Is currently moving
  String pillName;            // Medication name (e.g. "Aspirin 81mg")
  int stock;                  // Pills remaining in chamber
  int maxCapacity;            // Max chamber capacity
  int totalDispensed;         // Lifetime dispensed pills for this chamber
  int dispenseAngle;          // Actuation angle (e.g. 127 deg)
  int restAngle;              // Rest position (0 deg)
};

// Overall Telemetry & Session Stats
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
  0,          // totalDispensed
  0,          // lastDispenseMillis
  0,          // lastDispensedBottle
  "None",     // lastDispensedPill
  0,          // bootMillis
  98,         // batteryPercent
  4.12        // batteryVoltage
};

// =======================================================================
// Servo & Pill Management Class
// =======================================================================
class ServoHandler {
  public:
    ChamberData chambers[NUM_CHAMBERS];

    ServoHandler() {
      // Default configurations for 3 chambers
      chambers[0] = { 1, SERVO_PIN_1, Servo(), 0, false, "Aspirin 81mg",    28, 30, 0, DEFAULT_DISPENSE_ANGLE, DEFAULT_REST_ANGLE };
      chambers[1] = { 2, SERVO_PIN_2, Servo(), 0, false, "Lisinopril 10mg", 18, 30, 0, DEFAULT_DISPENSE_ANGLE, DEFAULT_REST_ANGLE };
      chambers[2] = { 3, SERVO_PIN_3, Servo(), 0, false, "Amoxicillin 500", 25, 30, 0, DEFAULT_DISPENSE_ANGLE, DEFAULT_REST_ANGLE };
    }

    void init() {
      Serial.println("[SERVOS] Initializing servos...");
      chambers[0].servo.attach(chambers[0].pin);
      chambers[1].servo.attach(chambers[1].pin);
      chambers[2].servo.attach(chambers[2].pin);

      for (int i = 0; i < NUM_CHAMBERS; i++) {
        chambers[i].requests = 0;
        chambers[i].active = false;
        chambers[i].servo.write(chambers[i].restAngle);
      }
      Serial.println("[SERVOS] Servos attached and reset to 0 degrees.");
    }

    void queueRequest(int bottleId) {
      if (bottleId >= 1 && bottleId <= NUM_CHAMBERS) {
        int idx = bottleId - 1;
        chambers[idx].requests++;
        Serial.printf("[DISPENSE] Queued request for Bottle #%d (%s). Pending: %d\n",
                      bottleId, chambers[idx].pillName.c_str(), chambers[idx].requests);
      }
    }

    bool hasPendingRequests() {
      for (int i = 0; i < NUM_CHAMBERS; i++) {
        if (chambers[i].requests > 0) return true;
      }
      return false;
    }

    void setPillName(int bottleId, String name) {
      if (bottleId >= 1 && bottleId <= NUM_CHAMBERS) {
        chambers[bottleId - 1].pillName = name;
        Serial.printf("[CONFIG] Set Bottle #%d medication name: %s\n", bottleId, name.c_str());
      }
    }

    void refill(int bottleId, int count) {
      if (bottleId >= 1 && bottleId <= NUM_CHAMBERS) {
        chambers[bottleId - 1].stock = count;
        Serial.printf("[REFILL] Refilled Bottle #%d to %d pills.\n", bottleId, count);
      }
    }
};

ServoHandler servoHandler;

// =======================================================================
// Display Manager & UI Engine
// =======================================================================
class DisplayManager {
  private:
    int idlePage = 0;
    unsigned long lastPageSwitch = 0;
    const unsigned long PAGE_DURATION_MS = 4000; // Rotate stats every 4s

  public:
    void init() {
      Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);

      // Attempt primary I2C address (0x3C)
      if (display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
        displayAvailable = true;
        Serial.println("[OLED] SSD1306 Display found at 0x3C!");
      } else if (display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS_ALT)) {
        displayAvailable = true;
        Serial.println("[OLED] SSD1306 Display found at 0x3D!");
      } else {
        displayAvailable = false;
        Serial.println("[OLED] WARNING: SSD1306 OLED not detected. Running headless.");
        return;
      }

      display.clearDisplay();
      display.setTextColor(SSD1306_WHITE);
      showSplashScreen();
    }

    // Helper: Draw standard status bar at top (y=0 to y=10)
    void drawHeader(const char* title, bool showBle = true) {
      display.setTextSize(1);
      display.setCursor(0, 1);
      display.print(title);

      if (showBle) {
        int bleX = SCREEN_WIDTH - 28;
        if (deviceConnected) {
          display.drawBitmap(bleX, 0, icon_bluetooth, 7, 10, SSD1306_WHITE);
          display.setCursor(bleX + 9, 1);
          display.print("ON");
        } else {
          display.setCursor(bleX, 1);
          display.print("[--]");
        }
      }

      display.drawLine(0, 11, SCREEN_WIDTH, 11, SSD1306_WHITE);
    }

    // Screen 0: Startup Splash Screen
    void showSplashScreen() {
      if (!displayAvailable) return;
      display.clearDisplay();

      // Draw Heartware Logo Box
      display.drawRoundRect(10, 8, 108, 48, 6, SSD1306_WHITE);
      display.drawBitmap(18, 16, icon_heart, 8, 8, SSD1306_WHITE);

      display.setTextSize(1);
      display.setCursor(32, 16);
      display.print("HEARTWARE");

      display.setCursor(20, 29);
      display.print("Smart Dispenser");

      display.setCursor(20, 40);
      display.print("v2.4 Online");

      display.display();
      delay(1400);
    }

    // Screen 1: Active Dispensing Animation Screen
    void showDispensing(int bottleId, const char* pillName, int step) {
      if (!displayAvailable) return;
      display.clearDisplay();

      // Inverted Top Banner for high urgency / visibility
      display.fillRect(0, 0, SCREEN_WIDTH, 12, SSD1306_WHITE);
      display.setTextColor(SSD1306_BLACK, SSD1306_WHITE);
      display.setTextSize(1);
      display.setCursor(14, 2);
      display.print("*** DISPENSING ***");
      display.setTextColor(SSD1306_WHITE);

      // Bottle Number Indicator
      display.setTextSize(1);
      display.setCursor(2, 17);
      display.printf("BOTTLE #%d", bottleId);

      // Pill Capsule Icon
      display.drawBitmap(72, 16, icon_pill, 14, 8, SSD1306_WHITE);

      // Pill Medication Name (Clean font)
      display.setCursor(2, 29);
      display.setTextSize(1);
      String truncated = String(pillName);
      if (truncated.length() > 18) truncated = truncated.substring(0, 18);
      display.print(truncated);

      // Dynamic animated progress bar & servo indicator
      int barY = 43;
      display.drawRoundRect(2, barY, 124, 9, 3, SSD1306_WHITE);
      int progressWidth = map(step, 0, 100, 2, 120);
      display.fillRect(4, barY + 2, progressWidth, 5, SSD1306_WHITE);

      // Footer status
      display.setCursor(2, 55);
      if (step < 50) {
        display.print("Actuating Servo...");
      } else {
        display.print("Dropping Pill -> Chute");
      }

      display.display();
    }

    // Screen 2: Dispense Complete Screen
    void showDispenseComplete(int bottleId, const char* pillName, int stockLeft) {
      if (!displayAvailable) return;
      display.clearDisplay();

      // Top Header
      drawHeader("DISPENSE SUCCESS", true);

      // Checkmark Icon & Confirmation
      display.drawBitmap(4, 18, icon_check, 12, 10, SSD1306_WHITE);
      display.setTextSize(1);
      display.setCursor(22, 19);
      display.printf("BOTTLE #%d OK", bottleId);

      display.setCursor(4, 33);
      display.print(pillName);

      display.setCursor(4, 44);
      display.printf("Remain: %d pills", stockLeft);

      // Patient reminder banner
      display.fillRect(0, 54, SCREEN_WIDTH, 10, SSD1306_WHITE);
      display.setTextColor(SSD1306_BLACK, SSD1306_WHITE);
      display.setCursor(8, 55);
      display.print(">> Take with water <<");
      display.setTextColor(SSD1306_WHITE);

      display.display();
    }

    // Screen 3A: Idle Dashboard - Chamber Inventory
    void showPageInventory() {
      drawHeader("HEARTWARE DISPENSER", true);

      // Display 3 rows for Chambers 1, 2, 3
      int yStart = 16;
      for (int i = 0; i < NUM_CHAMBERS; i++) {
        ChamberData &c = servoHandler.chambers[i];
        int y = yStart + (i * 15);

        // Bottle Tag
        display.setTextSize(1);
        display.setCursor(0, y);
        display.printf("[%d]", c.id);

        // Name (truncated to 10 chars for layout)
        display.setCursor(22, y);
        String name = c.pillName;
        if (name.length() > 9) name = name.substring(0, 9);
        display.print(name);

        // Pill count & Low stock indicator
        display.setCursor(84, y);
        display.printf("%2d left", c.stock);

        if (c.stock <= 4) {
          display.setCursor(122, y);
          display.print("!");
        }
      }

      display.setCursor(0, 56);
      display.print("Ready to dispense [1-3]");
    }

    // Screen 3B: Idle Dashboard - Dispensing Analytics & History
    void showPageAnalytics() {
      drawHeader("DISPENSE ANALYTICS", true);

      display.setTextSize(1);
      display.setCursor(0, 16);
      display.printf("Total Dispensed: %lu", stats.totalDispensed);

      // Per-Bottle breakdown
      display.setCursor(0, 28);
      display.printf("B1:%2d | B2:%2d | B3:%2d",
                     servoHandler.chambers[0].totalDispensed,
                     servoHandler.chambers[1].totalDispensed,
                     servoHandler.chambers[2].totalDispensed);

      // Last dispense info
      display.setCursor(0, 41);
      if (stats.lastDispensedBottle > 0) {
        unsigned long elapsedSec = (millis() - stats.lastDispenseMillis) / 1000;
        if (elapsedSec < 60) {
          display.printf("Last: B#%d (%lus ago)", stats.lastDispensedBottle, elapsedSec);
        } else {
          display.printf("Last: B#%d (%lum ago)", stats.lastDispensedBottle, elapsedSec / 60);
        }
      } else {
        display.print("Last: None yet");
      }

      display.setCursor(0, 54);
      display.print("Adherence: Optimal");
    }

    // Screen 3C: Idle Dashboard - Hardware & Telemetry Stats
    void showPageHardware() {
      drawHeader("SYSTEM TELEMETRY", true);

      // Free Heap RAM
      uint32_t freeHeap = ESP.getFreeHeap() / 1024;
      display.setTextSize(1);
      display.setCursor(0, 16);
      display.printf("Free RAM:  %d KB", freeHeap);

      // System Uptime (Formatted hh:mm:ss)
      unsigned long uptimeSec = millis() / 1000;
      unsigned int h = uptimeSec / 3600;
      unsigned int m = (uptimeSec % 3600) / 60;
      unsigned int s = uptimeSec % 60;
      display.setCursor(0, 28);
      display.printf("Uptime:    %02d:%02d:%02d", h, m, s);

      // Battery & Voltage
      display.setCursor(0, 40);
      display.printf("Battery:   %d%% (%.2fV)", stats.batteryPercent, stats.batteryVoltage);

      // BLE Status
      display.setCursor(0, 52);
      if (deviceConnected) {
        display.print("BLE Link:  CONNECTED");
      } else {
        display.print("BLE Link:  ADVERTISING");
      }
    }

    // Periodically cycle between idle telemetry pages
    void updateIdleLoop() {
      if (!displayAvailable) return;

      unsigned long now = millis();
      if (now - lastPageSwitch >= PAGE_DURATION_MS) {
        lastPageSwitch = now;
        idlePage = (idlePage + 1) % 3;
      }

      display.clearDisplay();
      switch (idlePage) {
        case 0: showPageInventory(); break;
        case 1: showPageAnalytics(); break;
        case 2: showPageHardware(); break;
      }
      display.display();
    }
};

DisplayManager displayManager;

// =======================================================================
// Dispense Execution Engine
// =======================================================================
void executeDispenseCycle() {
  for (int i = 0; i < NUM_CHAMBERS; i++) {
    ChamberData &chamber = servoHandler.chambers[i];

    while (chamber.requests > 0) {
      Serial.printf("[CYCLE] Starting dispense for Bottle #%d (%s)...\n",
                    chamber.id, chamber.pillName.c_str());

      chamber.active = true;

      // Phase 1: Display Dispensing Animation & Rotate Servo to 127°
      displayManager.showDispensing(chamber.id, chamber.pillName.c_str(), 25);
      chamber.servo.write(chamber.dispenseAngle);

      delay(250);
      displayManager.showDispensing(chamber.id, chamber.pillName.c_str(), 75);
      delay(250);

      // Phase 2: Return Servo to Rest (0°)
      chamber.servo.write(chamber.restAngle);
      displayManager.showDispensing(chamber.id, chamber.pillName.c_str(), 100);
      delay(150);

      // Phase 3: Update Chamber Stock & Telemetry Stats
      if (chamber.stock > 0) chamber.stock--;
      chamber.totalDispensed++;
      chamber.requests--;
      chamber.active = false;

      stats.totalDispensed++;
      stats.lastDispenseMillis = millis();
      stats.lastDispensedBottle = chamber.id;
      stats.lastDispensedPill = chamber.pillName;

      Serial.printf("[CYCLE] Bottle #%d completed. Stock remaining: %d pills.\n",
                    chamber.id, chamber.stock);

      // Phase 4: Show Dispense Complete Screen
      displayManager.showDispenseComplete(chamber.id, chamber.pillName.c_str(), chamber.stock);

      // Notify BLE Client with confirmation string
      if (deviceConnected && pServoCharacteristic != NULL) {
        char notifyBuf[64];
        snprintf(notifyBuf, sizeof(notifyBuf), "DISPENSED:BOTTLE_%d:REMAIN_%d",
                 chamber.id, chamber.stock);
        pServoCharacteristic->setValue(notifyBuf);
        pServoCharacteristic->notify();
      }

      // Display hold for patient to view
      delay(1200);

      // If chained request remains, brief pause between pills
      if (chamber.requests > 0 || servoHandler.hasPendingRequests()) {
        delay(300);
      }
    }
  }
}

// =======================================================================
// BLE Server & Characteristic Callbacks
// =======================================================================
class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *pServer) {
    deviceConnected = true;
    Serial.println("[BLE] Device connected to Heartware BLE Server!");
  }

  void onDisconnect(BLEServer *pServer) {
    deviceConnected = false;
    Serial.println("[BLE] Device disconnected. Restarting advertising...");
    pServer->getAdvertising()->start();
  }
};

class ServoCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    String value = pCharacteristic->getValue();
    Serial.print("[BLE RX] Received payload: ");
    Serial.println(value);

    // Command: PING -> reply PONG
    if (value == "PING") {
      pCharacteristic->setValue("PONG");
      pCharacteristic->notify();
      return;
    }

    // Command: STATUS -> return telemetry string
    if (value == "STATUS") {
      char statusBuf[128];
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

    // Command: NAME:<id>:<name> (e.g. "NAME:1:Tylenol")
    if (value.startsWith("NAME:")) {
      int firstColon = value.indexOf(':');
      int secondColon = value.indexOf(':', firstColon + 1);
      if (secondColon > 0) {
        int id = value.substring(firstColon + 1, secondColon).toInt();
        String medName = value.substring(secondColon + 1);
        servoHandler.setPillName(id, medName);
        pCharacteristic->setValue("ACK:NAME_UPDATED");
        pCharacteristic->notify();
        return;
      }
    }

    // Command: REFILL:<id>:<count> (e.g. "REFILL:1:30")
    if (value.startsWith("REFILL:")) {
      int firstColon = value.indexOf(':');
      int secondColon = value.indexOf(':', firstColon + 1);
      if (secondColon > 0) {
        int id = value.substring(firstColon + 1, secondColon).toInt();
        int count = value.substring(secondColon + 1).toInt();
        servoHandler.refill(id, count);
        pCharacteristic->setValue("ACK:REFILLED");
        pCharacteristic->notify();
        return;
      }
    }

    // Single or Chained Dispense Request (e.g. "1", "2", "3", "123", "11")
    int queuedCount = 0;
    for (size_t i = 0; i < value.length(); i++) {
      char c = value[i];
      if (c >= '1' && c <= '3') {
        int bottleId = c - '0';
        servoHandler.queueRequest(bottleId);
        queuedCount++;
      }
    }

    // Send ACK notification back to PWA client
    if (queuedCount > 0) {
      String ackMsg = "ACK:" + value;
      pCharacteristic->setValue(ackMsg.c_str());
      pCharacteristic->notify();
      Serial.printf("[BLE TX] Notified client: %s\n", ackMsg.c_str());
    }
  }
};

// =======================================================================
// Arduino Setup & Main Loop
// =======================================================================
void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\n==========================================");
  Serial.println("  Heartware ESP32 Medication Dispenser   ");
  Serial.println("==========================================");

  // Initialize OLED Display
  displayManager.init();

  // Initialize Servos
  servoHandler.init();

  // Initialize BLE Server
  Serial.println("[BLE] Starting BLE Subsystem...");
  BLEDevice::init("ESP32_Test");

  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());
  BLEService *pService = pServer->createService(SERVICE_UUID);

  // Characteristic with Read, Write, and Notify properties
  pServoCharacteristic = pService->createCharacteristic(
    CHARATERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ |
    BLECharacteristic::PROPERTY_WRITE |
    BLECharacteristic::PROPERTY_NOTIFY
  );

  // Initial telemetry read value
  pServoCharacteristic->setValue("HEARTWARE:READY");
  pServoCharacteristic->addDescriptor(new BLE2902());
  pServoCharacteristic->setCallbacks(new ServoCallbacks());

  pService->start();

  // Setup advertising with service UUID for fast PWA discovery
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06); // Helper parameters for iPhone/Chrome BLE
  pAdvertising->setMaxPreferred(0x12);
  pServer->getAdvertising()->start();

  stats.bootMillis = millis();
  Serial.println("[INIT] Heartware ESP32 Setup Complete! Ready for commands.");
}

void loop() {
  // If there are pending dispense requests, trigger dispensing cycle
  if (servoHandler.hasPendingRequests()) {
    executeDispenseCycle();
  } else {
    // Otherwise update rotating idle telemetry dashboard
    displayManager.updateIdleLoop();
  }

  // Handle BLE disconnect recovery
  if (!deviceConnected && oldDeviceConnected) {
    delay(500); // Give the bluetooth stack the chance to get things ready
    pServer->startAdvertising(); // Restart advertising
    Serial.println("[BLE] Disconnected -> Restarted advertising");
    oldDeviceConnected = deviceConnected;
  }
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }

  delay(50);
}
