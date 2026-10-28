# Deploying

The app is a static Svelte build. Cloudflare Pages serves `web/dist` at
**cctv-jogja.pages.dev** and rebuilds on every push to `main`.

Liveness is the only thing that changes often, so it is published separately:

```
VPS cron (15 min)                    GitHub                    Browser
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
   - Build command: `npm run build`
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
{"generatedAt":"2026-10-28T06:00:00Z","cameras":{"14":"alive","207":"dead"}}
```

The app fetches
`https://raw.githubusercontent.com/apikdech/cctv/status/status.json`, which
GitHub serves with `Access-Control-Allow-Origin: *` and caches for 5 minutes.

## 3. VPS cron (once)

```bash
# 1. Two clones: main for the script and camera list, status for publishing.
sudo mkdir -p /srv && cd /srv
git clone --single-branch --branch main   git@github.com:apikdech/cctv.git cctv
git clone --single-branch --branch status git@github.com:apikdech/cctv.git cctv-status

# 2. A repo-scoped write key (add the .pub to Settings → Deploy keys, write access).
ssh-keygen -t ed25519 -N "" -C "cctv-status-cron" -f ~/.ssh/cctv-status
```

Then, every 15 minutes:

```cron
*/15 * * * * cd /srv/cctv && git pull -q --ff-only && uv run python probe_status.py && cp status.json /srv/cctv-status/status.json && cd /srv/cctv-status && git add status.json && git commit -qm "status $(date -u +%FT%TZ)" ; git push -q
```

A run with no changes exits non-zero at `git commit`; that is expected. The
script probes three streams at a time with a plain `User-Agent`, and writes the
file atomically so a killed run cannot publish a half-written one.

## How the site behaves

- On load it merges the status file over the 10-minute localStorage cache and
  only probes from the browser for cameras the file does not cover.
- A file that is missing, malformed, or older than 30 minutes (twice the cron
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
- Each sweep is 172 requests to the city server. Keep the interval at 15
  minutes or longer, and keep concurrency at 3–4.
- All probe traffic comes from one IP; if the city starts refusing it, lengthen
  the interval rather than raising concurrency.
