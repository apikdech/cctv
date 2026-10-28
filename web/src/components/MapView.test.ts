import { render } from '@testing-library/svelte';
import { it, expect, vi, beforeEach } from 'vitest';

const { maps } = vi.hoisted(() => ({ maps: [] as Array<Record<string, any>> }));

vi.mock('maplibre-gl', () => {
  class FakeMap {
    handlers = new Map<string, Function[]>();
    keyboard = { enable: vi.fn(), disable: vi.fn(), isEnabled: vi.fn(() => true) };
    failStyle = false;
    setStyle = vi.fn(() => {
      setTimeout(
        () =>
          this.failStyle
            ? this.emit('error', { error: new Error('style failed') })
            : this.emit('style.load'),
        0,
      );
    });
    sources: Record<string, { setData: ReturnType<typeof vi.fn> }> = {};

    constructor() {
      maps.push(this);
      setTimeout(() => this.emit('load'), 0);
    }
    on(ev: string, cb: Function) {
      this.handlers.set(ev, [...(this.handlers.get(ev) ?? []), cb]);
    }
    once(ev: string, cb: Function) {
      const wrap = (...args: unknown[]) => {
        this.off(ev, wrap);
        cb(...args);
      };
      this.on(ev, wrap);
    }
    off(ev: string, cb: Function) {
      this.handlers.set(ev, (this.handlers.get(ev) ?? []).filter((h) => h !== cb));
    }
    emit(ev: string, payload?: unknown) {
      for (const cb of [...(this.handlers.get(ev) ?? [])]) cb(payload);
    }
    addSource(id: string) {
      this.sources[id] = { setData: vi.fn() };
    }
    addLayer() {}
    getSource(id: string) {
      return this.sources[id] ?? (this.sources[id] = { setData: vi.fn() });
    }
    fitBounds() {}
    flyTo() {}
    getZoom() {
      return 12;
    }
    getCanvas() {
      return { style: {} };
    }
    remove() {}
  }

  return {
    Map: FakeMap,
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
  };
});

import MapView from './MapView.svelte';

const props = (theme: 'light' | 'dark') => ({
  cameras: [],
  liveness: {},
  selected: null,
  hoveredId: null,
  theme,
  keyboard: true,
  onselect: vi.fn(),
  ongroup: vi.fn(),
});

beforeEach(() => {
  maps.length = 0;
});

it('re-adds the camera layers once the new style arrives', async () => {
  const { rerender } = render(MapView, props('light'));
  await vi.waitFor(() => expect(maps[0].keyboard.enable).toHaveBeenCalled());

  const addSource = vi.spyOn(maps[0], 'addSource');
  await rerender(props('dark'));
  await vi.waitFor(() => expect(addSource).toHaveBeenCalledWith('cameras', expect.anything()));
  expect(addSource).toHaveBeenCalledWith('highlight', expect.anything());
});

it('stays usable when a style swap fails, and retries on the next toggle', async () => {
  const { rerender } = render(MapView, props('light'));
  await vi.waitFor(() => expect(maps[0].keyboard.enable).toHaveBeenCalledTimes(1));
  maps[0].failStyle = true;

  await rerender(props('dark'));
  await vi.waitFor(() => expect(maps[0].setStyle).toHaveBeenCalledTimes(1));
  // The map keeps working after the failed swap instead of going inert.
  await vi.waitFor(() => expect(maps[0].keyboard.enable).toHaveBeenCalledTimes(2));

  await rerender(props('light'));
  await vi.waitFor(() => expect(maps[0].setStyle).toHaveBeenCalledTimes(2));
});
