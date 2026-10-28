<script lang="ts">
  import { onDestroy } from 'svelte';
  import { displayName } from '../lib/search';
  import { attachStream } from '../lib/stream';
  import type { Camera } from '../lib/types';

  interface Props {
    camera: Camera;
    onremove: (id: string) => void;
    onliveness: (id: string, status: 'alive' | 'dead') => void;
  }
  let { camera, onremove, onliveness }: Props = $props();

  let wrapper: HTMLDivElement;
  let video: HTMLVideoElement;
  let failed = $state(false);
  let live = $state(false);
  let hovered = $state(false);

  // Reordering hands the tile a fresh props object for the same camera. Track
  // the source we are actually playing and keep the stream attached when it
  // doesn't change; a reorder must never restart a video.
  const source = $derived({ id: camera.id, url: camera.url });
  let currentId = '';
  let detach: (() => void) | null = null;

  $effect(() => {
    const { id, url } = source;
    if (id === currentId) return;
    detach?.();
    currentId = id;
    failed = false;
    live = false;

    detach = attachStream(video, url, (status) => {
      if (status === 'unsupported') {
        failed = true;
        return;
      }
      live = status === 'alive';
      if (status === 'dead') failed = true;
      onliveness(id, status);
    });
  });

  onDestroy(() => detach?.());

  function fullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else wrapper.requestFullscreen?.().catch(() => {});
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key !== 'f' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (hovered) fullscreen();
  }
</script>

<svelte:window {onkeydown} />

<div
  class="tile"
  role="group"
  aria-label={displayName(camera.title)}
  bind:this={wrapper}
  ondblclick={fullscreen}
  onmouseenter={() => (hovered = true)}
  onmouseleave={() => (hovered = false)}
>
  <video bind:this={video} muted autoplay playsinline></video>

  {#if failed}
    <p class="error">This camera isn't streaming right now</p>
  {/if}

  <span class="chip"><i class:live></i>{displayName(camera.title)}</span>
  <button
    class="remove"
    type="button"
    aria-label={`Remove ${displayName(camera.title)} from wall`}
    title="Remove from wall"
    onclick={() => onremove(camera.id)}
  >✕</button>
</div>

<style>
  .tile {
    position: relative;
    flex: 1;
    min-width: 0;
    background: #000;
    overflow: hidden;
    cursor: default;
  }
  video {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
  .chip {
    position: absolute;
    top: 6px;
    left: 6px;
    display: flex;
    align-items: center;
    gap: 5px;
    max-width: calc(100% - 44px);
    padding: 2px 7px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.55);
    color: #f3f4f6;
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .chip i {
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #6b7280;
  }
  .chip i.live {
    background: #22c55e;
  }
  .error {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    margin: 0;
    padding: 16px;
    text-align: center;
    color: #e5e7eb;
    font-size: 13px;
  }
  .remove {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 26px;
    height: 26px;
    border: 0;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    font-size: 13px;
    line-height: 1;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s ease;
  }
  .tile:hover .remove,
  .remove:focus-visible {
    opacity: 1;
  }
  .remove:hover {
    background: rgba(0, 0, 0, 0.8);
  }
</style>
