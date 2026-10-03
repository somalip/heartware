# Heartware

A minimal PWA for an automatic medication dispenser: ESP32, four servos (one per slot), and a small display.

Theme: **Shaping Society** — low-cost hardware and an offline-capable app to make medication adherence accessible.

## What works

- Sign in / create account (stored locally on the device, passwords SHA-256 hashed)
- Four slots: dispense, refill, edit medication / capacity / servo angle
- Dose schedule with next-dose display
- Dispense history with JSON export
- Emergency contact, call links, emergency slot (slot 4)
- Installable and works offline (service worker, production build only)

## Not yet real

- **Bluetooth**: `src/services/hardwareService.ts` simulates the device. Web Bluetooth pairing is stubbed; there is no GATT protocol yet.
- **Accounts**: local only. Replace `src/context/AuthContext.tsx` with a real backend before storing real patient data.
- **Scheduled dispensing** is expected to run on the ESP32; the app only shows the schedule.
- Nearby-help listings are placeholders.

## Run

```bash
pnpm install
pnpm dev      # http://localhost:3000
pnpm build
pnpm preview  # test offline / install
```
