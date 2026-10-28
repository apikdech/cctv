import { it, expect } from 'vitest';
import { formatHash, resolveHashCamera } from './hash';

const cams = [{ id: 'kota-14' }, { id: 'prov-14' }] as any;

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
