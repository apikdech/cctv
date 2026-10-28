#!/usr/bin/env python3
"""Reconstruct the CCTV Yogyakarta camera list history from the Wayback Machine.

The live API only exposes the current list, so cameras that were pulled
disappear without trace. The Wayback Machine has ~15 captures of the
`/home/getdata` JSON (2022-06 -> 2025-09), which this script downloads,
parses and merges into a single "every camera ever seen" table.

Outputs (in ./wayback):
    getdata_<timestamp>.json   raw capture, untouched
    history.csv                one row per camera per capture
    all_cameras.csv            one row per camera, first/last seen
"""

import csv
import gzip
import json
import time
import urllib.request
from pathlib import Path

CDX_URL = (
    "https://web.archive.org/cdx/search/cdx"
    "?url=cctv.jogjakota.go.id/home/getdata"
    "&output=json&filter=statuscode:200&fl=timestamp,digest"
)
REPLAY = "https://web.archive.org/web/{ts}id_/https://cctv.jogjakota.go.id/home/getdata"
OUT = Path("wayback")

FIELDS = [
    "cctv_id", "cctv_title", "cctv_link", "cctv_category", "cctv_status",
    "cctv_latitude", "cctv_longitude", "cctv_opd", "cctv_desc",
    "kecamatan_nama", "kelurahan_nama", "insert_timestamp", "update_timestamp",
]


def get(url: str) -> bytes:
    """GET with patience: the Wayback replay API throttles aggressively."""
    for attempt in range(5):
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                body = r.read()
            time.sleep(2)  # stay under the rate limit
            return gzip.decompress(body) if body[:2] == b"\x1f\x8b" else body
        except urllib.error.HTTPError as exc:
            if exc.code != 429 or attempt == 4:
                raise
            time.sleep(15 * (attempt + 1))
    raise RuntimeError("unreachable")


def captures() -> list[str]:
    rows = json.loads(get(CDX_URL))
    seen: dict[str, str] = {}
    for ts, digest in rows[1:]:
        seen.setdefault(digest, ts)  # first timestamp for each unique payload
    return sorted(seen.values())


def main() -> None:
    OUT.mkdir(exist_ok=True)
    history: list[dict] = []

    for ts in captures():
        path = OUT / f"getdata_{ts}.json"
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
            print(f"  {ts}  {len(data):>3} cameras (cached)")
        else:
            try:
                data = json.loads(get(REPLAY.format(ts=ts)))
            except Exception as exc:  # a capture can be truncated; skip, don't abort
                print(f"  {ts}  SKIP ({exc})")
                continue
            path.write_text(
                json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            print(f"  {ts}  {len(data):>3} cameras")
        for cam in data:
            history.append({"snapshot": ts, **{k: cam.get(k) for k in FIELDS}})

    with open(OUT / "history.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["snapshot", *FIELDS])
        w.writeheader()
        w.writerows(history)

    ever: dict[str, dict] = {}
    for row in history:
        entry = ever.setdefault(
            row["cctv_id"],
            {"cctv_id": row["cctv_id"], "cctv_title": row["cctv_title"],
             "first_seen": row["snapshot"], "last_seen": row["snapshot"],
             "seen_in": 0, "cctv_link": row["cctv_link"],
             "kecamatan_nama": row["kecamatan_nama"]},
        )
        entry["last_seen"] = row["snapshot"]
        entry["seen_in"] += 1

    with open(OUT / "all_cameras.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(next(iter(ever.values())).keys()))
        w.writeheader()
        w.writerows(sorted(ever.values(), key=lambda c: int(c["cctv_id"])))

    print(f"\n{len(captures())} captures, {len(history)} observations, "
          f"{len(ever)} unique cameras ever seen")


if __name__ == "__main__":
    main()
