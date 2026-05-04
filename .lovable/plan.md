## Problem

The CAS CN1 isn't streaming weight data over TCP to the local agent, so `/weight` stays empty. CAS CN1 typically only emits a weight frame **on demand** (when the PRINT key is pressed or when a print command is sent over the link). The scale also has a built-in label printer we can drive directly over the same TCP socket.

## Strategy

Extend the existing local **scale-agent** (`scale-agent/server.js`) to support two new actions over the same TCP connection:

1. **Request weight on demand** — send the CAS "print/transmit" command (`P\r\n`, configurable) to the scale; the scale replies with one weight frame which the agent parses and returns.
2. **Send raw print payload** — accept a label text/ESC-P payload from the ERP and forward it as-is to the scale's built-in printer over TCP.

The ERP keeps the same `readWeight()` flow but adds an explicit "Request weight" action and a "Print on scale" path used when weight capture fails.

## Plan

### 1. Local agent (`scale-agent/server.js`)
- Add `POST /weight/request` — writes a configurable trigger command (env `SCALE_REQUEST_CMD`, default `P\r\n`) to the TCP socket, waits up to ~1.5 s for the next parsed frame, returns it. Falls back to `408` if no frame arrives.
- Add `POST /print` — body `{ payload: string, encoding?: 'utf8'|'ascii'|'hex' }`. Writes the bytes to the scale TCP socket (which the CN1 forwards to its built-in printer). Returns `{ ok: true, bytesWritten }`.
- Keep existing passive listener so any unsolicited frames still update `currentReading`.
- Add small in-memory mutex so a `/weight/request` and a `/print` don't interleave bytes.
- Update `scale-agent/README.md` with the two new endpoints and the env vars.

### 2. Scale client (`src/lib/scaleAgent.ts`)
- Add `requestWeight(opts?: { requireStable?: boolean })` — POSTs to `/weight/request`, parses the response into `ScaleReading`, throws `ScaleError` like today.
- Add `printOnScale(payload: string, encoding?: 'utf8'|'ascii'|'hex')` — POSTs to `/print`. Throws `ScaleError('agent_unreachable' | 'scale_disconnected', …)` on failure.
- Add a tiny helper `buildScaleLabelPayload({ companyName, productCode, productName, serialNumber, globalSerial, itemSerial, weightKg, lengthYards?, dateTime })` that returns ASCII text suitable for the CN1's built-in printer (configurable template stored in `localStorage` so an admin can tweak without redeploying the agent).

### 3. Operator Production Interface (`src/components/operator/ProductionInterface.tsx`)
- Replace the silent `readWeight()` poll inside `captureWeight` with: try `requestWeight({ requireStable: true })` first (works for CN1 PRINT-on-demand mode); if that throws `timeout`/`scale_disconnected`, fall back to `readWeight()` once, then surface the existing `(SCALE ERROR)` toast.
- Add a new "Print on scale" path next to the existing Print button:
  - Visible whenever the last weight capture failed OR via a small "Print on scale" secondary button always available.
  - Builds the payload from the current selected item + entered/captured values and calls `printOnScale(payload)`.
  - On success: still run the existing post-print bookkeeping (increment serials, update `operator_assignments` / `machine_assignments`, save inventory record, etc.) — the only thing that changes is **where** the physical print happens.
- If the operator hasn't captured a weight (because the scale won't stream), allow manual weight entry to proceed to "Print on scale" so the workflow isn't blocked.

### 4. Admin → System Settings (`src/components/admin/SystemSettings.tsx`)
- Add a "Request weight" test button next to the existing live monitor that calls the new `/weight/request` endpoint and shows the returned reading or error.
- Add a "Send test print" button that posts a short fixed string (`"*** TEST PRINT ***\r\n\r\n"`) to `/print` and shows success/failure.
- Add inputs for: trigger command (default `P\r\n`) and the label template, both stored in `localStorage`.

### 5. Cleanup
- Leave the old `supabase/functions/read-scale-weight/index.ts` untouched (already unused by the operator flow). No DB migrations needed — everything new lives in the local agent + `localStorage`.

## Technical notes (for review)

- All scale I/O still goes through the **single persistent TCP socket** the agent already maintains, so we don't fight the CN1's "one client" limitation.
- The `/weight/request` handler subscribes to the next parsed frame via a one-shot internal event emitter, with a 1500 ms timeout. This is what makes "press print on the scale" effectively replaceable with "click Capture in the ERP".
- The `/print` payload is opaque bytes — if your CN1 expects ESC/P or a specific CAS label protocol, the admin can paste the exact byte sequence (hex mode) without code changes.
- Browser still cannot open TCP sockets — the agent remains mandatory. No change to that constraint.

## Files

Edited:
- `scale-agent/server.js`
- `scale-agent/README.md`
- `src/lib/scaleAgent.ts`
- `src/components/operator/ProductionInterface.tsx`
- `src/components/admin/SystemSettings.tsx`

Reply **go** to implement.