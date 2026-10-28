import type { Camera } from './types';

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;
type Status = 'alive' | 'dead';

const CACHE_KEY = 'cctv-liveness-v1';
const CACHE_TTL_MS = 600_000;

/** A camera is alive when its playlist answers 200 with a non-empty body. */
export async function probe(url: string, fetchFn: FetchFn = fetch, timeoutMs = 10_000): Promise<Status> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Fakes and some environments ignore AbortSignal, so race a timer too.
  const timeout = new Promise<Status>((resolve) => {
    timer = setTimeout(() => resolve('dead'), timeoutMs);
  });
  const check = (async (): Promise<Status> => {
    try {
      const res = await fetchFn(url, { signal: AbortSignal.timeout(timeoutMs) });
      return res.ok && (await res.text()).length > 0 ? 'alive' : 'dead';
    } catch {
      return 'dead';
    }
  })();
  try {
    return await Promise.race([check, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function checkAll(
  cams: Camera[],
  opts: { concurrency: number; probe: (url: string) => Promise<Status>; onResult: (id: number, status: Status) => void },
): Promise<void> {
  const queue = [...cams];
  const worker = async () => {
    for (let cam = queue.shift(); cam; cam = queue.shift()) {
      opts.onResult(cam.id, await opts.probe(cam.url));
    }
  };
  await Promise.all(Array.from({ length: Math.min(opts.concurrency, queue.length) }, worker));
}

export type LivenessCache = Record<number, { status: Status; at: number }>;

export function loadCache(storage: Storage | null, now: number): LivenessCache {
  try {
    const raw = storage?.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const fresh: LivenessCache = {};
    for (const [id, entry] of Object.entries(parsed as Record<string, unknown>)) {
      const e = entry as { status?: unknown; at?: unknown };
      if ((e?.status === 'alive' || e?.status === 'dead') && typeof e.at === 'number' && now - e.at <= CACHE_TTL_MS) {
        fresh[Number(id)] = { status: e.status, at: e.at };
      }
    }
    return fresh;
  } catch {
    return {};
  }
}

export function saveCache(storage: Storage | null, cache: LivenessCache): void {
  try {
    storage?.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage full or blocked: the cache is an optimisation, so carry on.
  }
}
