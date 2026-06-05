from datetime import datetime, timezone
from influxdb_client.client.influxdb_client_async import InfluxDBClientAsync
from influxdb_client import Point
from app.core.config import settings


def _client() -> InfluxDBClientAsync:
    return InfluxDBClientAsync(
        url=settings.influx_url,
        token=settings.influx_token,
        org=settings.influx_org,
    )


async def write_telemetry(
    station_id: str,
    city: str,
    food_pct: int,
    battery_pct: int,
    temp_c: float,
    humidity_pct: float,
) -> None:
    point = (
        Point("station_metrics")
        .tag("station_id", station_id)
        .tag("city", city)
        .field("food_pct", food_pct)
        .field("battery_pct", battery_pct)
        .field("temp_c", temp_c)
        .field("humidity_pct", humidity_pct)
        .time(datetime.now(timezone.utc))
    )
    async with _client() as client:
        write_api = client.write_api()
        await write_api.write(bucket=settings.influx_bucket, record=point)


async def write_feed_event(
    station_id: str,
    cat_code: str,
    grams_dispensed: int,
    confidence: float,
    trigger: str,
) -> None:
    point = (
        Point("feed_events")
        .tag("station_id", station_id)
        .tag("cat_code", cat_code)
        .tag("trigger", trigger)
        .field("grams_dispensed", grams_dispensed)
        .field("confidence", confidence)
        .time(datetime.now(timezone.utc))
    )
    async with _client() as client:
        write_api = client.write_api()
        await write_api.write(bucket=settings.influx_bucket, record=point)


async def write_donation_event(
    station_id: str,
    amount_ntd: float,
    donor_name: str,
) -> None:
    point = (
        Point("donation_events")
        .tag("station_id", station_id)
        .field("amount_ntd", amount_ntd)
        .field("donor_name", donor_name or "Anonymous")
        .time(datetime.now(timezone.utc))
    )
    async with _client() as client:
        write_api = client.write_api()
        await write_api.write(bucket=settings.influx_bucket, record=point)
