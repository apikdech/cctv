import type { Camera } from './types';
import { MAX_WALL } from './wall';

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

export function formatWallHash(ids: string[]): string {
  return ids.length ? `#wall=${ids.join(',')}` : '';
}

/** Known ids only, de-duplicated, in link order, never more than a full wall. */
export function resolveWallHash(hash: string, cams: Camera[]): string[] {
  const match = /^#wall=(.+)$/.exec(hash);
  if (!match) return [];
  const known = new Set(cams.map((c) => c.id));
  const ids: string[] = [];
  for (const raw of match[1].split(',')) {
    let id: string;
    try {
      id = decodeURIComponent(raw);
    } catch {
      return [];
    }
    if (known.has(id) && !ids.includes(id)) ids.push(id);
    if (ids.length === MAX_WALL) break;
  }
  return ids;
}
