#!/usr/bin/env python3
"""Merge the live camera list and every Wayback capture into one file.

The map app loads `web/public/cameras.json`. Each camera appears once, with
its newest known record, tagged `official` (in today's live list) or
`removed` (only seen in the archive, with the date it was last seen).

Run after the crawlers:
    uv run python build_cameras.py
"""

import json
import math
from pathlib import Path

LIVE = Path("cctv.json")
WAYBACK = Path("wayback")
OUT = Path("web/public/cameras.json")


def _coord(value) -> float | None:
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    return f if math.isfinite(f) else None


def _camera(rec: dict) -> dict | None:
    lat, lon = _coord(rec.get("cctv_latitude")), _coord(rec.get("cctv_longitude"))
    if lat is None or lon is None or (lat == 0 and lon == 0):
        return None
    return {
        "id": int(rec["cctv_id"]),
        "title": (rec.get("cctv_title") or "").strip(),
        "url": rec.get("cctv_link") or "",
        "lat": lat,
        "lon": lon,
        "kecamatan": rec.get("kecamatan_nama") or "",
        "kelurahan": rec.get("kelurahan_nama") or "",
    }


def merge(live: list[dict], snapshots: list[tuple[str, list[dict]]]) -> list[dict]:
    cams: dict[int, dict] = {}
    for ts, records in sorted(snapshots, key=lambda s: s[0]):
        seen = f"{ts[:4]}-{ts[4:6]}-{ts[6:8]}"
        for rec in records:
            cam = _camera(rec)
            if cam:
                cams[cam["id"]] = {**cam, "source": "removed", "lastSeen": seen}
    for rec in live:
        cam = _camera(rec)
        if cam:
            cams[cam["id"]] = {**cam, "source": "official", "lastSeen": None}
    return [cams[i] for i in sorted(cams)]


def main() -> None:
    live = json.loads(LIVE.read_text(encoding="utf-8"))
    snapshots = [
        (p.stem.split("_", 1)[1], json.loads(p.read_text(encoding="utf-8")))
        for p in sorted(WAYBACK.glob("getdata_*.json"))
    ]
    cams = merge(live, snapshots)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(cams, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    official = sum(1 for c in cams if c["source"] == "official")
    print(f"{len(cams)} cameras ({official} official, {len(cams) - official} removed) -> {OUT}")


if __name__ == "__main__":
    main()
