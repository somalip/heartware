#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

BLEServer *pServer = NULL;
BLECharacteristic *pServoCharacteristic = NULL;
bool deviceConnected = false;

// Heartware BLE UUIDs matching the PWA Web Bluetooth client
#define SERVICE_UUID "41200547-118c-4580-926f-6380e3a521b5"
#define CHARATERISTIC_UUID "2a75981f-0e72-4bb1-943b-5d568704b20a"

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *pServer) {
    deviceConnected = true;
    Serial.println("Device connected to Heartware BLE Server");
  }

  void onDisconnect(BLEServer *pServer) {
    deviceConnected = false;
    Serial.println("Device disconnected. Restarting BLE advertising...");
    pServer->getAdvertising()->start();
  }
};

// Helper to actuate individual bottle dispenser (Bottle 1, Bottle 2, Bottle 3)
void dispenseBottle(int bottleNum) {
  Serial.print("Dispensing 1 pill from Bottle ");
  Serial.println(bottleNum);
  // Example: Actuate servo or motor for bottleNum:
  // if (bottleNum == 1) servo1.write(90); ...
}

class ServoCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    Serial.println("Received new value from Heartware App:");
    String value = pCharacteristic->getValue();
    Serial.println(value);

    // Heartware Protocol:
    // Single bottle: "1", "2", or "3"
    // Chained multi-pill commands: concatenated digits, e.g. "123", "11", "213"
    int pillsDispensed = 0;
    for (int i = 0; i < value.length(); i++) {
      char c = value[i];
      if (c == '1' || c == '2' || c == '3') {
        int bottleId = c - '0';
        dispenseBottle(bottleId);
        pillsDispensed++;
        // Short mechanical delay between chained drops if multiple pills requested
        if (i < value.length() - 1) {
          delay(600);
        }
      }
    }

    // Echo back an ACK notification to the PWA client
    String ackMsg = "ACK:" + value;
    pCharacteristic->setValue(ackMsg.c_str());
    pCharacteristic->notify();
  }
};

void setup() {
  Serial.begin(115200);
  Serial.println("Starting Heartware ESP32 BLE Server...");

  // Initialize BLE device with advertised name
  BLEDevice::init("ESP32_Test");

  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());
  BLEService *pService = pServer->createService(SERVICE_UUID);
  
  // Enable READ, WRITE, and NOTIFY for bidirectional PWA communication
  pServoCharacteristic = pService->createCharacteristic(
    CHARATERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ |
    BLECharacteristic::PROPERTY_WRITE |
    BLECharacteristic::PROPERTY_NOTIFY
  );

  // Initial read value when client queries characteristic
  pServoCharacteristic->setValue("HEARTWARE:READY");
  
  // Add BLE2902 descriptor to allow client notification subscriptions
  pServoCharacteristic->addDescriptor(new BLE2902());
  pServoCharacteristic->setCallbacks(new ServoCallbacks());

  pService->start();

  // Configure advertising with service UUID for fast PWA scanning
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06); // Parameters that help with iOS/Chrome BLE connections
  pAdvertising->setMaxPreferred(0x12);
  pServer->getAdvertising()->start();

  Serial.println("Heartware ESP32 BLE ready and advertising!");
}

void loop() {
  // Can periodically send telemetry notifications if device is connected
  delay(1000);
}