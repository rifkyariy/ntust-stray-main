import json
import aiomqtt
from app.core.config import settings


async def publish_dispense_command(station_id: str, grams: int, trigger: str = "manual") -> None:
    """Publish a dispense command to the station's ESP32."""
    payload = json.dumps({"grams": grams, "trigger": trigger})
    async with aiomqtt.Client(hostname=settings.mqtt_broker, port=settings.mqtt_port) as client:
        await client.publish(f"stray/{station_id}/dispense/cmd", payload=payload)


async def publish_schedule_command(station_id: str, cron_expr: str, grams: int, active: bool) -> None:
    """Publish a schedule update to the station's ESP32."""
    payload = json.dumps({"cron_expr": cron_expr, "grams": grams, "active": active})
    async with aiomqtt.Client(hostname=settings.mqtt_broker, port=settings.mqtt_port) as client:
        await client.publish(f"stray/{station_id}/schedule/set", payload=payload)
