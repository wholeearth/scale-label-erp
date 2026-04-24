/**
 * CAS CN1 Scale Bridge Agent
 * --------------------------
 * Runs locally on the weighing PC.
 *  - Maintains a persistent TCP connection to the scale (default 192.168.1.239:20304)
 *  - Continuously reads weight frames and parses the latest stable value
 *  - Exposes a CORS-enabled HTTP API:
 *      GET  /weight   -> { weight, unit, stable, connected, raw, ts }
 *      GET  /health   -> { ok, connected, lastUpdate }
 *
 * No external npm deps — uses only Node.js built-ins (net, http).
 *
 * Configuration (env vars):
 *   SCALE_HOST   default "192.168.1.239"
 *   SCALE_PORT   default 20304
 *   AGENT_PORT   default 5000
 *   STABLE_MS    default 800   (ms a weight must be unchanged to be "stable")
 */

const net = require('net');
const http = require('http');

const SCALE_HOST = process.env.SCALE_HOST || '192.168.1.239';
const SCALE_PORT = parseInt(process.env.SCALE_PORT || '20304', 10);
const AGENT_PORT = parseInt(process.env.AGENT_PORT || '5000', 10);
const STABLE_MS  = parseInt(process.env.STABLE_MS  || '800', 10);
const RECONNECT_DELAY_MS = 2000;

let scaleSocket = null;
let connected = false;
let buffer = '';
let lastWeight = null;     // number kg
let lastUnit   = 'kg';
let lastRaw    = '';
let lastUpdate = 0;        // epoch ms when a frame was last parsed
let stableSince = 0;       // epoch ms since current weight value first seen

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

/**
 * Parse a raw frame from the CAS CN1.
 * Typical formats observed:
 *   "ST,GS,   12.34kg\r\n"   (stable, gross)
 *   "US,GS,   12.34kg\r\n"   (unstable)
 *   "   12.34 kg"
 * We extract the first decimal number we see.
 */
function parseFrame(frame) {
  const trimmed = frame.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const weight = parseFloat(m[1]);
  if (Number.isNaN(weight)) return null;
  const unit = /kg/i.test(trimmed) ? 'kg' : (/lb/i.test(trimmed) ? 'lb' : 'kg');
  // Some scales prefix "ST" for stable, "US" for unstable
  const stableFlag = /^ST/i.test(trimmed) ? true
                   : /^US/i.test(trimmed) ? false
                   : null; // unknown — fall back to time-based stability
  return { weight, unit, raw: trimmed, stableFlag };
}

function connectToScale() {
  log(`Connecting to scale ${SCALE_HOST}:${SCALE_PORT}...`);
  scaleSocket = new net.Socket();
  scaleSocket.setKeepAlive(true, 10000);
  scaleSocket.setNoDelay(true);

  scaleSocket.connect(SCALE_PORT, SCALE_HOST, () => {
    connected = true;
    log('Scale connected.');
  });

  scaleSocket.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    // Frames usually end in \r\n; also flush long buffers
    let idx;
    while ((idx = buffer.search(/[\r\n]/)) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      const parsed = parseFrame(frame);
      if (!parsed) continue;
      const now = Date.now();
      if (lastWeight === null || parsed.weight !== lastWeight) {
        stableSince = now;
      }
      lastWeight = parsed.weight;
      lastUnit = parsed.unit;
      lastRaw = parsed.raw;
      lastUpdate = now;
      // Track explicit stable flag if scale provides it
      if (parsed.stableFlag === true) stableSince = Math.min(stableSince, now - STABLE_MS);
    }
    if (buffer.length > 4096) buffer = buffer.slice(-1024); // safety
  });

  scaleSocket.on('error', (err) => {
    log('Scale socket error:', err.message);
  });

  scaleSocket.on('close', () => {
    connected = false;
    log(`Scale disconnected. Reconnecting in ${RECONNECT_DELAY_MS}ms...`);
    setTimeout(connectToScale, RECONNECT_DELAY_MS);
  });
}

function currentReading() {
  const now = Date.now();
  const fresh = lastUpdate > 0 && (now - lastUpdate) < 5000;
  const stable = fresh && lastWeight !== null && (now - stableSince) >= STABLE_MS;
  return {
    weight: lastWeight ?? 0,
    unit: lastUnit,
    stable,
    connected,
    fresh,
    raw: lastRaw,
    ts: lastUpdate,
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store',
};

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...corsHeaders });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    return res.end();
  }
  const url = (req.url || '/').split('?')[0];
  if (url === '/weight') return send(res, 200, currentReading());
  if (url === '/health') return send(res, 200, {
    ok: true,
    connected,
    lastUpdate,
    scale: { host: SCALE_HOST, port: SCALE_PORT },
  });
  send(res, 404, { error: 'Not found' });
});

server.listen(AGENT_PORT, () => {
  log(`Scale agent HTTP API listening on http://localhost:${AGENT_PORT}`);
  log(`Endpoints: GET /weight, GET /health`);
});

connectToScale();

process.on('SIGINT', () => { log('Shutting down.'); try { scaleSocket?.destroy(); } catch {} server.close(() => process.exit(0)); });
