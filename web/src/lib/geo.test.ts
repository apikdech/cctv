import { it, expect } from 'vitest';
import { kindOf, toFeatureCollection, nearest, distanceMeters } from './geo';
import type { Camera } from './types';

const cam = (id: string, lat: number, lon: number, source: Camera['source'] = 'official', dataset: Camera['dataset'] = 'kota'): Camera =>
  ({ id, ref: 1, dataset, title: `Cam_${id}`, url: '', lat, lon, kecamatan: '', kelurahan: '', owner: '', slug: '', source, lastSeen: null });
const prov = (id: string) => cam(id, 0, 0, 'official', 'prov');

it('dead overrides source', () => {
  expect(kindOf(cam('kota-1', 0, 0, 'removed'), {})).toBe('removed');
  expect(kindOf(cam('kota-1', 0, 0, 'official'), { 'kota-1': 'dead' })).toBe('dead');
});

it('separates province from city and lets dead win', () => {
  expect(kindOf(cam('kota-1', 0, 0), {})).toBe('kota');
  expect(kindOf(prov('prov-1'), {})).toBe('prov');
  expect(kindOf(prov('prov-1'), { 'prov-1': 'dead' })).toBe('dead');
});

it('builds point features in lon,lat order with display names', () => {
  const fc = toFeatureCollection([cam('kota-7', -7.8, 110.37)], {});
  expect(fc.features[0]).toMatchObject({ id: 'kota-7', geometry: { coordinates: [110.37, -7.8] }, properties: { id: 'kota-7', title: 'Cam kota-7', kind: 'kota' } });
});

it('nearest excludes the target and sorts by distance', () => {
  const t = cam('kota-1', -7.8, 110.37), far = cam('kota-2', -7.9, 110.37), near = cam('kota-3', -7.801, 110.37);
  expect(nearest([t, far, near], t, 5).map(c => c.id)).toEqual(['kota-3', 'kota-2']);
  expect(Math.round(distanceMeters(t, near))).toBe(111);
});
