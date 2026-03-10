"""
Celery tasks for Fan Games daily reset at 4:00 AM UTC.
"""
from datetime import datetime, timezone
from ..extensions import celery, db
from ..models.fan_games import DailyChallenge, FanGameResult
from ..services.fan_games_service import (
    generate_grid_challenge,
    generate_guess_challenge,
    generate_target_challenge,
    generate_connections_challenge,
    generate_roster_challenge,
    generate_journey_challenge,
)

DAILY_GAME_TYPES = [
    ("grid",        generate_grid_challenge),
    ("guess",       generate_guess_challenge),
    ("target",      generate_target_challenge),
    ("connections", generate_connections_challenge),
    ("roster",      generate_roster_challenge),
    ("journey",     generate_journey_challenge),
]


@celery.task(name="tasks.reset_daily_fan_games")
def reset_daily_fan_games():
    """
    Generate fresh daily challenges for all six daily games at 4:00 AM UTC.
    """
    from app import create_app
    app = create_app()
    with app.app_context():
        today = datetime.now(timezone.utc).date()

        for game_type, gen_fn in DAILY_GAME_TYPES:
            existing = DailyChallenge.query.filter_by(
                date=today, game_type=game_type
            ).first()
            if existing:
                # Delete results that reference this challenge (challenge_id is NOT NULL)
                FanGameResult.query.filter_by(challenge_id=existing.id).delete()
                db.session.delete(existing)
                db.session.flush()

            try:
                data = gen_fn(today)
                challenge = DailyChallenge(
                    date=today,
                    game_type=game_type,
                    challenge_data=data,
                )
                db.session.add(challenge)
            except Exception as e:
                print(f"[fan_games] Failed to generate {game_type} challenge: {e}")

        db.session.commit()
        print(f"[fan_games] All 6 daily challenges generated for {today}")


if __name__ == "__main__":
    """Run manually to generate today's fan game challenges: python -m app.tasks.fan_games"""
    from app import create_app
    app = create_app()
    with app.app_context():
        reset_daily_fan_games()
