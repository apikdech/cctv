import { it, expect } from 'vitest';
import { formatHash, formatWallHash, resolveHashCamera, resolveWallHash } from './hash';

const cams = [{ id: 'kota-14' }, { id: 'prov-14' }] as any;
// Ten known cameras, enough to prove the wall keeps only the first eight.
const many = Array.from({ length: 10 }, (_, i) => ({ id: `kota-${i + 1}` })) as any;

it('formats', () => {
  expect(formatHash('kota-14')).toBe('#cam=kota-14');
  expect(formatHash(null)).toBe('');
});

it('round-trips composite ids', () => {
  expect(resolveHashCamera('#cam=prov-14', cams)?.id).toBe('prov-14');
  expect(resolveHashCamera('#cam=kota-14', cams)?.id).toBe('kota-14');
});

it('resolves legacy numeric links to the city camera', () => {
  expect(resolveHashCamera('#cam=14', cams)?.id).toBe('kota-14');
});

it('distinguishes the same number in both datasets', () => {
  expect(resolveHashCamera('#cam=prov-14', cams)?.id).not.toBe(resolveHashCamera('#cam=kota-14', cams)?.id);
});

it('ignores malformed hashes', () => {
  for (const h of ['#cam=99999', '#cam=', '', '#other=14', '#cam=kota-']) {
    expect(resolveHashCamera(h, cams)).toBeNull();
  }
});

it('formats a wall', () => {
  expect(formatWallHash(['kota-1', 'prov-3'])).toBe('#wall=kota-1,prov-3');
  expect(formatWallHash([])).toBe('');
});

it('resolves a wall link in order', () => {
  expect(resolveWallHash('#wall=prov-3,kota-1', [{ id: 'kota-1' }, { id: 'prov-3' }] as any)).toEqual(['prov-3', 'kota-1']);
});

it('de-duplicates a wall link', () => {
  expect(resolveWallHash('#wall=kota-1,kota-1,kota-2', many)).toEqual(['kota-1', 'kota-2']);
});

it('drops unknown ids from a wall link', () => {
  expect(resolveWallHash('#wall=kota-1,nope,kota-2', many)).toEqual(['kota-1', 'kota-2']);
});

it('keeps only the first 8 of a wall link', () => {
  const all = many.map((c: { id: string }) => c.id);
  expect(resolveWallHash(`#wall=${all.join(',')}`, many)).toEqual(all.slice(0, 8));
});

it('ignores malformed wall links', () => {
  for (const h of ['', '#wall=', '#wall=nope', '#cam=kota-1', '#wall=%E0%A4%A']) {
    expect(resolveWallHash(h, many)).toEqual([]);
  }
});
