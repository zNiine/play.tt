from .auth import auth_bp
from .slates import slates_bp
from .games import games_bp
from .bts import bts_bp
from .users import users_bp
from .weeks import weeks_bp
from .admin import admin_bp
from .fan_games import fan_games_bp

__all__ = ["auth_bp", "slates_bp", "games_bp", "bts_bp", "users_bp", "weeks_bp", "admin_bp", "fan_games_bp"]
