import json
import logging
import aiomqtt
from app.core.config import settings

logger = logging.getLogger(__name__)


async def _publish(topic: str, payload: str) -> bool:
    try:
        async with aiomqtt.Client(
            hostname=settings.mqtt_broker,
            port=settings.mqtt_port,
            timeout=5,
        ) as client:
            await client.publish(topic, payload=payload)
            logger.info("MQTT published  topic=%s  payload=%s", topic, payload)
            return True
    except Exception as exc:
        logger.error("MQTT publish FAILED  topic=%s  error=%s", topic, exc)
        return False


async def publish_dispense_command(station_id: str, grams: int, trigger: str = "manual") -> bool:
    return await _publish(
        f"stray/{station_id}/dispense",
        json.dumps({"grams": grams, "trigger": trigger}, separators=(",", ":")),
    )


async def publish_schedule_command(station_id: str, cron_expr: str, grams: int, active: bool) -> None:
    await _publish(
        f"stray/{station_id}/schedule/set",
        json.dumps({"cron_expr": cron_expr, "grams": grams, "active": active}, separators=(",", ":")),
    )


async def publish_show_qr(station_id: str, url: str, amount_ntd: float, grams: int) -> None:
    await _publish(
        f"stray/{station_id}/show_qr",
        json.dumps({"url": url, "amount_ntd": amount_ntd, "grams": grams}, separators=(",", ":")),
    )
