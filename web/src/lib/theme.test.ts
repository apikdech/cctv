import { it, expect } from 'vitest';
import { THEME_KEY, loadThemeChoice, nextChoice, resolveTheme, saveThemeChoice } from './theme';

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

it('loadThemeChoice defaults to system', () => {
  expect(loadThemeChoice(null)).toBe('system');
  const storage = memoryStorage();
  expect(loadThemeChoice(storage)).toBe('system');
  storage.setItem(THEME_KEY, 'purple');
  expect(loadThemeChoice(storage)).toBe('system');
  storage.setItem(THEME_KEY, 'dark');
  expect(loadThemeChoice(storage)).toBe('dark');
  storage.setItem(THEME_KEY, 'light');
  expect(loadThemeChoice(storage)).toBe('light');
});

it('saveThemeChoice stores a choice and clears it for system', () => {
  const storage = memoryStorage();
  saveThemeChoice(storage, 'dark');
  expect(loadThemeChoice(storage)).toBe('dark');
  saveThemeChoice(storage, 'system');
  expect(storage.getItem(THEME_KEY)).toBeNull();
});

it('saveThemeChoice survives blocked or missing storage', () => {
  const blocked = { ...memoryStorage(), setItem: () => { throw new Error('blocked'); } } as Storage;
  expect(() => saveThemeChoice(blocked, 'dark')).not.toThrow();
  expect(() => saveThemeChoice(null, 'dark')).not.toThrow();
});

it('resolveTheme follows the system only on system', () => {
  expect(resolveTheme('system', true)).toBe('dark');
  expect(resolveTheme('system', false)).toBe('light');
  expect(resolveTheme('light', true)).toBe('light');
  expect(resolveTheme('dark', false)).toBe('dark');
});

it('nextChoice cycles system, light, dark', () => {
  expect(nextChoice('system')).toBe('light');
  expect(nextChoice('light')).toBe('dark');
  expect(nextChoice('dark')).toBe('system');
});
