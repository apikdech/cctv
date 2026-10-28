# CCTV Jogja Map — Layout and UX improvements

## Intent

The user's everyday flow is jumping from camera to camera: click a dot on the
map, watch, click the next one. Today the side panel is a fixed 360px, so the
16:9 video is only ~200px tall, and the user ends up double-clicking into
fullscreen just to see anything. Fullscreen hides the map, which they need to
keep seeing while they jump between cameras.

This round makes the panel resizable (desktop and mobile), lets the user hop
outward from camera to camera with the arrow keys, and adds a dark theme that
follows the system by default.

## Goals

- **Resizable side panel (desktop).** Drag the divider between panel and map
  to make the panel (and so the video) bigger. The map always stays visible.
- **Resizable bottom panel (mobile, ≤640px).** Drag a grab bar to make the
  bottom panel taller or shorter. Some map always stays visible.
- Both sizes are remembered across visits (localStorage).
- **Arrow-key "trip".** While a camera is open, `↓` opens the nearest camera
  not yet visited on this trip; `↑` steps back. Repeated `↓` drifts outward
  across the city one nearest camera at a time.
- **Dark theme.** System / Light / Dark. Defaults to System (follows
  `prefers-color-scheme`, live). A manual choice is remembered. The panel, the
  map tiles, the markers, and the small map UI (popup, buttons) all switch.

## Non-goals

- A "theater" / video-over-map mode. Rejected: the map must stay visible.
- Collapsing the sidebar, a pinned (sticky) video while scrolling Nearby.
  Offered, not picked this round.
- Arrow-key navigation of the main camera list or the group list. The trip is
  only for an open camera.
- Theming the Wall. It stays dark in both themes (user agreed).

## Anti-goals (failure even if it works)

- The map being hidden or squeezed to nothing by a resize.
- Pressing `↓` repeatedly bouncing between two cameras.
- Switching theme losing the camera markers, the selection highlight, or the
  map's position.
- A white flash on load for someone on dark mode.
- Breaking existing flows: dot → panel, `#cam=` / `#wall=` links, `F` for
  fullscreen, the Wall.

## Decisions the user made

- The map must stay visible while jumping between cameras → resizable panel,
  not a video-over-map mode.
- In scope: resizable panel (desktop), resizable bottom panel (mobile),
  arrow-key navigation, dark theme toggle.
- Arrow keys: the gradual outward trip (nearest unvisited from wherever you
  are now), not a walk down a frozen Nearby list.
- Theme toggle lives in the **map's top-right corner, next to the Wall
  button** (option A of two mocked up; "System/Light/Dark switch in the list
  header" was rejected). Visible on every screen except the Wall.
- Approach A: hand-written, no new dependencies. Theme colours as CSS custom
  properties; map swaps between OpenFreeMap `liberty` and `dark` styles.
- The user approved the behaviour played back to them, including the builder
  proposals below marked *(proposed, accepted)*.

## Approaches considered

- **A. Hand-written, no new dependencies (chosen).** CSS custom properties for
  colours, a tiny pre-paint script for the theme, pointer-event drag handles,
  MapLibre style swap. Keeps the project's two-runtime-dependency footprint;
  the cost is handling drag edge cases ourselves.
- **B. Same, but a pane library (e.g. `paneforge`) for resizing.** Free
  keyboard resizing and ARIA, but a new dependency built for side-by-side
  panes; the mobile bottom panel would still be custom.
- **Rejected: CSS `filter: invert()` on the map for dark mode.** Cheap, but
  turns the blue Kota markers orange, colliding with Removed.

## Resizable panels

### Desktop

- A vertical divider between panel and map, `col-resize` cursor, visibly
  highlighted on hover/drag (see mockup in the brainstorm: thin bar with a
  grip).
- Default width 360px (today's). Min 280px. Max: whatever leaves at least
  320px of map, and never more than 70% of the window. *(builder's call)*
- Window resize clamps the stored width to the current limits (without
  overwriting the stored preference, so widening the window again restores
  it). *(builder's call)*
- Double-click the divider resets to the default. *(builder's call)*
- The map must re-fit its canvas while/after the panel changes size (verify
  MapLibre picks this up from its container; call `map.resize()` if not).
- Dragging over the map or video must not select text or pan the map
  (pointer capture on the handle).

### Mobile (≤640px, the existing breakpoint)

- Layout stays map on top, panel at the bottom. The panel's top edge gets a
  grab bar (pill) that drags the panel taller/shorter, touch and mouse.
- Default 45vh (today's). Min: enough for the grab bar plus the list header.
  Max: leaves at least ~20% of the screen as map. *(builder's call)*
- Stored separately from the desktop width.

## Arrow-key trip

All of this applies only while a single camera is open in the panel (Wall
closed). *(proposed, accepted)* unless marked otherwise.

- `↓` opens the nearest camera to the **current** camera that has not been
  visited on this trip, drawn from the currently visible cameras (filters
  apply; e.g. with Dead unchecked, dead cameras are skipped).
- `↑` goes back one step to the previous camera on the trip. At the start of
  a trip it does nothing.
- If `↓` is pressed after `↑`, the trip continues from where you now are; the
  steps you backed out of are dropped from the trail but stay "visited" (so
  `↓` doesn't immediately return to the one you just backed out of).
  *(builder's call)*
- If no unvisited visible camera remains, `↓` does nothing.
- A trip **starts fresh** when the user picks a camera any other way (map dot,
  list row, Nearby row, a `#cam=` link) or goes back to the list.
- The map flies to each camera as it does today; the URL hash updates as it
  does today.
- The Nearby list keeps showing the 5 closest visible cameras; ones already
  visited on this trip are dimmed. The camera `↓` will open is **always shown
  at the top of Nearby with a "Next ↓" tag**, even when it is not among the 5
  closest (in dense areas all 5 closest can already be visited; the builder
  check measured this on ~5 of 40 steps over the real dataset). So the list is
  the "Next ↓" row (if any) followed by the 5 closest, without duplicating it.
  *(user decision)*
- "Visited" and "Next" are also conveyed to assistive tech (e.g. in the row's
  accessible name), not only by dimming. *(builder's call)*
- One step per key press: key auto-repeat (`e.repeat`) is ignored, so holding
  `↓` does not race through cameras and streams. *(builder's call)*
- Works in native fullscreen too: the video stays fullscreen and switches
  camera; `Esc` returns to the map. *(builder's call)*
- Ignored while typing in an input (same rule as `F`), and with
  Meta/Ctrl/Alt held. The browser's default scroll on those keys is
  suppressed only when the trip handles the key.
- **Map focus:** clicking a dot gives the map canvas focus, and MapLibre's
  keyboard handler pans on arrow keys. Since click-dot-then-`↓` is exactly
  the user's flow, the trip must win: disable MapLibre's keyboard panning
  while a camera is open, restore it when back on the list. *(builder's call)*

The trip logic (next unvisited nearest, back, reset, and exposing the next
target id for the "Next ↓" row) goes in a pure module in
`web/src/lib/` with unit tests, like `wall.ts` and `geo.ts`.

## Dark theme

### Toggle

- A small round button in the map's top-right corner, styled like the Wall
  button; the Wall button sits to its left when shown.
- One button that cycles **System → Light → Dark → System**; its icon and
  tooltip/`aria-label` name the current mode (e.g. "Theme: System").
  *(builder's call; mockup showed a single ◐ button)*
- Choice stored in localStorage; absent = System. In System mode, changes to
  the OS setting apply live.

### Colours

- Move the hardcoded colours in `app.css` and the components (App,
  CameraList, CameraRow, Player, WallButton, MapView) to CSS custom
  properties with a light and a dark set. Wall and WallTile keep their fixed
  dark colours.
- Category colours (Kota blue, Provinsi teal, Removed orange, Dead grey) stay
  recognisable in both themes; small brightness tweaks for dark are fine.
- Set `color-scheme` so native controls (search input, checkboxes,
  scrollbars) match.
- No flash: a small inline script in `index.html` reads the stored choice and
  `prefers-color-scheme` and sets the theme attribute on `<html>` before the
  app renders.

### Map

- Light: `https://tiles.openfreemap.org/styles/liberty` (today). Dark:
  `https://tiles.openfreemap.org/styles/dark` (confirmed reachable).
- Switching uses `map.setStyle(url, { transformStyle })` (or re-adding on
  `style.load`) so the `cameras` and `highlight` sources, their layers, their
  current data, and the click/hover handlers survive, and the view (centre,
  zoom) does not move.
- Marker stroke, cluster stroke, label colour/halo and highlight ring use
  per-theme values (white strokes on light, dark strokes on dark), as in the
  mockup.
- The hover popup and the attribution control get dark styling.

## Constraints

- Svelte 5 runes, existing style, no new dependencies.
- `pnpm`, Node from `web/.nvmrc`.
- `pnpm test` and `pnpm check` keep passing. New logic gets tests where it can
  be tested without a real map or stream: trip logic, theme resolution
  (stored choice + system preference), size clamping and persistence, and the
  keyboard wiring in the panel.

## Left to the builder

- Where the theme, sizes and trip state live (modules vs `App.svelte` state)
  and the exact CSS variable names.
- Exact visuals of the divider, grab bar, toggle icon and dimmed Nearby rows,
  matching the existing app.
- Keyboard accessibility of the drag handles (e.g. `role="separator"`,
  focusable, ←/→ on desktop) — nice to have, must not interfere with the
  trip keys.
- How MapLibre is told about container resizes, if it needs telling.
