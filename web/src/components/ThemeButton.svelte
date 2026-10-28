<script lang="ts">
  import type { ThemeChoice } from '../lib/theme';

  interface Props {
    choice: ThemeChoice;
    onclick: () => void;
  }
  let { choice, onclick }: Props = $props();

  const label = $derived(`Theme: ${choice === 'system' ? 'System' : choice === 'light' ? 'Light' : 'Dark'}`);
  const icon = $derived(choice === 'system' ? '◐' : choice === 'light' ? '☀' : '☾');
</script>

<button class="theme" type="button" aria-label={label} title={label} {onclick}>{icon}</button>

<style>
  .theme {
    width: 30px;
    height: 30px;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: var(--chip-bg);
    color: var(--chip-text);
    font: inherit;
    font-size: 15px;
    line-height: 1;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
  }
  .theme:hover {
    background: var(--chip-hover);
  }
</style>
