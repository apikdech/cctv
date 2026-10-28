#!/usr/bin/env python3
"""Fetch the provincial CCTV list from cctv.jogjaprov.go.id into `jogjaprov/`.

The site is a Vue SPA, so there is nothing to scrape from the HTML. The map
pins come from a public JSON:API endpoint found in `assets/index-*.js`:

    https://cctv.jogjaprov.go.id/api/v1/location-pins

One unauthenticated request returns every pin (~1,000). Pins with
`pin_type == "cctv"` carry a `stream_url` on the site's own HLS proxy, e.g.

    https://cctv.jogjaprov.go.id/cctv-proxy/atcs-kota/streams/JogokariyanSelatan.stream.m3u8

The `cctv-proxy/<source>/streams/` prefix tells you which agency feeds it
(atcs-kota, cctv-kominfosleman, cctv-kominfogk, cctv-bantul, ...).

    uv run python crawl_jogjaprov.py
"""

import csv
import json
import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import Request, urlopen

API_URL = "https://cctv.jogjaprov.go.id/api/v1/location-pins"
OUT_DIR = Path("jogjaprov")
CONCURRENCY = 4
TIMEOUT = 10
USER_AGENT = "cctv-jogja-map/1.0 (+https://github.com/apikdech/cctv)"

FIELDS = [
    "id",
    "name",
    "slug",
    "group_name",
    "stream_url",
    "live",
    "active",
    "visible",
    "lat",
    "lng",
]


def fetch_pins() -> list[dict]:
    # A bare `Accept: application/json` gets a 406 from this API; curl's default passes.
    req = Request(API_URL, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    with urlopen(req, timeout=30) as res:
        return json.load(res)["data"]


def to_camera(pin: dict) -> dict:
    attrs = pin["attributes"]
    return {
        "id": int(pin["id"]),
        "name": attrs["name"],
        "slug": attrs["slug"],
        "group_name": attrs["group_name"],
        "stream_url": attrs["stream_url"],
        "active": attrs["active"],
        "visible": attrs["visible"],
        "lat": attrs["lat"],
        "lng": attrs["lng"],
    }


def probe(url: str, *, open_url=urlopen) -> bool:
    """HLS is alive when the playlist answers 2xx with an #EXTM3U body."""
    req = Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with open_url(req, timeout=TIMEOUT) as res:
            return 200 <= res.status < 300 and b"#EXTM3U" in res.read(64)
    except Exception:
        return False


def main() -> None:
    cameras = [to_camera(pin) for pin in fetch_pins() if pin["attributes"]["pin_type"] == "cctv"]
    with_stream = [c for c in cameras if c["stream_url"]]

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
        alive = list(pool.map(lambda c: probe(c["stream_url"]), with_stream))
    for camera, live in zip(with_stream, alive):
        camera["live"] = live
    for camera in cameras:
        camera.setdefault("live", False)

    cameras.sort(key=lambda c: c["id"])
    OUT_DIR.mkdir(exist_ok=True)

    tmp = OUT_DIR / "cameras.json.tmp"
    tmp.write_text(json.dumps(cameras, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(tmp, OUT_DIR / "cameras.json")

    with (OUT_DIR / "cameras.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(cameras)

    working = sorted(c["stream_url"] for c in cameras if c["live"])
    (OUT_DIR / "streams_working.txt").write_text("\n".join(working) + "\n", encoding="utf-8")

    print(f"{len(cameras)} cameras, {len(with_stream)} with streams, {len(working)} live -> {OUT_DIR}/")


if __name__ == "__main__":
    main()
