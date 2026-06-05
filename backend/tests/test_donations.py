import pytest
import pytest_asyncio
from datetime import datetime
from app.db.models import Station


@pytest_asyncio.fixture
async def station(db_session):
    s = Station(
        station_code="F-TPE-01", name="Test Station",
        city="Taipei", district="Wanhua",
        lat=25.0, lng=121.5, installed_at=datetime.utcnow(),
    )
    db_session.add(s)
    await db_session.commit()
    await db_session.refresh(s)
    return s


@pytest.mark.asyncio
async def test_create_donation(client, station):
    response = await client.post("/donations", json={
        "station_id": str(station.id),
        "amount_ntd": 15.0,
        "donor_name": "Lin Wei",
        "dispense": False,
    })
    assert response.status_code == 201
    data = response.json()
    assert data["amount_ntd"] == 15.0
    assert data["donor_name"] == "Lin Wei"
    assert data["dispensed"] is False


@pytest.mark.asyncio
async def test_list_donations_by_station(client, station):
    await client.post("/donations", json={
        "station_id": str(station.id), "amount_ntd": 15.0, "dispense": False,
    })
    await client.post("/donations", json={
        "station_id": str(station.id), "amount_ntd": 30.0, "dispense": False,
    })
    response = await client.get(f"/donations?station_id={station.id}")
    assert response.status_code == 200
    assert len(response.json()) == 2
