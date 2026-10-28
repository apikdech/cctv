import { it, expect } from 'vitest';
import { MAX_WALL, addToWall, gridFor, removeFromWall, swapInWall } from './wall';

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
