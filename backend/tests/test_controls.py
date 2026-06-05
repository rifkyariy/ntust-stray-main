import pytest
import pytest_asyncio
from datetime import datetime
from app.db.models import Station, AdminUser
from app.core.security import hash_password, create_access_token


@pytest_asyncio.fixture
async def station(db_session):
    s = Station(
        station_code="F-TPE-01", name="Ximending", city="Taipei",
        district="Wanhua", lat=25.0, lng=121.5, installed_at=datetime.utcnow(),
    )
    db_session.add(s)
    await db_session.commit()
    await db_session.refresh(s)
    return s


@pytest_asyncio.fixture
async def auth_headers(db_session):
    user = AdminUser(
        email="admin@stray.tw", name="Admin",
        password_hash=hash_password("pass"),
    )
    db_session.add(user)
    await db_session.commit()
    token = create_access_token("admin@stray.tw")
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_dispense_requires_auth(client, station):
    response = await client.post(f"/stations/{station.id}/dispense", json={"grams": 100})
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_dispense_with_auth(client, station, auth_headers):
    from unittest.mock import patch, AsyncMock
    with patch("app.api.controls.publish_dispense_command", new_callable=AsyncMock) as mock_pub:
        response = await client.post(
            f"/stations/{station.id}/dispense",
            json={"grams": 100, "trigger": "manual"},
            headers=auth_headers,
        )
    assert response.status_code == 200
    mock_pub.assert_called_once_with("F-TPE-01", 100, "manual")


@pytest.mark.asyncio
async def test_schedule_with_auth(client, station, auth_headers):
    from unittest.mock import patch, AsyncMock
    with patch("app.api.controls.publish_schedule_command", new_callable=AsyncMock):
        response = await client.post(
            f"/stations/{station.id}/schedule",
            json={"station_id": str(station.id), "cron_expr": "0 8 * * *", "grams": 100, "active": True},
            headers=auth_headers,
        )
    assert response.status_code == 200
