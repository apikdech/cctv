import { it, expect } from 'vitest';
import { kindOf, toFeatureCollection, nearest, distanceMeters } from './geo';
import type { Camera } from './types';
const cam = (id: number, lat: number, lon: number, source: Camera['source'] = 'official'): Camera =>
  ({ id, title: `Cam_${id}`, url: '', lat, lon, kecamatan: '', kelurahan: '', source, lastSeen: null });

it('dead overrides source', () => {
  expect(kindOf(cam(1, 0, 0, 'removed'), {})).toBe('removed');
  expect(kindOf(cam(1, 0, 0, 'official'), { 1: 'dead' })).toBe('dead');
});
it('builds point features in lon,lat order with display names', () => {
  const fc = toFeatureCollection([cam(7, -7.8, 110.37)], {});
  expect(fc.features[0]).toMatchObject({ id: 7, geometry: { coordinates: [110.37, -7.8] }, properties: { id: 7, title: 'Cam 7', kind: 'official' } });
});
it('nearest excludes the target and sorts by distance', () => {
  const t = cam(1, -7.8, 110.37), far = cam(2, -7.9, 110.37), near = cam(3, -7.801, 110.37);
  expect(nearest([t, far, near], t, 5).map(c => c.id)).toEqual([3, 2]);
  expect(Math.round(distanceMeters(t, near))).toBe(111);
});
