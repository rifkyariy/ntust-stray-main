"""
Seed script — creates first admin user + station fixture.

Usage:
  docker compose run --rm backend python -m app.db.seed
"""
import asyncio
from datetime import datetime
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select, text
from app.core.config import settings
from app.core.security import hash_password
from app.db.models import Base, AdminUser, Station, StationStatus

engine = create_async_engine(settings.database_url, echo=False)
SessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

STATIONS = [
    {
        "code":     "NTUST-STR-01",
        "name":     "National Taiwan University of Science and Technology",
        "city":     "Taipei City",
        "district": "Daan District",
        "lat":      25.0122202,
        "lng":      121.541437,
        "food":     85,
        "batt":     100,
        "temp":     26.5,
        "humidity": 65.0,
        "image_url": "https://images.unsplash.com/photo-1562774053-701939374585?w=800&q=80&auto=format&fit=crop",
    },
]


async def seed() -> None:
    async with SessionLocal() as db:
        # Admin user
        result = await db.execute(select(AdminUser).where(AdminUser.email == "admin@stray.tw"))
        if result.scalar_one_or_none() is None:
            db.add(AdminUser(
                email="admin@stray.tw",
                name="Stray Admin",
                password_hash=hash_password("stray2026"),
            ))
            print("Created admin: admin@stray.tw / stray2026")
        else:
            print("Admin already exists — skipping")

        # Wipe all existing stations (cascades to donations, schedules)
        await db.execute(text("DELETE FROM cats"))
        await db.execute(text("DELETE FROM schedules"))
        await db.execute(text("DELETE FROM donations"))
        await db.execute(text("DELETE FROM stations"))
        await db.commit()
        print("Cleared existing station data")

        # Insert the single station
        for s in STATIONS:
            st_status = (
                StationStatus.offline  if s["food"] == 0    else
                StationStatus.low_food if s["food"] < 25    else
                StationStatus.online
            )
            db.add(Station(
                station_code=s["code"],
                name=s["name"],
                city=s["city"],
                district=s["district"],
                lat=s["lat"],
                lng=s["lng"],
                status=st_status,
                food_pct=s["food"],
                battery_pct=s["batt"],
                temp_c=s["temp"],
                humidity_pct=s["humidity"],
                image_url=s.get("image_url"),
                installed_at=datetime.utcnow(),
            ))

        await db.commit()
        print(f"Seeded {len(STATIONS)} station(s)")


if __name__ == "__main__":
    asyncio.run(seed())
