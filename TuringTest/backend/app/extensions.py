import os
import redis
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from celery import Celery

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
limiter = Limiter(key_func=get_remote_address, default_limits=["300 per day", "60 per hour"])
celery = Celery(__name__, broker=os.environ.get("REDIS_URL", "redis://localhost:6379/0"))


def get_redis_client():
    return redis.from_url(os.environ.get("REDIS_URL", "redis://localhost:6379/0"))


redis_client = get_redis_client()
