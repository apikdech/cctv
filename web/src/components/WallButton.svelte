<script lang="ts">
  import { MAX_WALL } from '../lib/wall';

  interface Props {
    inWall: boolean;
    full: boolean;
    onclick: () => void;
  }
  let { inWall, full, onclick }: Props = $props();

  const blocked = $derived(full && !inWall);
</script>

<button
  class="wall"
  class:on={inWall}
  type="button"
  disabled={blocked}
  title={blocked ? `Wall is full (${MAX_WALL} cameras)` : inWall ? 'Remove from wall' : 'Add to wall'}
  onclick={onclick}
>{inWall ? 'On wall' : blocked ? 'Wall is full' : 'Add to wall'}</button>

<style>
  .wall {
    flex: none;
    padding: 3px 8px;
    border: 1px solid var(--input-border);
    border-radius: 999px;
    background: var(--bg);
    font: inherit;
    font-size: 11px;
    color: var(--text);
    white-space: nowrap;
    cursor: pointer;
  }
  .wall:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent);
  }
  .wall.on {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--chip-text);
  }
  .wall:disabled {
    color: var(--disabled);
    cursor: not-allowed;
  }
</style>
