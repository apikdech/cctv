import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { it, expect, vi, beforeEach } from 'vitest';

vi.mock('maplibre-gl', () => ({
  Map: class {
    constructor(options: { style?: string }) {
      mapOptions.push(options);
    }
    on() {}
    once() {}
    setStyle() {}
    addSource() {}
    addLayer() {}
    fitBounds() {}
    flyTo() {}
    getZoom() {
      return 12;
    }
    getCanvas() {
      return { style: {} };
    }
    remove() {}
  },
  Popup: class {
    setLngLat() {
      return this;
    }
    setText() {
      return this;
    }
    addTo() {
      return this;
    }
    remove() {}
  },
  LngLatBounds: class {
    extend() {}
  },
  setWorkerUrl() {},
}));

vi.mock('hls.js', () => {
  class FakeHls {
    static Events = { MANIFEST_PARSED: 'manifestParsed', ERROR: 'hlsError' };
    static isSupported = () => true;
    on() {}
    loadSource() {}
    attachMedia() {}
    destroy() {}
  }
  return { default: FakeHls };
});

import App from './App.svelte';

const { mapOptions } = vi.hoisted(() => ({ mapOptions: [] as { style?: string }[] }));

const cams = [
  { id: 'kota-1', ref: 1, dataset: 'kota', title: 'Simpang_A', url: 'u1', lat: -7.8, lon: 110.36, kecamatan: 'GONDOKUSUMAN', kelurahan: '', owner: '', slug: '', source: 'official', lastSeen: null },
  { id: 'kota-2', ref: 2, dataset: 'kota', title: 'Simpang_B', url: 'u2', lat: -7.81, lon: 110.37, kecamatan: 'GONDOKUSUMAN', kelurahan: '', owner: '', slug: '', source: 'official', lastSeen: null },
  { id: 'kota-3', ref: 3, dataset: 'kota', title: 'Simpang_C', url: 'u3', lat: -7.83, lon: 110.39, kecamatan: 'GONDOKUSUMAN', kelurahan: '', owner: '', slug: '', source: 'official', lastSeen: null },
];

beforeEach(() => {
  history.replaceState(null, '', '/');
  localStorage.clear();
  mapOptions.length = 0;
  delete document.documentElement.dataset.theme;
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('cameras.json')) return new Response(JSON.stringify(cams), { status: 200 });
    return new Response('', { status: 404 });
  }));
});

it('restores a wall from the link', async () => {
  history.replaceState(null, '', '/#wall=kota-1,kota-2');
  render(App);
  expect(await screen.findByTestId('grid')).toBeInTheDocument();
  expect(screen.getByText('← map')).toBeInTheDocument();
});

it('drops a wall link that resolves to nothing', async () => {
  history.replaceState(null, '', '/#wall=nope');
  render(App);
  await screen.findByText('Simpang A');
  expect(location.hash).toBe('');
  expect(screen.queryByTestId('grid')).toBeNull();
});

const addPlayingCamera = () => within(document.querySelector('.info') as HTMLElement).getByText('Add to wall');

it('leaving the wall clears the wall from the URL', async () => {
  render(App);
  await userEvent.click(await screen.findByText('Simpang A'));
  expect(location.hash).toBe('#cam=kota-1');
  await userEvent.click(addPlayingCamera());
  await userEvent.click(screen.getByText('Wall (1)'));
  expect(location.hash).toBe('#wall=kota-1');
  await userEvent.keyboard('m');
  expect(screen.queryByTestId('grid')).toBeNull();
  expect(location.hash).toBe('#cam=kota-1');
});

it('theme button cycles System → Light → Dark and applies it', async () => {
  render(App);
  await screen.findByText('Simpang A');

  const button = () => screen.getByRole('button', { name: /^Theme: / });
  expect(button()).toHaveAccessibleName('Theme: System');
  expect(document.documentElement.dataset.theme).toBe('light');

  await userEvent.click(button());
  expect(button()).toHaveAccessibleName('Theme: Light');
  expect(localStorage.getItem('cctv-theme')).toBe('light');
  expect(document.documentElement.dataset.theme).toBe('light');

  await userEvent.click(button());
  expect(button()).toHaveAccessibleName('Theme: Dark');
  expect(localStorage.getItem('cctv-theme')).toBe('dark');
  expect(document.documentElement.dataset.theme).toBe('dark');

  await userEvent.click(button());
  expect(button()).toHaveAccessibleName('Theme: System');
  expect(localStorage.getItem('cctv-theme')).toBeNull();
  expect(document.documentElement.dataset.theme).toBe('light');
});

it('restores a stored panel width, clamped to the window', async () => {
  localStorage.setItem('cctv-panel-width', '900');
  const { container } = render(App);
  await screen.findByText('Simpang A');
  expect((container.querySelector('.app') as HTMLElement).style.getPropertyValue('--panel-w')).toBe('704px');
  expect(localStorage.getItem('cctv-panel-width')).toBe('900');
});

it('arrow down walks outward, arrow up steps back', async () => {
  render(App);
  await userEvent.click(await screen.findByText('Simpang A'));
  expect(location.hash).toBe('#cam=kota-1');
  const nextRow = () => screen.getAllByRole('listitem')[0];
  expect(within(nextRow()).getByText('Simpang B')).toBeInTheDocument();

  await userEvent.keyboard('{ArrowDown}');
  expect(location.hash).toBe('#cam=kota-2');
  await userEvent.keyboard('{ArrowDown}');
  expect(location.hash).toBe('#cam=kota-3');
  await userEvent.keyboard('{ArrowUp}');
  expect(location.hash).toBe('#cam=kota-2');
  await userEvent.keyboard('{ArrowUp}');
  expect(location.hash).toBe('#cam=kota-1');
  await userEvent.keyboard('{ArrowUp}');
  expect(location.hash).toBe('#cam=kota-1');
});

it('picking a camera starts a new trip', async () => {
  render(App);
  await userEvent.click(await screen.findByText('Simpang A'));
  await userEvent.keyboard('{ArrowDown}');
  expect(location.hash).toBe('#cam=kota-2');

  const aside = document.querySelector('aside') as HTMLElement;
  await userEvent.click(within(aside).getByRole('button', { name: /Simpang A/ }));
  expect(location.hash).toBe('#cam=kota-1');

  await userEvent.keyboard('{ArrowDown}');
  expect(location.hash).toBe('#cam=kota-2');
});

it('leaves the arrow keys alone on the list', async () => {
  render(App);
  await screen.findByText('Simpang A');
  await userEvent.keyboard('{ArrowDown}');
  expect(location.hash).toBe('');
});

it('starts on the dark map style when the system is dark', async () => {
  window.matchMedia = vi.fn().mockImplementation((media: string) => ({
    matches: true,
    media,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  try {
    render(App);
    await screen.findByText('Simpang A');
    expect(mapOptions[0]?.style).toBe('https://tiles.openfreemap.org/styles/dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  } finally {
    delete (window as { matchMedia?: unknown }).matchMedia;
  }
});

it('opening the wall tears down the single player underneath', async () => {
  const { container } = render(App);
  await userEvent.click(await screen.findByText('Simpang A'));
  expect(container.querySelectorAll('video')).toHaveLength(1);
  await userEvent.click(addPlayingCamera());
  await userEvent.click(screen.getByText('Wall (1)'));

  expect(screen.getByTestId('grid')).toBeInTheDocument();
  expect(container.querySelectorAll('video')).toHaveLength(1);
  const aside = document.querySelector('aside') as HTMLElement & { inert: boolean };
  // jsdom does not reflect the inert property to the attribute; either proves it.
  expect(aside.inert || aside.hasAttribute('inert')).toBe(true);
});
