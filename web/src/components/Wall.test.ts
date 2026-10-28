import { fireEvent, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { it, expect, vi, beforeEach } from 'vitest';

const instances: any[] = [];
vi.mock('hls.js', () => {
  class FakeHls {
    static Events = { MANIFEST_PARSED: 'manifestParsed', ERROR: 'hlsError' };
    static isSupported = () => true;
    handlers: Record<string, Function> = {};
    destroyed = false;
    constructor() {
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
import Wall from './Wall.svelte';
import type { Camera } from '../lib/types';

const cam = (id: string): Camera => ({ id, ref: 1, dataset: 'kota', title: `Cam_${id}`, url: `u${id}`, lat: 0, lon: 0, kecamatan: '', kelurahan: '', owner: '', slug: '', source: 'official', lastSeen: null });
const cameras = [cam('a'), cam('b'), cam('c')];
const props = (cams: Camera[] = cameras) => ({ cameras: cams, onclose: vi.fn(), onremove: vi.fn(), onswap: vi.fn(), onliveness: vi.fn() });

beforeEach(() => {
  instances.length = 0;
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
});

it('shows a tile per camera and the count', () => {
  const { unmount } = render(Wall, props());
  expect(screen.getByText('Cam a')).toBeInTheDocument();
  expect(screen.getByText('Cam b')).toBeInTheDocument();
  expect(screen.getByText('Cam c')).toBeInTheDocument();
  expect(screen.getByText('3 cameras')).toBeInTheDocument();
  unmount();
  render(Wall, props([cam('a')]));
  expect(screen.getByText('1 camera')).toBeInTheDocument();
});

it('grid follows the count', () => {
  const { unmount } = render(Wall, props());
  const grid = screen.getByTestId('grid');
  expect(grid.style.getPropertyValue('--cols')).toBe('2');
  expect(grid.style.getPropertyValue('--rows')).toBe('2');
  unmount();
  render(Wall, props(['a', 'b', 'c', 'd', 'e'].map(cam)));
  expect(screen.getByTestId('grid').style.getPropertyValue('--cols')).toBe('3');
  expect(screen.getByTestId('grid').style.getPropertyValue('--rows')).toBe('2');
});

it('remove button reports the id', async () => {
  const p = props();
  render(Wall, p);
  await userEvent.click(screen.getByLabelText('Remove Cam a from wall'));
  expect(p.onremove).toHaveBeenCalledWith('a');
});

it('back button and M close the wall', async () => {
  const p = props();
  render(Wall, p);
  await userEvent.click(screen.getByText('← map'));
  expect(p.onclose).toHaveBeenCalledTimes(1);
  await userEvent.keyboard('m');
  expect(p.onclose).toHaveBeenCalledTimes(2);
  await userEvent.keyboard('{Control>}m{/Control}');
  expect(p.onclose).toHaveBeenCalledTimes(2);
});

it('a failing stream stays in its tile', async () => {
  const p = props();
  const { container } = render(Wall, p);
  instances[1].emit('hlsError', { fatal: true });
  expect(await screen.findByText("This camera isn't streaming right now")).toBeInTheDocument();
  expect(p.onliveness).toHaveBeenCalledWith('b', 'dead');
  expect(container.querySelectorAll('[data-tile]')).toHaveLength(3);
});

it('drop swaps, dropping on itself does not', async () => {
  const p = props();
  const { container } = render(Wall, p);
  const tile = (id: string) => container.querySelector(`[data-tile="${id}"]`)!;
  await fireEvent.dragStart(tile('a'));
  await fireEvent.dragOver(tile('c'));
  await fireEvent.drop(tile('c'));
  expect(p.onswap).toHaveBeenCalledWith('a', 'c');
  await fireEvent.dragStart(tile('b'));
  await fireEvent.drop(tile('b'));
  expect(p.onswap).toHaveBeenCalledTimes(1);
});

it('reordering does not restart streams', async () => {
  const p = props();
  const { container, rerender } = render(Wall, p);
  const domOrder = () => [...container.querySelectorAll('[data-tile]')].map((t) => (t as HTMLElement).dataset.tile);
  const before = domOrder();
  const made = instances.length;
  await rerender({ ...p, cameras: [cam('c'), cam('b'), cam('a')] });
  expect(domOrder()).toEqual(before);
  expect(instances).toHaveLength(made);
  expect(instances.some((h) => h.destroyed)).toBe(false);
  const slot = (id: string) => container.querySelector(`[data-tile="${id}"]`) as HTMLElement;
  expect(slot('a').style.order).toBe('2');
  expect(slot('c').style.order).toBe('0');
});

it('double-click on a tile requests fullscreen', async () => {
  const req = vi.fn().mockResolvedValue(undefined);
  HTMLElement.prototype.requestFullscreen = req;
  const { container } = render(Wall, props());
  await fireEvent.doubleClick(container.querySelector('[data-tile="a"] .tile')!);
  expect(req).toHaveBeenCalled();
});
