"""
Backend cron scheduler — executes active feed schedules by publishing
dispense commands to MQTT at the configured cron time.

APScheduler 3.x runs in the same asyncio event loop as FastAPI.
Each schedule row maps to one APScheduler job, keyed by schedule UUID.
"""
import logging
import uuid as _uuid
from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone='Asia/Taipei')

# ESP32 sends telemetry every 10 s; mark offline after 90 s of silence.
_OFFLINE_THRESHOLD_S = 90
# Grace period after backend restart before marking "never seen" stations offline.
_GRACE_PERIOD_S = 120
_backend_start: datetime = datetime.now(timezone.utc)


async def _execute(station_code: str, grams: int) -> None:
    """Called by APScheduler at the cron-scheduled time."""
    from app.mqtt.publisher import publish_dispense_command
    logger.info("[scheduler] firing schedule  station=%s  grams=%d", station_code, grams)
    ok = await publish_dispense_command(station_code, grams, "schedule")
    if not ok:
        logger.warning("[scheduler] MQTT publish failed for scheduled dispense  station=%s", station_code)


def add_schedule_job(schedule_id: _uuid.UUID, station_code: str, cron_expr: str, grams: int) -> None:
    """Register (or replace) a cron job for a schedule row."""
    job_id = str(schedule_id)
    try:
        trigger = CronTrigger.from_crontab(cron_expr, timezone='Asia/Taipei')
    except Exception as exc:
        logger.error("[scheduler] invalid cron expression %r: %s", cron_expr, exc)
        return

    # replace_existing=True ensures re-saves don't duplicate jobs
    scheduler.add_job(
        _execute,
        trigger,
        id=job_id,
        args=[station_code, grams],
        replace_existing=True,
        coalesce=True,
        misfire_grace_time=120,
    )
    logger.info("[scheduler] job added  id=%s  cron=%r  station=%s  grams=%d",
                job_id, cron_expr, station_code, grams)


def remove_schedule_job(schedule_id: _uuid.UUID) -> None:
    """Remove a cron job when a schedule is deleted."""
    job_id = str(schedule_id)
    try:
        scheduler.remove_job(job_id)
        logger.info("[scheduler] job removed  id=%s", job_id)
    except Exception:
        pass  # job may not exist if it was never added (e.g. inactive)


async def _check_stale_stations() -> None:
    """Runs every 60 s — marks stations offline if they've gone quiet."""
    from app.db.models import Station, StationStatus
    from app.db.session import AsyncSessionLocal
    from app.ws.manager import manager
    from app.mqtt.handlers import last_telemetry

    now = datetime.now(timezone.utc)
    post_grace = (now - _backend_start).total_seconds() > _GRACE_PERIOD_S

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Station))
        stations = result.scalars().all()

        for station in stations:
            code = station.station_code
            seen_at = last_telemetry.get(code)

            if seen_at is not None:
                stale = (now - seen_at).total_seconds() > _OFFLINE_THRESHOLD_S
            else:
                # Never seen since backend started — only act after grace period
                stale = post_grace

            if stale and station.status != StationStatus.offline:
                station.status = StationStatus.offline
                logger.info("[watchdog] station %s marked offline (last seen: %s)", code, seen_at)
                await db.commit()
                await manager.broadcast({
                    "type": "station_status",
                    "station_id": code,
                    "status": "offline",
                    "ts": now.isoformat(),
                })


async def load_all_schedules(db: AsyncSession) -> None:
    """Called once at startup — registers all active DB schedules + watchdog."""
    from app.db.models import Schedule, Station
    result = await db.execute(
        select(Schedule, Station.station_code)
        .join(Station, Schedule.station_id == Station.id)
        .where(Schedule.active.is_(True))
    )
    rows = result.all()
    for schedule, station_code in rows:
        add_schedule_job(schedule.id, station_code, schedule.cron_expr, schedule.grams)
    logger.info("[scheduler] loaded %d active schedule(s) from DB", len(rows))

    scheduler.add_job(
        _check_stale_stations,
        IntervalTrigger(seconds=60),
        id="watchdog_stale_stations",
        replace_existing=True,
        coalesce=True,
    )
    logger.info("[scheduler] stale-station watchdog registered (interval=60s, threshold=%ds)", _OFFLINE_THRESHOLD_S)
