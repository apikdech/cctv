export type ThemeChoice = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

export const THEME_KEY = 'cctv-theme';

export const MAP_STYLE: Record<Theme, string> = {
  light: 'https://tiles.openfreemap.org/styles/liberty',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

export function loadThemeChoice(storage: Storage | null): ThemeChoice {
  try {
    const raw = storage?.getItem(THEME_KEY);
    return raw === 'light' || raw === 'dark' ? raw : 'system';
  } catch {
    return 'system';
  }
}

export function saveThemeChoice(storage: Storage | null, choice: ThemeChoice): void {
  try {
    if (choice === 'system') storage?.removeItem(THEME_KEY);
    else storage?.setItem(THEME_KEY, choice);
  } catch {
    // Storage blocked: the choice still applies for this visit.
  }
}

/** Mirrored by the pre-paint script in index.html; keep the two in step. */
export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): Theme {
  if (choice === 'system') return prefersDark ? 'dark' : 'light';
  return choice;
}

export function nextChoice(choice: ThemeChoice): ThemeChoice {
  return choice === 'system' ? 'light' : choice === 'light' ? 'dark' : 'system';
}

export function prefersDarkQuery(): MediaQueryList | null {
  return window.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
}
