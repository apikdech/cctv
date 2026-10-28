#!/usr/bin/env python3
"""Compare the live camera list against every camera ever archived.

Answers the question the live page can't: which cameras were removed from
the public list, and which of those are still actually streaming?

Outputs:
    wayback/removed_cameras.csv   removed from live list, with stream status
"""

import csv
import json
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

WB = Path("wayback")


def probe(url: str) -> str:
    """A live HLS camera answers 200 with a non-empty playlist."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            return "live" if r.status == 200 and r.read(1) else "empty"
    except Exception:
        return "dead"


def main() -> None:
    live = {c["cctv_id"]: c for c in json.loads(Path("cctv.json").read_text())}
    ever = list(csv.DictReader(open(WB / "all_cameras.csv", encoding="utf-8")))

    removed = [c for c in ever if c["cctv_id"] not in live]
    with ThreadPoolExecutor(max_workers=4) as pool:
        statuses = list(pool.map(lambda c: probe(c["cctv_link"]), removed))

    for cam, status in zip(removed, statuses):
        cam["stream"] = status

    with open(WB / "removed_cameras.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=[*removed[0].keys(), "stream"])
        w.writeheader()
        w.writerows(sorted(removed, key=lambda c: int(c["cctv_id"])))

    live_on = sum(1 for s in statuses if s == "live")
    print(f"live list now        : {len(live)}")
    print(f"cameras ever archived: {len(ever)}")
    print(f"removed from list    : {len(removed)}")
    print(f"  ...still streaming : {live_on}")
    print(f"\n-> {WB}/removed_cameras.csv\n")
    for cam in removed:
        if cam["stream"] == "live":
            print(f"  {cam['cctv_id']:>4}  {cam['cctv_title']}  (last seen {cam['last_seen'][:8]})")


if __name__ == "__main__":
    main()
