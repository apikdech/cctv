#!/usr/bin/env python3
"""Merge the city crawls, the Wayback captures and the province crawl into one file.

The map app loads `web/public/cameras.json`. Every camera appears once, with
its newest known record:

- `dataset: "kota"` — from cctv.jogjakota.go.id, tagged `official` (in
  today's live list) or `removed` (only seen in the archive).
- `dataset: "prov"` — from cctv.jogjaprov.go.id, always `official`, and only
  when the pin has a stream and usable coordinates.

Ids are `"<dataset>-<ref>"` so the same upstream number in both sources stays
distinct. Both feeds at one spot are kept: they are different angles.

Run after the crawlers:
    uv run python crawl_cctv.py
    uv run python crawl_jogjaprov.py
    uv run python build_cameras.py
"""

import json
import math
from pathlib import Path

LIVE = Path("cctv.json")
WAYBACK = Path("wayback")
PROVINCE = Path("jogjaprov/cameras.json")
OUT = Path("web/public/cameras.json")


def _coord(value) -> float | None:
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    return f if math.isfinite(f) else None


def _coords(lat, lon) -> tuple[float, float] | None:
    lat_f, lon_f = _coord(lat), _coord(lon)
    if lat_f is None or lon_f is None or (lat_f == 0 and lon_f == 0):
        return None
    return lat_f, lon_f


def _camera(rec: dict) -> dict | None:
    coords = _coords(rec.get("cctv_latitude"), rec.get("cctv_longitude"))
    if coords is None:
        return None
    lat, lon = coords
    return {
        "ref": int(rec["cctv_id"]),
        "dataset": "kota",
        "title": (rec.get("cctv_title") or "").strip(),
        "url": rec.get("cctv_link") or "",
        "lat": lat,
        "lon": lon,
        "kecamatan": rec.get("kecamatan_nama") or "",
        "kelurahan": rec.get("kelurahan_nama") or "",
        "owner": "",
        "slug": "",
    }


def _province(rec: dict) -> dict | None:
    if not rec.get("stream_url"):
        return None
    coords = _coords(rec.get("lat"), rec.get("lng"))
    if coords is None:
        return None
    lat, lon = coords
    return {
        "ref": int(rec["id"]),
        "dataset": "prov",
        "title": (rec.get("name") or "").strip(),
        "url": rec["stream_url"],
        "lat": lat,
        "lon": lon,
        "kecamatan": "",
        "kelurahan": "",
        "owner": rec.get("group_name") or "",
        "slug": rec.get("slug") or "",
    }


def load_province(path: Path) -> list[dict]:
    """A missing crawl must stop the build: writing a city-only map would silently drop 542 cameras."""
    if not path.exists():
        raise FileNotFoundError(f"{path} is missing — run `uv run python crawl_jogjaprov.py` first")
    return json.loads(path.read_text(encoding="utf-8"))


def merge(live: list[dict], snapshots: list[tuple[str, list[dict]]], province: list[dict]) -> list[dict]:
    cams: dict[int, dict] = {}
    for ts, records in sorted(snapshots, key=lambda s: s[0]):
        seen = f"{ts[:4]}-{ts[4:6]}-{ts[6:8]}"
        for rec in records:
            cam = _camera(rec)
            if cam:
                cams[cam["ref"]] = {**cam, "source": "removed", "lastSeen": seen}
    for rec in live:
        cam = _camera(rec)
        if cam:
            cams[cam["ref"]] = {**cam, "source": "official", "lastSeen": None}

    merged = [{**cam, "id": f"kota-{cam['ref']}"} for cam in cams.values()]
    for rec in province:
        cam = _province(rec)
        if cam:
            merged.append({**cam, "source": "official", "lastSeen": None, "id": f"prov-{cam['ref']}"})
    return sorted(merged, key=lambda c: (c["dataset"], c["ref"]))


def main() -> None:
    live = json.loads(LIVE.read_text(encoding="utf-8"))
    snapshots = [
        (p.stem.split("_", 1)[1], json.loads(p.read_text(encoding="utf-8")))
        for p in sorted(WAYBACK.glob("getdata_*.json"))
    ]
    province = load_province(PROVINCE)
    cams = merge(live, snapshots, province)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(cams, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    city = sum(1 for c in cams if c["dataset"] == "kota")
    print(f"{len(cams)} cameras ({city} city, {len(cams) - city} province) -> {OUT}")


if __name__ == "__main__":
    main()
