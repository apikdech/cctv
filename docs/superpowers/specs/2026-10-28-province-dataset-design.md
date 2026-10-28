# CCTV Jogja Map — Province dataset merge

## Intent

The map today only knows the **city** site (`cctv.jogjakota.go.id`): 172
cameras, all inside the city. The **province** site
(`cctv.jogjaprov.go.id`) publishes 1,006 pins covering the whole DIY —
Sleman, Bantul, Gunungkidul, Kulon Progo and the city — through its own
HLS proxy. 542 of those pins are mappable and have a stream.

The user navigates the way they use Google Maps: pan to an area they
already have in mind, or type a word into search. So both datasets belong
on **one map**, with search understanding everything, not behind a dataset
switch.

The two sources overlap heavily: 63 of the 172 city cameras have a
province feed within 25 m (98 pairs), the same intersection from a
different owner. The user wants **both kept** — they are different angles
and different quality.

## Goals

- Every mappable camera from both sites on one map, no dataset switch.
- Search finds a camera by name, place (`Sleman`, `Malioboro`,
  `Jogokariyan`) or agency (`Dishub`, `Kominfo`).
- Cameras that share a spot all exist and are independently playable.
- An id that is unambiguous across datasets, everywhere it is used.

## Non-goals

- Collapsing "twin" feeds into one marker.
- Mapping the 333 province pins with no coordinates, or the 452 with no
  stream.
- Scraping the province admin UI; province refresh stays in
  `crawl_jogjaprov.py`.
- New filter concepts beyond the legend toggles.
- Auto-refreshing data at runtime.

## Anti-goals (failure even if it works)

- A province camera inheriting a city camera's liveness because both use
  the number 816.
- Hiding city feeds under province twins, which would quietly delete the
  "removed from the city list" story the app exists for.
- Quadrupling probe traffic to government servers without saying so.
- Search that only understands camera names, so "Sleman" finds nothing.

## Decisions the user made

- Same spot, two feeds → show both; never auto-hide.
- One map; navigate by panning or search; no dataset tab.
- Search should "find everything" — names and places/agencies blended.

## Data

Merged at build time into `web/public/cameras.json`, as today.

| input | cameras |
|---|---|
| `cctv.json` + `wayback/*` (existing merge) | 172 |
| `jogjaprov/cameras.json`, rows with valid coords **and** a `stream_url` | 542 |
| **merged** | **714** |

`jogjaprov/cameras.json` stays the crawler's full output (1,006 rows,
including dead and unmappable ones); only the mappable subset is merged.

### Identity

Numeric ids collide across the two sources (11 shared numbers, e.g. 816,
817, 843). Every consumer therefore switches from `number` to this string:

```
id = "<dataset>-<ref>"     e.g. "kota-816", "prov-1915"
```

`ref` keeps the upstream id as a number for debugging and for mapping back
to the crawler output. `dataset` is `"kota" | "prov"` and drives colour,
labels and filters.

### Record shape

| field | kota | prov |
|---|---|---|
| `id` | `kota-<cctv_id>` | `prov-<pin id>` |
| `ref` | `cctv_id` | pin id |
| `dataset` | `kota` | `prov` |
| `title` | `cctv_title` | `name` |
| `url` | `cctv_link` | `stream_url` |
| `lat` / `lon` | parsed | parsed |
| `kecamatan` / `kelurahan` | from city record | `""` |
| `owner` | `""` | `group_name` (e.g. "Dinas Kominfo Sleman") |
| `slug` | `""` | pin `slug` (e.g. `depan-plazamall-malioboro`) |
| `source` | `official` \| `removed` | always `official` |
| `lastSeen` | date or `null` | `null` |

Records with missing/invalid coordinates are dropped, as today.

## Liveness

`status.json` keys become these string ids (`"kota-816": "alive"`). Two
consequences:

- `probe_status.py` no longer sorts by `int(id)`; the sweep grows from 172
  to 714 URLs. At the current concurrency (3–4) that is ~1–3 minutes,
  still well inside the 15-minute cron. **Keep concurrency as it is** and
  lengthen the interval if the sweep ever strains — the deploy doc's
  "be gentle" rule wins over freshness.
- The browser cache key bumps `cctv-liveness-v1` → `cctv-liveness-v2`, so
  numeric keys cached by the old build are never read against new ids.

Unchanged: a stale/missing `status.json` falls back to browser probing, and
playing a stream overrides the file. `docs/deploy.md` updates its "172
requests" note to 714.

## Search

Matches, case- and separator-insensitively, across:

- `title`
- `kecamatan`, `kelurahan`
- `owner`
- `slug` *(builder's call: many province names are terse — `ViewDepanMall`
  carries `depan-plazamall-malioboro`, and `Purosani`/`Bugisan` appear in no
  name or owner at all, only in slugs)*
- the dataset words `kota`, `provinsi`, `prov`, `diy`

Display stays `title`; the slug is search-only.

Agency abbreviations expand before matching *(builder's call)*: `dishub` →
`perhubungan`, so the 90 `Dinas Perhubungan DIY` cameras answer to the word
people actually type. `kominfo` already matches the owners literally; no
further aliases are added.

Province names arrive CamelCase (`SimpangDeBritto`, `JogokariyanSelatan`),
so both display and matching split camel boundaries — searching
`jogokariyan selatan` must find `JogokariyanSelatan`, and the row should
read `Jogokariyan Selatan` rather than the raw concatenation.

Ranking: title matches first, then place/agency matches, each alphabetical
within its group. An empty query shows everything. Search remains a list
filter; selecting a result flies the map and opens the player, as today.

## Look

Colour is provenance; grey overrides everything:

| class | colour |
|---|---|
| city, in today's city list | `#2563eb` blue |
| province | `#0d9488` teal |
| removed from the city list | `#ea580c` orange |
| dead / not responding | `#9ca3af` grey |

The legend swatches double as the toggles: **Kota · Provinsi · Removed ·
Dead**, all on by default. Dataset toggles and the dead toggle are
independent (a dead city camera is hidden by "Dead", not by "Kota"); the
selected camera is always visible.

Rows and the player name the source in words, because colour alone is not
enough with four classes:

- `Simpang APMD (PTZ)` — `Kota · Official`
- `APMD` — `Provinsi · Dinas Kominfosan Yogyakarta`

Cluster colour *(builder's call)*: all members dead → grey; else any
removed → orange; else any province → teal; else blue.

## URL

`#cam=kota-816`. Legacy links without a dataset (`#cam=816`) resolve to the
city camera of that number, so old bookmarks keep working.

## Build and refresh

`build_cameras.py` gains the province input and emits the merged file.
Refresh order becomes:

```
uv run python crawl_cctv.py        # city  -> cctv.json
uv run python crawl_jogjaprov.py   # prov  -> jogjaprov/cameras.json
uv run python build_cameras.py     # merge -> web/public/cameras.json
```

## Files expected to change

- `build_cameras.py` — merge province rows, string ids, `dataset`/`owner`/`ref`
- `probe_status.py` — string ids, sort
- `web/src/lib/types.ts` — `id: string`, `ref`, `dataset`, `owner`, toggles
- `web/src/lib/hash.ts` — composite parse + legacy numeric
- `web/src/lib/search.ts` — blended fields, camel splitting, ranking
- `web/src/lib/liveness.ts` — string keyed cache, v2
- `web/src/lib/status.ts` — string keys
- `web/src/lib/geo.ts` — `Kind` gains `prov`; feature ids
- `web/src/App.svelte`, `CameraList`, `CameraRow`, `Player`, `MapView` — ids,
  labels, colours, toggles
- `docs/deploy.md` — sweep size
- tests: `tests/test_build_cameras.py`, `tests/test_probe_status.py`,
  `web/src/lib/*.test.ts`, `web/src/components/*.test.ts`

## Left to the builder

- Exact cluster-colour rule and ranking tie-breaks.
- Row layout for the extra `owner` line; hiding it when empty.
- Whether the player shows `owner` and dataset on one line or two.
- How the two new toggle labels sit next to the old ones on narrow screens.
- Nothing about dedupe: both feeds stay, by the user's decision.
