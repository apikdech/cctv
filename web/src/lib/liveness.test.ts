import { describe, it, expect } from 'vitest';
import { probe, checkAll, loadCache, saveCache, applyResults } from './liveness';

const res = (status: number, body: string) => Promise.resolve(new Response(body, { status }));

describe('probe', () => {
  it('alive only on 200 with a body', async () => {
    expect(await probe('u', () => res(200, '#EXTM3U'))).toBe('alive');
    expect(await probe('u', () => res(404, 'nope'))).toBe('dead');
    expect(await probe('u', () => res(200, ''))).toBe('dead');
    expect(await probe('u', () => Promise.reject(new Error('net')))).toBe('dead');
  });
  it('times out as dead', async () => {
    expect(await probe('u', () => new Promise(() => {}), 30)).toBe('dead');
  });
  it('bypasses the HTTP cache', async () => {
    let init: RequestInit | undefined;
    await probe('u', (_url, i) => { init = i; return res(200, '#EXTM3U'); });
    expect(init?.cache).toBe('no-store');
  });
});

describe('applyResults', () => {
  it('ignores probe results for cameras the player already resolved', () => {
    const out = applyResults({ 1: 'alive' }, { 1: { status: 'alive', at: 5 } }, [[1, 'dead'], [2, 'dead']], 100, new Set([1]));
    expect(out.liveness).toEqual({ 1: 'alive', 2: 'dead' });
    expect(out.cache).toEqual({ 1: { status: 'alive', at: 5 }, 2: { status: 'dead', at: 100 } });
  });
});

describe('checkAll', () => {
  it('never runs more than `concurrency` probes and reports every camera', async () => {
    let inFlight = 0, peak = 0;
    const cams = Array.from({ length: 10 }, (_, i) => ({ id: i, url: `u${i}` })) as any;
    const seen: number[] = [];
    await checkAll(cams, {
      concurrency: 4,
      probe: async () => { peak = Math.max(peak, ++inFlight); await new Promise(r => setTimeout(r, 5)); inFlight--; return 'alive'; },
      onResult: id => seen.push(id),
    });
    expect(peak).toBeLessThanOrEqual(4);
    expect(seen.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

describe('cache', () => {
  it('round-trips and drops entries older than 10 minutes', () => {
    saveCache(localStorage, { 1: { status: 'alive', at: 0 }, 2: { status: 'dead', at: 500_000 } });
    expect(loadCache(localStorage, 600_001)).toEqual({ 2: { status: 'dead', at: 500_000 } });
  });
  it('loadCache survives broken storage', () => {
    localStorage.setItem('cctv-liveness-v1', '{not json');
    expect(loadCache(localStorage, 0)).toEqual({});
    expect(loadCache(null, 0)).toEqual({});
    const throwing = { getItem: () => { throw new Error('denied'); } } as unknown as Storage;
    expect(loadCache(throwing, 0)).toEqual({});
  });
});
