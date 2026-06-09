from fastapi.testclient import TestClient
import app.demo as demo
from app.main import app

client = TestClient(app)


def test_demo_detections_reports_processing_then_ready(monkeypatch):
    # Stub the worker so no real video/model is touched.
    calls = {"started": False}

    def fake_ensure_started():
        calls["started"] = True
        return {"status": "processing", "progress": 0.0}

    monkeypatch.setattr(demo, "ensure_started", fake_ensure_started)
    r = client.get("/demo/detections")
    assert r.status_code == 200
    assert r.json()["status"] == "processing"
    assert calls["started"] is True


def test_demo_process_force_triggers_start(monkeypatch):
    seen = {}

    def fake_start(settings=None, force=False):
        seen["force"] = force
        seen["settings"] = settings
        return {"status": "processing", "progress": 0.0}

    monkeypatch.setattr(demo, "start_processing", fake_start)
    r = client.post("/demo/process?force=true&conf=0.2&slice=false&smooth=true&stride=0.4")
    assert r.status_code == 200
    assert seen["force"] is True
    assert seen["settings"]["conf"] == 0.2
    assert seen["settings"]["slice"] is False
    assert seen["settings"]["stride"] == 0.4


def test_tracker_reset_ok(monkeypatch):
    import app.pipeline as pipeline
    reset = {"n": 0}
    monkeypatch.setattr(pipeline, "reset_tracking", lambda: reset.__setitem__("n", reset["n"] + 1))
    r = client.post("/tracker/reset")
    assert r.status_code == 200
    assert reset["n"] == 1
