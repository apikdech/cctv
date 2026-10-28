# CCTV Jogja Map — Multi-stream wall

## Intent

Today the app plays exactly one camera, in a 360px side panel. The user wants
to watch **several live streams at once** (up to 8): sometimes to keep an eye
on a handful of junctions, sometimes just for fun. They are happy to leave it
to the viewer's own network to cope with the load.

The answer is a **wall**: a full-window view of its own, where the chosen
cameras tile the screen. The map stays the place cameras are found; the wall is
the place they are watched.

## Goals

- Watch 1–8 cameras at once, side by side, in one view.
- Tiles fit themselves to the window; no manual layout work to get a usable
  result.
- The user can reorder tiles by dragging one onto another.
- An open wall survives a reload and can be shared as a link.
- A camera that is not streaming says so in its tile and keeps its place.

## Non-goals

- Free-form canvas: no arbitrary tile positions or resizing (the user looked at
  it and chose the auto-fitting grid).
- Named or saved sets of cameras. The link/bookmark is the saved set.
- Adding cameras by shift-click on the map. May come later.
- Audio mixing. Streams are muted, as the single player is today.
- Recording, snapshots, or any server-side component.

## Anti-goals (failure even if it works)

- Streams that keep pulling from government servers while the wall is not on
  screen. The README's "be gentle" rule applies: more concurrent viewers per
  tab is already a heavier load than probing.
- A ninth camera silently dropping or replacing an existing one.
- Breaking today's single-camera flow: clicking a dot on the map still opens
  the one camera in the side panel, and `#cam=<id>` links still work.
- Reordering that restarts every stream.

## Decisions the user made

- The wall is a full-window view; sidebar and map are hidden while it is open
  (option A of three that were mocked up; "wall beside the map" and "free
  canvas" were rejected).
- Up to 8 cameras.
- Layout fits itself to the number of cameras, and the user can drag tiles to
  change their order.
- Everything about how cameras get onto the wall was left to the builder's
  judgement (see below, marked as such).

## The wall

Opened by a **Wall (n)** button that appears once at least one camera has been
added, and closed by a **← map** button in the top bar or the `M` key. The top
bar also shows the camera count. There is no audio control: every stream is
muted, as in the single player (builder-check call).

### Tiles

- Black background; the video is letterboxed to fit (`object-fit: contain`),
  never cropped.
- A name chip with a live dot (green playing, grey not streaming), a remove
  (✕) control, and fullscreen on double-click or `F` while hovering, matching
  the single player.
- A camera that fails or stalls shows the same "This camera isn't streaming
  right now" message the single player does, stays in its slot, and can be
  removed. The stall timeout and the reporting of alive/dead into the shared
  liveness map behave exactly as in `Player.svelte`.

### Grid

The grid follows the count, aimed at a landscape window:

| cameras | grid (columns × rows) |
|---|---|
| 1 | 1 × 1 |
| 2 | 2 × 1 |
| 3–4 | 2 × 2 |
| 5–6 | 3 × 2 |
| 7–8 | 4 × 2 |

On a narrow screen (the existing 640px breakpoint) it is a single scrolling
column. Empty cells in a partly filled grid are simply empty.

### Reordering

Dragging a tile onto another swaps them. Order is the order of the ids in the
URL. A swap must not tear down and restart the underlying streams.

## Adding and removing cameras (builder's call, user delegated)

- Every camera row in the list and the single-camera panel gets an **Add to
  wall** control; once added, it reads **On wall** and removes on press.
  Clicking the row body still selects the camera exactly as today. (Note:
  `CameraRow.svelte` is a single `<button>`, so the add control needs the row
  restructured rather than nested inside it.)
- From the map the path is dot → panel → Add to wall.
- At 8 cameras, Add to wall is disabled and says why ("wall is full").
- Removing a tile from the wall; if the wall becomes empty it closes.

## URL

`#wall=<id>,<id>,...` carries the wall in order, using the existing composite
camera ids. Opening a link restores the wall and opens it. Unknown ids are
dropped; ids past the eighth are ignored. `#cam=` and `#wall=` do not coexist:
whichever the user acted on last is the one in the URL, and the wall wins on
load if both somehow appear. The wall's cameras are kept when the wall is
closed (back on the map the URL returns to `#cam=` or empty) so the **Wall (n)**
button can reopen it. That closed set lives in memory only: reloading while on
the map starts with an empty wall. Only an open wall is restored from the URL
(builder-check call; no localStorage).

## Streaming behaviour

- A backgrounded or minimised browser tab with the wall still open keeps
  streaming; no Page Visibility handling (builder-check call, keeps it simple).
- Streams exist only while the wall is open. Closing it tears every player
  down; reopening restarts them (a couple of seconds). This is a deliberate
  trade for not holding up to eight connections open in the background.
- Each tile uses its own `hls.js` instance, with the same fallback to native
  HLS on browsers that support it, as `Player.svelte`.
- The liveness probe that runs on load (concurrency 4, cached 10 minutes) is
  unchanged.

## Constraints

- Svelte 5 runes, existing style, no new dependencies (drag and drop with
  native pointer or HTML drag events).
- Use the repo's package manager (`pnpm`) and Node from `web/.nvmrc`.
- The existing tests (`pnpm test`, `pnpm check`) keep passing; new behaviour
  gets tests where it can be tested without a real stream (grid choice,
  hash parsing/formatting, add/remove/cap/reorder logic).

## Left to the builder

- Where the wall state lives and how `App.svelte` switches between map view
  and wall view.
- Exact visuals: tile chrome, button placement, colours (match the existing
  app).
- Extracting the HLS attach/stall logic out of `Player.svelte` so both use it,
  if that is cleaner than duplicating it.
- Drag-and-drop mechanics and keyboard accessibility of reordering.
