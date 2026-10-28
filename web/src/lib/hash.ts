import type { Camera } from './types';

export function formatHash(id: string | null): string {
  return id === null ? '' : `#cam=${id}`;
}

/** Accepts composite ids; a bare number is read as the legacy city link. */
export function resolveHashCamera(hash: string, cams: Camera[]): Camera | null {
  const match = /^#cam=(.+)$/.exec(hash);
  if (!match) return null;
  let token: string;
  try {
    token = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  const exact = cams.find((c) => c.id === token);
  if (exact) return exact;
  if (!/^\d+$/.test(token)) return null;
  return cams.find((c) => c.id === `kota-${token}`) ?? null;
}
