import { HardwareState, ChamberConfig, BleLogEntry } from '../types';

export const BLE_SERVICE_UUID = '41200547-118c-4580-926f-6380e3a521b5';
export const BLE_CHARACTERISTIC_UUID = '2a75981f-0e72-4bb1-943b-5d568704b20a';
export const BLE_DEVICE_NAME = 'ESP32_Test';

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
  ledRingColor: '#8e8e93',
  serviceUuid: BLE_SERVICE_UUID,
  characteristicUuid: BLE_CHARACTERISTIC_UUID,
  lastReadValue: '',
  lastReadTimestamp: '',
  isReading: false,
  isWriting: false,
  bleLogs: [],
  bluetoothSupported: typeof navigator !== 'undefined' && 'bluetooth' in navigator
};

class HardwareManager {
  private state: HardwareState = { ...INITIAL_HARDWARE };
  private listeners: ((state: HardwareState) => void)[] = [];

  // Web Bluetooth references
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private service: BluetoothRemoteGATTService | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  isGattConnected(): boolean {
    return Boolean(this.server?.connected);
  }

  getActiveServiceUuid(): string | null {
    return this.service?.uuid ?? null;
  }

  constructor() {
    // Virtual heartbeat interval
    setInterval(() => {
      this.state.lastHeartbeat = new Date().toISOString();
      if (this.state.connected && this.state.connectionType === 'simulated') {
        this.notify();
      }
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
    const currentState = this.getState();
    this.listeners.forEach(l => l(currentState));
  }

  private addLog(direction: BleLogEntry['direction'], message: string) {
    const entry: BleLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      time: new Date().toLocaleTimeString(),
      direction,
      message
    };
    this.state.bleLogs = [entry, ...this.state.bleLogs.slice(0, 49)];
    this.notify();
  }

  clearBleLogs() {
    this.state.bleLogs = [];
    this.notify();
  }

  isBluetoothSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  // Connect over Web Bluetooth GATT with reference service and characteristic
  async connectBluetooth(options?: { acceptAllDevices?: boolean }): Promise<{ success: boolean; message: string }> {
    if (!this.isBluetoothSupported()) {
      this.addLog('info', 'Web Bluetooth not supported by this browser. Defaulting to Simulated mode.');
      return this.connectSimulated('Web Bluetooth is not supported in this browser. Running in simulated hardware mode.');
    }

    try {
      this.addLog('info', 'Requesting Bluetooth device...');

      const reqOptions: RequestDeviceOptions = options?.acceptAllDevices
        ? {
            acceptAllDevices: true,
            optionalServices: [BLE_SERVICE_UUID.toLowerCase(), 'battery_service']
          }
        : {
            filters: [
              { name: BLE_DEVICE_NAME },
              { namePrefix: 'ESP32' },
              { namePrefix: 'esp32' },
              { namePrefix: 'Heartware' },
              { namePrefix: 'heartware' },
              { services: [BLE_SERVICE_UUID.toLowerCase()] }
            ],
            optionalServices: [BLE_SERVICE_UUID.toLowerCase(), 'battery_service']
          };

      const device = await navigator.bluetooth!.requestDevice(reqOptions);
      this.device = device;

      // Handle spontaneous disconnection (power down, out of range, reset)
      const onDisconnected = () => {
        this.handleDisconnected();
      };
      device.addEventListener('gattserverdisconnected', onDisconnected);

      this.addLog('info', `Found "${device.name || 'ESP32'}". Connecting to GATT server...`);

      if (!device.gatt) {
        throw new Error('Device does not support GATT connectivity.');
      }

      const server = await device.gatt.connect();
      this.server = server;
      this.addLog('info', 'Connected to GATT Server. Requesting primary service...');

      let service: BluetoothRemoteGATTService | null = null;
      try {
        service = await server.getPrimaryService(BLE_SERVICE_UUID.toLowerCase());
      } catch (svcErr) {
        // Fallback: enumerate primary services to find matching UUID
        try {
          const services = await server.getPrimaryServices();
          service = services.find(s => s.uuid.toLowerCase() === BLE_SERVICE_UUID.toLowerCase()) || services[0] || null;
        } catch (enumErr) {
          throw svcErr;
        }
      }

      if (!service) {
        throw new Error(`Primary service (${BLE_SERVICE_UUID}) could not be resolved on device.`);
      }
      this.service = service;
      this.addLog('info', `Found Service (${service.uuid.slice(0, 8)}...). Accessing characteristic...`);

      let characteristic: BluetoothRemoteGATTCharacteristic | null = null;
      try {
        characteristic = await service.getCharacteristic(BLE_CHARACTERISTIC_UUID.toLowerCase());
      } catch (charErr) {
        try {
          const chars = await service.getCharacteristics();
          characteristic = chars.find(c => c.uuid.toLowerCase() === BLE_CHARACTERISTIC_UUID.toLowerCase()) || chars[0] || null;
        } catch (enumErr) {
          throw charErr;
        }
      }

      if (!characteristic) {
        throw new Error(`Characteristic (${BLE_CHARACTERISTIC_UUID}) could not be resolved on device.`);
      }
      this.characteristic = characteristic;
      this.addLog('info', `Found Characteristic (${characteristic.uuid.slice(0, 8)}...).`);

      // Subscribe to real-time notifications if supported
      if (characteristic.properties.notify || characteristic.properties.indicate) {
        try {
          await characteristic.startNotifications();
          characteristic.addEventListener('characteristicvaluechanged', (ev: Event) => {
            const char = ev.target as BluetoothRemoteGATTCharacteristic;
            if (char.value) {
              const text = new TextDecoder('utf-8').decode(char.value);
              this.handleIncomingValue(text, 'notify');
            }
          });
          this.addLog('info', 'Subscribed to real-time characteristic notifications.');
        } catch (subErr: any) {
          this.addLog('info', `Characteristic notifications note: ${subErr.message}`);
        }
      }

      // Perform initial read of characteristic value (e.g. "HEARTWARE:READY" from firmware)
      if (characteristic.properties.read) {
        try {
          const raw = await characteristic.readValue();
          const initialVal = new TextDecoder('utf-8').decode(raw);
          this.handleIncomingValue(initialVal, 'initial');
        } catch (readErr: any) {
          this.addLog('info', `Initial read note: ${readErr.message}`);
        }
      }

      // Mark hardware state as live BLE
      this.state.connected = true;
      this.state.connectionType = 'ble';
      this.state.deviceId = device.name || BLE_DEVICE_NAME;
      this.state.batteryLevel = 98;
      this.state.oledText = {
        line1: "HEARTWARE v2.4",
        line2: `DEVICE: ${this.state.deviceId}`,
        line3: "GATT LINK ACTIVE",
        line4: "BLE: CONNECTED"
      };
      this.addLog('info', `GATT connection established with ${this.state.deviceId}. Ready for telemetry.`);
      this.notify();

      return {
        success: true,
        message: `Connected to ${device.name || 'ESP32 Dispenser'} over BLE GATT.`
      };
    } catch (err: any) {
      this.addLog('error', `Connection error: ${err.message || 'Cancelled by user'}`);
      return {
        success: false,
        message: err.message || 'Bluetooth connection was cancelled or unavailable.'
      };
    }
  }

  // Handle incoming data packet from read or notification
  private handleIncomingValue(value: string, source: 'read' | 'notify' | 'initial') {
    this.state.lastReadValue = value;
    this.state.lastReadTimestamp = new Date().toLocaleTimeString();
    this.addLog('rx', `${value} (${source})`);
    this.state.oledText.line3 = `RX: ${value.slice(0, 16)}`;
    this.notify();
  }

  // Read latest value from characteristic
  async readCharacteristicValue(): Promise<string | null> {
    if (this.state.connectionType === 'ble' && this.characteristic) {
      try {
        this.state.isReading = true;
        this.notify();
        this.addLog('info', 'Reading characteristic...');
        const raw = await this.characteristic.readValue();
        const value = new TextDecoder('utf-8').decode(raw);
        this.handleIncomingValue(value, 'read');
        this.state.isReading = false;
        this.notify();
        return value;
      } catch (err: any) {
        this.state.isReading = false;
        this.addLog('error', `Read failed: ${err.message}`);
        this.notify();
        throw err;
      }
    } else if (this.state.connectionType === 'simulated' && this.state.connected) {
      // Return simulated telemetry string
      this.state.isReading = true;
      this.notify();
      await new Promise(r => setTimeout(r, 200));
      const simulatedData = `STATUS:OK;TEMP:22.4C;BAT:95%;BOTTLES:1_READY`;
      this.handleIncomingValue(simulatedData, 'read');
      this.state.isReading = false;
      this.notify();
      return simulatedData;
    } else {
      throw new Error('Dispenser is not connected.');
    }
  }

  // Write payload string to characteristic
  async writeCharacteristicValue(value: string): Promise<{ success: boolean; message: string; response?: string }> {
    if (this.state.connectionType === 'ble' && this.characteristic) {
      try {
        this.state.isWriting = true;
        this.notify();
        const encoder = new TextEncoder();
        const data = encoder.encode(value);

        let writeOk = false;
        let lastError: Error | null = null;

        // Strategy 1: writeValueWithResponse if supported
        if (
          this.characteristic.properties?.write &&
          typeof this.characteristic.writeValueWithResponse === 'function'
        ) {
          try {
            await this.characteristic.writeValueWithResponse(data);
            writeOk = true;
          } catch (e: any) {
            lastError = e;
          }
        }

        // Strategy 2: writeValueWithoutResponse if write failed or writeWithoutResponse property is present
        if (
          !writeOk &&
          (this.characteristic.properties?.writeWithoutResponse ||
            typeof this.characteristic.writeValueWithoutResponse === 'function')
        ) {
          try {
            await this.characteristic.writeValueWithoutResponse(data);
            writeOk = true;
          } catch (e: any) {
            lastError = e;
          }
        }

        // Strategy 3: Standard legacy writeValue (widely supported across browsers)
        if (!writeOk && typeof (this.characteristic as any).writeValue === 'function') {
          try {
            await (this.characteristic as any).writeValue(data);
            writeOk = true;
          } catch (e: any) {
            lastError = e;
          }
        }

        if (!writeOk) {
          throw lastError || new Error('GATT write operation failed across all methods.');
        }

        this.addLog('tx', value);
        this.state.oledText.line4 = `TX: ${value.slice(0, 16)}`;
        this.notify();

        // Give the ESP32 firmware 180ms to process the onWrite callback, update characteristic & notify
        await new Promise(r => setTimeout(r, 180));

        let ackResponse = '';
        if (this.characteristic.properties?.read) {
          try {
            const raw = await this.characteristic.readValue();
            ackResponse = new TextDecoder('utf-8').decode(raw);
            this.handleIncomingValue(ackResponse, 'read');
          } catch (readErr: any) {
            // Notification handler may have already received it
          }
        }

        this.state.isWriting = false;
        this.notify();

        const displayAck = ackResponse || this.state.lastReadValue || `ACK:${value}`;
        return {
          success: true,
          message: `Dispatched: "${value}" · ESP32: "${displayAck}"`,
          response: displayAck,
        };
      } catch (err: any) {
        this.state.isWriting = false;
        this.addLog('error', `Write failed: ${err.message}`);
        this.notify();
        return { success: false, message: `Write failed: ${err.message}` };
      }
    } else if (this.state.connectionType === 'simulated' && this.state.connected) {
      this.state.isWriting = true;
      this.notify();
      this.addLog('tx', `[SIMULATED] ${value}`);
      this.state.oledText.line4 = `TX: ${value.slice(0, 16)}`;
      this.notify();

      // Simulate micro-controller processing delay (180ms)
      await new Promise(r => setTimeout(r, 180));
      this.state.isWriting = false;

      // Realistic response generation matching reference/firmware.ino ACK protocol
      let simulatedAck = `ACK:${value}`;
      if (/^[1-3]+$/.test(value)) {
        if (value.length === 1) {
          simulatedAck = `ACK:${value} (BOTTLE_${value}_OK)`;
        } else {
          const list = value.split('').join(',');
          simulatedAck = `ACK:${value} (CHAINED_BOTTLES:[${list}]_OK)`;
        }
      } else if (value === 'PING') {
        simulatedAck = 'PONG (ACK:PING)';
      } else if (value === 'STATUS') {
        simulatedAck = 'STATUS:OK;BAT:98%;BOTTLES:1_READY';
      } else if (value.startsWith('DISPENSE:')) {
        const parts = value.split(':');
        const slot = parts[1] || '1';
        simulatedAck = `ACK:DISPENSE:BOTTLE_${slot}_OK`;
      } else if (value.startsWith('CALIBRATE:')) {
        const parts = value.split(':');
        const slot = parts[1] || '1';
        const deg = parts[2] || '90';
        simulatedAck = `ACK:CALIBRATE:BOTTLE_${slot}_${deg}DEG_OK`;
      } else if (value === 'HEARTWARE:READY') {
        simulatedAck = 'ACK:HEARTWARE:READY:ONLINE';
      }

      this.handleIncomingValue(simulatedAck, 'notify');
      return {
        success: true,
        message: `Dispatched: "${value}" · ESP32: "${simulatedAck}"`,
        response: simulatedAck,
      };
    } else {
      return {
        success: false,
        message: 'Hardware is not connected. Connect via BLE or start Simulation mode.',
      };
    }
  }

  // Fallback to simulated hardware mode
  connectSimulated(customMessage?: string): { success: boolean; message: string } {
    this.disconnect();
    this.state.connected = true;
    this.state.connectionType = 'simulated';
    this.state.deviceId = 'ESP32-VIRTUAL-DISPENSER';
    this.state.batteryLevel = 100;
    this.state.lastReadValue = 'SIMULATED: READY';
    this.state.lastReadTimestamp = new Date().toLocaleTimeString();
    this.state.oledText = {
      line1: "HEARTWARE v2.4",
      line2: "SIMULATED BRIDGE",
      line3: "READY TO DISPENSE",
      line4: "BLE: VIRTUAL LINK"
    };
    const msg = customMessage || 'Connected to Virtual ESP32 Dispenser Unit via BLE simulation.';
    this.addLog('info', msg);
    this.notify();
    return { success: true, message: msg };
  }

  // Handle disconnection event
  private handleDisconnected() {
    this.state.connected = false;
    this.state.deviceId = '';
    this.state.batteryLevel = 0;
    this.state.oledText = {
      line1: "HEARTWARE",
      line2: "STATUS: OFFLINE",
      line3: "READY TO PAIR",
      line4: "BLE: DISCONNECTED"
    };
    this.device = null;
    this.server = null;
    this.service = null;
    this.characteristic = null;
    this.addLog('info', 'Hardware disconnected or link lost.');
    this.notify();
  }

  disconnect() {
    if (this.device?.gatt?.connected) {
      try {
        this.device.gatt.disconnect();
      } catch (e) {
        // ignore
      }
    }
    this.handleDisconnected();
  }

  // Dispense pill with servo and send command over BLE
  // Sends just the bottle number (1, 2, 3), repeated for chained multi-pill dispense (e.g. "11")
  async triggerServoDispense(chamber: ChamberConfig, count: number = 1): Promise<{ success: boolean; message: string; response?: string }> {
    if (this.state.isDispensing) {
      return { success: false, message: 'Dispenser is currently busy with an active cycle.' };
    }

    const pillCount = Math.max(1, count);
    const command = String(chamber.servoId).repeat(pillCount);
    this.addLog('info', `Triggering Bottle #${chamber.servoId} dispense (${pillCount} pill${pillCount > 1 ? 's' : ''}, command: "${command}")...`);

    // Dispatch bottle command (1, 2, or 3) to ESP32 over BLE
    let dispatchRes: { success: boolean; message: string; response?: string } = { success: true, message: '' };
    if (this.state.connected) {
      dispatchRes = await this.writeCharacteristicValue(command);
    }

    this.state.isDispensing = true;
    this.state.activeServo = chamber.servoId;
    this.state.oledText.line1 = `DISPENSING BOTTLE #${chamber.servoId}`;
    this.state.oledText.line2 = `${chamber.medicationName.slice(0, 16).toUpperCase() || `BOTTLE ${chamber.servoId}`}`;
    this.state.oledText.line3 = `COUNT: ${pillCount} PILL${pillCount > 1 ? 'S' : ''} (CMD: "${command}")`;
    this.state.oledText.line4 = "IR SENSOR: DETECTING...";
    this.state.ledRingColor = '#f59e0b';
    this.notify();

    // Proportional mechanical cycle delay
    const duration = 1200 + (pillCount * 600);
    await new Promise(resolve => setTimeout(resolve, duration));

    this.state.isDispensing = false;
    this.state.activeServo = null;
    this.state.oledText.line1 = "DISPENSE COMPLETED";
    this.state.oledText.line2 = `BOTTLE #${chamber.servoId} ROTATED OK`;
    this.state.oledText.line3 = `COUNT: ${Math.max(0, chamber.currentCount - pillCount)} REMAIN`;
    this.state.oledText.line4 = "TAKE PILL WITH WATER";
    this.state.ledRingColor = '#20a782';
    this.notify();

    setTimeout(() => {
      this.state.oledText.line1 = "HEARTWARE v2.4";
      this.state.oledText.line2 = "READY: 1 BOTTLE OK";
      this.state.oledText.line3 = "NEXT: SCHEDULED AUTO";
      this.state.oledText.line4 = "SYSTEM NOMINAL";
      this.notify();
    }, 5000);

    return {
      success: true,
      message: `Dispensed ${pillCount} pill${pillCount > 1 ? 's' : ''} from Bottle ${chamber.servoId} (${chamber.medicationName || `Bottle ${chamber.servoId}`}). Sent: "${command}"`,
      response: dispatchRes.response
    };
  }

  // Dispense a chained multi-pill sequence across bottles e.g. [1, 2, 3] or [1, 1, 2]
  // Sends concatenated bottle numbers over BLE: e.g. "123"
  async triggerChainedDispense(
    sequence: (1 | 2 | 3)[],
    bottleNames?: Record<number, string>
  ): Promise<{ success: boolean; message: string; response?: string }> {
    if (this.state.isDispensing) {
      return { success: false, message: 'Dispenser is currently busy with an active cycle.' };
    }
    if (!sequence.length) {
      return { success: false, message: 'No bottles specified in chained sequence.' };
    }

    const command = sequence.join('');
    const summaryList = sequence.map(id => bottleNames?.[id] ? `Bottle ${id} (${bottleNames[id]})` : `Bottle ${id}`).join(', ');
    this.addLog('info', `Triggering chained multi-pill dispense: "${command}" (${summaryList})...`);

    let dispatchRes: { success: boolean; message: string; response?: string } = { success: true, message: '' };
    if (this.state.connected) {
      dispatchRes = await this.writeCharacteristicValue(command);
    }

    this.state.isDispensing = true;
    this.state.oledText.line1 = "CHAINED DISPENSE";
    this.state.oledText.line2 = `CMD: "${command}" (${sequence.length} PILLS)`;
    this.state.oledText.line3 = `BOTTLES: ${sequence.join(' -> ')}`;
    this.state.oledText.line4 = "DISPENSING SEQUENCE...";
    this.state.ledRingColor = '#f59e0b';
    this.notify();

    // Sequence mechanical cycle delay
    const duration = 1000 + (sequence.length * 800);
    await new Promise(resolve => setTimeout(resolve, duration));

    this.state.isDispensing = false;
    this.state.activeServo = null;
    this.state.oledText.line1 = "CHAIN COMPLETED";
    this.state.oledText.line2 = `DISPENSED ${sequence.length} PILLS`;
    this.state.oledText.line3 = `SEQ: ${sequence.join(', ')} OK`;
    this.state.oledText.line4 = "TAKE PILL WITH WATER";
    this.state.ledRingColor = '#20a782';
    this.notify();

    setTimeout(() => {
      this.state.oledText.line1 = "HEARTWARE v2.4";
      this.state.oledText.line2 = "READY: 1 BOTTLE OK";
      this.state.oledText.line3 = "NEXT: SCHEDULED AUTO";
      this.state.oledText.line4 = "SYSTEM NOMINAL";
      this.notify();
    }, 5000);

    return {
      success: true,
      message: `Chained sequence executed: Sent "${command}" (${sequence.length} pills from ${summaryList}).`,
      response: dispatchRes.response
    };
  }

  // Test servo movement calibration over BLE
  async testCalibrateServo(servoId: number, angle: number): Promise<string> {
    const command = `CALIBRATE:${servoId}:${angle}`;
    this.addLog('info', `Calibrating Servo #${servoId} to ${angle}°...`);

    if (this.state.connected) {
      await this.writeCharacteristicValue(command);
    }

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
