"""
Seed script — creates first admin user + Taiwan station fixtures.

Usage:
  docker compose run --rm backend python -m app.db.seed
"""
import asyncio
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from app.core.config import settings
from app.core.security import hash_password
from app.db.models import Base, AdminUser, Station, StationStatus

engine = create_async_engine(settings.database_url, echo=False)
SessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

STATIONS = [
    {"code": "F-TPE-01", "name": "Ximending Station",      "city": "Taipei",    "district": "Wanhua",    "lat": 25.0424, "lng": 121.5083, "food": 91, "batt": 100},
    {"code": "F-TPE-02", "name": "Zhongshan MRT",          "city": "Taipei",    "district": "Zhongshan", "lat": 25.0525, "lng": 121.5231, "food": 67, "batt": 88},
    {"code": "F-TPE-03", "name": "Daan Park East Gate",    "city": "Taipei",    "district": "Da'an",     "lat": 25.0298, "lng": 121.5436, "food": 18, "batt": 73},
    {"code": "F-TPE-04", "name": "Longshan Temple",        "city": "Taipei",    "district": "Wanhua",    "lat": 25.0373, "lng": 121.4997, "food": 84, "batt": 95},
    {"code": "F-TPE-05", "name": "Shilin Night Market",    "city": "Taipei",    "district": "Shilin",    "lat": 25.0879, "lng": 121.5244, "food": 72, "batt": 100},
    {"code": "F-TPE-06", "name": "Songshan Raohe St.",     "city": "Taipei",    "district": "Songshan",  "lat": 25.0507, "lng": 121.5776, "food":  0, "batt":   0},
    {"code": "F-TNN-01", "name": "Anping Old Fort",        "city": "Tainan",    "district": "Anping",    "lat": 22.9966, "lng": 120.1614, "food": 56, "batt": 67},
    {"code": "F-TNN-02", "name": "Chihkan Tower",          "city": "Tainan",    "district": "West Dist.", "lat": 22.9989, "lng": 120.2023, "food": 88, "batt": 100},
    {"code": "F-KHH-01", "name": "Liuhe Night Market",    "city": "Kaohsiung", "district": "Xinxing",   "lat": 22.6292, "lng": 120.3030, "food": 41, "batt": 81},
    {"code": "F-KHH-02", "name": "Cijin Island Ferry",    "city": "Kaohsiung", "district": "Cijin",     "lat": 22.6108, "lng": 120.2691, "food": 79, "batt": 92},
    {"code": "F-TCH-01", "name": "Fengjia Night Market",  "city": "Taichung",  "district": "Xitun",     "lat": 24.1636, "lng": 120.6437, "food": 94, "batt": 100},
    {"code": "F-TCH-02", "name": "Calligraphy Greenway",  "city": "Taichung",  "district": "West Dist.", "lat": 24.1477, "lng": 120.6716, "food": 31, "batt": 54},
    {"code": "F-TCH-03", "name": "National Museum of Fine Arts", "city": "Taichung", "district": "North Dist.", "lat": 24.1540, "lng": 120.6726, "food": 14, "batt": 88},
    {"code": "F-TPE-07", "name": "Beitou Hot Spring Park","city": "Taipei",    "district": "Beitou",    "lat": 25.1349, "lng": 121.5061, "food": 62, "batt": 78},
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

        # Stations
        for s in STATIONS:
            result = await db.execute(select(Station).where(Station.station_code == s["code"]))
            if result.scalar_one_or_none() is None:
                st = StationStatus.offline if s["food"] == 0 else (
                    StationStatus.low_food if s["food"] < 25 else StationStatus.online
                )
                db.add(Station(
                    station_code=s["code"],
                    name=s["name"],
                    city=s["city"],
                    district=s["district"],
                    lat=s["lat"],
                    lng=s["lng"],
                    status=st,
                    food_pct=s["food"],
                    battery_pct=s["batt"],
                    temp_c=26.0,
                    humidity_pct=65.0,
                    installed_at=datetime.utcnow(),
                ))
        await db.commit()
        print(f"Seeded {len(STATIONS)} stations")


if __name__ == "__main__":
    asyncio.run(seed())
