import { distanceMeters } from './geo';
import type { Camera } from './types';

export interface Trip {
  /** The cameras walked through, oldest first; the last is the current one. */
  trail: string[];
  visited: string[];
}

export function startTrip(id: string): Trip {
  return { trail: [id], visited: [id] };
}

export function nextTarget(trip: Trip, cams: Camera[], current: Camera): Camera | null {
  let best: Camera | null = null;
  let bestDistance = Infinity;
  for (const cam of cams) {
    if (cam.id === current.id || trip.visited.includes(cam.id)) continue;
    const d = distanceMeters(current, cam);
    if (d < bestDistance) {
      best = cam;
      bestDistance = d;
    }
  }
  return best;
}

export function stepForward(trip: Trip, id: string): Trip {
  return { trail: [...trip.trail, id], visited: [...trip.visited, id] };
}

/** Backing out forgets the step, but not that the camera was seen. */
export function stepBack(trip: Trip): Trip | null {
  if (trip.trail.length < 2) return null;
  return { trail: trip.trail.slice(0, -1), visited: trip.visited };
}

type KeyLike = {
  key: string;
  repeat: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
};

export function tripKey(e: KeyLike): 'next' | 'back' | null {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return null;
  const tag = (e.target as HTMLElement | null)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return null;
  if (e.key === 'ArrowDown') return 'next';
  if (e.key === 'ArrowUp') return 'back';
  return null;
}
