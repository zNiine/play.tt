from datetime import datetime, timezone
from ..extensions import db


class Team(db.Model):
    __tablename__ = "teams"

    id = db.Column(db.Integer, primary_key=True)
    team_code = db.Column(db.String(10), unique=True, nullable=False)
    team_name = db.Column(db.String(100), nullable=False)
    division = db.Column(db.String(50), nullable=True)

    players = db.relationship("Player", back_populates="team", lazy="dynamic")
    home_games = db.relationship(
        "Game", foreign_keys="Game.home_team_id", back_populates="home_team", lazy="dynamic"
    )
    away_games = db.relationship(
        "Game", foreign_keys="Game.away_team_id", back_populates="away_team", lazy="dynamic"
    )

    def to_dict(self):
        return {"id": self.id, "team_code": self.team_code, "team_name": self.team_name}


class Game(db.Model):
    __tablename__ = "games"

    id = db.Column(db.Integer, primary_key=True)
    external_game_id = db.Column(db.String(100), unique=True, nullable=True)
    home_team_id = db.Column(db.Integer, db.ForeignKey("teams.id"), nullable=False)
    away_team_id = db.Column(db.Integer, db.ForeignKey("teams.id"), nullable=False)
    start_time = db.Column(db.DateTime(timezone=True), nullable=False)
    # scheduled | lineups_partial | lineups_confirmed | live | final
    status = db.Column(db.String(30), default="scheduled", nullable=False)

    home_team = db.relationship("Team", foreign_keys=[home_team_id], back_populates="home_games")
    away_team = db.relationship("Team", foreign_keys=[away_team_id], back_populates="away_games")
    player_stats = db.relationship("PlayerGameStats", back_populates="game", lazy="dynamic")
    lineups = db.relationship("GameLineup", back_populates="game", lazy="dynamic")

    def to_dict(self):
        return {
            "id": self.id,
            "external_game_id": self.external_game_id,
            "home_team": self.home_team.to_dict() if self.home_team else None,
            "away_team": self.away_team.to_dict() if self.away_team else None,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "status": self.status,
        }
