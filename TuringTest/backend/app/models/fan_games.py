from datetime import datetime, timezone
from ..extensions import db


class DailyChallenge(db.Model):
    __tablename__ = "daily_challenges"

    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    # game_type: 'grid' | 'guess' | 'target'
    game_type = db.Column(db.String(20), nullable=False)
    challenge_data = db.Column(db.JSON, nullable=False, default=dict)
    created_at = db.Column(
        db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    results = db.relationship("FanGameResult", back_populates="challenge", lazy="dynamic")

    __table_args__ = (db.UniqueConstraint("date", "game_type"),)

    def to_dict(self, include_answers=False):
        data = dict(self.challenge_data)
        if not include_answers and "valid_answers" in data:
            del data["valid_answers"]
        if not include_answers and "player_name" in data:
            del data["player_name"]
        return {
            "id": self.id,
            "date": self.date.isoformat() if self.date else None,
            "game_type": self.game_type,
            "challenge_data": data,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class FanGameResult(db.Model):
    __tablename__ = "fan_game_results"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    challenge_id = db.Column(
        db.Integer, db.ForeignKey("daily_challenges.id"), nullable=False
    )
    result_data = db.Column(db.JSON, nullable=False, default=dict)
    score = db.Column(db.Float, default=0.0)
    completed = db.Column(db.Boolean, default=False)
    created_at = db.Column(
        db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = db.relationship("User", backref=db.backref("fan_game_results", lazy="dynamic"))
    challenge = db.relationship("DailyChallenge", back_populates="results")

    __table_args__ = (db.UniqueConstraint("user_id", "challenge_id"),)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "challenge_id": self.challenge_id,
            "result_data": self.result_data,
            "score": self.score,
            "completed": self.completed,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class HigherLowerScore(db.Model):
    __tablename__ = "higher_lower_scores"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    streak = db.Column(db.Integer, nullable=False, default=0)
    achieved_at = db.Column(
        db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    user = db.relationship("User", backref=db.backref("higher_lower_scores", lazy="dynamic"))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "display_name": self.user.display_name if self.user else None,
            "streak": self.streak,
            "achieved_at": self.achieved_at.isoformat() if self.achieved_at else None,
        }


class HigherLowerScenario(db.Model):
    """Tracks aggregate correct/total counts for each unique higher-or-lower comparison."""
    __tablename__ = "higher_lower_scenarios"

    id = db.Column(db.Integer, primary_key=True)
    # data.db player_ids (strings) + seasons identify a unique comparison
    player_a_id = db.Column(db.String(50), nullable=False)
    season_a = db.Column(db.String(50), nullable=True)
    player_b_id = db.Column(db.String(50), nullable=False)
    season_b = db.Column(db.String(50), nullable=True)
    stat_key = db.Column(db.String(20), nullable=False)
    correct_count = db.Column(db.Integer, nullable=False, default=0)
    total_count = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(
        db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        db.UniqueConstraint("player_a_id", "season_a", "player_b_id", "season_b", "stat_key",
                            name="uq_hl_scenario"),
    )

    @property
    def historical_pct(self):
        """Percentage of users who answered correctly (before the current answer is counted)."""
        if self.total_count == 0:
            return None
        return round(100.0 * self.correct_count / self.total_count, 1)
