export const MAX_WALL = 8;

/** Columns × rows per camera count; the wall is wider than it is tall. */
const GRIDS = [
  { cols: 1, rows: 1 },
  { cols: 2, rows: 1 },
  { cols: 2, rows: 2 },
  { cols: 2, rows: 2 },
  { cols: 3, rows: 2 },
  { cols: 3, rows: 2 },
  { cols: 4, rows: 2 },
  { cols: 4, rows: 2 },
];

export function gridFor(n: number): { cols: number; rows: number } {
  const index = Math.min(Math.max(n, 1), MAX_WALL) - 1;
  return GRIDS[index];
}

export function addToWall(ids: string[], id: string): string[] {
  if (ids.includes(id) || ids.length >= MAX_WALL) return ids;
  return [...ids, id];
}

export function removeFromWall(ids: string[], id: string): string[] {
  return ids.filter((other) => other !== id);
}

export function swapInWall(ids: string[], a: string, b: string): string[] {
  const from = ids.indexOf(a);
  const to = ids.indexOf(b);
  if (from === -1 || to === -1 || from === to) return ids;
  const next = [...ids];
  next[from] = b;
  next[to] = a;
  return next;
}
