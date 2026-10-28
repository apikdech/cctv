from build_cameras import merge


def rec(i, title="Cam", lat="-7.80", lon="110.37", link="https://x/a.m3u8", kec="JETIS"):
    return {"cctv_id": str(i), "cctv_title": title, "cctv_link": link,
            "cctv_latitude": lat, "cctv_longitude": lon,
            "kecamatan_nama": kec, "kelurahan_nama": None}


def test_live_record_wins_and_is_official():
    out = merge([rec(1, "Live name")], [("20250901071340", [rec(1, "Old name")])])
    assert out == [{"id": 1, "title": "Live name", "url": "https://x/a.m3u8",
                    "lat": -7.80, "lon": 110.37, "kecamatan": "JETIS", "kelurahan": "",
                    "source": "official", "lastSeen": None}]


def test_archived_only_is_removed_with_newest_snapshot_data():
    snaps = [("20240812184657", [rec(5, "Older")]), ("20250901071340", [rec(5, "Newer")])]
    [cam] = merge([], snaps)
    assert cam["source"] == "removed"
    assert cam["title"] == "Newer"
    assert cam["lastSeen"] == "2025-09-01"


def test_drops_invalid_coordinates():
    bad = [rec(1, lat=""), rec(2, lon="abc"), rec(3, lat="0", lon="0"), rec(4)]
    assert [c["id"] for c in merge(bad, [])] == [4]


def test_sorted_by_numeric_id():
    assert [c["id"] for c in merge([rec(10), rec(9), rec(100)], [])] == [9, 10, 100]
