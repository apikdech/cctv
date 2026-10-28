# CCTV Jogja Map

A local map of every Yogyakarta camera — city and province — including the ones
the city has removed from its public list at
[cctv.jogjakota.go.id](https://cctv.jogjakota.go.id). The province feeds come
from [cctv.jogjaprov.go.id](https://cctv.jogjaprov.go.id), whose public API
lists the whole DIY; where both sources cover one intersection, both feeds are
kept because they are different angles.
Live and Wayback Machine data are merged, so cameras pulled from the official
list still show up, and many of them still stream. Nearby cameras merge into
number bubbles, the side panel searches by name, and clicking a camera plays it
in the panel. Colours: **blue** city, **teal** province, **orange** removed from
the city list, **grey** dead.

## Run the app

```bash
cd web
nvm use
pnpm install
pnpm dev
```

Link straight to a camera with `#cam=<dataset>-<ref>`, e.g.
`http://localhost:5173/#cam=prov-1915`. Old numeric links (`#cam=14`) still open
the city camera of that number.

## Refresh the data

The app reads the bundled `web/public/cameras.json`. To rebuild it:

```bash
uv run python crawl_cctv.py      # city list   -> cctv.json
uv run python crawl_wayback.py   # archive     -> wayback/ (resumable, slow)
uv run python crawl_jogjaprov.py # province    -> jogjaprov/cameras.json
uv run python audit_cameras.py   # optional    -> wayback/removed_cameras.csv
uv run python build_cameras.py   # merge both  -> web/public/cameras.json
```

## Tests

```bash
uv run --with pytest pytest tests -q   # data merge
cd web && pnpm test && pnpm check   # app
```

## Be gentle

These are city government servers. The Wayback Machine rate-limits hard, and
the app checks each stream from your browser. Those results are cached for
10 minutes, so reloading doesn't re-check all ~170 cameras. Don't crawl in a
loop.
