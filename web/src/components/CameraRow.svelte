<script lang="ts">
  import { displayName } from '../lib/search';
  import type { Camera, Liveness } from '../lib/types';

  interface Props {
    camera: Camera;
    liveness: Liveness;
    onselect: (id: string) => void;
    onhover: (id: string | null) => void;
  }
  let { camera, liveness, onselect, onhover }: Props = $props();

  const kind = $derived(liveness === 'dead' ? 'dead' : camera.source);
  const status = $derived(
    (camera.source === 'official' ? 'Official' : 'Removed') +
      (liveness === 'dead' ? ' · dead' : liveness === 'checking' ? ' · checking…' : ''),
  );
</script>

<button
  class="row"
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
    {#if camera.kecamatan}<span class="sub">{camera.kecamatan}</span>{/if}
    <span class="sub status">{status}</span>
  </span>
</button>

<style>
  .row {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    width: 100%;
    padding: 8px 12px;
    border: 0;
    background: none;
    font: inherit;
    text-align: left;
    color: inherit;
    cursor: pointer;
    border-radius: 6px;
  }
  .row:hover,
  .row:focus-visible {
    background: #f3f4f6;
    outline: none;
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
    color: #6b7280;
  }
  .official {
    background: #2563eb;
  }
  .removed {
    background: #ea580c;
  }
  .prov {
    background: #0d9488;
  }
  .dead {
    background: #9ca3af;
  }
</style>
