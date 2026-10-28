import { it, expect } from 'vitest';
import { nextTarget, startTrip, stepBack, stepForward, tripKey } from './trip';
import type { Camera } from './types';

const cam = (id: string, lon: number): Camera => ({
  id,
  ref: 1,
  dataset: 'kota',
  title: `Cam_${id}`,
  url: `u${id}`,
  lat: 0,
  lon,
  kecamatan: '',
  kelurahan: '',
  owner: '',
  slug: '',
  source: 'official',
  lastSeen: null,
});

const A = cam('A', 0);
const B = cam('B', 1);
const C = cam('C', 2);
const D = cam('D', 3);
const all = [A, B, C, D];

it('starts at the picked camera and walks outward without coming back', () => {
  let trip = startTrip('A');
  expect(nextTarget(trip, all, A)).toBe(B);

  trip = stepForward(trip, 'B');
  expect(nextTarget(trip, all, B)).toBe(C);

  trip = stepForward(trip, 'C');
  expect(nextTarget(trip, all, C)).toBe(D);

  trip = stepForward(trip, 'D');
  expect(nextTarget(trip, all, D)).toBeNull();
});

it('returns null when there is nowhere new to go', () => {
  expect(nextTarget(startTrip('A'), [A], A)).toBeNull();
});

it('only considers the cameras it is given', () => {
  expect(nextTarget(startTrip('A'), [A, C, D], A)).toBe(C);
});

it('steps back along the trail but remembers what was visited', () => {
  expect(stepBack(startTrip('A'))).toBeNull();

  let trip = startTrip('A');
  trip = stepForward(trip, 'B');
  trip = stepForward(trip, 'C');

  const back = stepBack(trip)!;
  expect(back.trail).toEqual(['A', 'B']);
  expect(back.visited).toContain('C');
  expect(nextTarget(back, all, B)).toBe(D);
});

it('reads the arrow keys and ignores everything else', () => {
  const key = (over: Partial<Parameters<typeof tripKey>[0]> = {}) => ({
    key: 'ArrowDown',
    repeat: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    target: null,
    ...over,
  });

  expect(tripKey(key())).toBe('next');
  expect(tripKey(key({ key: 'ArrowUp' }))).toBe('back');
  expect(tripKey(key({ key: 'ArrowLeft' }))).toBeNull();
  expect(tripKey(key({ key: 'j' }))).toBeNull();
  expect(tripKey(key({ repeat: true }))).toBeNull();
  expect(tripKey(key({ metaKey: true }))).toBeNull();
  expect(tripKey(key({ ctrlKey: true }))).toBeNull();
  expect(tripKey(key({ altKey: true }))).toBeNull();
});

it('leaves typing alone', () => {
  for (const tag of ['input', 'textarea', 'select']) {
    const target = document.createElement(tag);
    expect(
      tripKey({ key: 'ArrowDown', repeat: false, metaKey: false, ctrlKey: false, altKey: false, target }),
    ).toBeNull();
  }
});
