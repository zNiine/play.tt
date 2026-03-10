from celery.schedules import crontab
from app import create_app
from app.extensions import celery

app = create_app()
app.app_context().push()

celery.conf.beat_schedule = {
    "sync-games-daily": {
        "task": "tasks.sync_games_for_date",
        "schedule": crontab(hour=6, minute=0),
    },
    "update-lineups-5min": {
        "task": "tasks.update_confirmed_lineups",
        "schedule": 300.0,
    },
    "update-live-scores-5min": {
        "task": "tasks.update_live_scores",
        "schedule": 300.0,
    },
    "finalize-slates-10min": {
        "task": "tasks.finalize_slates_if_complete",
        "schedule": 600.0,
    },
    "finalize-bts-nightly": {
        "task": "tasks.finalize_bts_day",
        "schedule": crontab(hour=2, minute=0),
    },
    "reset-daily-fan-games": {
        "task": "tasks.reset_daily_fan_games",
        "schedule": crontab(hour=4, minute=0),
    },
}
