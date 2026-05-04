/**
 * Client for the local CAS CN1 scale bridge agent.
 * The agent runs on the weighing PC and exposes:
 *   GET  /weight          – passive last-seen reading
 *   POST /weight/request  – actively triggers a weight transmission
 *   POST /print           – forwards a payload to the scale's built-in printer
 *   GET  /health
 *
 * The base URL is configurable via localStorage so a single ERP tab can point
 * at a different host if needed.
 */

const STORAGE_KEY = 'scale_agent_url';
const TEMPLATE_KEY = 'scale_print_template';
const TRIGGER_CMD_KEY = 'scale_trigger_command';
const DEFAULT_URL = 'http://localhost:5000';
const REQUEST_TIMEOUT_MS = 2500;
const ACTIVE_REQUEST_TIMEOUT_MS = 4000;

export interface ScaleReading {
  weight: number;
  unit: string;
  stable: boolean;
  connected: boolean;
  fresh: boolean;
  raw: string;
  ts: number;
}

export type ScaleErrorKind =
  | 'agent_unreachable'
  | 'scale_disconnected'
  | 'unstable'
  | 'timeout'
  | 'print_failed';

export class ScaleError extends Error {
  kind: ScaleErrorKind;
  constructor(kind: ScaleErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

export function getScaleAgentUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_URL;
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_URL;
}

export function setScaleAgentUrl(url: string) {
  if (typeof window === 'undefined') return;
  const cleaned = url.trim().replace(/\/+$/, '');
  if (cleaned) localStorage.setItem(STORAGE_KEY, cleaned);
  else localStorage.removeItem(STORAGE_KEY);
}

const DEFAULT_TRIGGER = 'P\\r\\n';
export function getTriggerCommand(): string {
  if (typeof window === 'undefined') return DEFAULT_TRIGGER;
  return localStorage.getItem(TRIGGER_CMD_KEY) || DEFAULT_TRIGGER;
}
export function setTriggerCommand(cmd: string) {
  if (typeof window === 'undefined') return;
  if (cmd) localStorage.setItem(TRIGGER_CMD_KEY, cmd);
  else localStorage.removeItem(TRIGGER_CMD_KEY);
}

const DEFAULT_TEMPLATE =
  '{COMPANY}\\n{PRODUCT_CODE} {PRODUCT_NAME}\\nS/N: {SERIAL}\\nWeight: {WEIGHT} kg\\nDate: {DATETIME}\\n\\n\\n';
export function getPrintTemplate(): string {
  if (typeof window === 'undefined') return DEFAULT_TEMPLATE;
  return localStorage.getItem(TEMPLATE_KEY) || DEFAULT_TEMPLATE;
}
export function setPrintTemplate(tpl: string) {
  if (typeof window === 'undefined') return;
  if (tpl) localStorage.setItem(TEMPLATE_KEY, tpl);
  else localStorage.removeItem(TEMPLATE_KEY);
}

function decodeEscapes(s: string): string {
  return s
    .replace(/\\r/g, '\r')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\0/g, '\0');
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

export async function readWeight(opts?: { requireStable?: boolean }): Promise<ScaleReading> {
  const base = getScaleAgentUrl();
  let res: Response;
  try {
    res = await fetchWithTimeout(`${base}/weight`, {}, REQUEST_TIMEOUT_MS);
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new ScaleError('timeout', 'Scale agent did not respond in time.');
    }
    throw new ScaleError(
      'agent_unreachable',
      `Cannot reach scale agent at ${base}. Make sure the local scale-agent service is running.`,
    );
  }
  if (!res.ok) throw new ScaleError('agent_unreachable', `Scale agent returned HTTP ${res.status}.`);
  const data = (await res.json()) as ScaleReading;
  if (!data.connected || !data.fresh) {
    throw new ScaleError('scale_disconnected', 'Scale is not connected or sending no data.');
  }
  if (opts?.requireStable && !data.stable) {
    throw new ScaleError('unstable', 'Weight is not stable yet — wait for the reading to settle.');
  }
  return data;
}

/**
 * Actively asks the scale to transmit one weight frame (CAS CN1 PRINT command).
 * Useful when the scale does not stream continuously.
 */
export async function requestWeight(opts?: { requireStable?: boolean }): Promise<ScaleReading> {
  const base = getScaleAgentUrl();
  const cmd = decodeEscapes(getTriggerCommand());
  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${base}/weight/request`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      },
      ACTIVE_REQUEST_TIMEOUT_MS,
    );
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new ScaleError('timeout', 'Scale did not respond to request in time.');
    }
    throw new ScaleError('agent_unreachable', `Cannot reach scale agent at ${base}.`);
  }
  if (res.status === 408) throw new ScaleError('timeout', 'Scale did not send a frame after request.');
  if (res.status === 503) throw new ScaleError('scale_disconnected', 'Scale TCP socket is not connected.');
  if (!res.ok) throw new ScaleError('agent_unreachable', `Scale agent returned HTTP ${res.status}.`);
  const data = (await res.json()) as ScaleReading;
  if (opts?.requireStable && !data.stable) {
    throw new ScaleError('unstable', 'Weight is not stable yet — wait for the reading to settle.');
  }
  return data;
}

/**
 * Send an arbitrary payload to the scale's built-in printer over the same TCP socket.
 * Use encoding='hex' to send raw byte sequences (e.g. ESC/P control codes).
 */
export async function printOnScale(
  payload: string,
  encoding: 'utf8' | 'ascii' | 'hex' = 'utf8',
): Promise<{ bytesWritten: number }> {
  const base = getScaleAgentUrl();
  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${base}/print`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload, encoding }),
      },
      ACTIVE_REQUEST_TIMEOUT_MS,
    );
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new ScaleError('timeout', 'Print request timed out.');
    throw new ScaleError('agent_unreachable', `Cannot reach scale agent at ${base}.`);
  }
  if (res.status === 503) throw new ScaleError('scale_disconnected', 'Scale TCP socket is not connected.');
  if (!res.ok) {
    let msg = `Print failed (HTTP ${res.status})`;
    try {
      const j = await res.json();
      if (j?.message) msg = j.message;
    } catch {}
    throw new ScaleError('print_failed', msg);
  }
  return (await res.json()) as { bytesWritten: number };
}

export interface LabelFields {
  companyName?: string;
  productCode?: string;
  productName?: string;
  serial?: string;
  globalSerial?: string | number;
  itemSerial?: string | number;
  weightKg?: number;
  lengthYards?: number;
  dateTime?: string;
}

/** Apply the user-editable template to label fields, returning printable text. */
export function buildScaleLabelPayload(fields: LabelFields, templateOverride?: string): string {
  const tpl = decodeEscapes(templateOverride ?? getPrintTemplate());
  const map: Record<string, string> = {
    COMPANY: fields.companyName ?? '',
    PRODUCT_CODE: fields.productCode ?? '',
    PRODUCT_NAME: fields.productName ?? '',
    SERIAL: fields.serial ?? '',
    GLOBAL_SERIAL: String(fields.globalSerial ?? ''),
    ITEM_SERIAL: String(fields.itemSerial ?? ''),
    WEIGHT: fields.weightKg !== undefined ? fields.weightKg.toFixed(2) : '',
    LENGTH: fields.lengthYards !== undefined ? fields.lengthYards.toFixed(2) : '',
    DATETIME: fields.dateTime ?? new Date().toLocaleString(),
  };
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (k in map ? map[k] : `{${k}}`));
}

export async function checkAgentHealth(): Promise<{ ok: boolean; connected: boolean }> {
  const base = getScaleAgentUrl();
  try {
    const res = await fetchWithTimeout(`${base}/health`, {}, REQUEST_TIMEOUT_MS);
    if (!res.ok) return { ok: false, connected: false };
    const data = await res.json();
    return { ok: !!data.ok, connected: !!data.connected };
  } catch {
    return { ok: false, connected: false };
  }
}
