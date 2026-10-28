import { describe, it, expect } from 'vitest';
import { loadStatus, MAX_AGE_MS } from './status';

const NOW = Date.parse('2026-10-28T06:00:00Z');
const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

describe('loadStatus', () => {
  it('maps composite camera ids to alive or dead', async () => {
    const out = await loadStatus(
      () => ok({ generatedAt: '2026-10-28T05:55:00Z', cameras: { 'kota-14': 'alive', 'prov-207': 'dead' } }),
      NOW,
    );
    expect(out).toEqual({ 'kota-14': 'alive', 'prov-207': 'dead' });
  });

  it('drops entries that are not a known liveness value', async () => {
    const out = await loadStatus(
      () => ok({ generatedAt: '2026-10-28T05:55:00Z', cameras: { 'kota-14': 'alive', 'prov-207': 'checking', 'kota-300': 1 } }),
      NOW,
    );
    expect(out).toEqual({ 'kota-14': 'alive' });
  });

  it('rejects keys that are not composite ids', async () => {
    const out = await loadStatus(
      () => ok({ generatedAt: '2026-10-28T05:55:00Z', cameras: { 14: 'alive', 'kota-14': 'dead' } }),
      NOW,
    );
    expect(out).toEqual({ 'kota-14': 'dead' });
  });

  it('ignores a file older than the maximum age', async () => {
    const at = new Date(NOW - MAX_AGE_MS - 1000).toISOString();
    expect(await loadStatus(() => ok({ generatedAt: at, cameras: { 'kota-14': 'alive' } }), NOW)).toEqual({});
  });

  it('ignores an unparseable timestamp', async () => {
    expect(await loadStatus(() => ok({ generatedAt: 'yesterday', cameras: { 'kota-14': 'alive' } }), NOW)).toEqual({});
  });

  it('returns empty when the file cannot be fetched or parsed', async () => {
    expect(await loadStatus(() => Promise.reject(new Error('offline')), NOW)).toEqual({});
    expect(await loadStatus(() => Promise.resolve(new Response('nope', { status: 404 })), NOW)).toEqual({});
    expect(await loadStatus(() => Promise.resolve(new Response('{not json', { status: 200 })), NOW)).toEqual({});
  });
});
