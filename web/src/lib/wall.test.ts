import { it, expect, vi } from 'vitest';
import { MAX_WALL, addToWall, gridFor, removeFromWall, swapInWall, loadWall, saveWall } from './wall';

it('gridFor follows the count', () => {
  expect([1, 2, 3, 4, 5, 6, 7, 8].map(gridFor)).toEqual([
    { cols: 1, rows: 1 },
    { cols: 2, rows: 1 },
    { cols: 2, rows: 2 },
    { cols: 2, rows: 2 },
    { cols: 3, rows: 2 },
    { cols: 3, rows: 2 },
    { cols: 4, rows: 2 },
    { cols: 4, rows: 2 },
  ]);
  expect(gridFor(0)).toEqual({ cols: 1, rows: 1 });
  expect(gridFor(12)).toEqual(gridFor(8));
});

it('addToWall appends, ignores duplicates, stops at the cap', () => {
  expect(addToWall(['a'], 'b')).toEqual(['a', 'b']);
  expect(addToWall(['a'], 'a')).toEqual(['a']);
  const full = Array.from({ length: MAX_WALL }, (_, i) => `c${i}`);
  expect(addToWall(full, 'ninth')).toEqual(full);
  expect(MAX_WALL).toBe(8);
});

it('removeFromWall removes the id and ignores unknown ids', () => {
  expect(removeFromWall(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  expect(removeFromWall(['a', 'b'], 'zz')).toEqual(['a', 'b']);
});

it('swapInWall swaps two positions', () => {
  expect(swapInWall(['a', 'b', 'c'], 'a', 'c')).toEqual(['c', 'b', 'a']);
});

it('swapInWall leaves the list alone without two distinct members', () => {
  expect(swapInWall(['a', 'b', 'c'], 'a', 'a')).toEqual(['a', 'b', 'c']);
  expect(swapInWall(['a', 'b', 'c'], 'a', 'zz')).toEqual(['a', 'b', 'c']);
});

it('saves and restores camera order', () => {
  localStorage.clear();
  saveWall(localStorage, ['b', 'a']);
  expect(localStorage.getItem('cctv-wall')).toBe('["b","a"]');
  expect(loadWall(localStorage, [{ id: 'a' }, { id: 'b' }])).toEqual(['b', 'a']);
});

it('ignores invalid saved data and filters stale and duplicate IDs', () => {
  localStorage.clear();
  const cameras = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}` }));
  expect(loadWall(null, cameras)).toEqual([]);
  expect(loadWall(localStorage, cameras)).toEqual([]);
  for (const raw of ['{', '42', '{}', 'null']) {
    localStorage.setItem('cctv-wall', raw);
    expect(loadWall(localStorage, cameras)).toEqual([]);
  }
  localStorage.setItem('cctv-wall', JSON.stringify(['c1', 'unknown', 'c1', null, 4, ...cameras.map((c) => c.id)]));
  expect(loadWall(localStorage, cameras)).toEqual(['c1', 'c0', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7']);
});

it('clears only wall data and tolerates unavailable storage', () => {
  localStorage.clear();
  localStorage.setItem('cctv-theme', 'dark');
  saveWall(localStorage, ['a']);
  saveWall(localStorage, []);
  expect(localStorage.getItem('cctv-wall')).toBeNull();
  expect(localStorage.getItem('cctv-theme')).toBe('dark');
  const blocked = { getItem: vi.fn(() => { throw Error(); }), setItem: vi.fn(() => { throw Error(); }), removeItem: vi.fn(() => { throw Error(); }) } as unknown as Storage;
  expect(loadWall(blocked, [{ id: 'a' }])).toEqual([]);
  expect(() => saveWall(blocked, ['a'])).not.toThrow();
  expect(() => saveWall(blocked, [])).not.toThrow();
  expect(() => saveWall(null, ['a'])).not.toThrow();
});
