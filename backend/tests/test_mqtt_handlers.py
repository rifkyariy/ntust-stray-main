import pytest
from unittest.mock import AsyncMock, patch
from datetime import datetime


@pytest.mark.asyncio
async def test_handle_telemetry_updates_station_and_broadcasts(db_session):
    from app.mqtt.handlers import handle_telemetry
    from app.db.models import Station, StationStatus

    # Insert a station
    s = Station(
        station_code="F-TPE-01",
        name="Ximending",
        city="Taipei",
        district="Wanhua",
        lat=25.0,
        lng=121.5,
        installed_at=datetime.utcnow(),
    )
    db_session.add(s)
    await db_session.commit()

    payload = b'{"food_pct": 75, "battery_pct": 90, "temp_c": 26.5, "humidity_pct": 70}'

    with patch("app.mqtt.handlers.write_telemetry", new_callable=AsyncMock) as mock_write, \
         patch("app.mqtt.handlers.manager") as mock_manager:
        mock_manager.broadcast = AsyncMock()
        await handle_telemetry("F-TPE-01", payload, db_session)

    # Station status updated in DB
    await db_session.refresh(s)
    assert s.food_pct == 75
    assert s.battery_pct == 90
    assert s.status == StationStatus.online

    # InfluxDB write called
    mock_write.assert_called_once()

    # WebSocket broadcast sent
    mock_manager.broadcast.assert_called_once()
    ws_msg = mock_manager.broadcast.call_args[0][0]
    assert ws_msg["type"] == "telemetry"
    assert ws_msg["station_id"] == "F-TPE-01"
    assert ws_msg["food_pct"] == 75


@pytest.mark.asyncio
async def test_handle_telemetry_low_food_triggers_alert(db_session):
    from app.mqtt.handlers import handle_telemetry
    from app.db.models import Station, StationStatus

    s = Station(
        station_code="F-TPE-02",
        name="Test Station",
        city="Taipei",
        district="Zhongshan",
        lat=25.0,
        lng=121.5,
        installed_at=datetime.utcnow(),
    )
    db_session.add(s)
    await db_session.commit()

    payload = b'{"food_pct": 10, "battery_pct": 80, "temp_c": 25.0, "humidity_pct": 60}'

    with patch("app.mqtt.handlers.write_telemetry", new_callable=AsyncMock), \
         patch("app.mqtt.handlers.manager") as mock_manager:
        mock_manager.broadcast = AsyncMock()
        await handle_telemetry("F-TPE-02", payload, db_session)

    await db_session.refresh(s)
    assert s.status == StationStatus.low_food
    # Should have called broadcast twice: telemetry + alert
    assert mock_manager.broadcast.call_count == 2
    calls = [c[0][0] for c in mock_manager.broadcast.call_args_list]
    types = {c["type"] for c in calls}
    assert "telemetry" in types
    assert "alert" in types
