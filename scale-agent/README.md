# CAS CN1 Scale Bridge Agent

A small Node.js service that runs on the weighing PC and exposes the CAS CN1
scale to the ERP over a local HTTP API. Browsers can't open raw TCP sockets,
so this agent is the bridge.

## Run

```
node server.js
```

No npm install required — uses only Node built-ins.

## Configuration (env vars)

| Var                 | Default            | Description                                           |
|---------------------|--------------------|-------------------------------------------------------|
| `SCALE_HOST`        | `192.168.1.239`    | Scale IP                                              |
| `SCALE_PORT`        | `20304`            | Scale TCP port                                        |
| `AGENT_PORT`        | `5000`             | Local HTTP port the ERP talks to                      |
| `STABLE_MS`         | `800`              | ms a value must be unchanged to be considered stable  |
| `SCALE_REQUEST_CMD` | `P\r\n`            | Command sent to scale on `/weight/request`            |
| `REQUEST_TIMEOUT_MS`| `1500`             | Max wait for a frame after `/weight/request`          |

## Endpoints

### `GET /weight`
Returns the last passively-received reading.
```
{ weight, unit, stable, connected, fresh, raw, ts }
```

### `POST /weight/request`
Actively triggers the scale to transmit a frame (CAS CN1 emits a frame when
the PRINT command is sent). Body (optional):
```
{ "command": "P\r\n", "encoding": "utf8" }
```
Returns the same reading shape as `/weight`. `408` if the scale doesn't reply
in time, `503` if the TCP socket is down.

### `POST /print`
Forwards a payload to the scale's built-in printer over the same TCP socket.
```
{ "payload": "Hello\r\n", "encoding": "utf8" | "ascii" | "hex" }
```
Use `hex` to send raw control bytes (e.g. ESC/P).

### `GET /health`
```
{ ok, connected, lastUpdate, scale: { host, port } }
```

## Why the printer route?

If the CAS CN1 doesn't continuously stream weight to TCP, the ERP can:
1. Call `POST /weight/request` to actively pull a frame, AND/OR
2. Call `POST /print` to send the formatted label directly to the scale's
   built-in printer (the scale prints it itself, with its known weight).

Both routes share the single persistent TCP socket maintained by the agent.

## Run as a Windows service

Use `nssm` (https://nssm.cc):
```
nssm install ScaleAgent "C:\Program Files\nodejs\node.exe" "C:\path\to\scale-agent\server.js"
nssm set ScaleAgent AppEnvironmentExtra SCALE_HOST=192.168.1.239 SCALE_PORT=20304
nssm start ScaleAgent
```
