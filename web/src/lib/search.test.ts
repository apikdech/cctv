import { describe, it, expect } from 'vitest';
import { displayName, searchCameras, visibleCameras } from './search';
import type { Camera } from './types';

const cam = (id: string, title: string, extra: Partial<Camera> = {}): Camera => ({
  id, ref: 1, dataset: 'kota', title, url: `u${id}`, lat: -7.8, lon: 110.37, kecamatan: '', kelurahan: '',
  owner: '', slug: '', source: 'official', lastSeen: null, ...extra,
});
const all = { kota: true, prov: true, removed: true, dead: true };

describe('search', () => {
  it('displayName replaces underscores', () => {
    expect(displayName('Malioboro_Mall_Utara')).toBe('Malioboro Mall Utara');
  });
  it('matches across underscores and case', () => {
    const cams = [cam('kota-1', 'Malioboro_Mall_Utara'), cam('kota-2', 'Simpang Tugu (PTZ)')];
    expect(searchCameras(cams, 'malioboro mall').map(c => c.id)).toEqual(['kota-1']);
    expect(searchCameras(cams, '  TUGU ').map(c => c.id)).toEqual(['kota-2']);
    expect(searchCameras(cams, '').length).toBe(2);
  });

  it('splits camelCase for display and matching', () => {
    expect(displayName('JogokariyanSelatan')).toBe('Jogokariyan Selatan');
    const cams = [cam('prov-1', 'JogokariyanSelatan', { dataset: 'prov' })];
    expect(searchCameras(cams, 'jogokariyan selatan').map(c => c.id)).toEqual(['prov-1']);
  });

  it('finds place names that only exist in the slug', () => {
    const cams = [cam('prov-1281', 'ViewDepanMall', { dataset: 'prov', slug: 'depan-plazamall-malioboro' })];
    expect(searchCameras(cams, 'malioboro').map(c => c.id)).toEqual(['prov-1281']);
  });

  it('matches agency names and expands dishub', () => {
    const cams = [cam('prov-9', 'RingRoad', { dataset: 'prov', owner: 'Dinas Perhubungan DIY' })];
    expect(searchCameras(cams, 'dishub').map(c => c.id)).toEqual(['prov-9']);
    expect(searchCameras(cams, 'perhubungan').map(c => c.id)).toEqual(['prov-9']);
  });

  it('matches provinsi and kota as dataset words', () => {
    const cams = [cam('kota-1', 'A'), cam('prov-2', 'B', { dataset: 'prov' })];
    expect(searchCameras(cams, 'provinsi').map(c => c.id)).toEqual(['prov-2']);
    expect(searchCameras(cams, 'kota').map(c => c.id)).toEqual(['kota-1']);
  });

  it('ranks title matches above place matches', () => {
    const cams = [cam('prov-1', 'X', { dataset: 'prov', owner: 'Sleman' }), cam('prov-2', 'Sleman Ring Road', { dataset: 'prov', owner: 'Bantul' })];
    expect(searchCameras(cams, 'sleman').map(c => c.id)).toEqual(['prov-2', 'prov-1']);
  });
});

describe('visibleCameras', () => {
  const cams = [cam('kota-1', 'a'), cam('prov-2', 'b', { dataset: 'prov' }), cam('kota-3', 'c', { source: 'removed' })];

  it('hides a dataset when its toggle is off', () => {
    expect(visibleCameras(cams, { ...all, kota: false }, {}, null).map(c => c.id)).toEqual(['prov-2']);
    expect(visibleCameras(cams, { ...all, prov: false }, {}, null).map(c => c.id)).toEqual(['kota-1', 'kota-3']);
  });

  it('hides removed cameras', () => {
    expect(visibleCameras(cams, { ...all, removed: false }, {}, null).map(c => c.id)).toEqual(['kota-1', 'prov-2']);
  });

  it('hides dead cameras unless they are selected', () => {
    const live = { 'prov-2': 'dead' } as const;
    expect(visibleCameras(cams, { ...all, dead: false }, live, null).map(c => c.id)).toEqual(['kota-1', 'kota-3']);
    expect(visibleCameras(cams, { ...all, dead: false }, live, 'prov-2').map(c => c.id)).toEqual(['kota-1', 'prov-2', 'kota-3']);
  });
});
