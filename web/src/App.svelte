<script lang="ts">
  import { onMount } from 'svelte';
  import MapView from './components/MapView.svelte';
  import type { Camera } from './lib/types';

  let cameras: Camera[] = $state([]);

  onMount(async () => {
    cameras = await (await fetch('/cameras.json')).json();
  });
</script>

<main>
  <MapView
    {cameras}
    liveness={{}}
    selected={null}
    hoveredId={null}
    onselect={(id) => console.log('select', id)}
    ongroup={(ids) => console.log('group', ids)}
  />
</main>

<style>
  main {
    height: 100%;
  }
</style>
