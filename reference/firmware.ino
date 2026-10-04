#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ESP32Servo.h>

BLEServer *pServer = NULL;
BLECharacteristic *pServoCharacteristic = NULL;
bool deviceConnected = false;


#define SERVICE_UUID "41200547-118c-4580-926f-6380e3a521b5"
#define CHARATERISTIC_UUID "2a75981f-0e72-4bb1-943b-5d568704b20a"

struct PillData {
  int requests;
  Servo servo;
  bool active;
};

class ServoHandler {
  public:
    PillData pillData[1];
    Servo s1;

    ServoHandler() {
      this->pillData[0].requests = 0;
      this->pillData[0].active = false;
      s1.attach(5);
      Serial.println("init servo");
    }

    void init() {
      this->pillData[0].requests = 0;
      this->pillData[0].active = false;
      s1.attach(5);
      Serial.println("init servo");
    }

    void sendRequest(int pill) {
      this->pillData[0].requests += 1;
    }

    void dispense() {
      if(!this->pillData[0].active && this->pillData[0].requests > 0) {
        this->pillData[0].active = true;
        s1.write(90);
      }
      delay(100);
      if(this->pillData[0].active && this->pillData[0].requests > 0) {
        this->pillData[0].active = false;
        this->pillData[0].requests -= 1;
        s1.write(0);
      }
    }

    void test() {
      s1.write(90);
    }

    bool requestWaiting() {
      return (this->pillData[0].requests > 0);
    }
};

ServoHandler servoHandler;

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
    for (char i : value) {
      int data = i - '0';
      servoHandler.sendRequest(data);
    }
    //ServoHandler::requests+=1;
    Serial.println(value);
  }
};



Servo test;

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
  //BLEDevice::startAdvertising();
  pServoCharacteristic->setCallbacks(new ServoCallbacks());

  pService->start();
  pServer->getAdvertising()->start();

  Serial.println("init done");
  
  test.attach(4);

  servoHandler.init();
  
  //Serial.println(test.attached());
}

void loop() {

  if(servoHandler.requestWaiting()) {

    Serial.println("dispensing");
    servoHandler.dispense();
  }
  delay(1000);
}
