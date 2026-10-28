import type { FetchFn } from './liveness';
import type { LivenessMap } from './types';

/** Written to the `status` branch by the VPS cron; see docs/deploy.md. */
export const STATUS_URL = 'https://raw.githubusercontent.com/apikdech/cctv/status/status.json';

/** Twice the cron interval: older than this and the data is treated as absent. */
export const MAX_AGE_MS = 30 * 60_000;

type StatusFile = { generatedAt?: unknown; cameras?: unknown };

function parse(data: unknown, now: number): LivenessMap {
  if (!data || typeof data !== 'object') return {};
  const file = data as StatusFile;
  if (typeof file.generatedAt !== 'string') return {};

  const at = Date.parse(file.generatedAt);
  if (!Number.isFinite(at) || now - at > MAX_AGE_MS) return {};
  if (!file.cameras || typeof file.cameras !== 'object') return {};

  const out: LivenessMap = {};
  for (const [id, value] of Object.entries(file.cameras as Record<string, unknown>)) {
    if (!/^(kota|prov)-\d+$/.test(id)) continue;
    if (value === 'alive' || value === 'dead') out[id] = value;
  }
  return out;
}

/**
 * Liveness as last seen by the server-side probe. Any failure is an empty
 * result, which leaves the caller to fall back to probing from the browser.
 */
export async function loadStatus(fetchFn: FetchFn = fetch, now = Date.now(), url = STATUS_URL): Promise<LivenessMap> {
  try {
    const res = await fetchFn(url);
    if (!res.ok) return {};
    return parse(await res.json(), now);
  } catch {
    return {};
  }
}
