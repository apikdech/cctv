import type { FeatureCollection, Point } from 'geojson';
import { displayName, kindOf } from './search';
import type { Camera, Kind, LivenessMap } from './types';

export { kindOf };
export type { Kind };

export type CameraFeatureCollection = FeatureCollection<Point, { id: string; title: string; kind: Kind }>;

/**
 * A cluster is tinted by its worst member. MapLibre cannot call JS per cluster,
 * so the paint expression in MapView.svelte mirrors this rule — keep them in step.
 */
export function clusterKind(counts: { total: number; dead: number; removed: number; prov: number }): Kind {
  if (counts.total > 0 && counts.dead === counts.total) return 'dead';
  if (counts.removed > 0) return 'removed';
  if (counts.prov > 0) return 'prov';
  return 'kota';
}

export function toFeatureCollection(cams: Camera[], liveness: LivenessMap): CameraFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: cams.map((cam) => ({
      type: 'Feature',
      id: cam.id,
      geometry: { type: 'Point', coordinates: [cam.lon, cam.lat] },
      properties: { id: cam.id, title: displayName(cam.title), kind: kindOf(cam, liveness) },
    })),
  };
}

const EARTH_RADIUS_M = 6_371_000;

export function distanceMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function nearest(cams: Camera[], target: Camera, n: number): Camera[] {
  return cams
    .filter((c) => c.id !== target.id)
    .map((c) => ({ c, d: distanceMeters(target, c) }))
    .sort((x, y) => x.d - y.d)
    .slice(0, n)
    .map((x) => x.c);
}
