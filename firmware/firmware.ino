#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

BLEServer *pServer = NULL;
BLECharacteristic *pServoCharacteristic = NULL;
bool deviceConnected = false;
#define SERVICE_UUID "41200547-118c-4580-926f-6380e3a521b5"
#define CHARATERISTIC_UUID "2a75981f-0e72-4bb1-943b-5d568704b20a"

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *pServer) {
    deviceConnected = true;
    Serial.println("connectsd");
  }

  void onDisconnect(BLEServer *pServer) {
    deviceConnected = false;
    Serial.println("disonnected");
    pServer->getAdvertising()->start();
  }
};

class ServoCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    Serial.println("recieved new value");
    String value = pCharacteristic->getValue();
    Serial.println(value);
  }
};


void setup() {
  // put your setup code here, to run once:
  Serial.begin(115200);
  Serial.println("starting BLE");

  BLEDevice::init("ESP32_Test");

  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());
  BLEService *pService = pServer->createService(SERVICE_UUID);
  
  pServoCharacteristic = 
    pService->createCharacteristic(CHARATERISTIC_UUID,  BLECharacteristic::PROPERTY_WRITE);

  pServoCharacteristic->setValue("test value");
  
   
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  /*pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);  // functions that help with iPhone connections issue
  pAdvertising->setMaxPreferred(0x12);*/
  //BLEDevice::startAdvertising();
  pServoCharacteristic->setCallbacks(new ServoCallbacks());

  pService->start();
  pServer->getAdvertising()->start();

  Serial.println("init done");
}

void loop() {
  // put your main code here, to run repeatedly:
  delay(1000);
}
