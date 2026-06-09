from app.demo import frame_indices, cache_signature, is_cache_valid


def test_frame_indices_steps_by_stride():
    # 10s video at 30fps, stride 0.5s -> samples at 0,0.5,...,9.5 => 20 frames
    idx = frame_indices(fps=30.0, frame_count=300, stride=0.5)
    assert idx[0] == 0
    assert idx[1] == 15          # 0.5s * 30fps
    assert len(idx) == 20
    assert all(0 <= i < 300 for i in idx)


def test_frame_indices_clamps_to_available_frames():
    idx = frame_indices(fps=30.0, frame_count=10, stride=1.0)
    assert idx == [0]            # only ~0.33s of video


def test_cache_signature_changes_with_settings():
    s1 = cache_signature(video_id="v", model="m", settings={"conf": 0.1, "slice": True})
    s2 = cache_signature(video_id="v", model="m", settings={"conf": 0.2, "slice": True})
    assert s1 != s2
    assert s1 == cache_signature(video_id="v", model="m", settings={"slice": True, "conf": 0.1})


def test_is_cache_valid_matches_signature():
    sig = cache_signature(video_id="v", model="m", settings={"conf": 0.1})
    assert is_cache_valid({"hash": sig}, sig) is True
    assert is_cache_valid({"hash": "other"}, sig) is False
    assert is_cache_valid({}, sig) is False
