# Deploying

The app is a static Svelte build. Cloudflare Pages serves `web/dist` at
**cctv-jogja.pages.dev** and rebuilds on every push to `main`.

Liveness is the only thing that changes often, so it is published separately:

```
VPS cron (6 h)                       GitHub                    Browser
probe_status.py ──► status.json ──► status branch ──► raw.githubusercontent.com
                                                            │
                                              fetched once on load
                                                            ▼
                                              alive / dead, falls back to
                                              probing in the browser
```

## 1. Cloudflare Pages (once)

1. Push this repo to GitHub, then in the dashboard: **Workers & Pages → Create
   → Pages → Connect to Git** and pick the repo.
2. Build settings:
   - Framework preset: **None**
   - Root directory: `web`
   - Build command: `pnpm build`
   - Build output directory: `dist`
   - Node version: from `web/.nvmrc` (26). If the build image rejects it, set
     `NODE_VERSION=24` under **Settings → Environment variables**.
3. **Settings → Builds → Branch control**: production branch `main`, and set
   **Preview branch** to **None**.
   - This is required. The default, *All non-Production branches*, would build
     a preview for every `status` push — ~2,880 builds/month against the Free
     plan's 500, and deployments stop once the cap is hit.

`cctv.pages.dev` is already taken by another account, hence `cctv-jogja`.

## 2. Status branch (once)

The `status` branch is an orphan branch holding a single `status.json` at its
root. It is machine-owned; do not merge it into `main`.

```json
{"generatedAt":"2026-10-28T06:00:00Z","cameras":{"kota-14":"alive","prov-207":"dead"}}
```

The app fetches
`https://raw.githubusercontent.com/apikdech/cctv/status/status.json`, which
GitHub serves with `Access-Control-Allow-Origin: *` and caches for 5 minutes.

## 3. VPS cron (once)

No Docker and no pip installs: `publish_status.sh` needs `git`, `flock` and
Python 3.9+ — all present on Debian 11+/Ubuntu 22.04+ — plus a GitHub token.
It publishes from the clone it lives in, and discards local edits there.

```bash
# 1. Clone once, wherever you want it.
git clone https://github.com/apikdech/cctv.git ~/cctv

# 2. A token that can write only this repo's contents.
#    Fine-grained: Contents = Read and write.  Classic: `repo` scope.
mkdir -p ~/.config
(umask 077; echo GITHUB_TOKEN=github_pat_xxx > ~/.config/cctv-status.env)

# 3. First publish, ~15 minutes; prints progress every 50 cameras.
~/cctv/publish_status.sh
```

Then, every 6 hours, in your own crontab (`crontab -e`):

```cron
0 */6 * * * ~/cctv/publish_status.sh >> ~/cctv-status.log 2>&1
```

Running it as root also works: use `/srv/cctv` and put the token in
`/etc/cctv-status.env` instead. The script checks `CCTV_ENV_FILE`, then
`/etc/cctv-status.env`, then `~/.config/cctv-status.env`.

The script fetches `main`, probes three streams at a time with a plain
`User-Agent`, writes `status.json` atomically, commits it to the `status`
branch and pushes with the token from the environment. `flock` inside the
script keeps a hung sweep from overlapping the next one: worst case (every
stream hanging until the 10s timeout) a 714-camera sweep takes ~40 minutes,
which fits inside a 6-hour interval but not inside a shorter one.

## How the site behaves

- On load it merges the status file over the 10-minute localStorage cache and
  only probes from the browser for cameras the file does not cover — up to all
  714 if the file is stale, which is the old behaviour at four times the size.
- A file that is missing, malformed, or older than 12 hours (twice the cron
  interval) is ignored, and the browser probes as before. So a dead VPS
  degrades to today's behaviour rather than showing stale status.
- Opening a camera still play-tests the real stream and overrides the file.

## Verifying

```bash
curl -s https://raw.githubusercontent.com/apikdech/cctv/status/status.json | head -c 200
curl -sI https://cctv-jogja.pages.dev | head -5
```

## Limits worth knowing

- Pages Free: 500 builds/month, one at a time. Only `main` builds.
- Each sweep is ~714 requests, to the city **and** province servers: 172 city
  cameras plus 542 mappable province cameras. Keeping concurrency at 3–4 holds
  the request *rate* unchanged; the sweep just takes longer (a minute or two,
  ~40 minutes if every stream times out).
  Keep the interval at 6 hours.
- All probe traffic comes from one IP; if either source starts refusing it,
  lengthen the interval rather than raising concurrency.
