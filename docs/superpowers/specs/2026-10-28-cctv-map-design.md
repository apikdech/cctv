# CCTV Jogja Map — Design

## Intent

The official site (cctv.jogjakota.go.id) shows a map of city cameras, but
the city has quietly removed cameras from its public list — 62 of the 165
ever archived, including the whole Malioboro corridor and Nol Km. **50 of
those removed cameras still stream** from the city's video server; only the
listing was deleted.

The user wants a local web app to browse *every* camera — official and
removed — on a map, navigate easily even where cameras are packed tightly,
and watch the live feed. The user is new to map UIs and handed UX and stack
decisions to the builder's judgment.

## Goals

- See all cameras on a map of Yogyakarta, with dense areas staying readable.
- Find a camera by name quickly.
- Watch any camera that's still streaming, including removed ones.
- Clearly see which cameras are official, removed-but-streaming, or dead.

## Non-goals

- Recording, screenshots, or archiving video.
- Watching several cameras at once.
- Hosting/deploying publicly. Runs locally (`npm run dev` / static build).
- A backend or database.
- Category filters — `cctv_category` is a numeric ID with no names in the
  data, so there's nothing meaningful to label.
- Re-crawling from the browser. Data refresh stays with the Python scripts.

## Anti-goals (would be a failure even if it "works")

- Hammering the city server. A gov server that already rate-limits; the app
  must be gentle (see Stream status).
- Downtown turning into unreadable overlapping dots/labels.
- A black video box with no explanation when a stream is dead.
- Heavy stack for a one-page tool.

## Existing work (build on it)

In `/Users/apik/Projects/cctv` (not a git repo):

- `crawl_cctv.py` → `cctv.json` — live list, 110 cameras (24 fields each).
- `crawl_wayback.py` → `wayback/getdata_<ts>.json` (14 captures,
  2024-08 → 2025-09-01), `wayback/history.csv`, `wayback/all_cameras.csv`.
- `audit_cameras.py` → `wayback/removed_cameras.csv`.

Key record fields: `cctv_id`, `cctv_title`, `cctv_link` (HLS `.m3u8`),
`cctv_latitude`, `cctv_longitude` (strings), `kecamatan_nama`,
`kelurahan_nama`, `cctv_status`.

Verified facts:
- `cctvjss.jogjakota.go.id` returns `Access-Control-Allow-Origin: *`, so
  hls.js can play streams directly from localhost. No proxy needed.
- Stream URLs are master playlists → chunklist → `.ts` segments.
- The live `getdata` endpoint is **not** browser-fetchable (needs the
  `X-Requested-With` header and has no CORS). Data must be bundled.

## Data

A build-time step merges sources into one file the app loads
(e.g. `public/cameras.json`):

- Union of live `cctv.json` and every `wayback/getdata_*.json`, keyed by
  `cctv_id`.
- For each camera take the **newest** record (live beats any archive; later
  archive beats earlier), so title/link/coords are current.
- Add `source`: `"official"` if in live `cctv.json`, else `"removed"`.
- Add `last_seen` (snapshot timestamp, or "live") for removed cameras.
- Parse lat/lon to numbers; drop records with missing/invalid coords.
- Duplicates: different `cctv_id`s can share a stream URL (e.g. id 207 and
  829 "Simpang Demangan View Timur"). Keep both; they're separate entries.

Refreshing = re-run the Python crawlers, then the merge step. The merge step
should be a small script in the repo, runnable with one command.

## Layout (user picked)

Full-screen map with a **left side panel**.

### Map
- MapLibre GL + free OpenStreetMap-based raster or vector tiles, no API key.
- Opens centred on Yogyakarta city, fitted to all cameras.
- **Clustering**: nearby cameras merge into a bubble showing a count;
  clicking a bubble zooms in to split it; bubbles split naturally on zoom.
- **Same-spot cameras** (e.g. four views at one intersection) must still be
  individually clickable at max zoom — fan them out (spiderfy) or equivalent.
- **Hover** a single dot → tooltip with the camera name.
- At street-level zoom, names may show next to dots when there's room.
- The camera currently playing is visually ringed/highlighted.

### Side panel — list mode (default)
- Search box filtering by name (case-insensitive, substring).
- Count of cameras shown.
- Each row: camera name, kecamatan underneath (omitted when empty — ~25
  cameras have none in any source), and a status indicator.
- Hover a row → its dot highlights on the map.
- Click a row → map flies to it and opens player mode.
- Legend/toggles to show/hide each group: official · removed · dead.

### Side panel — player mode (user picked "video in the side panel")
- Video at top (hls.js; native HLS fallback for Safari).
- **Fullscreen button** on the video (user asked for this) — real browser
  fullscreen; Esc exits.
- Camera name, kecamatan/kelurahan, source (official / removed, with
  last-seen date for removed).
- "Nearby" list of the closest few cameras — click to switch.
- "← back to list".
- One stream at a time; switching stops the previous one.
- If a stream fails: friendly message ("This camera isn't streaming right
  now") instead of a black box.

### URL
- Selected camera reflected in the URL hash (e.g. `#cam=14`) so it can be
  bookmarked/shared; loading that URL opens that camera.

## Stream status (user decided: show removed; mark dead ones)

Two independent properties per camera *(builder's call: the user said
"dead → show an indicator", which applies to any dead camera, not only
removed ones)*:

- `source`: `official` | `removed` — fixed, from the merge step.
- `liveness`: `checking` | `alive` | `dead` — from the browser check.

How they render:

| source | liveness | look |
|---|---|---|
| official | alive / checking | primary colour |
| removed | alive / checking | second colour |
| either | dead | grey with a "dead" indicator; still clickable to show info |

The list row and player always show the source (e.g. "Removed · dead").
Toggles: **official**, **removed**, **dead** (hiding "dead" hides dead
cameras of both sources).

Status is checked **live in the browser** (CORS allows it): fetch each
camera's `playlist.m3u8` with low concurrency (~4 at a time), and treat
HTTP 200 + non-empty body as alive. All cameras are checked, official
included. Until checked, show the camera as "checking" (source colour) —
the map must be usable immediately, not blocked on checks. A cluster's
colour can follow its members; exact rule is the builder's call.

Results are cached in `localStorage` for **10 minutes** *(builder's
call)*, so reloads within that window send no checks. Opening a camera in
the player re-determines liveness from the actual playback result and
updates the cache.

## Stack (builder's call, stated to user)

- **Svelte (current major, runes) + Vite + TypeScript** — user chose
  Svelte because the app may grow (recording, multi-view, stats). Plain
  Svelte, **not SvelteKit** *(builder's call: one page today; SvelteKit can
  be adopted when a second page actually exists)*. MapLibre and hls.js are
  each wrapped in a thin component that owns its DOM element.
- MapLibre GL JS for the map (clustering via its GeoJSON source).
- hls.js for video.
- Node via nvm (v26 available; add `.nvmrc`). npm.
- Merge step: Python via `uv run` to match existing scripts, or a Node
  script — builder's call.

## Left to the builder

- Exact colours, icons, typography, spacing.
- Tile provider choice (must be free, keyless, OSM-based).
- Spiderfy implementation approach.
- Mobile behaviour (desktop-first; should not be broken on a phone).
- How many "nearby" cameras, and the distance rule.
- Project folder layout inside the repo.
