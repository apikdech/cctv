import { it, expect } from 'vitest';
import { SHEET, SIDEBAR, clampSheet, clampSidebar, loadSize, saveSize } from './size';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

it('clampSidebar keeps the map visible and the panel usable', () => {
  expect(clampSidebar(500, 1440)).toBe(500);
  expect(clampSidebar(100, 1440)).toBe(SIDEBAR.min);
  expect(clampSidebar(900, 1000)).toBe(680);
  expect(clampSidebar(1200, 2000)).toBe(1200);
  expect(clampSidebar(1500, 2000)).toBe(1400);
});

it('clampSheet stays between the minimum height and 80% of the screen', () => {
  expect(clampSheet(0.45, 800)).toBe(0.45);
  expect(clampSheet(0.95, 800)).toBe(0.8);
  expect(clampSheet(0.05, 800)).toBe(140 / 800);
});

it('loadSize falls back for missing or corrupt values', () => {
  expect(loadSize(null, SIDEBAR.key, 360)).toBe(360);
  const storage = memoryStorage();
  expect(loadSize(storage, SIDEBAR.key, 360)).toBe(360);
  for (const bad of ['abc', '-5', '0', 'NaN']) {
    storage.setItem(SIDEBAR.key, bad);
    expect(loadSize(storage, SIDEBAR.key, 360)).toBe(360);
  }
  storage.setItem(SIDEBAR.key, '512');
  expect(loadSize(storage, SIDEBAR.key, 360)).toBe(512);
  storage.setItem(SHEET.key, '0.6');
  expect(loadSize(storage, SHEET.key, 0.45)).toBe(0.6);
});

it('saveSize round-trips and survives blocked or missing storage', () => {
  const storage = memoryStorage();
  saveSize(storage, SIDEBAR.key, 512);
  expect(loadSize(storage, SIDEBAR.key, 360)).toBe(512);

  const blocked = { ...memoryStorage(), setItem: () => { throw new Error('blocked'); } } as Storage;
  expect(() => saveSize(blocked, SIDEBAR.key, 512)).not.toThrow();
  expect(() => saveSize(null, SIDEBAR.key, 512)).not.toThrow();
});
