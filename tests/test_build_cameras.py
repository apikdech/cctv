import pytest

from build_cameras import load_province, merge


def rec(i, title="Cam", lat="-7.80", lon="110.37", link="https://x/a.m3u8", kec="JETIS"):
    return {"cctv_id": str(i), "cctv_title": title, "cctv_link": link,
            "cctv_latitude": lat, "cctv_longitude": lon,
            "kecamatan_nama": kec, "kelurahan_nama": None}


def prov(i, name="Cam", lat=-7.80, lng=110.37, stream="https://x/p.m3u8", owner="Dinas Kominfo Sleman", slug="some-slug"):
    return {"id": i, "name": name, "lat": lat, "lng": lng, "stream_url": stream, "group_name": owner, "slug": slug}


def test_live_record_wins_and_is_official():
    out = merge([rec(1, "Live name")], [("20250901071340", [rec(1, "Old name")])], [])
    assert out == [{"id": "kota-1", "ref": 1, "dataset": "kota", "title": "Live name",
                    "url": "https://x/a.m3u8", "lat": -7.80, "lon": 110.37, "kecamatan": "JETIS",
                    "kelurahan": "", "owner": "", "slug": "", "source": "official", "lastSeen": None}]


def test_archived_only_is_removed_with_newest_snapshot_data():
    snaps = [("20240812184657", [rec(5, "Older")]), ("20250901071340", [rec(5, "Newer")])]
    [cam] = merge([], snaps, [])
    assert cam["source"] == "removed"
    assert cam["title"] == "Newer"
    assert cam["lastSeen"] == "2025-09-01"


def test_drops_invalid_coordinates():
    bad = [rec(1, lat=""), rec(2, lon="abc"), rec(3, lat="0", lon="0"), rec(4)]
    assert [c["id"] for c in merge(bad, [], [])] == ["kota-4"]


def test_province_rows_are_official_and_keep_their_slug():
    [cam] = merge([], [], [prov(1915, "JogokariyanSelatan")])
    assert cam == {"id": "prov-1915", "ref": 1915, "dataset": "prov", "title": "JogokariyanSelatan",
                   "url": "https://x/p.m3u8", "lat": -7.80, "lon": 110.37, "kecamatan": "", "kelurahan": "",
                   "owner": "Dinas Kominfo Sleman", "slug": "some-slug", "source": "official", "lastSeen": None}


def test_drops_province_pins_without_stream_or_coordinates():
    pins = [prov(1, stream=None), prov(2, stream=""), prov(3, lat=None), prov(4, lng=None), prov(5, lat=0, lng=0), prov(6)]
    assert [c["ref"] for c in merge([], [], pins)] == [6]


def test_keeps_a_city_and_province_camera_at_the_same_spot():
    city, pins = [rec(816)], [prov(816)]
    assert [c["id"] for c in merge(city, [], pins)] == ["kota-816", "prov-816"]


def test_sorts_city_before_province_then_by_ref():
    out = merge([rec(10), rec(2)], [], [prov(9), prov(100)])
    assert [c["id"] for c in out] == ["kota-2", "kota-10", "prov-9", "prov-100"]


def test_missing_province_file_is_an_error(tmp_path):
    with pytest.raises(FileNotFoundError, match="crawl_jogjaprov"):
        load_province(tmp_path / "nope.json")
