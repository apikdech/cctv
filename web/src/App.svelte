<script lang="ts">
  import { onMount } from 'svelte';
  import CameraList from './components/CameraList.svelte';
  import MapView from './components/MapView.svelte';
  import Player from './components/Player.svelte';
  import Wall from './components/Wall.svelte';
  import { nearest } from './lib/geo';
  import { formatHash, formatWallHash, resolveHashCamera, resolveWallHash } from './lib/hash';
  import { applyResults, checkAll, loadCache, probe, saveCache, type LivenessCache } from './lib/liveness';
  import { visibleCameras } from './lib/search';
  import { loadStatus } from './lib/status';
  import { addToWall, removeFromWall, swapInWall } from './lib/wall';
  import type { Camera, LivenessMap, Toggles } from './lib/types';

  type Status = 'alive' | 'dead';
  const FLUSH_MS = 500;

  let cameras: Camera[] = $state([]);
  let liveness: LivenessMap = $state({});
  let toggles: Toggles = $state({ kota: true, prov: true, removed: true, dead: true });
  let selectedId: string | null = $state(null);
  let hoveredId: string | null = $state(null);
  let group: string[] | null = $state(null);
  let wallIds: string[] = $state([]);
  let wallOpen = $state(false);
  let cache: LivenessCache = {};
  // Actual playback beats a background probe that finishes later.
  const playerResolved = new Set<string>();

  const visible = $derived(visibleCameras(cameras, toggles, liveness, selectedId));
  const selected = $derived(cameras.find((c) => c.id === selectedId) ?? null);
  const nearby = $derived(selected ? nearest(visible, selected, 5) : []);
  const groupCameras = $derived(group ? cameras.filter((c) => group!.includes(c.id)) : []);
  const wallCameras = $derived(wallIds.map((id) => cameras.find((c) => c.id === id)).filter((c): c is Camera => !!c));

  function storage(): Storage | null {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  function record(results: [string, Status][], skip?: ReadonlySet<string>) {
    if (!results.length) return;
    ({ liveness, cache } = applyResults(liveness, cache, results, Date.now(), skip));
    saveCache(storage(), cache);
  }

  function recordPlayback(id: string, status: Status) {
    playerResolved.add(id);
    record([[id, status]]);
  }

  function select(id: string) {
    selectedId = id;
    group = null;
    hoveredId = null;
    history.replaceState(null, '', formatHash(id));
  }

  function listUrl(): string {
    return selectedId ? formatHash(selectedId) : location.pathname + location.search;
  }

  function back() {
    selectedId = null;
    hoveredId = null;
    history.replaceState(null, '', listUrl());
  }

  function showGroup(ids: string[]) {
    if (selectedId !== null) back();
    group = ids;
  }

  function openWall() {
    wallOpen = true;
    history.replaceState(null, '', formatWallHash(wallIds));
  }

  function closeWall() {
    if (!wallOpen) return;
    wallOpen = false;
    history.replaceState(null, '', listUrl());
  }

  function toggleWall(id: string) {
    const next = wallIds.includes(id) ? removeFromWall(wallIds, id) : addToWall(wallIds, id);
    if (next === wallIds) return;
    wallIds = next;
    if (!wallOpen) return;
    if (wallIds.length === 0) closeWall();
    else history.replaceState(null, '', formatWallHash(wallIds));
  }

  function swapTiles(fromId: string, toId: string) {
    const next = swapInWall(wallIds, fromId, toId);
    if (next === wallIds) return;
    wallIds = next;
    if (wallOpen) history.replaceState(null, '', formatWallHash(wallIds));
  }

  function syncFromHash() {
    const wall = resolveWallHash(location.hash, cameras);
    if (wall.length) {
      wallIds = wall;
      wallOpen = true;
      return;
    }
    // Not a wall link: the user left the wall, if they were on it.
    if (wallOpen) wallOpen = false;
    // A wall link with nothing usable is not a camera link either; drop it.
    if (location.hash.startsWith('#wall=')) history.replaceState(null, '', location.pathname + location.search);
    const cam = resolveHashCamera(location.hash, cameras);
    if (cam) select(cam.id);
    else selectedId = null;
  }

  async function checkStreams() {
    const pending: [string, Status][] = [];
    const flush = setInterval(() => record(pending.splice(0), playerResolved), FLUSH_MS);
    try {
      await checkAll(
        cameras.filter((c) => !(c.id in liveness)),
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
      const cached = Object.fromEntries(Object.entries(cache).map(([id, e]) => [id, e.status]));
      // Server-side status wins over a stale local cache; anything still unknown
      // falls through to probing from the browser.
      liveness = { ...cached, ...(await loadStatus()) };
      syncFromHash();
      await checkStreams();
    })();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  });
</script>

<div class="app">
  <aside class="panel" inert={wallOpen}>
    {#if selected}
      {#if !wallOpen}
        <Player
          camera={selected}
          {nearby}
          {liveness}
          onback={back}
          onselect={select}
          onhover={(id) => (hoveredId = id)}
          onliveness={recordPlayback}
          wall={wallIds}
          onwall={toggleWall}
        />
      {/if}
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
        wall={wallIds}
        onwall={toggleWall}
      />
    {:else}
      <CameraList
        cameras={visible}
        {liveness}
        {toggles}
        ontoggle={(t) => (toggles = t)}
        onselect={select}
        onhover={(id) => (hoveredId = id)}
        wall={wallIds}
        onwall={toggleWall}
      />
    {/if}
  </aside>

  <div class="map" inert={wallOpen}>
    <MapView cameras={visible} {liveness} {selected} {hoveredId} onselect={select} ongroup={showGroup} />
    {#if wallIds.length > 0 && !wallOpen}
      <button class="wall-open" type="button" onclick={openWall}>Wall ({wallIds.length})</button>
    {/if}
  </div>

  {#if wallOpen}
    <Wall
      cameras={wallCameras}
      onclose={closeWall}
      onremove={toggleWall}
      onswap={swapTiles}
      onliveness={recordPlayback}
    />
  {/if}
</div>

<style>
  .app {
    display: grid;
    grid-template-columns: 360px 1fr;
    height: 100%;
  }
  .panel {
    min-height: 0;
    border-right: 1px solid var(--border);
    background: var(--bg);
  }
  .map {
    position: relative;
    min-height: 0;
  }
  .wall-open {
    position: absolute;
    top: 12px;
    right: 12px;
    padding: 6px 12px;
    border: 0;
    border-radius: 6px;
    background: var(--chip-bg);
    color: var(--chip-text);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
  }
  .wall-open:hover {
    background: var(--chip-hover);
  }
  @media (max-width: 640px) {
    .app {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr 45vh;
    }
    .panel {
      grid-row: 2;
      border-right: 0;
      border-top: 1px solid var(--border);
    }
  }
</style>
