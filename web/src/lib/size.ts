export const SIDEBAR = { key: 'cctv-panel-width', fallback: 360, min: 280, minMap: 320, maxFraction: 0.7 };
export const SHEET = { key: 'cctv-sheet-height', fallback: 0.45, minPx: 140, maxFraction: 0.8 };

export function clampSidebar(width: number, viewportWidth: number): number {
  const max = Math.min(viewportWidth - SIDEBAR.minMap, viewportWidth * SIDEBAR.maxFraction);
  return Math.max(SIDEBAR.min, Math.min(width, max));
}

export function clampSheet(fraction: number, viewportHeight: number): number {
  return Math.min(Math.max(fraction, SHEET.minPx / viewportHeight), SHEET.maxFraction);
}

export function loadSize(storage: Storage | null, key: string, fallback: number): number {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  } catch {
    return fallback;
  }
}

export function saveSize(storage: Storage | null, key: string, value: number): void {
  try {
    storage?.setItem(key, String(value));
  } catch {
    // Storage blocked: the size still applies for this visit.
  }
}
