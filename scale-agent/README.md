# CAS CN1 Scale Bridge Agent

A tiny local Node.js service that bridges a **CAS CN1 weighing scale** (TCP) to the ERP frontend (HTTP). Browsers cannot open raw TCP sockets, so this agent runs on the **weighing PC** and exposes the scale at `http://localhost:5000`.

## What it does

- Opens a persistent TCP connection to the scale (default `192.168.1.239:20304`)
- Continuously reads weight frames, parses the numeric value, tracks stability
- Auto-reconnects on disconnection
- Serves a small CORS-enabled HTTP API:
  - `GET /weight` → `{ weight, unit, stable, connected, fresh, raw, ts }`
  - `GET /health` → `{ ok, connected, lastUpdate, scale }`

**No mock values are ever returned.** If the scale is offline, `connected: false` and `weight: 0` so the frontend can show an error.

## Requirements

- Node.js **16+** installed on the weighing PC
- Network access from the weighing PC to the scale IP
- (Optional) Allow inbound on port `5000` only on `localhost` — the ERP browser tab on the same PC calls it.

## Run it

```bash
cd scale-agent
node server.js
```

You should see:

```
[2026-04-24T...] Scale agent HTTP API listening on http://localhost:5000
[2026-04-24T...] Connecting to scale 192.168.1.239:20304...
[2026-04-24T...] Scale connected.
```

Test it:

```bash
curl http://localhost:5000/weight
# {"weight":12.34,"unit":"kg","stable":true,"connected":true,...}
```

## Configuration (env vars)

| Var          | Default           | Purpose                                              |
|--------------|-------------------|------------------------------------------------------|
| `SCALE_HOST` | `192.168.1.239`   | Scale IP                                             |
| `SCALE_PORT` | `20304`           | Scale TCP port                                       |
| `AGENT_PORT` | `5000`            | Local HTTP port the ERP frontend will call           |
| `STABLE_MS`  | `800`             | ms a value must be unchanged to be reported `stable` |

Example:

```bash
SCALE_HOST=192.168.1.239 SCALE_PORT=20304 AGENT_PORT=5000 node server.js
```

## Run as a Windows service (production)

Use [`node-windows`](https://github.com/coreybutler/node-windows) or NSSM.

**Quick NSSM recipe:**

1. Download NSSM (https://nssm.cc/) and place `nssm.exe` somewhere on PATH.
2. Open an elevated Command Prompt:
   ```
   nssm install ScaleAgent "C:\Program Files\nodejs\node.exe" "C:\path\to\scale-agent\server.js"
   nssm set ScaleAgent AppDirectory "C:\path\to\scale-agent"
   nssm set ScaleAgent AppEnvironmentExtra SCALE_HOST=192.168.1.239 SCALE_PORT=20304 AGENT_PORT=5000
   nssm start ScaleAgent
   ```
3. The service will auto-start on boot.

## Linux / systemd

Create `/etc/systemd/system/scale-agent.service`:

```ini
[Unit]
Description=CAS CN1 Scale Bridge Agent
After=network.target

[Service]
Environment=SCALE_HOST=192.168.1.239
Environment=SCALE_PORT=20304
Environment=AGENT_PORT=5000
ExecStart=/usr/bin/node /opt/scale-agent/server.js
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now scale-agent
```

## Frontend integration

The ERP reads from this agent via the URL stored in `localStorage` under `scale_agent_url` (defaults to `http://localhost:5000`). Change it in **Admin → System Settings → Scale Configuration** if the agent runs on a different host/port.
