# Province Dataset Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put every mappable camera from both the city and province CCTV sites on the one existing map, with unambiguous ids and a search that understands names, places and agencies.

**Architecture:** The Python merge step gains the province crawl as a third input and emits string ids (`kota-<ref>` / `prov-<ref>`). The Svelte app switches its camera identity from `number` to that string across the hash, the liveness cache, `status.json` parsing, search, and the map feature ids, so the two sources can never collide. No dedupe: twin feeds at one spot stay as separate records.

**Tech Stack:** Python 3 (stdlib only, `uv run`), Svelte 5 + Vite + TypeScript, MapLibre GL, hls.js, Vitest + Testing Library, pytest.

**Spec:** `docs/superpowers/specs/2026-10-28-province-dataset-design.md`

## Global Constraints

- Camera id is the string `"<dataset>-<ref>"`: dataset is `kota` or `prov`, ref is the upstream number. Exactly these prefixes.
- Both feeds at the same spot are kept, always. No dedupe, no auto-hide.
- Colours: city `#2563eb`, province `#0d9488`, removed `#ea580c`, dead `#9ca3af`.
- Probe concurrency stays 3–4. Never raise it to make the bigger sweep faster.
- Province rows only enter the map when they have a valid `lat`/`lng` and a non-empty `stream_url`.
- Search must stay case- and separator-insensitive, and must tolerate camelCase names.
- No new runtime dependencies.
- Commands: run `nvm use` in `web/` first. Python via `uv run`; web via `pnpm`.

## Review Focus

Behaviour the spec implies but tests must pin, most likely to bite first:

1. A city camera and a province camera share the number 816 — neither may inherit the other's liveness, selection or URL. → Task 3.
2. Old bookmarks are `#cam=14` with no prefix — they must still open the city camera. → Task 3.
3. A visitor's `localStorage` still holds the v1 cache keyed by bare numbers — it must be ignored, not misread. → Task 3.
4. Province names arrive with no spaces (`JogokariyanSelatan`) — they must display readably and match `jogokariyan selatan`. → Task 4.
5. A province pin with no coordinates or no stream must never reach the map. → Task 1.
6. A `status.json` written by the old numeric-keyed cron must be dropped, not mapped onto the wrong cameras. → Task 3.

---

### Task 1: Merge province cameras into `cameras.json`

**Files:**
- Modify: `build_cameras.py`
- Modify: `tests/test_build_cameras.py`

**Interfaces:**
- Consumes: `cctv.json`, `wayback/getdata_*.json` (existing), `jogjaprov/cameras.json` (crawler output, 1006 rows).
- Produces: `web/public/cameras.json`, a list of records with `id: str`, `ref: int`, `dataset: "kota"|"prov"`, `title`, `url`, `lat`, `lon`, `kecamatan`, `kelurahan`, `owner`, `slug`, `source`, `lastSeen`. Public function `merge(live: list[dict], snapshots: list[tuple[str, list[dict]]], province: list[dict]) -> list[dict]`.

- [ ] **Step 1: Rewrite the failing tests for the new record shape**

In `tests/test_build_cameras.py`, update the four existing tests to expect string ids (`"kota-1"`, etc.) and the new fields, then add:

```python
def prov(i, name="Cam", lat=-7.80, lng=110.37, stream="https://x/p.m3u8", owner="Dinas Kominfo Sleman", slug="some-slug"):
    return {"id": i, "name": name, "lat": lat, "lng": lng, "stream_url": stream, "group_name": owner, "slug": slug}


def test_province_rows_are_official_and_keep_their_slug():
    [cam] = merge([], [], [prov(1915, "JogokariyanSelatan")])
    assert cam == {"id": "prov-1915", "ref": 1915, "dataset": "prov", "title": "JogokariyanSelatan",
                   "url": "https://x/p.m3u8", "lat": -7.80, "lon": 110.37, "kecamatan": "", "kelurahan": "",
                   "owner": "Dinas Kominfo Sleman", "slug": "some-slug", "source": "official", "lastSeen": None}


def test_drops_province_pins_without_stream_or_coordinates():
    pins = [prov(1, stream=None), prov(2, stream=""), prov(3, lat=None), prov(4, lng=None), prov(5, lat=0, lng=0), prov(6)]
    assert [c["ref"] for c in merge([], [], pins)] == [6]


def test_keeps_a_city_and_province_camera_at_the_same_spot():
    city, pins = [rec(816)], [prov(816)]
    assert [c["id"] for c in merge(city, [], pins)] == ["kota-816", "prov-816"]


def test_sorts_city_before_province_then_by_ref():
    out = merge([rec(10), rec(2)], [], [prov(9), prov(100)])
    assert [c["id"] for c in out] == ["kota-2", "kota-10", "prov-9", "prov-100"]
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `uv run --with pytest pytest tests/test_build_cameras.py -q`
Expected: FAIL — `merge() missing 1 required positional argument: 'province'` and key errors on `id`.

- [ ] **Step 3: Implement the merge**

In `build_cameras.py`:

- `PROVINCE = Path("jogjaprov/cameras.json")`.
- `_camera(rec)` keeps its coordinate rules but returns `ref` instead of `id`.
- `_province(rec) -> dict | None` returns `None` unless `rec.get("stream_url")` and `lat`/`lng` are valid non-zero floats; otherwise maps `name`, `stream_url`, `group_name or ""`, `slug or ""`, empty `kecamatan`/`kelurahan`, `source="official"`, `lastSeen=None`.
- `merge(live, snapshots, province)` tags city records `dataset="kota"` with `id=f"kota-{ref}"`, province records `id=f"prov-{ref}"`, and sorts with:

```python
key=lambda c: (c["dataset"], c["ref"])
```

- `main()` loads the province file when it exists (treat a missing file as `[]`), and prints the split: `city = sum(1 for c in cams if c["dataset"] == "kota")`, then `print(f"{len(cams)} cameras ({city} city, {len(cams) - city} province) -> {OUT}")`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `uv run --with pytest pytest tests/test_build_cameras.py -q`
Expected: PASS, 7 tests.

- [ ] **Step 5: Rebuild the data and check the count**

Run: `uv run python build_cameras.py`
Expected: `714 cameras (172 city, 542 province) -> web/public/cameras.json`. A count within a few cameras of 714 is acceptable only if `jogjaprov/cameras.json` has been recrawled since; if it differs by more than 5, stop and investigate.

- [ ] **Step 6: Commit**

```bash
git add build_cameras.py tests/test_build_cameras.py web/public/cameras.json
git commit -m "feat: merge province cameras into the map dataset"
```

---

### Task 2: Make `probe_status.py` aware of composite ids

**Files:**
- Modify: `probe_status.py`
- Modify: `tests/test_probe_status.py`
- Modify: `docs/deploy.md`

**Interfaces:**
- Consumes: camera records from Task 1 with `id` strings.
- Produces: `status.json` whose `cameras` object is keyed by those same strings.

- [ ] **Step 1: Update the failing tests**

In `tests/test_probe_status.py`, change `cam()` to take a string id, and update the two expectations to composite ids:

```python
def cam(i, url="https://x/a.m3u8"):
    return {"id": i, "url": url}


def test_build_status_covers_every_camera_in_id_order():
    out = build_status([cam("prov-2"), cam("kota-10"), cam("kota-2")], lambda url: True, "2026-10-28T06:00:00Z")
    assert list(out["cameras"]) == ["kota-2", "kota-10", "prov-2"]
```

Add:

```python
def test_build_status_keeps_unknown_shapes_working():
    out = build_status([cam("14"), cam("kota-9")], lambda url: True, "t")
    assert sorted(out["cameras"]) == ["14", "kota-9"]
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `uv run --with pytest pytest tests/test_probe_status.py -q`
Expected: FAIL — `ValueError: invalid literal for int()` from the existing `int(c["id"])` sort.

- [ ] **Step 3: Implement the sort key**

In `probe_status.py`, replace the `int(c["id"])` sort with:

```python
def _sort_key(cam: dict) -> tuple[str, int, str]:
    dataset, _, ref = str(cam["id"]).partition("-")
    return (dataset, int(ref), "") if ref.isdigit() else ("", 0, dataset)
```

and use `sorted(cameras, key=_sort_key)`. Leave concurrency, timeout and the atomic write untouched.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `uv run --with pytest pytest tests/test_probe_status.py -q`
Expected: PASS, 8 tests.

- [ ] **Step 5: Update the deploy note**

In `docs/deploy.md`, change the limits line "Each sweep is 172 requests to the city server" to say the sweep is now ~714 requests to the city **and province** servers, that the same 3–4 concurrency keeps the request rate unchanged, and that the interval lengthens before the concurrency rises. Leave the 15-minute cron as is.

- [ ] **Step 6: Commit**

```bash
git add probe_status.py tests/test_probe_status.py docs/deploy.md
git commit -m "feat: probe status by composite camera id"
```

---

### Task 3: Switch the app's identity to string ids

**Files:**
- Modify: `web/src/lib/types.ts`
- Modify: `web/src/lib/hash.ts`, `web/src/lib/hash.test.ts`
- Modify: `web/src/lib/geo.ts`, `web/src/lib/geo.test.ts`
- Modify: `web/src/lib/liveness.ts`, `web/src/lib/liveness.test.ts`
- Modify: `web/src/lib/status.ts`, `web/src/lib/status.test.ts`
- Modify fixture builders only in: `web/src/lib/search.test.ts`, `web/src/components/CameraList.test.ts`, `web/src/components/Player.test.ts`

**Interfaces:**
- Consumes: records from Task 1.
- Produces, for every later task:
  - `Camera { id: string; ref: number; dataset: 'kota' | 'prov'; title: string; url: string; lat: number; lon: number; kecamatan: string; kelurahan: string; owner: string; slug: string; source: 'official' | 'removed'; lastSeen: string | null }`
  - `Toggles { kota: boolean; prov: boolean; removed: boolean; dead: boolean }`
  - `LivenessMap = Record<string, Liveness>`, `LivenessCache = Record<string, { status: Status; at: number }>`
  - `formatHash(id: string | null): string`, `resolveHashCamera(hash: string, cams: Camera[]): Camera | null`
  - `kindOf(cam: Camera, liveness: LivenessMap): 'kota' | 'prov' | 'removed' | 'dead'`
  - `applyResults(liveness, cache, results: [string, Status][], now, skip?: ReadonlySet<string>)`

- [ ] **Step 1: Write the failing tests**

`web/src/lib/hash.test.ts`:

```ts
const cams = [{ id: 'kota-14' }, { id: 'prov-14' }] as any;
it('round-trips composite ids', () => {
  expect(formatHash('prov-14')).toBe('#cam=prov-14');
  expect(resolveHashCamera('#cam=prov-14', cams)?.id).toBe('prov-14');
  expect(resolveHashCamera('#cam=kota-14', cams)?.id).toBe('kota-14');
});
it('resolves legacy numeric links to the city camera', () => {
  expect(resolveHashCamera('#cam=14', cams)?.id).toBe('kota-14');
});
it('distinguishes the same number in both datasets', () => {
  expect(resolveHashCamera('#cam=prov-14', cams)?.id).not.toBe(resolveHashCamera('#cam=kota-14', cams)?.id);
});
it('ignores malformed hashes', () => {
  for (const h of ['#cam=99999', '#cam=', '', '#other=14', '#cam=kota-']) expect(resolveHashCamera(h, cams)).toBeNull();
});
```

`web/src/lib/status.test.ts` — add:

```ts
it('rejects keys that are not composite ids', async () => {
  const out = await loadStatus(() => ok({ generatedAt: '2026-10-28T05:55:00Z', cameras: { 14: 'alive', 'kota-14': 'dead' } }), NOW);
  expect(out).toEqual({ 'kota-14': 'dead' });
});
```

Change the ids in the other cases to composite ones too — inputs *and* expectations, e.g. `{ 'kota-14': 'alive', 'prov-207': 'dead' }` with `expect(out).toEqual({ 'kota-14': 'alive', 'prov-207': 'dead' })`.

`web/src/lib/liveness.test.ts`:

```ts
it('ignores the v1 cache key', () => {
  localStorage.setItem('cctv-liveness-v1', JSON.stringify({ 1: { status: 'alive', at: 0 } }));
  expect(loadCache(localStorage, 0)).toEqual({});
});
```

Update `applyResults`, `checkAll` and cache fixtures to string ids (`'kota-1'`, etc.).

`web/src/lib/geo.test.ts`:

```ts
it('separates province from city and lets dead win', () => {
  expect(kindOf(cam('kota-1', 0, 0, 'official'), {})).toBe('kota');
  expect(kindOf(prov('prov-1'), {})).toBe('prov');
  expect(kindOf(prov('prov-1'), { 'prov-1': 'dead' })).toBe('dead');
});
it('keeps string ids on features', () => {
  expect(toFeatureCollection([cam('kota-7', -7.8, 110.37)], {}).features[0].id).toBe('kota-7');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd web && nvm use && pnpm test`
Expected: FAIL on hash (`#cam=prov-14` not resolved), status (numeric key accepted), liveness (v1 key read), geo (`kindOf` returns `official`).

- [ ] **Step 3: Implement the identity change**

- `types.ts`: fields and types exactly as the Interfaces block; add `export type Dataset = 'kota' | 'prov';` and change `Kind`-related types only where they live today.
- `hash.ts`: `formatHash` returns `#cam=${id}`. `resolveHashCamera` matches `/^#cam=(.+)$/`, decodes the id, looks it up by exact `id`, and — only when the token is all digits — retries as `kota-<token>`. Return `null` for an empty or unknown token.
- `geo.ts`: `Kind = 'kota' | 'prov' | 'removed' | 'dead'`; `kindOf` returns `'dead'` when liveness is dead, else `'removed'` when source is removed, else the dataset. Feature `id` and `properties.id` carry the string id.
- `liveness.ts`: `CACHE_KEY = 'cctv-liveness-v2'`; `checkAll` and `applyResults` take string ids; the port of `loadCache` must not cast keys with `Number()`.
- `status.ts`: accept an entry only when the key matches `/^(kota|prov)-\d+$/`; drop everything else, including bare numbers.
- Update the fixture builders in `search.test.ts`, `CameraList.test.ts` and `Player.test.ts` to the new `Camera` shape, using ids like `'kota-1'`. Do not change their assertions beyond the id type in this task.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd web && pnpm test`
Expected: PASS. Component tests still pass because behaviour is unchanged.

- [ ] **Step 5: Type-check**

Run: `cd web && pnpm check`
Expected: PASS. If component props still declare `number`, update them to `string` here — no behaviour change.

- [ ] **Step 6: Commit**

```bash
git add web/src
git commit -m "refactor: identify cameras by dataset-prefixed string id"
```

---

### Task 4: Blend names, places and agencies into search

**Files:**
- Modify: `web/src/lib/search.ts`
- Modify: `web/src/lib/search.test.ts`

**Interfaces:**
- Consumes: `Camera`, `Toggles`, `LivenessMap` from Task 3.
- Produces: `displayName(title: string): string`, `searchCameras(cams: Camera[], query: string): Camera[]`, `visibleCameras(cams, toggles, liveness, selectedId: string | null): Camera[]`, `livenessOf(map, id: string)`.

- [ ] **Step 1: Write the failing tests**

Replace `web/src/lib/search.test.ts` with cases covering the spec:

```ts
const cam = (id: string, title: string, extra: Partial<Camera> = {}): Camera => ({
  id, ref: 1, dataset: 'kota', title, url: '', lat: 0, lon: 0, kecamatan: '', kelurahan: '', owner: '', slug: '',
  source: 'official', lastSeen: null, ...extra,
});
const all = { kota: true, prov: true, removed: true, dead: true };

it('splits camelCase for display', () => {
  expect(displayName('JogokariyanSelatan')).toBe('Jogokariyan Selatan');
  expect(displayName('Malioboro_Mall_Utara')).toBe('Malioboro Mall Utara');
});

it('finds place names that only exist in the slug', () => {
  const cams = [cam('prov-1281', 'ViewDepanMall', { dataset: 'prov', slug: 'depan-plazamall-malioboro' })];
  expect(searchCameras(cams, 'malioboro').map((c) => c.id)).toEqual(['prov-1281']);
});

it('matches agency names and expands dishub', () => {
  const cams = [cam('prov-9', 'RingRoad', { dataset: 'prov', owner: 'Dinas Perhubungan DIY' })];
  expect(searchCameras(cams, 'dishub').map((c) => c.id)).toEqual(['prov-9']);
  expect(searchCameras(cams, 'perhubungan').map((c) => c.id)).toEqual(['prov-9']);
});

it('matches provinsi and kota as dataset words', () => {
  const cams = [cam('kota-1', 'A'), cam('prov-2', 'B', { dataset: 'prov' })];
  expect(searchCameras(cams, 'provinsi').map((c) => c.id)).toEqual(['prov-2']);
  expect(searchCameras(cams, 'kota').map((c) => c.id)).toEqual(['kota-1']);
});

it('ranks title matches above place matches', () => {
  const cams = [cam('prov-1', 'X', { owner: 'Sleman' }), cam('prov-2', 'Sleman Ring Road', { owner: 'Bantul' })];
  expect(searchCameras(cams, 'sleman').map((c) => c.id)).toEqual(['prov-2', 'prov-1']);
});

it('hides by dataset and dead toggles', () => {
  const cams = [cam('kota-1', 'a'), cam('prov-2', 'b', { dataset: 'prov' }), cam('kota-3', 'c', { source: 'removed' })];
  expect(visibleCameras(cams, { ...all, kota: false }, {}, null).map((c) => c.id)).toEqual(['prov-2', 'kota-3']);
  expect(visibleCameras(cams, { ...all, prov: false }, {}, null).map((c) => c.id)).toEqual(['kota-1', 'kota-3']);
  expect(visibleCameras(cams, { ...all, dead: false }, { 'prov-2': 'dead' }, null).map((c) => c.id)).toEqual(['kota-1', 'kota-3']);
  expect(visibleCameras(cams, { ...all, prov: false }, { 'prov-2': 'dead' }, 'prov-2').map((c) => c.id)).toEqual(['kota-1', 'prov-2', 'kota-3']);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd web && pnpm test src/lib/search.test.ts`
Expected: FAIL on camelCase display, slug/agency matching, ranking and the new toggles.

- [ ] **Step 3: Implement search**

In `search.ts`:

- `splitCamel = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1 $2')`.
- `displayName` splits camelCase then underscores, collapses whitespace, trims.
- `normalize` lowercases, splits camelCase, turns `[_\-.]` into spaces, collapses, trims.
- `ALIASES: Record<string, string> = { dishub: 'perhubungan' }`; expand the query's words through it before matching (alias adds an alternative term, it does not replace the typed one).
- `datasetWords(cam)` returns `['kota']` for city, `['prov', 'provinsi', 'diy']` for province.
- `matches(cam, term)` checks `title`, `kecamatan`, `kelurahan`, `owner`, `slug`, and the dataset words, all normalized.
- `searchCameras` splits the query on whitespace, requires every term to match, and sorts with title hits first, then alphabetically by `displayName(title)`.
- `visibleCameras` hides a camera when its dataset toggle, its `removed` toggle, or (unless selected) the `dead` toggle is off.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd web && pnpm test src/lib/search.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/search.ts web/src/lib/search.test.ts
git commit -m "feat: search names, places, agencies and dataset words"
```

---

### Task 5: Show the source in the list and the player

**Files:**
- Modify: `web/src/App.svelte`
- Modify: `web/src/components/CameraList.svelte`, `CameraRow.svelte`, `Player.svelte`
- Modify: `web/src/components/CameraList.test.ts`, `Player.test.ts`

**Interfaces:**
- Consumes: `Camera`, `Toggles`, search helpers from Tasks 3–4.
- Produces: UI only; same props as today with `string` ids.

- [ ] **Step 1: Write the failing tests**

`CameraList.test.ts`:

```ts
it('names the dataset and the owner', () => {
  const city = cam('kota-1', 'Simpang Tugu');
  const prov = { ...cam('prov-2', 'RingRoad'), dataset: 'prov' as const, owner: 'Dinas Perhubungan DIY' };
  render(CameraList, { ...base, cameras: [city, prov] });
  expect(screen.getByText('Kota · Official')).toBeInTheDocument();
  expect(screen.getByText('Provinsi · Dinas Perhubungan DIY')).toBeInTheDocument();
});

it('offers four toggles', () => {
  render(CameraList, { ...base, cameras: [] });
  for (const label of ['Kota', 'Provinsi', 'Removed', 'Dead']) expect(screen.getByLabelText(label)).toBeInTheDocument();
  await userEvent.click(screen.getByLabelText('Provinsi'));
  expect(base.ontoggle).toHaveBeenCalledWith({ kota: true, prov: false, removed: true, dead: true });
});
```

Update the existing dead-state assertion to `'Kota · Removed · dead'`, the `base.toggles` fixture to `{ kota: true, prov: true, removed: true, dead: true }`, and the existing toggle assertion in "click selects, hover reports, toggle emits new toggles" to `{ kota: true, prov: true, removed: true, dead: false }`.

`Player.test.ts` — after the existing "Removed · last seen" case, add that a province camera shows `Provinsi · Dinas Perhubungan DIY`. Keep the rest unchanged, with string-id fixtures.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd web && pnpm test src/components`
Expected: FAIL — rows render `Official`, only three toggles exist.

- [ ] **Step 3: Implement the labels and toggles**

- `CameraRow.svelte`: keep the dot classes; add `prov` (`#0d9488`). Second line: `kecamatan` when present, else `owner`. Status line: `` `${dataset === 'prov' ? 'Provinsi' : 'Kota'} · ${source === 'official' ? 'Official' : 'Removed'}` `` plus ` · dead` / ` · checking…` as today.
- `CameraList.svelte`: placeholder `Search camera, place, agency…`; four toggle groups in the order Kota, Provinsi, Removed, Dead with matching swatch colours; count text unchanged.
- `Player.svelte`: replace the single source line with dataset first — `Kota · Official`, or for province `Provinsi · <owner>`, or for removed `Kota · Removed · last seen <date>`.
- `App.svelte`: `toggles` defaults to all four on; `selectedId`, `group`, `playerResolved` and `recordPlayback` use `string`; nothing else changes.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd web && pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src
git commit -m "feat: label city and province cameras in the list and player"
```

---

### Task 6: Colour the map by source

**Files:**
- Modify: `web/src/lib/geo.ts` (only if `Kind` is not already four-valued from Task 3)
- Modify: `web/src/components/MapView.svelte`
- Modify: `web/src/lib/geo.test.ts` only if `kindOf` changes here

**Interfaces:**
- Consumes: `Kind` from Task 3, `toFeatureCollection` output with string ids.
- Produces: no API change; `onselect` receives a string id.

- [ ] **Step 1: Write the failing test**

In `web/src/lib/geo.test.ts`, pin the cluster-colour rule by extracting it:

```ts
import { clusterKind } from './geo';
it('colours a cluster by its worst member', () => {
  expect(clusterKind({ dead: 3, removed: 0, prov: 0 })).toBe('dead');
  expect(clusterKind({ dead: 1, removed: 2, prov: 1 })).toBe('removed');
  expect(clusterKind({ dead: 0, removed: 0, prov: 4 })).toBe('prov');
  expect(clusterKind({ dead: 0, removed: 0, prov: 0 })).toBe('kota');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && pnpm test src/lib/geo.test.ts`
Expected: FAIL — `clusterKind is not a function`.

- [ ] **Step 3: Implement the colour rule**

- `geo.ts`: add `export function clusterKind(counts: { dead: number; removed: number; prov: number }): Kind` — all members dead → `dead`; else any removed → `removed`; else any province → `prov`; else `kota`.
- `MapView.svelte`: add `prov: '#0d9488'` to `COLOR`; add a `prov` entry to `clusterProperties`; paint `clusters` and `points` with a `match` on `kind` covering `prov`; use `clusterKind` for the cluster paint; type `onselect`/`hoveredId` as strings.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd web && pnpm test && pnpm check`
Expected: PASS.

- [ ] **Step 5: Look at it**

Run: `cd web && pnpm dev`, open `http://localhost:5173`, zoom out to all of DIY.
Expected: teal province dots outside the city, blue city dots inside it, clusters tinted by the rule, four legend swatches. Screenshot it before committing.

- [ ] **Step 6: Commit**

```bash
git add web/src
git commit -m "feat: colour province cameras and clusters"
```

---

### Task 7: Refresh the data and verify end to end

**Files:**
- Modify: `web/public/cameras.json` (generated), `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: shipped data + docs.

- [ ] **Step 1: Recrawl and rebuild**

```bash
uv run python crawl_cctv.py
uv run python crawl_jogjaprov.py
uv run python build_cameras.py
```
Expected: the province crawl reports `1006 cameras, … live`; the build reports `714 cameras (172 city, 542 province)`. A different live count is fine; a different total is not.

- [ ] **Step 2: Run every test and check**

```bash
uv run --with pytest pytest tests -q
cd web && pnpm test && pnpm check && pnpm build
```
Expected: all pass; `pnpm build` writes `web/dist`.

- [ ] **Step 3: Verify the behaviours that have no unit test**

With `pnpm dev` running:
1. Open `#cam=kota-816` and `#cam=prov-816` — two different cameras, two different streams.
2. Open `#cam=14` — the legacy link still lands on a city camera.
3. Search `dishub` — the Perhubungan cameras appear; `malioboro` finds both the city cameras and `View Depan Mall`.
4. Click a teal cluster outside the city — the list shows province cameras with their agency.
5. Turn off `Kota` — the city dots disappear, province ones stay.

- [ ] **Step 4: Note the refresh order in the README**

Add `uv run python crawl_jogjaprov.py` between the city crawl and the merge in the "Refresh the data" block, and one line under it saying the map now merges the city and province sources.

- [ ] **Step 5: Commit**

```bash
git add web/public/cameras.json README.md
git commit -m "chore: refresh merged city and province camera data"
```
