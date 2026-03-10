import uuid
from datetime import datetime, timezone
from ..extensions import db


class BTSDay(db.Model):
    __tablename__ = "bts_days"

    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False, unique=True)
    status = db.Column(db.String(20), default="open")
    lock_time = db.Column(db.DateTime(timezone=True), nullable=True)

    entries = db.relationship("BTSEntry", back_populates="bts_day", lazy="dynamic")

    def to_dict(self):
        return {
            "id": self.id,
            "date": self.date.isoformat() if self.date else None,
            "status": self.status,
            "lock_time": self.lock_time.isoformat() if self.lock_time else None,
        }


class BTSEntry(db.Model):
    __tablename__ = "bts_entries"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    bts_day_id = db.Column(db.Integer, db.ForeignKey("bts_days.id"), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    submitted_at = db.Column(
        db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    success = db.Column(db.Boolean, nullable=True)  # None=pending, True=win, False=loss

    bts_day = db.relationship("BTSDay", back_populates="entries")
    user = db.relationship("User", back_populates="bts_entries")
    picks = db.relationship("BTSPick", back_populates="entry", lazy="joined", cascade="all, delete-orphan")

    __table_args__ = (db.UniqueConstraint("bts_day_id", "user_id"),)

    def to_dict(self):
        return {
            "id": self.id,
            "bts_day": self.bts_day.to_dict() if self.bts_day else None,
            "user_id": self.user_id,
            "submitted_at": self.submitted_at.isoformat() if self.submitted_at else None,
            "success": self.success,
            "picks": [p.to_dict() for p in self.picks] if self.picks else [],
        }


class BTSPick(db.Model):
    __tablename__ = "bts_picks"

    id = db.Column(db.Integer, primary_key=True)
    bts_entry_id = db.Column(db.String(36), db.ForeignKey("bts_entries.id"), nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey("players.id"), nullable=False)

    entry = db.relationship("BTSEntry", back_populates="picks")
    player = db.relationship("Player")

    def to_dict(self):
        return {
            "id": self.id,
            "player": self.player.to_dict() if self.player else None,
        }


class BTSUserState(db.Model):
    __tablename__ = "bts_user_state"

    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), primary_key=True)
    current_streak = db.Column(db.Integer, default=0)
    longest_streak = db.Column(db.Integer, default=0)
    season_year = db.Column(db.Integer, nullable=False)
    last_played = db.Column(db.Date, nullable=True)

    user = db.relationship("User", back_populates="bts_state")

    def to_dict(self):
        return {
            "user_id": self.user_id,
            "current_streak": self.current_streak,
            "longest_streak": self.longest_streak,
            "season_year": self.season_year,
            "last_played": self.last_played.isoformat() if self.last_played else None,
        }
