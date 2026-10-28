<script lang="ts">
  import CameraRow from './CameraRow.svelte';
  import { livenessOf, searchCameras } from '../lib/search';
  import type { Camera, LivenessMap, Toggles } from '../lib/types';

  interface Props {
    cameras: Camera[];
    liveness: LivenessMap;
    toggles: Toggles;
    ontoggle: (t: Toggles) => void;
    onselect: (id: string) => void;
    onhover: (id: string | null) => void;
    title?: string;
    onback?: () => void;
  }
  let { cameras, liveness, toggles, ontoggle, onselect, onhover, title, onback }: Props = $props();

  let query = $state('');
  const shown = $derived(title ? cameras : searchCameras(cameras, query));

  const groups = [
    { key: 'kota', label: 'Kota' },
    { key: 'prov', label: 'Provinsi' },
    { key: 'removed', label: 'Removed' },
    { key: 'dead', label: 'Dead' },
  ] as const;
</script>

<section class="list">
  <header>
    {#if title}
      {#if onback}<button class="back" type="button" onclick={onback}>← back to list</button>{/if}
      <h2>{title}</h2>
    {:else}
      <input class="search" type="search" placeholder="Search camera, place, agency…" bind:value={query} />
      <p class="count">{shown.length} cameras</p>
    {/if}
    <div class="toggles">
      {#each groups as g (g.key)}
        <label>
          <input
            type="checkbox"
            checked={toggles[g.key]}
            onchange={(e) => ontoggle({ ...toggles, [g.key]: e.currentTarget.checked })}
          />
          <span class="swatch {g.key}"></span>{g.label}
        </label>
      {/each}
    </div>
  </header>

  <ul>
    {#each shown as camera (camera.id)}
      <li><CameraRow {camera} liveness={livenessOf(liveness, camera.id)} {onselect} {onhover} /></li>
    {/each}
  </ul>
</section>

<style>
  .list {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  header {
    padding: 12px;
    border-bottom: 1px solid #e5e7eb;
  }
  h2 {
    margin: 4px 0 8px;
    font-size: 16px;
  }
  .search {
    width: 100%;
    padding: 8px 10px;
    font: inherit;
    border: 1px solid #d1d5db;
    border-radius: 6px;
  }
  .count {
    margin: 8px 0;
    font-size: 12px;
    color: #6b7280;
  }
  .back {
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    font-size: 13px;
    color: #2563eb;
    cursor: pointer;
  }
  .toggles {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    font-size: 13px;
  }
  .toggles label {
    display: flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
  }
  .swatch {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .swatch.kota {
    background: #2563eb;
  }
  .swatch.prov {
    background: #0d9488;
  }
  .swatch.removed {
    background: #ea580c;
  }
  .swatch.dead {
    background: #9ca3af;
  }
  ul {
    flex: 1;
    margin: 0;
    padding: 6px;
    list-style: none;
    overflow-y: auto;
  }
</style>
