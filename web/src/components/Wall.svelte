<script lang="ts">
  import WallTile from './WallTile.svelte';
  import { gridFor } from '../lib/wall';
  import type { Camera } from '../lib/types';

  interface Props {
    cameras: Camera[];
    onclose: () => void;
    onremove: (id: string) => void;
    onswap: (fromId: string, toId: string) => void;
    onliveness: (id: string, status: 'alive' | 'dead') => void;
  }
  let { cameras, onclose, onremove, onswap, onliveness }: Props = $props();

  const grid = $derived(gridFor(cameras.length));
  // Tiles are rendered in a stable order and placed with CSS `order`, so a
  // reorder never moves a <video> in the DOM (which would pause it).
  const ordered = $derived([...cameras].sort((a, b) => a.id.localeCompare(b.id)));
  const place = $derived(new Map(cameras.map((c, i) => [c.id, i])));

  let dragged: string | null = null;

  function dragstart(e: DragEvent, id: string) {
    dragged = id;
    e.dataTransfer?.setData('text/plain', id);
  }

  function drop(e: DragEvent, id: string) {
    e.preventDefault();
    const from = dragged;
    dragged = null;
    if (from !== null && from !== id) onswap(from, id);
  }

  function onkeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (e.key === 'm' && !e.metaKey && !e.ctrlKey && !e.altKey && target?.tagName !== 'INPUT') onclose();
  }
</script>

<svelte:window {onkeydown} />

<section class="wall">
  <header>
    <button class="back" type="button" onclick={onclose}>← map</button>
    <span class="count">{cameras.length} {cameras.length === 1 ? 'camera' : 'cameras'}</span>
  </header>

  <div
    class="grid"
    data-testid="grid"
    role="list"
    style="--cols: {grid.cols}; --rows: {grid.rows}"
  >
    {#each ordered as camera (camera.id)}
      <div
        class="slot"
        role="listitem"
        data-tile={camera.id}
        draggable="true"
        style:order={place.get(camera.id)}
        ondragstart={(e) => dragstart(e, camera.id)}
        ondragover={(e) => e.preventDefault()}
        ondrop={(e) => drop(e, camera.id)}
      >
        <WallTile {camera} {onremove} {onliveness} />
      </div>
    {/each}
  </div>
</section>

<style>
  .wall {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    background: #0b0f14;
  }
  header {
    display: flex;
    align-items: center;
    gap: 14px;
    flex: none;
    padding: 8px 12px;
    border-bottom: 1px solid #1f2937;
    color: #e5e7eb;
  }
  .back {
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    font-size: 13px;
    color: #93c5fd;
    cursor: pointer;
  }
  .count {
    font-size: 13px;
    color: #9ca3af;
  }
  .grid {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    grid-template-rows: repeat(var(--rows), 1fr);
    gap: 4px;
    padding: 4px;
  }
  .slot {
    display: flex;
    min-width: 0;
    min-height: 0;
  }
  @media (max-width: 640px) {
    .grid {
      grid-template-columns: 1fr;
      grid-template-rows: none;
      grid-auto-rows: auto;
      overflow-y: auto;
    }
    .slot {
      aspect-ratio: 16 / 9;
    }
  }
</style>
