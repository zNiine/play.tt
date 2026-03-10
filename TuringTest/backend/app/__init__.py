import os
from flask import Flask
from flask_cors import CORS
from .config import config_by_name
from .extensions import db, migrate, jwt, limiter, celery


def create_app(config_name: str = None) -> Flask:
    if config_name is None:
        config_name = os.environ.get("FLASK_ENV", "development")

    app = Flask(__name__)
    app.config.from_object(config_by_name.get(config_name, config_by_name["default"]))

    CORS(
        app,
        resources={r"/api/*": {"origins": app.config.get("FRONTEND_URL", "*")}},
        supports_credentials=True,
    )

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    limiter.init_app(app)
    celery.conf.update(app.config)

    from .api import auth_bp, slates_bp, games_bp, bts_bp, users_bp, weeks_bp, admin_bp, fan_games_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(slates_bp, url_prefix="/api/slates")
    app.register_blueprint(games_bp, url_prefix="/api/games")
    app.register_blueprint(bts_bp, url_prefix="/api/bts")
    app.register_blueprint(users_bp, url_prefix="/api/users")
    app.register_blueprint(weeks_bp, url_prefix="/api/weeks")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(fan_games_bp, url_prefix="/api/fan-games")

    return app
