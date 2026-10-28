#!/usr/bin/env python3
"""Probe every camera stream and write `status.json` for the `status` branch.

The site fetches that file from raw.githubusercontent.com instead of probing
all ~170 streams from every visitor's browser. Run it from a VPS cron; see
docs/deploy.md.

    uv run python probe_status.py
"""

import json
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

CAMERAS = Path("web/public/cameras.json")
OUT = Path("status.json")
CONCURRENCY = 3
TIMEOUT = 10
USER_AGENT = "cctv-jogja-map/1.0 (+https://github.com/apikdech/cctv)"


def probe(url: str, *, timeout: float = TIMEOUT, open_url=urlopen) -> bool:
    """A stream is alive when its playlist answers 2xx with a non-empty body."""
    req = Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with open_url(req, timeout=timeout) as res:
            return 200 <= res.status < 300 and bool(res.read())
    except Exception:
        return False


def _sort_key(cam: dict) -> tuple[str, int, str]:
    dataset, _, ref = str(cam["id"]).partition("-")
    return (dataset, int(ref), "") if ref.isdigit() else ("", 0, dataset)


def build_status(cameras: list[dict], probe_fn, generated_at: str) -> dict:
    ordered = sorted(cameras, key=_sort_key)
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
        results = list(pool.map(lambda c: bool(probe_fn(c["url"])), ordered))
    return {
        "generatedAt": generated_at,
        "cameras": {
            str(cam["id"]): ("alive" if ok else "dead")
            for cam, ok in zip(ordered, results)
        },
    }


def write_status(path: Path, status: dict) -> None:
    """Write atomically so a cron killed mid-write cannot publish half a file."""
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(status, separators=(",", ":")), encoding="utf-8")
    os.replace(tmp, path)


def main() -> None:
    cameras = json.loads(CAMERAS.read_text(encoding="utf-8"))
    generated_at = (
        datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    )
    status = build_status(cameras, probe, generated_at)
    write_status(OUT, status)
    alive = sum(1 for value in status["cameras"].values() if value == "alive")
    print(f"{alive}/{len(cameras)} alive -> {OUT}")


if __name__ == "__main__":
    main()
