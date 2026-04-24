/**
 * Client for the local CAS CN1 scale bridge agent.
 * The agent runs on the weighing PC and exposes /weight and /health on
 * http://localhost:5000 by default. The URL is configurable via localStorage
 * so a single ERP tab can point at a different host if needed.
 */

const STORAGE_KEY = 'scale_agent_url';
const DEFAULT_URL = 'http://localhost:5000';
const REQUEST_TIMEOUT_MS = 2500;

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
  | 'timeout';

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

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read the current weight reading from the local agent.
 * Throws ScaleError on any failure — never returns mock data.
 */
export async function readWeight(opts?: { requireStable?: boolean }): Promise<ScaleReading> {
  const base = getScaleAgentUrl();
  let res: Response;
  try {
    res = await fetchWithTimeout(`${base}/weight`, REQUEST_TIMEOUT_MS);
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new ScaleError('timeout', 'Scale agent did not respond in time.');
    }
    throw new ScaleError(
      'agent_unreachable',
      `Cannot reach scale agent at ${base}. Make sure the local scale-agent service is running.`,
    );
  }
  if (!res.ok) {
    throw new ScaleError('agent_unreachable', `Scale agent returned HTTP ${res.status}.`);
  }
  const data = (await res.json()) as ScaleReading;
  if (!data.connected || !data.fresh) {
    throw new ScaleError(
      'scale_disconnected',
      'Scale is not connected. Check the cable / network and the scale power.',
    );
  }
  if (opts?.requireStable && !data.stable) {
    throw new ScaleError('unstable', 'Weight is not stable yet — wait for the reading to settle.');
  }
  return data;
}

export async function checkAgentHealth(): Promise<{ ok: boolean; connected: boolean }> {
  const base = getScaleAgentUrl();
  try {
    const res = await fetchWithTimeout(`${base}/health`, REQUEST_TIMEOUT_MS);
    if (!res.ok) return { ok: false, connected: false };
    const data = await res.json();
    return { ok: !!data.ok, connected: !!data.connected };
  } catch {
    return { ok: false, connected: false };
  }
}
