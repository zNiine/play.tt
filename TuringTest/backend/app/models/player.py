from datetime import datetime, timezone
from ..extensions import db


class Player(db.Model):
    __tablename__ = "players"

    id = db.Column(db.Integer, primary_key=True)
    external_player_id = db.Column(db.String(100), unique=True, nullable=True)
    full_name = db.Column(db.String(200), nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey("teams.id"), nullable=True)
    primary_position = db.Column(db.String(10), nullable=False)
    bats = db.Column(db.String(5), nullable=True)
    throws = db.Column(db.String(5), nullable=True)
    # Roster display: "L/R" = bats left, throws right
    roster_bats_throws = db.Column(db.String(10), nullable=True)
    roster_height = db.Column(db.String(20), nullable=True)
    roster_weight = db.Column(db.String(20), nullable=True)
    roster_jersey = db.Column(db.String(10), nullable=True)
    active = db.Column(db.Boolean, default=True)

    team = db.relationship("Team", back_populates="players")
    game_stats = db.relationship("PlayerGameStats", back_populates="player", lazy="dynamic")

    def to_dict(self):
        return {
            "id": self.id,
            "external_player_id": self.external_player_id,
            "full_name": self.full_name,
            "team": self.team.to_dict() if self.team else None,
            "primary_position": self.primary_position,
            "bats": self.bats,
            "throws": self.throws,
            "active": self.active,
        }


class PlayerGameStats(db.Model):
    __tablename__ = "player_game_stats"

    id = db.Column(db.Integer, primary_key=True)
    game_id = db.Column(db.Integer, db.ForeignKey("games.id"), nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey("players.id"), nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey("teams.id"), nullable=True)
    stats_json = db.Column(db.JSON, default=dict)
    fantasy_points = db.Column(db.Float, default=0.0)
    last_updated = db.Column(
        db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    game = db.relationship("Game", back_populates="player_stats")
    player = db.relationship("Player", back_populates="game_stats")
    team = db.relationship("Team")

    __table_args__ = (db.UniqueConstraint("game_id", "player_id"),)

    def to_dict(self):
        return {
            "id": self.id,
            "game_id": self.game_id,
            "player_id": self.player_id,
            "player": self.player.to_dict() if self.player else None,
            "stats_json": self.stats_json,
            "fantasy_points": self.fantasy_points,
            "last_updated": self.last_updated.isoformat() if self.last_updated else None,
        }
