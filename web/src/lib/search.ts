import type { Camera, Liveness, LivenessMap, Toggles } from './types';

export function livenessOf(map: LivenessMap, id: string): Liveness {
  return map[id] ?? 'checking';
}

export function displayName(title: string): string {
  return title.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function searchCameras(cams: Camera[], query: string): Camera[] {
  const q = normalize(query);
  if (!q) return cams;
  return cams.filter((c) => normalize(c.title).includes(q));
}

export function visibleCameras(
  cams: Camera[],
  toggles: Toggles,
  liveness: LivenessMap,
  selectedId: string | null,
): Camera[] {
  return cams.filter((c) => {
    if (c.id === selectedId) return true;
    if (c.source === 'removed' && !toggles.removed) return false;
    if (!toggles[c.dataset]) return false;
    return toggles.dead || livenessOf(liveness, c.id) !== 'dead';
  });
}
