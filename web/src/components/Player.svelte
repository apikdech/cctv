<script lang="ts">
  import { onDestroy } from 'svelte';
  import CameraRow from './CameraRow.svelte';
  import WallButton from './WallButton.svelte';
  import { displayName, livenessOf } from '../lib/search';
  import { attachStream } from '../lib/stream';
  import { MAX_WALL } from '../lib/wall';
  import type { Camera, LivenessMap } from '../lib/types';

  interface Props {
    camera: Camera;
    nearby: Camera[];
    liveness: LivenessMap;
    onback: () => void;
    onselect: (id: string) => void;
    onhover: (id: string | null) => void;
    onliveness: (id: string, status: 'alive' | 'dead') => void;
    wall?: string[];
    onwall?: (id: string) => void;
  }
  let { camera, nearby, liveness, onback, onselect, onhover, onliveness, wall, onwall }: Props = $props();

  const wallFull = $derived((wall?.length ?? 0) >= MAX_WALL);

  let wrapper: HTMLDivElement;
  let video: HTMLVideoElement;
  let failed = $state(false);

  const place = $derived([camera.kecamatan, camera.kelurahan].filter(Boolean).join(' · '));
  const source = $derived(
    camera.dataset === 'prov'
      ? `Provinsi · ${camera.owner || 'Official'}`
      : camera.source === 'official'
        ? 'Kota · Official'
        : `Kota · Removed · last seen ${camera.lastSeen}`,
  );

  $effect(() => {
    const id = camera.id;
    const url = camera.url;
    failed = false;

    return attachStream(video, url, (status) => {
      if (status === 'unsupported') failed = true;
      if (status === 'dead') failed = true;
      if (status !== 'unsupported') onliveness(id, status);
    });
  });

  function fullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else wrapper.requestFullscreen?.().catch(() => {});
  }

  function onkeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (e.key === 'f' && !e.metaKey && !e.ctrlKey && target?.tagName !== 'INPUT') fullscreen();
  }
</script>

<svelte:window {onkeydown} />

<section class="player">
  <button class="back" type="button" onclick={onback}>← back to list</button>

  <div class="video" bind:this={wrapper}>
    <video bind:this={video} muted autoplay playsinline ondblclick={fullscreen}></video>
    {#if failed}
      <p class="error">This camera isn't streaming right now</p>
    {/if}
    <button class="fs" type="button" aria-label="Fullscreen" title="Fullscreen (F)" onclick={fullscreen}>⛶</button>
  </div>

  <div class="info">
    <h2>{displayName(camera.title)}</h2>
    {#if place}<p class="sub">{place}</p>{/if}
    <p class="sub">{source}</p>
    {#if onwall}
      <div class="wallrow">
        <WallButton inWall={wall?.includes(camera.id) ?? false} full={wallFull} onclick={() => onwall(camera.id)} />
      </div>
    {/if}
  </div>

  {#if nearby.length}
    <h3>Nearby</h3>
    <ul>
      {#each nearby as cam (cam.id)}
        <li>
          <CameraRow
            camera={cam}
            liveness={livenessOf(liveness, cam.id)}
            {onselect}
            {onhover}
            inWall={wall?.includes(cam.id) ?? false}
            {wallFull}
            {onwall}
          />
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .player {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow-y: auto;
  }
  .back {
    align-self: flex-start;
    margin: 12px;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    font-size: 13px;
    color: #2563eb;
    cursor: pointer;
  }
  .video {
    position: relative;
    flex: none;
    aspect-ratio: 16 / 9;
    background: #000;
  }
  video {
    width: 100%;
    height: 100%;
    object-fit: contain;
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
    font-size: 14px;
  }
  .fs {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    font-size: 18px;
    cursor: pointer;
  }
  .fs:hover {
    background: rgba(0, 0, 0, 0.8);
  }
  .info {
    padding: 12px;
    border-bottom: 1px solid #e5e7eb;
  }
  h2 {
    margin: 0 0 4px;
    font-size: 16px;
  }
  h3 {
    margin: 12px 12px 4px;
    font-size: 13px;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .sub {
    margin: 2px 0;
    font-size: 13px;
    color: #6b7280;
  }
  .wallrow {
    margin-top: 8px;
  }
  ul {
    margin: 0;
    padding: 0 6px 12px;
    list-style: none;
  }
</style>
