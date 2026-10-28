<script lang="ts">
  import {
    LngLatBounds,
    Map as MapLibre,
    Popup,
    setWorkerUrl,
    type GeoJSONSource,
    type MapLayerMouseEvent,
  } from 'maplibre-gl';
  import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
  import { onMount } from 'svelte';
  import type { Feature, FeatureCollection, Point } from 'geojson';
  import { toFeatureCollection } from '../lib/geo';
  import { MAP_STYLE, type Theme } from '../lib/theme';
  import type { Camera, LivenessMap } from '../lib/types';

  // Vite pre-bundles maplibre in dev, which breaks its relative worker URL.
  setWorkerUrl(workerUrl);

  interface Props {
    cameras: Camera[];
    liveness: LivenessMap;
    selected: Camera | null;
    hoveredId: string | null;
    theme: Theme;
    keyboard: boolean;
    onselect: (id: string) => void;
    ongroup: (ids: string[]) => void;
  }
  let { cameras, liveness, selected, hoveredId, theme, keyboard, onselect, ongroup }: Props = $props();

  const MAX_ZOOM = 19;
  // Category colours mirror the --kota/--prov/--removed/--dead variables in
  // app.css; keep the two in step.
  const PALETTE = {
    light: { kota: '#2563eb', prov: '#0d9488', removed: '#ea580c', dead: '#9ca3af', ring: '#111827', stroke: '#fff', label: '#111827', halo: '#fff' },
    dark: { kota: '#3b82f6', prov: '#14b8a6', removed: '#f97316', dead: '#6b7280', ring: '#e5e7eb', stroke: '#111827', label: '#e5e7eb', halo: '#111827' },
  } satisfies Record<Theme, Record<string, string>>;

  let container: HTMLDivElement;
  let map: MapLibre | undefined;
  let ready = $state(false);
  let fitted = false;
  let lastFlownId: string | null = null;
  let styledTheme: Theme | null = null;

  function source(id: string): GeoJSONSource {
    return map!.getSource(id) as GeoJSONSource;
  }

  function point(cam: Camera): Feature<Point> {
    return { type: 'Feature', geometry: { type: 'Point', coordinates: [cam.lon, cam.lat] }, properties: {} };
  }

  const empty: FeatureCollection = { type: 'FeatureCollection', features: [] };

  function addLayers(m: MapLibre, t: Theme) {
    const COLOR = PALETTE[t];
    m.addSource('cameras', {
      type: 'geojson',
      data: empty,
      maxzoom: MAX_ZOOM + 1, // must exceed clusterMaxZoom
      cluster: true,
      clusterRadius: 40,
      clusterMaxZoom: MAX_ZOOM,
      clusterProperties: {
        removed: ['+', ['case', ['==', ['get', 'kind'], 'removed'], 1, 0]],
        prov: ['+', ['case', ['==', ['get', 'kind'], 'prov'], 1, 0]],
        dead: ['+', ['case', ['==', ['get', 'kind'], 'dead'], 1, 0]],
      },
    });
    m.addSource('highlight', { type: 'geojson', data: empty });

    m.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'cameras',
      filter: ['has', 'point_count'],
      paint: {
        // Mirrors clusterKind() in lib/geo.ts: all dead, then any removed, then any province.
        'circle-color': [
          'case',
          ['==', ['get', 'dead'], ['get', 'point_count']], COLOR.dead,
          ['>', ['get', 'removed'], 0], COLOR.removed,
          ['>', ['get', 'prov'], 0], COLOR.prov,
          COLOR.kota,
        ],
        'circle-radius': ['step', ['get', 'point_count'], 15, 10, 19, 30, 24],
        'circle-stroke-width': 2,
        'circle-stroke-color': COLOR.stroke,
      },
    });
    m.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'cameras',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': ['Noto Sans Bold'],
        'text-size': 12,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': '#fff' },
    });
    m.addLayer({
      id: 'points',
      type: 'circle',
      source: 'cameras',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': ['match', ['get', 'kind'], 'removed', COLOR.removed, 'dead', COLOR.dead, 'prov', COLOR.prov, COLOR.kota],
        'circle-radius': 7,
        'circle-stroke-width': 2,
        'circle-stroke-color': COLOR.stroke,
      },
    });
    m.addLayer({
      id: 'labels',
      type: 'symbol',
      source: 'cameras',
      filter: ['!', ['has', 'point_count']],
      minzoom: 16,
      layout: {
        'text-field': ['get', 'title'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 12,
        'text-anchor': 'top',
        'text-offset': [0, 0.9],
        'text-max-width': 10,
      },
      paint: { 'text-color': COLOR.label, 'text-halo-color': COLOR.halo, 'text-halo-width': 1.5 },
    });
    m.addLayer({
      id: 'highlight',
      type: 'circle',
      source: 'highlight',
      paint: {
        'circle-radius': 13,
        'circle-opacity': 0,
        'circle-stroke-width': 3,
        'circle-stroke-color': COLOR.ring,
      },
    });
  }

  function addInteractions(m: MapLibre) {
    const popup = new Popup({ closeButton: false, closeOnClick: false, offset: 10 });

    m.on('click', 'clusters', async (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      const clusterId = f.properties.cluster_id as number;
      const count = f.properties.point_count as number;
      const zoom = await source('cameras').getClusterExpansionZoom(clusterId);
      if (zoom > MAX_ZOOM) {
        const leaves = await source('cameras').getClusterLeaves(clusterId, count, 0);
        ongroup(leaves.map((leaf) => leaf.properties!.id as string));
      } else {
        m.easeTo({ center: (f.geometry as Point).coordinates as [number, number], zoom });
      }
    });

    m.on('click', 'points', (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (f) onselect(f.properties.id as string);
    });

    m.on('mousemove', 'points', (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      popup
        .setLngLat((f.geometry as Point).coordinates as [number, number])
        .setText(f.properties.title as string)
        .addTo(m);
    });
    m.on('mouseleave', 'points', () => popup.remove());

    for (const layer of ['clusters', 'points']) {
      m.on('mouseenter', layer, () => (m.getCanvas().style.cursor = 'pointer'));
      m.on('mouseleave', layer, () => (m.getCanvas().style.cursor = ''));
    }
  }

  onMount(() => {
    const m = new MapLibre({ container, style: MAP_STYLE[theme], maxZoom: MAX_ZOOM, center: [110.37, -7.8], zoom: 12 });
    map = m;
    styledTheme = theme;
    m.on('load', () => {
      addLayers(m, theme);
      addInteractions(m);
      ready = true;
    });
    return () => m.remove();
  });

  // A style swap drops custom sources and layers, so they are re-added once the
  // new style loads. `fitted` and `lastFlownId` keep the view where it was.
  // If the new style never arrives the map would stay inert for the rest of the
  // session, so a failed swap just keeps the style that is already on screen
  // working; the next theme change tries again.
  $effect(() => {
    if (!ready || theme === styledTheme) return;
    styledTheme = theme;
    ready = false;
    map!.setStyle(MAP_STYLE[theme], { diff: false });

    const onLoad = () => {
      map!.off('error', onError);
      addLayers(map!, theme);
      ready = true;
    };
    const onError = () => {
      map!.off('style.load', onLoad);
      ready = true;
    };
    map!.once('style.load', onLoad);
    map!.once('error', onError);
  });

  $effect(() => {
    if (!ready) return;
    // The arrow keys drive the camera trip while a camera is open, so the
    // map's own arrow-key panning is off then.
    if (keyboard) map!.keyboard.enable();
    else map!.keyboard.disable();
  });

  $effect(() => {
    if (!ready) return;
    source('cameras').setData(toFeatureCollection(cameras, liveness));
    if (!fitted && cameras.length) {
      const bounds = new LngLatBounds();
      for (const c of cameras) bounds.extend([c.lon, c.lat]);
      map!.fitBounds(bounds, { padding: 40, duration: 0 });
      fitted = true;
    }
  });

  $effect(() => {
    if (!ready) return;
    const hovered = hoveredId === null ? undefined : cameras.find((c) => c.id === hoveredId);
    const marks = [selected, hovered].filter((c): c is Camera => !!c).map(point);
    source('highlight').setData({ type: 'FeatureCollection', features: marks });
  });

  $effect(() => {
    if (!ready) return;
    const id = selected?.id ?? null;
    if (id === lastFlownId) return;
    lastFlownId = id;
    if (selected) map!.flyTo({ center: [selected.lon, selected.lat], zoom: Math.max(map!.getZoom(), 17) });
  });
</script>

<div class="map" bind:this={container}></div>

<style>
  .map {
    width: 100%;
    height: 100%;
  }
</style>
