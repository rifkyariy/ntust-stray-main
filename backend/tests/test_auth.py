import pytest


@pytest.mark.asyncio
async def test_login_success(client, admin_user):
    response = await client.post("/auth/login", json={
        "email": "admin@stray.tw",
        "password": "testpass123",
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(client, admin_user):
    response = await client.post("/auth/login", json={
        "email": "admin@stray.tw",
        "password": "wrongpassword",
    })
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_unknown_email(client):
    response = await client.post("/auth/login", json={
        "email": "nobody@stray.tw",
        "password": "anything",
    })
    assert response.status_code == 401
