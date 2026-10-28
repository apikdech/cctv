import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { it, expect, vi, beforeEach } from 'vitest';

const instances: any[] = [];
vi.mock('hls.js', () => {
  class FakeHls {
    static Events = { MANIFEST_PARSED: 'manifestParsed', ERROR: 'hlsError' };
    static isSupported = () => true;
    handlers: Record<string, Function> = {}; destroyed = false;
    constructor() { instances.push(this); }
    on(ev: string, cb: Function) { this.handlers[ev] = cb; }
    loadSource() {} attachMedia() {}
    destroy() { this.destroyed = true; }
    emit(ev: string, data?: unknown) { this.handlers[ev]?.(ev, data); }
  }
  return { default: FakeHls };
});
import Player from './Player.svelte';
import type { Camera } from '../lib/types';

const cam = (id: string): Camera => ({ id, ref: 1, dataset: 'kota', title: `Cam_${id}`, url: `u${id}`, lat: 0, lon: 0, kecamatan: '', kelurahan: '', owner: '', slug: '', source: 'removed', lastSeen: '2025-09-01' });
const props = () => ({ camera: cam('kota-1'), nearby: [], liveness: {}, onback: vi.fn(), onselect: vi.fn(), onhover: vi.fn(), onliveness: vi.fn() });
beforeEach(() => { instances.length = 0; HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined); });

it('reports alive on manifest, dead + message on fatal error', async () => {
  const p = props();
  render(Player, p);
  instances[0].emit('manifestParsed');
  expect(p.onliveness).toHaveBeenCalledWith('kota-1', 'alive');
  instances[0].emit('hlsError', { fatal: true });
  expect(p.onliveness).toHaveBeenCalledWith('kota-1', 'dead');
  expect(await screen.findByText("This camera isn't streaming right now")).toBeInTheDocument();
  expect(screen.getByText('Removed · last seen 2025-09-01')).toBeInTheDocument();
});

it('ignores events from a previous camera', async () => {
  const p = props();
  const { rerender } = render(Player, p);
  await rerender({ ...p, camera: cam('kota-2') });
  expect(instances[0].destroyed).toBe(true);
  instances[0].emit('hlsError', { fatal: true });
  expect(p.onliveness).not.toHaveBeenCalled();
  expect(screen.queryByText("This camera isn't streaming right now")).toBeNull();
});

it('reports dead when the video never starts playing', async () => {
  vi.useFakeTimers();
  try {
    const p = props();
    render(Player, p);
    instances[0].emit('manifestParsed');
    await vi.advanceTimersByTimeAsync(15_000);
    expect(p.onliveness).toHaveBeenLastCalledWith('kota-1', 'dead');
    expect(screen.getByText("This camera isn't streaming right now")).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

it('does not time out once the video is playing', async () => {
  vi.useFakeTimers();
  try {
    const p = props();
    const { container } = render(Player, p);
    instances[0].emit('manifestParsed');
    container.querySelector('video')!.dispatchEvent(new Event('playing'));
    await vi.advanceTimersByTimeAsync(15_000);
    expect(p.onliveness).not.toHaveBeenCalledWith('kota-1', 'dead');
    expect(screen.queryByText("This camera isn't streaming right now")).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});

it('fullscreen button requests fullscreen', async () => {
  const req = vi.fn().mockResolvedValue(undefined);
  HTMLElement.prototype.requestFullscreen = req;
  render(Player, props());
  await userEvent.click(screen.getByLabelText('Fullscreen'));
  expect(req).toHaveBeenCalled();
});

it('fullscreen button exits fullscreen when already fullscreen', async () => {
  const exit = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => document.body });
  document.exitFullscreen = exit;
  try {
    render(Player, props());
    await userEvent.click(screen.getByLabelText('Fullscreen'));
    expect(exit).toHaveBeenCalled();
  } finally {
    delete (document as any).fullscreenElement;
    delete (document as any).exitFullscreen;
  }
});
