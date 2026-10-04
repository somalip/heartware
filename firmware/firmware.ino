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
    PillData pillData[3];
    Servo s1;
    Servo s2;
    Servo s3;

    ServoHandler() {
    }

    void init() {
      for(int i = 0; i < 3; i++) {
        this->pillData[i].requests = 0;
        //this->pillData[i].servo.attach(i+5);
        this->pillData[i].active = false;
        s1.attach(5);
        s2.attach(4);
        s3.attach(3);
        Serial.println("init servos");
      }
    }

    void sendRequest(int pill) {
      Serial.printf("got req %d \n",pill);
      pillData[pill-1].requests += 1;
    }

    void dispense() {
      for(int i = 0; i < 3; i++) {
        if(!this->pillData[i].active && this->pillData[i].requests > 0) {
          this->pillData[i].active = true;
          //this->pillData[i].servo.write(127);
          switch(i) {
            case 0:
              Serial.println("1");
              s1.write(127);break;
            case 1:
              Serial.println("2");
              s2.write(127);break;
            case 2:
              Serial.println("3");
              s3.write(127);break;
          }
          //s1.write(90);
        }
      }
      delay(100);
      for(int i = 0; i < 3; i++) {
        if(this->pillData[i].active && this->pillData[i].requests > 0) {
          this->pillData[i].active = false;
          this->pillData[i].requests-=1;
          //s1.write(0);
          switch(i) {
            case 0:
              s1.write(0);break;
            case 1:
              s2.write(0);break;
            case 2:
              s3.write(0);break;
          }
        }
      }
    }

    void test() {
      s1.write(90);
    }

    bool requestWaiting() {
      return (this->pillData[0].requests > 0 || this->pillData[1].requests > 0 || this->pillData[2].requests > 0);
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
  

  servoHandler.init();
  
  //Serial.println(test.attached());
}

void loop() {

   if(true/*servoHandler.requestWaiting()*/) {

    Serial.println("dispensing");
    servoHandler.dispense();
  }
  delay(1500);
}
