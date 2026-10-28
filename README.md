# CCTV Jogja Map

A local map of every Yogyakarta city camera, including the ones the city has
removed from its public list at [cctv.jogjakota.go.id](https://cctv.jogjakota.go.id).
Live and Wayback Machine data are merged, so cameras pulled from the official
list still show up, and many of them still stream. Nearby cameras merge into
number bubbles, the side panel searches by name, and clicking a camera plays it
in the panel. Colours: **blue** official, **orange** removed, **grey** dead.

## Run the app

```bash
cd web
nvm use
pnpm install
pnpm dev
```

Link straight to a camera with `#cam=<id>`, e.g. `http://localhost:5173/#cam=14`.

## Refresh the data

The app reads the bundled `web/public/cameras.json`. To rebuild it:

```bash
uv run python crawl_cctv.py      # live list   -> cctv.json
uv run python crawl_wayback.py   # archive     -> wayback/ (resumable, slow)
uv run python audit_cameras.py   # optional    -> wayback/removed_cameras.csv
uv run python build_cameras.py   # merge       -> web/public/cameras.json
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
