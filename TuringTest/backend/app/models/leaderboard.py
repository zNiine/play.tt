from datetime import datetime, timezone
from ..extensions import db


class Week(db.Model):
    __tablename__ = "weeks"

    id = db.Column(db.Integer, primary_key=True)
    season_year = db.Column(db.Integer, nullable=False)
    week_index = db.Column(db.Integer, nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(20), default="active")

    weekly_scores = db.relationship("WeeklyScore", back_populates="week", lazy="dynamic")

    def to_dict(self):
        return {
            "id": self.id,
            "season_year": self.season_year,
            "week_index": self.week_index,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "status": self.status,
        }


class WeeklyScore(db.Model):
    __tablename__ = "weekly_scores"

    id = db.Column(db.Integer, primary_key=True)
    week_id = db.Column(db.Integer, db.ForeignKey("weeks.id"), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    total_points = db.Column(db.Float, default=0.0)
    entries_count = db.Column(db.Integer, default=0)
    rank = db.Column(db.Integer, nullable=True)

    week = db.relationship("Week", back_populates="weekly_scores")
    user = db.relationship("User", back_populates="weekly_scores")

    __table_args__ = (db.UniqueConstraint("week_id", "user_id"),)

    def to_dict(self):
        return {
            "id": self.id,
            "week_id": self.week_id,
            "user": self.user.to_dict() if self.user else None,
            "total_points": self.total_points,
            "entries_count": self.entries_count,
            "rank": self.rank,
        }


class Winner(db.Model):
    __tablename__ = "winners"

    id = db.Column(db.Integer, primary_key=True)
    scope = db.Column(db.String(20), nullable=False)  # slate | week | season
    scope_id = db.Column(db.String(100), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    rank = db.Column(db.Integer, nullable=False)
    prize_description = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(20), default="pending")

    user = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "scope": self.scope,
            "scope_id": self.scope_id,
            "user": self.user.to_dict() if self.user else None,
            "rank": self.rank,
            "prize_description": self.prize_description,
            "status": self.status,
        }


class GameLineup(db.Model):
    __tablename__ = "game_lineups"

    id = db.Column(db.Integer, primary_key=True)
    game_id = db.Column(db.Integer, db.ForeignKey("games.id"), nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey("teams.id"), nullable=False)
    confirmed = db.Column(db.Boolean, default=False)
    confirmed_at = db.Column(db.DateTime(timezone=True), nullable=True)

    game = db.relationship("Game", back_populates="lineups")
    team = db.relationship("Team")
    lineup_players = db.relationship(
        "LineupPlayer", back_populates="game_lineup", lazy="joined", cascade="all, delete-orphan"
    )

    __table_args__ = (db.UniqueConstraint("game_id", "team_id"),)

    def to_dict(self):
        return {
            "id": self.id,
            "game_id": self.game_id,
            "team": self.team.to_dict() if self.team else None,
            "confirmed": self.confirmed,
            "confirmed_at": self.confirmed_at.isoformat() if self.confirmed_at else None,
            "players": [p.to_dict() for p in self.lineup_players] if self.lineup_players else [],
        }


class LineupPlayer(db.Model):
    __tablename__ = "lineup_players"

    id = db.Column(db.Integer, primary_key=True)
    game_lineup_id = db.Column(db.Integer, db.ForeignKey("game_lineups.id"), nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey("players.id"), nullable=False)
    batting_order = db.Column(db.Integer, nullable=True)
    position = db.Column(db.String(10), nullable=True)

    game_lineup = db.relationship("GameLineup", back_populates="lineup_players")
    player = db.relationship("Player")

    def to_dict(self):
        return {
            "id": self.id,
            "player": self.player.to_dict() if self.player else None,
            "batting_order": self.batting_order,
            "position": self.position,
        }
