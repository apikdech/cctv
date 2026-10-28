<script lang="ts">
  import Hls from 'hls.js';
  import CameraRow from './CameraRow.svelte';
  import { displayName, livenessOf } from '../lib/search';
  import type { Camera, LivenessMap } from '../lib/types';

  interface Props {
    camera: Camera;
    nearby: Camera[];
    liveness: LivenessMap;
    onback: () => void;
    onselect: (id: number) => void;
    onhover: (id: number | null) => void;
    onliveness: (id: number, status: 'alive' | 'dead') => void;
  }
  let { camera, nearby, liveness, onback, onselect, onhover, onliveness }: Props = $props();

  const STALL_MS = 15_000;

  let wrapper: HTMLDivElement;
  let video: HTMLVideoElement;
  let failed = $state(false);

  const place = $derived([camera.kecamatan, camera.kelurahan].filter(Boolean).join(' · '));
  const source = $derived(camera.source === 'official' ? 'Official' : `Removed · last seen ${camera.lastSeen}`);

  $effect(() => {
    const id = camera.id;
    const url = camera.url;
    failed = false;

    // Events from a stream we've already left must not touch the new camera.
    let active = true;
    const report = (status: 'alive' | 'dead') => {
      if (!active) return;
      if (status === 'dead') failed = true;
      onliveness(id, status);
    };
    const play = () => video.play().catch(() => {});

    // A stream can serve a playlist yet never deliver frames; don't leave a black box.
    const stall = setTimeout(() => report('dead'), STALL_MS);
    const playing = () => clearTimeout(stall);
    video.addEventListener('playing', playing);
    const stop = () => {
      active = false;
      clearTimeout(stall);
      video.removeEventListener('playing', playing);
    };

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        play();
        report('alive');
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) report('dead');
      });
      hls.loadSource(url);
      hls.attachMedia(video);
      return () => {
        stop();
        hls.destroy();
      };
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      const ok = () => report('alive');
      const bad = () => report('dead');
      video.addEventListener('loadeddata', ok);
      video.addEventListener('error', bad);
      video.src = url;
      play();
      return () => {
        stop();
        video.removeEventListener('loadeddata', ok);
        video.removeEventListener('error', bad);
        video.removeAttribute('src');
        video.load();
      };
    }

    // This browser can't play HLS at all; that says nothing about the camera.
    stop();
    failed = true;
    return stop;
  });

  function fullscreen() {
    wrapper.requestFullscreen?.().catch(() => {});
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
  </div>

  {#if nearby.length}
    <h3>Nearby</h3>
    <ul>
      {#each nearby as cam (cam.id)}
        <li><CameraRow camera={cam} liveness={livenessOf(liveness, cam.id)} {onselect} {onhover} /></li>
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
  ul {
    margin: 0;
    padding: 0 6px 12px;
    list-style: none;
  }
</style>
