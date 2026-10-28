import json

from probe_status import build_status, probe, write_status


class FakeResponse:
    def __init__(self, status=200, body=b"#EXTM3U"):
        self.status = status
        self._body = body

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def cam(i, url="https://x/a.m3u8"):
    return {"id": i, "url": url}


def test_probe_alive_only_on_2xx_with_a_body():
    assert probe("https://x/a.m3u8", open_url=lambda req, timeout: FakeResponse()) is True
    assert probe("https://x/a.m3u8", open_url=lambda req, timeout: FakeResponse(404)) is False
    assert probe("https://x/a.m3u8", open_url=lambda req, timeout: FakeResponse(200, b"")) is False


def test_probe_treats_errors_as_dead():
    def boom(req, timeout):
        raise TimeoutError("slow")

    assert probe("https://x/a.m3u8", open_url=boom) is False


def test_probe_sends_a_contactable_user_agent():
    seen = {}

    def capture(req, timeout):
        seen["agent"] = req.get_header("User-agent")
        return FakeResponse()

    probe("https://x/a.m3u8", open_url=capture)
    assert "cctv" in seen["agent"].lower()


def test_build_status_covers_every_camera_in_id_order():
    out = build_status([cam("prov-2"), cam("kota-10"), cam("kota-2")], lambda url: True, "2026-10-28T06:00:00Z")
    assert out == {"generatedAt": "2026-10-28T06:00:00Z",
                   "cameras": {"kota-2": "alive", "kota-10": "alive", "prov-2": "alive"}}


def test_build_status_keeps_unknown_shapes_working():
    out = build_status([cam("14"), cam("kota-9")], lambda url: True, "t")
    assert sorted(out["cameras"]) == ["14", "kota-9"]


def test_build_status_marks_failures_dead():
    cams = [cam(1, "https://x/1.m3u8"), cam(2, "https://x/2.m3u8")]
    out = build_status(cams, lambda url: url.endswith("1.m3u8"), "t")
    assert out["cameras"] == {"1": "alive", "2": "dead"}


def test_build_status_never_runs_more_than_three_probes_at_once():
    import threading
    import time

    lock = threading.Lock()
    state = {"in_flight": 0, "peak": 0}

    def slow(url):
        with lock:
            state["in_flight"] += 1
            state["peak"] = max(state["peak"], state["in_flight"])
        time.sleep(0.01)
        with lock:
            state["in_flight"] -= 1
        return True

    build_status([cam(i) for i in range(12)], slow, "t")
    assert state["peak"] <= 3


def test_write_status_leaves_no_temp_file(tmp_path):
    path = tmp_path / "status.json"
    write_status(path, {"generatedAt": "t", "cameras": {"1": "alive"}})
    assert json.loads(path.read_text())["cameras"] == {"1": "alive"}
    assert [p.name for p in tmp_path.iterdir()] == ["status.json"]
