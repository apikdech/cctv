<script lang="ts">
  import WallButton from './WallButton.svelte';
  import { displayName } from '../lib/search';
  import type { Camera, Liveness } from '../lib/types';

  interface Props {
    camera: Camera;
    liveness: Liveness;
    onselect: (id: string) => void;
    onhover: (id: string | null) => void;
    inWall?: boolean;
    wallFull?: boolean;
    onwall?: (id: string) => void;
    tag?: 'next' | 'visited';
  }
  let { camera, liveness, onselect, onhover, inWall = false, wallFull = false, onwall, tag }: Props = $props();

  const kind = $derived(
    liveness === 'dead' ? 'dead' : camera.source === 'removed' ? 'removed' : camera.dataset,
  );
  const dataset = $derived(camera.dataset === 'prov' ? 'Provinsi' : 'Kota');
  const place = $derived(camera.kecamatan || camera.owner);
  const status = $derived(
    `${dataset} · ${camera.source === 'official' ? 'Official' : 'Removed'}` +
      (liveness === 'dead' ? ' · dead' : liveness === 'checking' ? ' · checking…' : ''),
  );
</script>

<div class="row" class:visited={tag === 'visited'}>
  <button
    class="main"
    type="button"
    onclick={() => onselect(camera.id)}
    onmouseenter={() => onhover(camera.id)}
    onmouseleave={() => onhover(null)}
    onfocus={() => onhover(camera.id)}
    onblur={() => onhover(null)}
  >
    <span class="dot {kind}"></span>
    <span class="text">
      <span class="name">{displayName(camera.title)}{#if tag === 'next'}<span class="tag">Next ↓</span>{/if}</span>
      {#if place}<span class="sub">{place}</span>{/if}
      <span class="sub status">{status}</span>
      {#if tag === 'visited'}<span class="sr-only"> (visited)</span>{/if}
    </span>
  </button>

  {#if onwall}
    <WallButton {inWall} full={wallFull} onclick={() => onwall(camera.id)} />
  {/if}
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-right: 10px;
    border-radius: 6px;
  }
  .row:hover {
    background: var(--hover);
  }
  .main {
    display: flex;
    flex: 1;
    gap: 10px;
    align-items: flex-start;
    min-width: 0;
    padding: 8px 12px;
    border: 0;
    background: none;
    font: inherit;
    text-align: left;
    color: inherit;
    cursor: pointer;
    border-radius: 6px;
  }
  .main:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  .dot {
    flex: none;
    width: 10px;
    height: 10px;
    margin-top: 5px;
    border-radius: 50%;
  }
  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .name {
    font-weight: 600;
    font-size: 14px;
  }
  .tag {
    margin-left: 6px;
    padding: 1px 5px;
    border-radius: 999px;
    background: var(--accent);
    color: var(--chip-text);
    font-size: 10px;
    font-weight: 600;
    white-space: nowrap;
  }
  .row.visited {
    opacity: 0.55;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }
  .sub {
    font-size: 12px;
    color: var(--muted);
  }
  .official {
    background: var(--kota);
  }
  .removed {
    background: var(--removed);
  }
  .prov {
    background: var(--prov);
  }
  .dead {
    background: var(--dead);
  }
</style>
