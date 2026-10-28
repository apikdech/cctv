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
  import type { Camera, LivenessMap } from '../lib/types';

  // Vite pre-bundles maplibre in dev, which breaks its relative worker URL.
  setWorkerUrl(workerUrl);

  interface Props {
    cameras: Camera[];
    liveness: LivenessMap;
    selected: Camera | null;
    hoveredId: number | null;
    onselect: (id: number) => void;
    ongroup: (ids: number[]) => void;
  }
  let { cameras, liveness, selected, hoveredId, onselect, ongroup }: Props = $props();

  const STYLE = 'https://tiles.openfreemap.org/styles/liberty';
  const MAX_ZOOM = 19;
  const COLOR = { official: '#2563eb', removed: '#ea580c', dead: '#9ca3af', ring: '#111827' };

  let container: HTMLDivElement;
  let map: MapLibre | undefined;
  let ready = $state(false);
  let fitted = false;
  let lastFlownId: number | null = null;

  function source(id: string): GeoJSONSource {
    return map!.getSource(id) as GeoJSONSource;
  }

  function point(cam: Camera): Feature<Point> {
    return { type: 'Feature', geometry: { type: 'Point', coordinates: [cam.lon, cam.lat] }, properties: {} };
  }

  const empty: FeatureCollection = { type: 'FeatureCollection', features: [] };

  function addLayers(m: MapLibre) {
    m.addSource('cameras', {
      type: 'geojson',
      data: empty,
      maxzoom: MAX_ZOOM + 1, // must exceed clusterMaxZoom
      cluster: true,
      clusterRadius: 40,
      clusterMaxZoom: MAX_ZOOM,
      clusterProperties: {
        removed: ['+', ['case', ['==', ['get', 'kind'], 'removed'], 1, 0]],
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
        'circle-color': [
          'case',
          ['==', ['get', 'dead'], ['get', 'point_count']], COLOR.dead,
          ['>', ['get', 'removed'], 0], COLOR.removed,
          COLOR.official,
        ],
        'circle-radius': ['step', ['get', 'point_count'], 15, 10, 19, 30, 24],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
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
        'circle-color': ['match', ['get', 'kind'], 'removed', COLOR.removed, 'dead', COLOR.dead, COLOR.official],
        'circle-radius': 7,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
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
      paint: { 'text-color': COLOR.ring, 'text-halo-color': '#fff', 'text-halo-width': 1.5 },
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
        ongroup(leaves.map((leaf) => leaf.properties!.id as number));
      } else {
        m.easeTo({ center: (f.geometry as Point).coordinates as [number, number], zoom });
      }
    });

    m.on('click', 'points', (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (f) onselect(f.properties.id as number);
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
    const m = new MapLibre({ container, style: STYLE, maxZoom: MAX_ZOOM, center: [110.37, -7.8], zoom: 12 });
    map = m;
    m.on('load', () => {
      addLayers(m);
      addInteractions(m);
      ready = true;
    });
    return () => m.remove();
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
