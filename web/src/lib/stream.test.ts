import { it, expect, vi, beforeEach } from 'vitest';

const instances: any[] = [];
vi.mock('hls.js', () => {
  class FakeHls {
    static Events = { MANIFEST_PARSED: 'manifestParsed', ERROR: 'hlsError' };
    static isSupported = vi.fn(() => true);
    handlers: Record<string, Function> = {};
    destroyed = false;
    config?: Record<string, unknown>;
    constructor(config?: Record<string, unknown>) {
      this.config = config;
      instances.push(this);
    }
    on(ev: string, cb: Function) {
      this.handlers[ev] = cb;
    }
    loadSource() {}
    attachMedia() {}
    destroy() {
      this.destroyed = true;
    }
    emit(ev: string, data?: unknown) {
      this.handlers[ev]?.(ev, data);
    }
  }
  return { default: FakeHls };
});

import Hls from 'hls.js';
import { attachStream } from './stream';

const supported = (yes: boolean) => (Hls as any).isSupported.mockReturnValue(yes);
let video: HTMLVideoElement;

beforeEach(() => {
  instances.length = 0;
  supported(true);
  video = document.createElement('video');
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  HTMLMediaElement.prototype.load = vi.fn();
});

it('reports alive on manifest and dead on a fatal error', () => {
  const seen: string[] = [];
  attachStream(video, 'u1', (s) => seen.push(s));
  instances[0].emit('manifestParsed');
  instances[0].emit('hlsError', { fatal: true });
  expect(seen).toEqual(['alive', 'dead']);
});

it('starts two target durations behind live', () => {
  attachStream(video, 'u1', () => {});
  expect(instances[0].config).toMatchObject({ liveSyncDurationCount: 2 });
});

it('ignores a non-fatal hls error', () => {
  const seen: string[] = [];
  attachStream(video, 'u1', (s) => seen.push(s));
  instances[0].emit('hlsError', { fatal: false });
  expect(seen).toEqual([]);
});

it('reports dead when nothing plays within 15s', () => {
  vi.useFakeTimers();
  try {
    const seen: string[] = [];
    attachStream(video, 'u1', (s) => seen.push(s));
    instances[0].emit('manifestParsed');
    vi.advanceTimersByTime(15_000);
    expect(seen.at(-1)).toBe('dead');
  } finally {
    vi.useRealTimers();
  }
});

it('a playing event cancels the stall timer', () => {
  vi.useFakeTimers();
  try {
    const seen: string[] = [];
    attachStream(video, 'u1', (s) => seen.push(s));
    instances[0].emit('manifestParsed');
    video.dispatchEvent(new Event('playing'));
    vi.advanceTimersByTime(15_000);
    expect(seen).not.toContain('dead');
  } finally {
    vi.useRealTimers();
  }
});

it('cleanup destroys hls and silences later events', () => {
  vi.useFakeTimers();
  try {
    const seen: string[] = [];
    const stop = attachStream(video, 'u1', (s) => seen.push(s));
    stop();
    expect(instances[0].destroyed).toBe(true);
    instances[0].emit('hlsError', { fatal: true });
    vi.advanceTimersByTime(15_000);
    expect(seen).toEqual([]);
  } finally {
    vi.useRealTimers();
  }
});

it('plays natively where hls.js is not supported', () => {
  supported(false);
  video.canPlayType = () => 'maybe';
  const seen: string[] = [];
  const stop = attachStream(video, 'native1', (s) => seen.push(s));
  expect(video.getAttribute('src')).toBe('native1');
  video.dispatchEvent(new Event('loadeddata'));
  video.dispatchEvent(new Event('error'));
  expect(seen).toEqual(['alive', 'dead']);
  stop();
  expect(video.getAttribute('src')).toBeNull();
});

it('reports unsupported when the browser can play neither', () => {
  supported(false);
  video.canPlayType = () => '';
  const seen: string[] = [];
  const stop = attachStream(video, 'u1', (s) => seen.push(s));
  expect(seen).toEqual(['unsupported']);
  expect(() => stop()).not.toThrow();
});
