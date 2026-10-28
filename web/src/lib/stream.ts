import Hls from 'hls.js';

const STALL_MS = 15_000;

export type StreamStatus = 'alive' | 'dead' | 'unsupported';

/**
 * Attach `url` to `video` and report how it goes. Returns a cleanup function;
 * once it runs, no further status is reported.
 */
export function attachStream(
  video: HTMLVideoElement,
  url: string,
  onstatus: (status: StreamStatus) => void,
): () => void {
  let active = true;
  const report = (status: StreamStatus) => {
    if (active) onstatus(status);
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
  onstatus('unsupported');
  return stop;
}
