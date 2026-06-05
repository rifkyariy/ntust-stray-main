from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://stray:stray@postgres:5432/stray"
    influx_url: str = "http://influxdb:8086"
    influx_token: str = "my-super-secret-token"
    influx_org: str = "stray"
    influx_bucket: str = "stray"
    mqtt_broker: str = "mosquitto"
    mqtt_port: int = 1883
    jwt_secret: str = "change-me-in-production"
    jwt_expire_hours: int = 24


settings = Settings()
