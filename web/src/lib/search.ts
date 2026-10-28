import type { Camera, Liveness, LivenessMap, Toggles } from './types';

export function livenessOf(map: LivenessMap, id: string): Liveness {
  return map[id] ?? 'checking';
}

/** Agency shorthand people actually type, mapped to the word the data uses. */
const ALIASES: Record<string, string> = { dishub: 'perhubungan' };

function splitCamel(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

export function displayName(title: string): string {
  return splitCamel(title).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalize(s: string): string {
  return splitCamel(s).toLowerCase().replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function datasetWords(cam: Camera): string[] {
  return cam.dataset === 'prov' ? ['prov', 'provinsi', 'diy'] : ['kota'];
}

function haystack(cam: Camera): string {
  return normalize([cam.title, cam.kecamatan, cam.kelurahan, cam.owner, cam.slug, ...datasetWords(cam)].join(' '));
}

function hits(hay: string, term: string): boolean {
  return hay.includes(term) || (ALIASES[term] ? hay.includes(ALIASES[term]) : false);
}

export function searchCameras(cams: Camera[], query: string): Camera[] {
  const terms = normalize(query).split(' ').filter(Boolean);
  if (!terms.length) return cams;

  const titleHit = (cam: Camera) => {
    const title = normalize(cam.title);
    return terms.some((t) => hits(title, t));
  };

  return cams
    .filter((cam) => {
      const hay = haystack(cam);
      return terms.every((t) => hits(hay, t));
    })
    .sort((a, b) => Number(titleHit(b)) - Number(titleHit(a)) || displayName(a.title).localeCompare(displayName(b.title)));
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
