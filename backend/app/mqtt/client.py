import asyncio
import aiomqtt
from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.mqtt.handlers import handle_telemetry, handle_detection, handle_dispense_ack


async def mqtt_listener() -> None:
    """
    Subscribes to stray/+/+ and dispatches to handlers.
    Reconnects automatically on failure.
    """
    while True:
        try:
            async with aiomqtt.Client(
                hostname=settings.mqtt_broker,
                port=settings.mqtt_port,
            ) as client:
                await client.subscribe("stray/+/telemetry")
                await client.subscribe("stray/+/detection")
                await client.subscribe("stray/+/dispense/ack")

                async for message in client.messages:
                    topic_parts = str(message.topic).split("/")
                    if len(topic_parts) < 3:
                        continue

                    station_id = topic_parts[1]
                    subtopic = "/".join(topic_parts[2:])

                    async with AsyncSessionLocal() as db:
                        if subtopic == "telemetry":
                            await handle_telemetry(station_id, message.payload, db)
                        elif subtopic == "detection":
                            await handle_detection(station_id, message.payload, db)
                        elif subtopic == "dispense/ack":
                            await handle_dispense_ack(station_id, message.payload, db)

        except aiomqtt.MqttError as exc:
            print(f"[MQTT] Connection error: {exc} — retrying in 5s")
            await asyncio.sleep(5)
        except Exception as exc:
            print(f"[MQTT] Unexpected error: {exc} — retrying in 5s")
            await asyncio.sleep(5)
