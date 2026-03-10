import uuid
from datetime import datetime, timezone
from ..extensions import db


class Slate(db.Model):
    __tablename__ = "slates"

    id = db.Column(db.Integer, primary_key=True)
    slate_date = db.Column(db.Date, nullable=False, unique=True)
    lock_time = db.Column(db.DateTime(timezone=True), nullable=True)
    # open | locked | live | finalizing | final
    status = db.Column(db.String(20), default="open", nullable=False)

    slate_games = db.relationship("SlateGame", back_populates="slate", lazy="dynamic")
    slate_players = db.relationship("SlatePlayer", back_populates="slate", lazy="dynamic")
    entries = db.relationship("Entry", back_populates="slate", lazy="dynamic")

    def to_dict(self):
        return {
            "id": self.id,
            "slate_date": self.slate_date.isoformat() if self.slate_date else None,
            "lock_time": self.lock_time.isoformat() if self.lock_time else None,
            "status": self.status,
        }


class SlateGame(db.Model):
    __tablename__ = "slate_games"

    slate_id = db.Column(db.Integer, db.ForeignKey("slates.id"), primary_key=True)
    game_id = db.Column(db.Integer, db.ForeignKey("games.id"), primary_key=True)

    slate = db.relationship("Slate", back_populates="slate_games")
    game = db.relationship("Game")


class SlatePlayer(db.Model):
    __tablename__ = "slate_players"

    id = db.Column(db.Integer, primary_key=True)
    slate_id = db.Column(db.Integer, db.ForeignKey("slates.id"), nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey("players.id"), nullable=False)
    salary = db.Column(db.Integer, default=5000)
    eligible_positions = db.Column(db.JSON, default=list)
    active = db.Column(db.Boolean, default=True)

    slate = db.relationship("Slate", back_populates="slate_players")
    player = db.relationship("Player")

    __table_args__ = (db.UniqueConstraint("slate_id", "player_id"),)

    def to_dict(self):
        return {
            "id": self.id,
            "slate_id": self.slate_id,
            "player": self.player.to_dict() if self.player else None,
            "salary": self.salary,
            "eligible_positions": self.eligible_positions,
            "active": self.active,
        }


class Entry(db.Model):
    __tablename__ = "entries"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    slate_id = db.Column(db.Integer, db.ForeignKey("slates.id"), nullable=False)
    # draft | submitted | scored | final
    status = db.Column(db.String(20), default="draft", nullable=False)
    total_salary = db.Column(db.Integer, default=0)
    total_points = db.Column(db.Float, default=0.0)
    rank_live = db.Column(db.Integer, nullable=True)
    rank_final = db.Column(db.Integer, nullable=True)
    submitted_at = db.Column(db.DateTime(timezone=True), nullable=True)

    user = db.relationship("User", back_populates="entries")
    slate = db.relationship("Slate", back_populates="entries")
    picks = db.relationship("EntryPick", back_populates="entry", lazy="joined", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "slate_id": self.slate_id,
            "status": self.status,
            "total_salary": self.total_salary,
            "total_points": self.total_points,
            "rank_live": self.rank_live,
            "rank_final": self.rank_final,
            "submitted_at": self.submitted_at.isoformat() if self.submitted_at else None,
            "picks": [p.to_dict() for p in self.picks] if self.picks else [],
        }


class EntryPick(db.Model):
    __tablename__ = "entry_picks"

    id = db.Column(db.Integer, primary_key=True)
    entry_id = db.Column(db.String(36), db.ForeignKey("entries.id"), nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey("players.id"), nullable=False)
    slot = db.Column(db.Integer, nullable=False)  # 1-5 batters, 6 pitcher
    position = db.Column(db.String(10), nullable=False)
    is_captain = db.Column(db.Boolean, default=False)

    entry = db.relationship("Entry", back_populates="picks")
    player = db.relationship("Player")

    def to_dict(self):
        return {
            "id": self.id,
            "player": self.player.to_dict() if self.player else None,
            "slot": self.slot,
            "position": self.position,
            "is_captain": self.is_captain,
        }
