import { it, expect } from 'vitest';
import { formatHash, resolveHashCamera } from './hash';
const cams = [{ id: 14 }] as any;
it('formats', () => { expect(formatHash(14)).toBe('#cam=14'); expect(formatHash(null)).toBe(''); });
it('resolveHashCamera ignores unknown or malformed ids', () => {
  expect(resolveHashCamera('#cam=14', cams)?.id).toBe(14);
  for (const h of ['#cam=99999', '#cam=abc', '#cam=', '', '#other=14']) expect(resolveHashCamera(h, cams)).toBeNull();
});
