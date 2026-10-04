import { hardwareService } from './hardwareService.ts';
import { storageService } from './storageService.ts';
import { medicationSafetyService } from './medicationSafetyService.ts';

export interface ToolCallRecord {
  id: string;
  name: string;
  args: Record<string, any>;
  result?: any;
  status: 'invoked' | 'executing' | 'success' | 'error';
  timestamp: string;
  bleCommand?: string;
  errorMessage?: string;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: ToolCallRecord[];
  timestamp: string;
}

// Gemini Function Declarations for Tool Calling
export const DISPENSER_TOOL_DECLARATIONS = [
  {
    name: 'dispense_medication',
    description: 'Dispense medication from the dispenser bottle slot (1) using the ESP32 hardware BLE firmware.',
    parameters: {
      type: 'OBJECT',
      properties: {
        chamber_id: {
          type: 'INTEGER',
          description: 'The bottle slot number (1) to actuate.',
        },
        count: {
          type: 'INTEGER',
          description: 'The number of pills to dispense (default is 1).',
        },
        reason: {
          type: 'STRING',
          description: 'Clinical reason or note for dispensing (e.g., "Morning blood pressure dose", "Patient requested PRN headache relief").',
        },
      },
      required: ['chamber_id'],
    },
  },
  {
    name: 'get_dispenser_status',
    description: 'Get the current real-time status of the Heartware dispenser, including BLE connection state, battery level, pill count in the bottle slot (1), and upcoming scheduled doses.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'dispense_chained_sequence',
    description: 'Dispense a multi-dose sequence of medication from the dispenser bottle slot (e.g. [1, 1] for 2 pills).',
    parameters: {
      type: 'OBJECT',
      properties: {
        sequence: {
          type: 'ARRAY',
          description: 'Array of bottle slot numbers (1) to dispense, e.g. [1] or [1, 1].',
          items: {
            type: 'INTEGER',
          },
        },
        reason: {
          type: 'STRING',
          description: 'Reason for dispensing the sequence.',
        },
      },
      required: ['sequence'],
    },
  },
  {
    name: 'check_medication_safety',
    description: 'Clinically evaluate if dispensing a medication is safe right now, checking daily intake limits, cumulative active ingredients, and minimum dose intervals.',
    parameters: {
      type: 'OBJECT',
      properties: {
        chamber_id: {
          type: 'INTEGER',
          description: 'The bottle slot number (1) to evaluate.',
        },
        count: {
          type: 'INTEGER',
          description: 'Number of pills proposed (default 1).',
        },
      },
      required: ['chamber_id'],
    },
  },
  {
    name: 'get_medication_schedule',
    description: 'Get the patient active medication schedule, dosages, prescription timing, and instructions.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'connect_hardware',
    description: 'Establish connection with the ESP32 dispenser hardware via Web Bluetooth (service UUID 41200547-118c-4580-926f-6380e3a521b5) or activate Virtual Simulation mode.',
    parameters: {
      type: 'OBJECT',
      properties: {
        mode: {
          type: 'STRING',
          description: 'Connection mode: "ble" for physical Bluetooth device, or "simulated" for virtual testing.',
        },
      },
      required: ['mode'],
    },
  },
  {
    name: 'calibrate_servo',
    description: 'Send a servo calibration or test sweep command to a bottle slot on the ESP32 dispenser.',
    parameters: {
      type: 'OBJECT',
      properties: {
        chamber_id: {
          type: 'INTEGER',
          description: 'The bottle slot number (1, 2, or 3) to test.',
        },
        angle: {
          type: 'INTEGER',
          description: 'Target servo angle in degrees (0 to 180, default 90).',
        },
      },
      required: ['chamber_id'],
    },
  },
];

class ToolCallingService {
  private activeToolListeners: ((record: ToolCallRecord) => void)[] = [];

  onToolCall(listener: (record: ToolCallRecord) => void) {
    this.activeToolListeners.push(listener);
    return () => {
      this.activeToolListeners = this.activeToolListeners.filter(l => l !== listener);
    };
  }

  private notifyToolCall(record: ToolCallRecord) {
    this.activeToolListeners.forEach(l => l(record));
  }

  getApiKey(): string {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('heartware_gemini_api_key');
      if (stored && stored.trim().length > 10) return stored.trim();
    }
    return import.meta?.env?.VITE_GEMINI_API_KEY || '';
  }

  setApiKey(key: string): void {
    if (typeof window !== 'undefined') {
      if (key && key.trim()) {
        localStorage.setItem('heartware_gemini_api_key', key.trim());
      } else {
        localStorage.removeItem('heartware_gemini_api_key');
      }
    }
  }

  /**
   * Directly executes a tool function locally, interacting with hardware and storage.
   */
  async executeTool(name: string, args: Record<string, any>): Promise<any> {
    const record: ToolCallRecord = {
      id: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      args,
      status: 'executing',
      timestamp: new Date().toLocaleTimeString(),
    };
    this.notifyToolCall(record);

    try {
      let result: any = null;

      switch (name) {
        case 'dispense_medication': {
          const slotId = Number(args.chamber_id) as 1 | 2 | 3;
          const count = Math.max(1, Number(args.count) || 1);
          const reason = String(args.reason || 'AI Tool Calling');

          const chambers = storageService.getChambers();
          const chamber = chambers.find(c => c.servoId === slotId);

          if (!chamber) {
            throw new Error(`Bottle ${slotId} is not configured or does not exist.`);
          }

          if (chamber.currentCount < count) {
            result = {
              success: false,
              blocked: true,
              reason: `Insufficient inventory in Bottle ${slotId}. Requested ${count}, but only ${chamber.currentCount} remaining.`,
              chamber,
            };
            break;
          }

          // Clinical Safety Check
          const logs = storageService.getLogs();
          const safety = medicationSafetyService.validateDispenseSafety(slotId, chambers, logs);

          if (!safety.safeToDispense) {
            result = {
              success: false,
              blocked: true,
              safetyEvaluation: safety,
              message: `Dispense blocked by safety engine: ${safety.blockReason || 'Daily dose limit or time interval constraint exceeded.'}`,
            };
            break;
          }

          // Connect simulated if not connected
          const hwState = hardwareService.getState();
          if (!hwState.connected) {
            hardwareService.connectSimulated('Auto-connected simulated hardware for AI tool calling execution.');
          }

          // Trigger servo dispense via ESP32 BLE protocol
          const bleRes = await hardwareService.triggerServoDispense(chamber, count);
          record.bleCommand = String(slotId).repeat(count);

          // Update inventory
          const updatedChambers = chambers.map(c =>
            c.servoId === slotId ? { ...c, currentCount: Math.max(0, c.currentCount - count) } : c
          );
          storageService.saveChambers(updatedChambers);

          // Add history log
          const logEntry = storageService.addLog({
            timestamp: new Date().toISOString(),
            chamberId: slotId,
            medicationName: chamber.medicationName || `Bottle ${slotId}`,
            status: 'success',
            dispensedBy: 'app_trigger',
            notes: `Dispensed via Gemini Tool Calling (${reason})`,
            activeIngredients: chamber.activeIngredients,
            pillsDispensed: count,
          });

          result = {
            success: true,
            chamberId: slotId,
            medicationName: chamber.medicationName,
            pillStrength: chamber.pillStrength,
            pillsDispensed: count,
            remainingCount: Math.max(0, chamber.currentCount - count),
            bleResponse: bleRes.message,
            logId: logEntry.id,
            message: `Successfully dispensed ${count} pill(s) of ${chamber.medicationName || `Bottle ${slotId}`}. Remaining: ${Math.max(0, chamber.currentCount - count)}.`,
          };
          break;
        }

        case 'get_dispenser_status': {
          const hwState = hardwareService.getState();
          const chambers = storageService.getChambers();
          const schedules = storageService.getSchedules();

          result = {
            connected: hwState.connected,
            connectionType: hwState.connectionType,
            deviceId: hwState.deviceId,
            batteryLevel: hwState.batteryLevel,
            isDispensing: hwState.isDispensing,
            bottles: chambers.map(c => ({
              slot: c.servoId,
              medicationName: c.medicationName || '(Empty / Unassigned)',
              strength: c.pillStrength,
              remaining: c.currentCount,
              maxCapacity: c.maxCapacity,
              status: c.currentCount === 0 ? 'empty' : c.currentCount <= 4 ? 'low' : 'ready',
              maxDailyDoses: c.maxDailyDoses,
            })),
            activeSchedulesCount: schedules.filter(s => s.active).length,
            oledStatus: hwState.oledText,
          };
          break;
        }

        case 'dispense_chained_sequence': {
          const rawSeq = Array.isArray(args.sequence) ? args.sequence : [args.sequence];
          const sequence = rawSeq.map((n: any) => Number(n)) as (1 | 2 | 3)[];
          const reason = String(args.reason || 'AI Tool Calling');

          if (!sequence.length) {
            throw new Error('Sequence array is empty.');
          }

          const chambers = storageService.getChambers();
          const bottleNames: Record<number, string> = {};
          chambers.forEach(c => {
            bottleNames[c.servoId] = c.medicationName;
          });

          // Check counts
          const counts: Record<number, number> = {};
          sequence.forEach(id => {
            counts[id] = (counts[id] || 0) + 1;
          });

          for (const [idStr, need] of Object.entries(counts)) {
            const id = Number(idStr) as 1 | 2 | 3;
            const ch = chambers.find(c => c.servoId === id);
            if (!ch || ch.currentCount < need) {
              result = {
                success: false,
                blocked: true,
                message: `Insufficient inventory in Bottle ${id} (${ch?.medicationName || 'Unassigned'}). Need ${need}, have ${ch?.currentCount || 0}.`,
              };
              break;
            }
          }

          if (result?.blocked) break;

          const hwState = hardwareService.getState();
          if (!hwState.connected) {
            hardwareService.connectSimulated('Auto-connected simulated hardware for chained sequence.');
          }

          const bleRes = await hardwareService.triggerChainedDispense(sequence, bottleNames);
          record.bleCommand = sequence.join('');

          // Decrement inventories
          let currentChambers = [...chambers];
          sequence.forEach(id => {
            currentChambers = currentChambers.map(c =>
              c.servoId === id ? { ...c, currentCount: Math.max(0, c.currentCount - 1) } : c
            );
            storageService.addLog({
              timestamp: new Date().toISOString(),
              chamberId: id,
              medicationName: bottleNames[id] || `Bottle ${id}`,
              status: 'success',
              dispensedBy: 'app_trigger',
              notes: `Chained sequence dispense via Gemini Tool Calling (${reason})`,
              pillsDispensed: 1,
            });
          });
          storageService.saveChambers(currentChambers);

          result = {
            success: true,
            sequence,
            totalPillsDispensed: sequence.length,
            bleResponse: bleRes.message,
            message: `Chained sequence executed: dispensed ${sequence.length} pills (${sequence.map(id => `Bottle ${id}`).join(', ')}).`,
          };
          break;
        }

        case 'check_medication_safety': {
          const slotId = Number(args.chamber_id) as 1 | 2 | 3;
          const chambers = storageService.getChambers();
          const logs = storageService.getLogs();
          const chamber = chambers.find(c => c.servoId === slotId);

          if (!chamber) {
            throw new Error(`Bottle ${slotId} not found.`);
          }

          const safety = medicationSafetyService.validateDispenseSafety(slotId, chambers, logs);
          result = {
            slot: slotId,
            medicationName: chamber.medicationName,
            safeToDispense: safety.safeToDispense,
            hardBlocked: safety.hardBlocked,
            warnings: safety.warnings,
            blockReason: safety.blockReason || null,
          };
          break;
        }

        case 'get_medication_schedule': {
          const schedules = storageService.getSchedules();
          result = {
            schedules: schedules.map(s => ({
              id: s.id,
              medicationName: s.medicationName,
              dosage: s.dosage,
              bottleSlot: s.chamberId,
              times: s.times,
              instructions: s.instructions,
              active: s.active,
            })),
          };
          break;
        }

        case 'connect_hardware': {
          const mode = String(args.mode || 'simulated').toLowerCase();
          if (mode === 'ble') {
            const bleRes = await hardwareService.connectBluetooth();
            result = bleRes;
          } else {
            const simRes = hardwareService.connectSimulated('Connected via AI Tool Calling.');
            result = simRes;
          }
          break;
        }

        case 'calibrate_servo': {
          const slotId = Number(args.chamber_id) || 1;
          const angle = Number(args.angle) || 90;
          const hwState = hardwareService.getState();
          if (!hwState.connected) {
            hardwareService.connectSimulated('Auto-connected virtual hardware for calibration.');
          }
          const calRes = await hardwareService.testCalibrateServo(slotId, angle);
          record.bleCommand = `CALIBRATE:${slotId}:${angle}`;
          result = { success: true, message: calRes };
          break;
        }

        default:
          throw new Error(`Unknown tool function: "${name}"`);
      }

      record.status = 'success';
      record.result = result;
      this.notifyToolCall(record);
      return result;
    } catch (err: any) {
      record.status = 'error';
      record.errorMessage = err.message || 'Execution error';
      this.notifyToolCall(record);
      throw err;
    }
  }

  /**
   * Run a conversational turn with Gemini 3.8 Flash with Tool Calling enabled.
   */
  async chatWithTools(
    messages: { role: 'user' | 'assistant' | 'model'; content: string }[],
    systemInstruction?: string
  ): Promise<{ text: string; toolCalls: ToolCallRecord[] }> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('Gemini API key is not configured. Please set your API key in Settings or the Assistant.');
    }

    const defaultSystem = `You are Heartware Clinical AI, an intelligent, empathetic medical assistant for an automated ESP32 medication dispenser.
You have direct access to tools to query the dispenser, dispense medications, run chained regimens, check clinical safety, and calibrate hardware.
Always prioritize patient safety. When asked to dispense medication, invoke the "dispense_medication" tool.
If a patient asks for multiple medications, you can use "dispense_chained_sequence".
When a tool finishes, summarize the clinical result clearly, reminding the patient to take the pill with water, and noting remaining counts.`;

    const model = 'gemini-3.8-flash';
    const toolCallRecords: ToolCallRecord[] = [];

    // Map conversation into Gemini REST API format
    const contents: any[] = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    // Step 1: Initial call to Gemini with tools declared
    const requestBody = {
      contents,
      system_instruction: {
        parts: [{ text: systemInstruction || defaultSystem }],
      },
      tools: [
        {
          function_declarations: DISPENSER_TOOL_DECLARATIONS,
        },
      ],
      generationConfig: {
        temperature: 0.2,
      },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Gemini API error (HTTP ${res.status})`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    // Check if the model issued a functionCall
    const functionCallPart = parts.find((p: any) => p.functionCall);

    if (functionCallPart && functionCallPart.functionCall) {
      const fnName = functionCallPart.functionCall.name;
      const fnArgs = functionCallPart.functionCall.args || {};

      const record: ToolCallRecord = {
        id: `call-${Date.now()}`,
        name: fnName,
        args: fnArgs,
        status: 'executing',
        timestamp: new Date().toLocaleTimeString(),
      };
      toolCallRecords.push(record);

      let toolResult: any;
      try {
        toolResult = await this.executeTool(fnName, fnArgs);
        record.status = 'success';
        record.result = toolResult;
      } catch (execErr: any) {
        record.status = 'error';
        record.errorMessage = execErr.message;
        toolResult = { error: execErr.message };
      }

      // Step 2: Send functionResponse back to Gemini to complete conversational loop
      const secondTurnContents = [
        ...contents,
        {
          role: 'model',
          parts: [{ functionCall: functionCallPart.functionCall }],
        },
        {
          role: 'function',
          parts: [
            {
              functionResponse: {
                name: fnName,
                response: toolResult,
              },
            },
          ],
        },
      ];

      const secondRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: secondTurnContents,
          system_instruction: {
            parts: [{ text: systemInstruction || defaultSystem }],
          },
        }),
      });

      if (!secondRes.ok) {
        return {
          text: `[Tool ${fnName} completed with: ${JSON.stringify(toolResult)}]`,
          toolCalls: toolCallRecords,
        };
      }

      const secondData = await secondRes.json();
      const secondCandidate = secondData.candidates?.[0];
      const finalText = secondCandidate?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('\n') ||
        `Action completed: ${JSON.stringify(toolResult)}`;

      return {
        text: finalText,
        toolCalls: toolCallRecords,
      };
    }

    // Direct text response without tool call
    const directText = parts.map((p: any) => p.text).filter(Boolean).join('\n') || 'No response from assistant.';
    return {
      text: directText,
      toolCalls: toolCallRecords,
    };
  }
}

export const toolCallingService = new ToolCallingService();
