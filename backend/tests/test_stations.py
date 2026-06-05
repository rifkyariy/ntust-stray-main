import pytest
import uuid


@pytest.mark.asyncio
async def test_list_stations_empty(client):
    response = await client.get("/stations")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_and_get_station(client):
    payload = {
        "station_code": "F-TPE-01",
        "name": "Ximending Station",
        "city": "Taipei",
        "district": "Wanhua",
        "lat": 25.0424,
        "lng": 121.5083,
    }
    create_resp = await client.post("/stations", json=payload)
    assert create_resp.status_code == 201
    created = create_resp.json()
    assert created["station_code"] == "F-TPE-01"
    assert created["status"] == "offline"

    get_resp = await client.get(f"/stations/{created['id']}")
    assert get_resp.status_code == 200
    assert get_resp.json()["name"] == "Ximending Station"


@pytest.mark.asyncio
async def test_patch_station_status(client):
    # Create first
    payload = {
        "station_code": "F-TPE-02", "name": "Test", "city": "Taipei",
        "district": "D", "lat": 25.0, "lng": 121.5,
    }
    created = (await client.post("/stations", json=payload)).json()

    patch_resp = await client.patch(f"/stations/{created['id']}", json={"food_pct": 80})
    assert patch_resp.status_code == 200
    assert patch_resp.json()["food_pct"] == 80


@pytest.mark.asyncio
async def test_get_station_not_found(client):
    response = await client.get(f"/stations/{uuid.uuid4()}")
    assert response.status_code == 404
