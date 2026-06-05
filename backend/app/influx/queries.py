from influxdb_client.client.influxdb_client_async import InfluxDBClientAsync
from app.core.config import settings


def _client() -> InfluxDBClientAsync:
    return InfluxDBClientAsync(
        url=settings.influx_url,
        token=settings.influx_token,
        org=settings.influx_org,
    )


async def get_station_metrics(station_id: str, range_str: str = "1h") -> list[dict]:
    """
    Returns list of telemetry records for a station over the given range.
    range_str: "1h" | "24h" | "7d"
    """
    query = f"""
    from(bucket: "{settings.influx_bucket}")
      |> range(start: -{range_str})
      |> filter(fn: (r) => r._measurement == "station_metrics")
      |> filter(fn: (r) => r.station_id == "{station_id}")
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: 500)
    """
    async with _client() as client:
        query_api = client.query_api()
        tables = await query_api.query(query)
        results = []
        for table in tables:
            for record in table.records:
                results.append({
                    "ts": record.get_time().isoformat(),
                    "food_pct": record.values.get("food_pct"),
                    "battery_pct": record.values.get("battery_pct"),
                    "temp_c": record.values.get("temp_c"),
                    "humidity_pct": record.values.get("humidity_pct"),
                })
        return results


async def get_recent_feed_events(station_id: str | None = None, limit: int = 50) -> list[dict]:
    """
    Returns recent feed events. Optionally filtered by station_id.
    """
    station_filter = f'|> filter(fn: (r) => r.station_id == "{station_id}")' if station_id else ""
    query = f"""
    from(bucket: "{settings.influx_bucket}")
      |> range(start: -24h)
      |> filter(fn: (r) => r._measurement == "feed_events")
      {station_filter}
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: {limit})
    """
    async with _client() as client:
        query_api = client.query_api()
        tables = await query_api.query(query)
        results = []
        for table in tables:
            for record in table.records:
                results.append({
                    "ts": record.get_time().isoformat(),
                    "station_id": record.values.get("station_id"),
                    "cat_code": record.values.get("cat_code"),
                    "grams_dispensed": record.values.get("grams_dispensed"),
                    "confidence": record.values.get("confidence"),
                    "trigger": record.values.get("trigger"),
                })
        return results
