# Multi-stream Wall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A full-window "wall" that plays 1–8 chosen cameras at once in an auto-fitting grid, with drag-to-swap ordering and a shareable `#wall=` link.

**Architecture:** Pure logic (cap, add/remove/swap, grid choice, URL parsing) lives in `lib/` and is unit-tested. The HLS attach/stall logic is extracted from `Player.svelte` into `lib/stream.ts` so the single player and the wall tiles share it. A new `Wall.svelte` overlays the existing app (map stays mounted underneath); `App.svelte` owns the wall state and the URL.

**Tech Stack:** Svelte 5 (runes), TypeScript, hls.js, Vitest + Testing Library (jsdom), pnpm.

**Spec:** `docs/superpowers/specs/2026-10-28-multi-stream-wall-design.md`

## Global Constraints

Run every command from `web/` after `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use` (Node 26 from `.nvmrc`). Use `pnpm`.

- Cap is **8** cameras; the 9th add is disabled, never dropping or replacing a camera.
- Grid (cols × rows): 1 → 1×1, 2 → 2×1, 3–4 → 2×2, 5–6 → 3×2, 7–8 → 4×2. At the existing `max-width: 640px` breakpoint: one scrolling column.
- Tiles: black background, `object-fit: contain`, always `muted`.
- Failure message, verbatim: `This camera isn't streaming right now`. Stall timeout 15 000 ms. Same alive/dead reporting into the liveness map as `Player.svelte`.
- URL: `#wall=<id>,<id>,...` using composite ids (`kota-14`, `prov-1915`). `M` closes the wall. `#cam=` links and click-a-dot-opens-one-camera must keep working.
- Streams exist only while the wall is mounted. A reorder must not restart any stream.
- No new dependencies. Existing tests keep passing (`pnpm test`, `pnpm check`).

## Review Focus

Failure modes the spec implies but doesn't spell out, most likely first:

1. A `#wall=` link with duplicate ids → each camera once. (Task 1)
2. A `#wall=` link with more than 8 ids → first 8 only. (Task 1)
3. A `#wall=` link whose ids are all unknown, empty, or malformed percent-encoding → empty list, so the wall does not open. (Task 1)
4. Dragging a tile to a new position → no player is destroyed or re-created, and no `<video>` is moved in the DOM (a moved video element is paused by the browser). (Task 3)
5. Adding a camera already on the wall, adding at the cap, removing the last camera → no duplicates, no 9th, wall closes. (Tasks 1 and 5)

## File Structure

| file | responsibility |
|---|---|
| `src/lib/wall.ts` (new) | `MAX_WALL`, `gridFor`, `addToWall`, `removeFromWall`, `swapInWall` |
| `src/lib/hash.ts` (modify) | add `formatWallHash`, `resolveWallHash` |
| `src/lib/stream.ts` (new) | `attachStream`: hls.js / native HLS / stall timer / unsupported |
| `src/components/Player.svelte` (modify) | use `attachStream` instead of its inline copy |
| `src/components/WallTile.svelte` (new) | one stream tile: video, name chip, dot, ✕, error, fullscreen |
| `src/components/Wall.svelte` (new) | top bar, grid, drag-to-swap, `M` to close |
| `src/components/WallButton.svelte` (new) | "Add to wall" / "On wall" / "Wall is full" |
| `src/components/CameraRow.svelte`, `CameraList.svelte`, `Player.svelte` (modify) | show `WallButton` |
| `src/App.svelte` (modify) | wall state, URL sync, overlay, "Wall (n)" button |
| `README.md` (modify) | document the wall |

---

### Task 1: Wall logic and URL

**Files:**
- Create: `web/src/lib/wall.ts`, `web/src/lib/wall.test.ts`
- Modify: `web/src/lib/hash.ts`, `web/src/lib/hash.test.ts`

**Interfaces:**
- Produces (`wall.ts`):
  `MAX_WALL = 8`
  `gridFor(n: number): { cols: number; rows: number }` (n ≤ 0 → 1×1; n > 8 → the 8 grid)
  `addToWall(ids: string[], id: string): string[]` (returns `ids` unchanged if present or full)
  `removeFromWall(ids: string[], id: string): string[]`
  `swapInWall(ids: string[], a: string, b: string): string[]` (unchanged unless both present and different)
- Produces (`hash.ts`):
  `formatWallHash(ids: string[]): string` (`''` for empty, else `#wall=a,b`)
  `resolveWallHash(hash: string, cams: Camera[]): string[]` (known ids only, de-duplicated, in link order, at most `MAX_WALL`; `[]` on no match or malformed encoding)

- [ ] **Step 1: Write the failing tests**

`wall.test.ts`:
- `gridFor follows the count`: `[1..8].map(gridFor)` equals `[{cols:1,rows:1},{cols:2,rows:1},{cols:2,rows:2},{cols:2,rows:2},{cols:3,rows:2},{cols:3,rows:2},{cols:4,rows:2},{cols:4,rows:2}]`; `gridFor(0)` is `{cols:1,rows:1}`; `gridFor(12)` equals `gridFor(8)`.
- `addToWall appends, ignores duplicates, stops at the cap`: `addToWall(['a'],'b')` → `['a','b']`; `addToWall(['a'],'a')` → `['a']`; with 8 ids, adding a 9th returns an array equal to the input.
- `removeFromWall`: removes the id; unknown id leaves the list equal.
- `swapInWall`: `swapInWall(['a','b','c'],'a','c')` → `['c','b','a']`; same id twice, or an absent id → unchanged.

`hash.test.ts` (use `cams = [kota-1, kota-2, prov-3, …]` plus enough extra ids for 10 cameras total):
- `formats a wall`: `formatWallHash(['kota-1','prov-3'])` is `'#wall=kota-1,prov-3'`; `formatWallHash([])` is `''`.
- `resolves a wall link in order`: `'#wall=prov-3,kota-1'` → `['prov-3','kota-1']`.
- `de-duplicates`: `'#wall=kota-1,kota-1,kota-2'` → `['kota-1','kota-2']`.
- `drops unknown ids`: `'#wall=kota-1,nope,kota-2'` → `['kota-1','kota-2']`.
- `keeps only the first 8`: a link with all 10 known ids → the first 8.
- `ignores bad links`: each of `''`, `'#wall='`, `'#wall=nope'`, `'#cam=kota-1'`, `'#wall=%E0%A4%A'` → `[]`.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test src/lib/wall.test.ts src/lib/hash.test.ts`
Expected: FAIL (modules / exports missing).

- [ ] **Step 3: Implement** `wall.ts` and the two functions in `hash.ts` with the signatures above. In `resolveWallHash`, decode each comma-separated token with `decodeURIComponent` inside the same `try` pattern `resolveHashCamera` uses.

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test src/lib/wall.test.ts src/lib/hash.test.ts`
Expected: PASS, including the existing `hash.test.ts` cases.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-10-28-multi-stream-wall-design.md docs/superpowers/plans/2026-10-28-multi-stream-wall.md web/src/lib/wall.ts web/src/lib/wall.test.ts web/src/lib/hash.ts web/src/lib/hash.test.ts
git commit -m "feat: wall logic and #wall= link parsing"
```

---

### Task 2: Extract `attachStream` from `Player`

**Files:**
- Create: `web/src/lib/stream.ts`, `web/src/lib/stream.test.ts`
- Modify: `web/src/components/Player.svelte` (the `$effect` at lines 33–94)

**Interfaces:**
- Produces: `attachStream(video: HTMLVideoElement, url: string, onstatus: (s: 'alive' | 'dead' | 'unsupported') => void): () => void`. Returns a cleanup function. After cleanup, `onstatus` is never called again and the stall timer is cleared. `'unsupported'` is reported synchronously when neither hls.js nor native HLS works.

Behaviour moves over unchanged from `Player.svelte`: `STALL_MS = 15_000` reports `'dead'` unless the `playing` event fires; hls.js path reports `'alive'` on `MANIFEST_PARSED` (and calls `video.play()`), `'dead'` on a fatal error; native path reports `'alive'` on `loadeddata`, `'dead'` on `error`, and clears `src` on cleanup.

- [ ] **Step 1: Write the failing tests** in `stream.test.ts`, reusing the `FakeHls` mock from `Player.test.ts` but with `static isSupported = vi.fn(() => true)` so a test can switch it off:
- `reports alive on manifest and dead on a fatal error`; a non-fatal error reports nothing.
- `reports dead when nothing plays within 15s`: fake timers, emit manifest, advance 15 000 → last status `'dead'`.
- `a playing event cancels the stall timer`: emit manifest, dispatch `playing` on the video, advance 15 000 → no `'dead'`.
- `cleanup destroys hls and silences later events`: after cleanup `instances[0].destroyed` is true; a fatal emit and a 15 000 ms advance produce no calls.
- `native HLS`: `isSupported` → false, `video.canPlayType = () => 'maybe'`; `loadeddata` → `'alive'`, `error` → `'dead'`; `video.src` is set to the url.
- `unsupported`: `isSupported` → false, `canPlayType` → `''`; `onstatus` called once with `'unsupported'` before `attachStream` returns.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test src/lib/stream.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement** `attachStream` in `stream.ts` by moving the effect body out of `Player.svelte` (keep the `active` guard inside it).

- [ ] **Step 4: Rewire `Player.svelte`.** The `$effect` becomes: reset `failed = false`, then `return attachStream(video, url, (s) => { … })` where `'unsupported'` only sets `failed = true`, and `'alive'`/`'dead'` set `failed` when dead and call `onliveness(id, s)`. Remove the now-unused `Hls` import and `STALL_MS`.

- [ ] **Step 5: Run the whole suite**

Run: `pnpm test && pnpm check`
Expected: PASS. The existing `Player.test.ts` cases are the regression guard for the refactor and must pass unmodified.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/stream.ts web/src/lib/stream.test.ts web/src/components/Player.svelte
git commit -m "refactor: share HLS attach/stall logic between player and wall"
```

---

### Task 3: `WallTile` and `Wall`

**Files:**
- Create: `web/src/components/WallTile.svelte`, `web/src/components/Wall.svelte`, `web/src/components/Wall.test.ts`

**Interfaces:**
- Consumes: `attachStream` (Task 2), `gridFor` (Task 1), `displayName` from `lib/search`.
- Produces `WallTile` props: `{ camera: Camera; onremove: (id: string) => void; onliveness: (id: string, status: 'alive' | 'dead') => void }`. Contains the `<video muted autoplay playsinline>`, a name chip with a live dot (green once playing/alive, grey on failure), a `✕` button with `aria-label="Remove {displayName} from wall"`, the failure message, and fullscreen on double-click or `F` while the pointer is over it (same `requestFullscreen`/`exitFullscreen` toggle as `Player.svelte`).
- Produces `Wall` props: `{ cameras: Camera[]; onclose: () => void; onremove: (id: string) => void; onswap: (fromId: string, toId: string) => void; onliveness: (id: string, status: 'alive' | 'dead') => void }`. `cameras` is in display order.

Structure that the tests rely on:
- Top bar: a `← map` button, the text `{n} camera(s)` (`1 camera`, `3 cameras`).
- Grid container `data-testid="grid"` with inline custom properties `--cols` and `--rows` from `gridFor(n)`; CSS uses them for `grid-template-columns/rows`, and the 640px media query overrides to a single column.
- Each camera is wrapped in `<div data-tile={id} draggable="true" style:order={index}>` containing a `WallTile`. These wrappers are rendered in **stable id-sorted order** (not display order) and positioned visually with `order`, so a swap changes only `order` styles and never moves a `<video>` in the DOM.
- Drag and drop with native events: the wrapper's `dragstart` remembers the dragged id (and calls `e.dataTransfer?.setData('text/plain', id)` for Firefox); `dragover` calls `preventDefault()`; `drop` calls `onswap(dragged, id)` when the ids differ.
- `M` (no ctrl/meta/alt) on the window calls `onclose`.

- [ ] **Step 1: Write the failing tests** in `Wall.test.ts` (same `FakeHls` mock and `cam()` helper style as `Player.test.ts`; `props()` builds three cameras `a`, `b`, `c` and `vi.fn()` callbacks):
- `shows a tile per camera and the count`: names visible, `3 cameras`; with one camera, `1 camera`.
- `grid follows the count`: 3 cameras → `grid.style.getPropertyValue('--cols')` is `'2'` and `--rows` is `'2'`; 5 cameras → `'3'` and `'2'`.
- `remove button reports the id`: click `Remove Cam a from wall` → `onremove('a')`.
- `back button and M close the wall`: click `← map` → `onclose`; `userEvent.keyboard('m')` → `onclose`; `{Control>}m{/Control}` does not add a call.
- `a failing stream stays in its tile`: emit `hlsError` `{fatal:true}` on `instances[1]` → `This camera isn't streaming right now` appears once, `onliveness('b','dead')` called, and all three `[data-tile]` still exist.
- `drop swaps`: `fireEvent.dragStart(tile a)`, `fireEvent.dragOver(tile c)`, `fireEvent.drop(tile c)` → `onswap('a','c')`; dropping a tile on itself → no `onswap`.
- `reordering does not restart streams` (Review Focus 4): render with `[a,b,c]`, record `[...container.querySelectorAll('[data-tile]')].map(t => t.dataset.tile)` and the number of `FakeHls` instances; `rerender` with `[c,b,a]` → the DOM order of `[data-tile]` is unchanged, the instance count is unchanged, no instance has `destroyed === true`, and the `style.order` of `a` is `'2'` and of `c` is `'0'`.
- `double-click on a tile requests fullscreen`: `HTMLElement.prototype.requestFullscreen` mock called.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test src/components/Wall.test.ts`
Expected: FAIL (components missing).

- [ ] **Step 3: Implement** `WallTile.svelte` and `Wall.svelte` per the structure above, with the same styling language as `Player.svelte` (dark tile, `rgba(0,0,0,.55)` chips). `Wall` is `position: fixed; inset: 0` on a near-black background, with the bar above the grid.

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test && pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/WallTile.svelte web/src/components/Wall.svelte web/src/components/Wall.test.ts
git commit -m "feat: wall view with auto-fitting grid and drag-to-swap"
```

---

### Task 4: Add-to-wall controls

**Files:**
- Create: `web/src/components/WallButton.svelte`
- Modify: `web/src/components/CameraRow.svelte`, `web/src/components/CameraList.svelte`, `web/src/components/Player.svelte`
- Test: `web/src/components/CameraList.test.ts`, `web/src/components/Player.test.ts`

**Interfaces:**
- Consumes: `MAX_WALL` (Task 1).
- Produces `WallButton` props: `{ inWall: boolean; full: boolean; onclick: () => void }`. Text is `Add to wall`, or `On wall` when `inWall`, or `Wall is full` (disabled, `title="Wall is full (8 cameras)"`) when `full && !inWall`. An `On wall` button is never disabled (pressing it removes).
- `CameraRow` new optional props: `inWall?: boolean; wallFull?: boolean; onwall?: (id: string) => void`. The button renders only when `onwall` is given.
- `CameraList` and `Player` new optional props: `wall?: string[]; onwall?: (id: string) => void`. They compute `inWall = wall.includes(id)` and `full = wall.length >= MAX_WALL` and pass them to every `CameraRow` (and `Player` shows a `WallButton` in `.info` for the current camera).

`CameraRow` is currently one `<button class="row">`; a button cannot sit inside a button. Make the root a `<div class="row">` that keeps the hover/focus handlers and holds (a) the existing content as `<button class="main" onclick={() => onselect(camera.id)}>` and (b) the `WallButton`. Existing text-based queries (`getByText('Simpang Tugu')`) must keep working.

- [ ] **Step 1: Write the failing tests**
- `CameraList.test.ts` — `shows Add to wall and reports the id`: render with `wall: []`, `onwall` mock; click `Add to wall` → `onwall('kota-1')` and `onselect` not called.
- `CameraList.test.ts` — `marks cameras already on the wall`: `wall: ['kota-1']` → the row shows `On wall`.
- `CameraList.test.ts` — `a full wall disables Add for others`: `wall` of 8 other ids → `Wall is full` is disabled; a row whose id is on the wall still shows an enabled `On wall`.
- `CameraList.test.ts` — `no wall props, no button` (the existing `base` props): `queryByText('Add to wall')` is null.
- `Player.test.ts` — `player offers Add to wall`: render with `wall: []`, `onwall` mock → click calls `onwall('kota-1')`; and with `wall: ['kota-1']` shows `On wall`.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test src/components/CameraList.test.ts src/components/Player.test.ts`
Expected: new tests FAIL, old ones pass.

- [ ] **Step 3: Implement** `WallButton.svelte`, restructure `CameraRow.svelte`, pass the new props through `CameraList.svelte` and `Player.svelte` (including the `nearby` rows in `Player`).

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test && pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/WallButton.svelte web/src/components/CameraRow.svelte web/src/components/CameraList.svelte web/src/components/Player.svelte web/src/components/CameraList.test.ts web/src/components/Player.test.ts
git commit -m "feat: add-to-wall control on camera rows and the player"
```

---

### Task 5: Wire the wall into `App`

**Files:**
- Modify: `web/src/App.svelte`, `README.md`

**Interfaces:**
- Consumes: `Wall` (Task 3), `addToWall/removeFromWall/swapInWall/MAX_WALL` (Task 1), `formatWallHash/resolveWallHash` (Task 1), `WallButton` props via `wall`/`onwall` (Task 4), existing `recordPlayback(id, status)`.

State and behaviour in `App.svelte`:
- `wallIds: string[] = $state([])`, `wallOpen = $state(false)`, `wallCameras = $derived(…)` (ids resolved against `cameras`, in order, missing ones skipped).
- `toggleWall(id)`: remove if on the wall, else add. After any change, if `wallOpen` and the list is empty → `closeWall()`; else if `wallOpen` → `history.replaceState(null, '', formatWallHash(wallIds))`.
- `openWall()`: `wallOpen = true` and `replaceState` to the wall hash. `closeWall()`: no-op unless `wallOpen`; sets `wallOpen = false` and `replaceState` back to `formatHash(selectedId)` (which is `''` when nothing is selected).
- `syncFromHash()`: first `resolveWallHash(location.hash, cameras)`; if non-empty → `wallIds = ids; wallOpen = true; return`. Otherwise, if `wallOpen`, set it false (the user left the wall link); then the existing `#cam=` logic runs unchanged.
- `<Wall>` renders inside `{#if wallOpen}`, passing `cameras={wallCameras}`, `onclose={closeWall}`, `onremove={toggleWall}`, `onswap={(a, b) => (wallIds = swapInWall(wallIds, a, b), update URL)}`, `onliveness={recordPlayback}`. Swapping updates the URL the same way as other changes.
- A `Wall ({wallIds.length})` button, absolutely positioned top-right inside the `.map` container (give it `position: relative`), shown only while `wallIds.length > 0 && !wallOpen`; it calls `openWall`.
- `CameraList` (both usages) and `Player` get `wall={wallIds}` and `onwall={toggleWall}`.
- `README.md`: a short "Watch several at once" section — Add to wall, Wall (n), `M`, `F`, drag to swap, max 8, `#wall=kota-1,prov-1915` link, and a note that streams stop when you leave the wall.

- [ ] **Step 1: Implement** the above. `App` has no component test today and the logic that matters is already covered in Tasks 1 and 3; do not add an `App` test harness.

- [ ] **Step 2: Run the full verification**

Run: `pnpm test && pnpm check && pnpm build`
Expected: all PASS, build succeeds.

- [ ] **Step 3: Smoke test in a browser**

Run `pnpm dev`, open `http://localhost:5173/#wall=kota-1,kota-2,prov-1915` (keep it to three cameras; these are government servers). Expected:
- the wall opens full-window with 3 tiles in a 2×2 grid, each with a name chip; a dead camera shows `This camera isn't streaming right now` and keeps its slot;
- dragging one tile onto another swaps them and the other streams keep playing without a visible restart;
- `M` returns to the map, the URL loses `#wall=`, a `Wall (3)` button appears; pressing it reopens the wall and the streams start again;
- removing tiles with ✕ down to zero closes the wall; adding 8 cameras from the list disables further `Add to wall` buttons with `Wall is full`;
- clicking a dot on the map still opens the single player, and `#cam=prov-1915` still opens it on load.

- [ ] **Step 4: Commit**

```bash
git add web/src/App.svelte README.md
git commit -m "feat: multi-stream wall"
```
