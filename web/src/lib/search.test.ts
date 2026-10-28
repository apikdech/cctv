import { describe, it, expect } from 'vitest';
import { displayName, searchCameras, visibleCameras } from './search';
import type { Camera } from './types';

const cam = (id: number, title: string, source: Camera['source'] = 'official'): Camera =>
  ({ id, title, url: `u${id}`, lat: -7.8, lon: 110.37, kecamatan: '', kelurahan: '', source, lastSeen: null });
const all = { official: true, removed: true, dead: true };

describe('search', () => {
  it('displayName replaces underscores', () => {
    expect(displayName('Malioboro_Mall_Utara')).toBe('Malioboro Mall Utara');
  });
  it('matches across underscores and case', () => {
    const cams = [cam(1, 'Malioboro_Mall_Utara'), cam(2, 'Simpang Tugu (PTZ)')];
    expect(searchCameras(cams, 'malioboro mall').map(c => c.id)).toEqual([1]);
    expect(searchCameras(cams, '  TUGU ').map(c => c.id)).toEqual([2]);
    expect(searchCameras(cams, '').length).toBe(2);
  });
});

describe('visibleCameras', () => {
  const cams = [cam(1, 'a'), cam(2, 'b', 'removed'), cam(3, 'c', 'removed')];
  it('filters by source and dead toggles', () => {
    const live = { 2: 'alive', 3: 'dead' } as const;
    expect(visibleCameras(cams, { ...all, official: false }, live, null).map(c => c.id)).toEqual([2, 3]);
    expect(visibleCameras(cams, { ...all, dead: false }, live, null).map(c => c.id)).toEqual([1, 2]);
  });
  it('keeps the selected camera visible', () => {
    expect(visibleCameras(cams, { ...all, dead: false }, { 3: 'dead' }, 3).map(c => c.id)).toEqual([1, 2, 3]);
  });
});
