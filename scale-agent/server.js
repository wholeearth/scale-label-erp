/**
 * CAS CN1 Scale Bridge Agent
 * --------------------------
 * Runs locally on the weighing PC.
 *  - Maintains a persistent TCP connection to the scale (default 192.168.1.239:20304)
 *  - Continuously reads weight frames and parses the latest stable value
 *  - Exposes a CORS-enabled HTTP API:
 *      GET  /weight          -> last passively-received reading
 *      POST /weight/request  -> actively trigger a weight transmission and wait for the next frame
 *      POST /print           -> forward an arbitrary payload to the scale's built-in printer
 *      GET  /health          -> { ok, connected, lastUpdate }
 *
 * No external npm deps — uses only Node.js built-ins (net, http).
 *
 * Configuration (env vars):
 *   SCALE_HOST          default "192.168.1.239"
 *   SCALE_PORT          default 20304
 *   AGENT_PORT          default 5000
 *   STABLE_MS           default 800   (ms a weight must be unchanged to be "stable")
 *   SCALE_REQUEST_CMD   default "P\r\n"  (sent to scale on /weight/request; CAS CN1 typically responds with one frame)
 *   REQUEST_TIMEOUT_MS  default 1500
 */

const net = require('net');
const http = require('http');

const SCALE_HOST = process.env.SCALE_HOST || '192.168.1.239';
const SCALE_PORT = parseInt(process.env.SCALE_PORT || '20304', 10);
const AGENT_PORT = parseInt(process.env.AGENT_PORT || '5000', 10);
const STABLE_MS  = parseInt(process.env.STABLE_MS  || '800', 10);
const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || '1500', 10);
const SCALE_REQUEST_CMD = process.env.SCALE_REQUEST_CMD || 'P\r\n';
const RECONNECT_DELAY_MS = 2000;

let scaleSocket = null;
let connected = false;
let buffer = '';
let lastWeight = null;     // number kg
let lastUnit   = 'kg';
let lastRaw    = '';
let lastUpdate = 0;
let stableSince = 0;

// One-shot listeners awaiting the next parsed frame (used by /weight/request)
const frameWaiters = [];
// Simple write mutex so /weight/request and /print don't interleave bytes
let writeBusy = Promise.resolve();

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

function parseFrame(frame) {
  const trimmed = frame.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const weight = parseFloat(m[1]);
  if (Number.isNaN(weight)) return null;
  const unit = /kg/i.test(trimmed) ? 'kg' : (/lb/i.test(trimmed) ? 'lb' : 'kg');
  const stableFlag = /^ST/i.test(trimmed) ? true
                   : /^US/i.test(trimmed) ? false
                   : null;
  return { weight, unit, raw: trimmed, stableFlag };
}

function notifyFrameWaiters(reading) {
  while (frameWaiters.length) {
    const w = frameWaiters.shift();
    try { w.resolve(reading); } catch {}
  }
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
      if (parsed.stableFlag === true) stableSince = Math.min(stableSince, now - STABLE_MS);
      notifyFrameWaiters(currentReading());
    }
    if (buffer.length > 4096) buffer = buffer.slice(-1024);
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

function decodePayload(payload, encoding) {
  if (encoding === 'hex') {
    const clean = String(payload).replace(/\s+/g, '');
    return Buffer.from(clean, 'hex');
  }
  return Buffer.from(String(payload), encoding === 'ascii' ? 'ascii' : 'utf8');
}

function writeToScale(buf) {
  // Queue writes so two concurrent requests don't interleave
  const job = writeBusy.then(() => new Promise((resolve, reject) => {
    if (!connected || !scaleSocket || scaleSocket.destroyed) {
      return reject(new Error('Scale socket is not connected'));
    }
    scaleSocket.write(buf, (err) => {
      if (err) reject(err);
      else resolve(buf.length);
    });
  }));
  writeBusy = job.catch(() => {});
  return job;
}

function waitForNextFrame(timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const idx = frameWaiters.findIndex((w) => w.resolve === resolve);
      if (idx >= 0) frameWaiters.splice(idx, 1);
      reject(new Error('Timed out waiting for scale frame'));
    }, timeoutMs);
    frameWaiters.push({
      resolve: (r) => { clearTimeout(timer); resolve(r); },
    });
  });
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

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1_000_000) reject(new Error('payload too large')); });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    return res.end();
  }
  const url = (req.url || '/').split('?')[0];

  if (req.method === 'GET' && url === '/weight') {
    return send(res, 200, currentReading());
  }
  if (req.method === 'GET' && url === '/health') {
    return send(res, 200, { ok: true, connected, lastUpdate, scale: { host: SCALE_HOST, port: SCALE_PORT } });
  }

  if (req.method === 'POST' && url === '/weight/request') {
    if (!connected) return send(res, 503, { error: 'scale_disconnected' });
    try {
      const body = await readJsonBody(req).catch(() => ({}));
      const cmd = body?.command ? String(body.command) : SCALE_REQUEST_CMD;
      const enc = body?.encoding;
      const payload = decodePayload(cmd, enc);
      const waiter = waitForNextFrame(REQUEST_TIMEOUT_MS);
      await writeToScale(payload);
      const reading = await waiter;
      return send(res, 200, reading);
    } catch (e) {
      log('weight/request error:', e.message);
      return send(res, 408, { error: 'no_frame', message: e.message });
    }
  }

  if (req.method === 'POST' && url === '/print') {
    if (!connected) return send(res, 503, { error: 'scale_disconnected' });
    try {
      const body = await readJsonBody(req);
      if (!body?.payload) return send(res, 400, { error: 'missing_payload' });
      const buf = decodePayload(body.payload, body.encoding);
      const bytes = await writeToScale(buf);
      return send(res, 200, { ok: true, bytesWritten: bytes });
    } catch (e) {
      log('print error:', e.message);
      return send(res, 500, { error: 'print_failed', message: e.message });
    }
  }

  send(res, 404, { error: 'Not found' });
});

server.listen(AGENT_PORT, () => {
  log(`Scale agent HTTP API listening on http://localhost:${AGENT_PORT}`);
  log(`Endpoints: GET /weight, POST /weight/request, POST /print, GET /health`);
});

connectToScale();

process.on('SIGINT', () => { log('Shutting down.'); try { scaleSocket?.destroy(); } catch {} server.close(() => process.exit(0)); });
