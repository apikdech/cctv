#!/usr/bin/env python3
"""Fetch the CCTV Yogyakarta camera list into JSON + CSV.

The site loads this data with:
    $.ajax({ url: 'home/getdata', type: 'GET', dataType: 'json' })

CodeIgniter only allows it when the request looks like AJAX, so the
X-Requested-With header is required (no session/cookie needed).
"""

import csv
import json
import urllib.request

API_URL = "https://cctv.jogjakota.go.id/home/getdata"

FIELDS = [
    "cctv_id",
    "cctv_title",
    "cctv_link",
    "cctv_category",
    "cctv_status",
    "cctv_latitude",
    "cctv_longitude",
    "kecamatan_nama",
    "kelurahan_nama",
]


def fetch() -> list[dict]:
    req = urllib.request.Request(
        API_URL,
        headers={
            "X-Requested-With": "XMLHttpRequest",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Referer": "https://cctv.jogjakota.go.id/",
            "User-Agent": "Mozilla/5.0",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def main() -> None:
    cctv = fetch()

    with open("cctv.json", "w", encoding="utf-8") as f:
        json.dump(cctv, f, ensure_ascii=False, indent=2)

    with open("cctv.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(cctv)

    print(f"{len(cctv)} cameras -> cctv.json, cctv.csv")


if __name__ == "__main__":
    main()
