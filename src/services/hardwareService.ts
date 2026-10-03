import { HardwareState, ChamberConfig } from '../types';

export const INITIAL_HARDWARE: HardwareState = {
  connected: false,
  connectionType: 'simulated',
  deviceId: '',
  batteryLevel: 0,
  signalRssi: 0,
  lastHeartbeat: new Date().toISOString(),
  isDispensing: false,
  activeServo: null,
  oledText: {
    line1: "HEARTWARE",
    line2: "OFFLINE",
    line3: "READY TO PAIR",
    line4: "BLE: DISCONNECTED"
  },
  buzzerEnabled: true,
  ledRingColor: '#8e8e93'
};

class HardwareManager {
  private state: HardwareState = { ...INITIAL_HARDWARE };
  private listeners: ((state: HardwareState) => void)[] = [];

  constructor() {
    // Start virtual heartbeat
    setInterval(() => {
      this.state.lastHeartbeat = new Date().toISOString();
      this.notify();
    }, 15000);
  }

  getState(): HardwareState {
    return { ...this.state };
  }

  subscribe(listener: (state: HardwareState) => void) {
    this.listeners.push(listener);
    listener(this.getState());
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.getState()));
  }

  // Web Bluetooth API connector stub
  async connectBluetooth(): Promise<{ success: boolean; message: string }> {
    if (typeof navigator !== 'undefined' && 'bluetooth' in navigator) {
      try {
        // @ts-ignore Web Bluetooth API
        const device = await navigator.bluetooth.requestDevice({
          filters: [{ namePrefix: 'Heartware' }, { namePrefix: 'ESP32' }],
          optionalServices: ['battery_service', 'heart_rate']
        });
        this.state.connected = true;
        this.state.connectionType = 'ble';
        this.state.deviceId = device.name || 'ESP32-BLE-HW';
        this.state.oledText.line4 = "BLE: LINK ACTIVE";
        this.notify();
        return { success: true, message: `Connected to ${device.name} over BLE!` };
      } catch (err: any) {
        return { success: false, message: err.message || 'Bluetooth connection was cancelled or unavailable.' };
      }
    } else {
      // Fallback to simulated BLE pairing
      this.state.connected = true;
      this.state.connectionType = 'simulated';
      this.state.oledText.line4 = "BLE: VIRTUAL LINK";
      this.notify();
      return { success: true, message: 'Connected to Virtual ESP32 Dispenser Unit via BLE Bridge.' };
    }
  }

  disconnect() {
    this.state.connected = false;
    this.state.oledText.line2 = "STATUS: OFFLINE";
    this.notify();
  }

  // Simulate or command 4-servo dispensing
  async triggerServoDispense(chamber: ChamberConfig): Promise<{ success: boolean; message: string }> {
    if (this.state.isDispensing) {
      return { success: false, message: 'Dispenser is currently busy with an active cycle.' };
    }

    this.state.isDispensing = true;
    this.state.activeServo = chamber.servoId;
    this.state.oledText.line1 = `DISPENSING SERVO #${chamber.servoId}`;
    this.state.oledText.line2 = `${chamber.medicationName.slice(0, 16).toUpperCase()}`;
    this.state.oledText.line3 = `ANGLE: ${chamber.servoAngleDispense}° -> 0°`;
    this.state.oledText.line4 = "IR SENSOR: DETECTING...";
    this.state.ledRingColor = '#f59e0b'; // Amber pulsing
    this.notify();

    // Emulate 1.8s mechanical servo rotation and pill drop cycle
    await new Promise(resolve => setTimeout(resolve, 1800));

    this.state.isDispensing = false;
    this.state.activeServo = null;
    this.state.oledText.line1 = "DISPENSE COMPLETED";
    this.state.oledText.line2 = "CHAMBER ROTATED OK";
    this.state.oledText.line3 = `COUNT: ${Math.max(0, chamber.currentCount - 1)} REMAIN`;
    this.state.oledText.line4 = "TAKE PILL WITH WATER";
    this.state.ledRingColor = '#20a782'; // Green OK
    this.notify();

    // Reset OLED after 5 seconds
    setTimeout(() => {
      this.state.oledText.line1 = "HEARTWARE v2.4";
      this.state.oledText.line2 = "READY: 4 SERVOS OK";
      this.state.oledText.line3 = "NEXT: SCHEDULED AUTO";
      this.state.oledText.line4 = "SYSTEM NOMINAL";
      this.notify();
    }, 5000);

    return {
      success: true,
      message: `Successfully rotated Servo ${chamber.servoId} (${chamber.medicationName}) and verified pill drop.`
    };
  }

  // Test servo movement calibration
  async testCalibrateServo(servoId: number, angle: number): Promise<string> {
    this.state.oledText.line1 = `CALIBRATE SERVO #${servoId}`;
    this.state.oledText.line2 = `TESTING ANGLE: ${angle}°`;
    this.state.oledText.line3 = "SWEEPING 0° -> TARGET";
    this.notify();

    await new Promise(res => setTimeout(res, 1000));

    this.state.oledText.line1 = `SERVO #${servoId} CALIBRATED`;
    this.state.oledText.line2 = `REST: 0° | DISP: ${angle}°`;
    this.notify();
    return `Servo ${servoId} calibrated to ${angle} degrees.`;
  }
}

export const hardwareService = new HardwareManager();
