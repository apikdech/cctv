<script lang="ts">
  import { onMount } from 'svelte';
  import CameraList from './components/CameraList.svelte';
  import MapView from './components/MapView.svelte';
  import Player from './components/Player.svelte';
  import { nearest } from './lib/geo';
  import { formatHash, resolveHashCamera } from './lib/hash';
  import { applyResults, checkAll, loadCache, probe, saveCache, type LivenessCache } from './lib/liveness';
  import { visibleCameras } from './lib/search';
  import type { Camera, LivenessMap, Toggles } from './lib/types';

  type Status = 'alive' | 'dead';
  const FLUSH_MS = 500;

  let cameras: Camera[] = $state([]);
  let liveness: LivenessMap = $state({});
  let toggles: Toggles = $state({ official: true, removed: true, dead: true });
  let selectedId: number | null = $state(null);
  let hoveredId: number | null = $state(null);
  let group: number[] | null = $state(null);
  let cache: LivenessCache = {};
  // Actual playback beats a background probe that finishes later.
  const playerResolved = new Set<number>();

  const visible = $derived(visibleCameras(cameras, toggles, liveness, selectedId));
  const selected = $derived(cameras.find((c) => c.id === selectedId) ?? null);
  const nearby = $derived(selected ? nearest(visible, selected, 5) : []);
  const groupCameras = $derived(group ? cameras.filter((c) => group!.includes(c.id)) : []);

  function storage(): Storage | null {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  function record(results: [number, Status][], skip?: ReadonlySet<number>) {
    if (!results.length) return;
    ({ liveness, cache } = applyResults(liveness, cache, results, Date.now(), skip));
    saveCache(storage(), cache);
  }

  function recordPlayback(id: number, status: Status) {
    playerResolved.add(id);
    record([[id, status]]);
  }

  function select(id: number) {
    selectedId = id;
    group = null;
    hoveredId = null;
    history.replaceState(null, '', formatHash(id));
  }

  function back() {
    selectedId = null;
    hoveredId = null;
    history.replaceState(null, '', location.pathname + location.search);
  }

  function showGroup(ids: number[]) {
    if (selectedId !== null) back();
    group = ids;
  }

  function syncFromHash() {
    const cam = resolveHashCamera(location.hash, cameras);
    if (cam) select(cam.id);
    else selectedId = null;
  }

  async function checkStreams() {
    const pending: [number, Status][] = [];
    const flush = setInterval(() => record(pending.splice(0), playerResolved), FLUSH_MS);
    try {
      await checkAll(
        cameras.filter((c) => !(c.id in cache)),
        { concurrency: 4, probe: (url) => probe(url), onResult: (id, status) => pending.push([id, status]) },
      );
    } finally {
      clearInterval(flush);
      record(pending.splice(0), playerResolved);
    }
  }

  onMount(() => {
    (async () => {
      cameras = await (await fetch('/cameras.json')).json();
      cache = loadCache(storage(), Date.now());
      liveness = Object.fromEntries(Object.entries(cache).map(([id, e]) => [id, e.status]));
      syncFromHash();
      await checkStreams();
    })();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  });
</script>

<div class="app">
  <aside class="panel">
    {#if selected}
      <Player
        camera={selected}
        {nearby}
        {liveness}
        onback={back}
        onselect={select}
        onhover={(id) => (hoveredId = id)}
        onliveness={recordPlayback}
      />
    {:else if group}
      <CameraList
        cameras={groupCameras}
        {liveness}
        {toggles}
        title={`${groupCameras.length} cameras here`}
        onback={() => (group = null)}
        ontoggle={(t) => (toggles = t)}
        onselect={select}
        onhover={(id) => (hoveredId = id)}
      />
    {:else}
      <CameraList
        cameras={visible}
        {liveness}
        {toggles}
        ontoggle={(t) => (toggles = t)}
        onselect={select}
        onhover={(id) => (hoveredId = id)}
      />
    {/if}
  </aside>

  <div class="map">
    <MapView cameras={visible} {liveness} {selected} {hoveredId} onselect={select} ongroup={showGroup} />
  </div>
</div>

<style>
  .app {
    display: grid;
    grid-template-columns: 360px 1fr;
    height: 100%;
  }
  .panel {
    min-height: 0;
    border-right: 1px solid #e5e7eb;
    background: #fff;
  }
  .map {
    min-height: 0;
  }
  @media (max-width: 640px) {
    .app {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr 45vh;
    }
    .panel {
      grid-row: 2;
      border-right: 0;
      border-top: 1px solid #e5e7eb;
    }
  }
</style>
