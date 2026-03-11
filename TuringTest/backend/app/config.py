import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()


class BaseConfig:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/turingtest"
    )
    REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    broker_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    result_backend = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "jwt-secret-change-in-production")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    MAIL_SERVER = os.environ.get("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", 587))
    MAIL_USE_TLS = True
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD")
    broker_connection_retry_on_startup = True

class DevelopmentConfig(BaseConfig):
    DEBUG = True


class ProductionConfig(BaseConfig):
    DEBUG = False


config_by_name = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig,
}
