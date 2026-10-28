import type { Camera } from './types';

export function formatHash(id: number | null): string {
  return id === null ? '' : `#cam=${id}`;
}

export function resolveHashCamera(hash: string, cams: Camera[]): Camera | null {
  const match = /^#cam=(\d+)$/.exec(hash);
  if (!match) return null;
  const id = Number(match[1]);
  return cams.find((c) => c.id === id) ?? null;
}
