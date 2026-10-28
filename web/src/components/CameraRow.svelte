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
  }
  let { camera, liveness, onselect, onhover, inWall = false, wallFull = false, onwall }: Props = $props();

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

<div class="row">
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
      <span class="name">{displayName(camera.title)}</span>
      {#if place}<span class="sub">{place}</span>{/if}
      <span class="sub status">{status}</span>
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
