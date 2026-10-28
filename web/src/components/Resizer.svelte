<script lang="ts">
  interface Props {
    axis: 'x' | 'y';
    label: string;
    ondrag: (clientPos: number) => void;
    ondragend: () => void;
    onreset: () => void;
  }
  let { axis, label, ondrag, ondragend, onreset }: Props = $props();

  let handle: HTMLDivElement;
  let dragging = $state(false);

  function pos(e: PointerEvent): number {
    return axis === 'x' ? e.clientX : e.clientY;
  }

  function down(e: PointerEvent) {
    e.preventDefault();
    dragging = true;
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic or already-released pointer: dragging still works without capture.
    }
  }

  function move(e: PointerEvent) {
    if (dragging) ondrag(pos(e));
  }

  function up(e: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    try {
      handle.releasePointerCapture(e.pointerId);
    } catch {
      // Capture was never taken.
    }
    ondragend();
  }
</script>

<div
  class="resizer {axis}"
  class:dragging
  bind:this={handle}
  role="separator"
  aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
  aria-label={label}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  ondblclick={onreset}
>
  <span class="grip"></span>
</div>

<style>
  .resizer {
    position: relative;
    display: grid;
    place-items: center;
    flex: none;
    background: var(--border);
    transition: background 0.15s;
  }
  .resizer.x {
    width: 6px;
    height: 100%;
    cursor: col-resize;
    touch-action: none;
  }
  .resizer.y {
    height: 20px;
    cursor: row-resize;
    touch-action: none;
    background: transparent;
  }
  .grip {
    border-radius: 1px;
    background: var(--disabled);
  }
  .x .grip {
    width: 2px;
    height: 28px;
  }
  .y .grip {
    width: 36px;
    height: 4px;
    border-radius: 2px;
  }
  .resizer:hover,
  .resizer.dragging {
    background: var(--accent);
  }
  .resizer:hover .grip,
  .resizer.dragging .grip {
    background: var(--chip-text);
  }
</style>
