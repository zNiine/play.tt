from datetime import datetime, timezone
from ..extensions import celery, db
from ..models import Slate, Entry, Week, WeeklyScore, BTSDay, BTSEntry, BTSUserState, Winner
from ..services.leaderboard_service import update_weekly_score


@celery.task(name="tasks.finalize_slate")
def finalize_slate_task(slate_id: int):
    from app import create_app
    app = create_app()
    with app.app_context():
        slate = Slate.query.get(slate_id)
        if not slate:
            return

        entries = (
            Entry.query.filter_by(slate_id=slate_id)
            .filter(Entry.status.in_(["submitted", "scored"]))
            .order_by(Entry.total_points.desc())
            .all()
        )

        slate_date = slate.slate_date
        week = Week.query.filter(
            Week.start_date <= slate_date, Week.end_date >= slate_date
        ).first()

        for i, entry in enumerate(entries):
            entry.rank_final = i + 1
            entry.status = "final"
            if week:
                update_weekly_score(entry.user_id, week.id, entry.total_points)

        for i, entry in enumerate(entries[:3]):
            db.session.add(Winner(
                scope="slate",
                scope_id=str(slate_id),
                user_id=entry.user_id,
                rank=i + 1,
                prize_description="Daily winner prize" if i == 0 else None,
                status="confirmed",
            ))

        slate.status = "final"
        db.session.commit()


@celery.task(name="tasks.finalize_week")
def finalize_week_task(week_id: int):
    from app import create_app
    app = create_app()
    with app.app_context():
        week = Week.query.get(week_id)
        if not week:
            return

        scores = (
            WeeklyScore.query.filter_by(week_id=week_id)
            .order_by(WeeklyScore.total_points.desc())
            .all()
        )
        for i, score in enumerate(scores):
            score.rank = i + 1

        for i, score in enumerate(scores[:3]):
            db.session.add(Winner(
                scope="week",
                scope_id=str(week_id),
                user_id=score.user_id,
                rank=i + 1,
                prize_description="Weekly tickets" if i == 0 else None,
                status="confirmed",
            ))

        week.status = "final"
        db.session.commit()


@celery.task(name="tasks.finalize_bts_day")
def finalize_bts_day_task(bts_day_id: int = None):
    from app import create_app
    from ..models import PlayerGameStats
    app = create_app()
    with app.app_context():
        if bts_day_id:
            day = BTSDay.query.get(bts_day_id)
        else:
            today = datetime.now(timezone.utc).date()
            day = BTSDay.query.filter_by(date=today).first()
        if not day:
            return

        for entry in BTSEntry.query.filter_by(bts_day_id=day.id).all():
            success = all(
                any((s.stats_json or {}).get("H", 0) > 0
                    for s in PlayerGameStats.query.filter_by(player_id=pick.player_id).all())
                for pick in entry.picks
            )
            entry.success = success

            state = BTSUserState.query.get(entry.user_id)
            if not state:
                state = BTSUserState(
                    user_id=entry.user_id,
                    season_year=day.date.year,
                    current_streak=0,
                    longest_streak=0,
                )
                db.session.add(state)

            if success:
                state.current_streak += 1
                state.longest_streak = max(state.longest_streak, state.current_streak)
            else:
                state.current_streak = 0

            state.last_played = day.date

        day.status = "final"
        db.session.commit()


@celery.task(name="tasks.finalize_slates_if_complete")
def finalize_slates_if_complete():
    from app import create_app
    from ..models import SlateGame, Game
    app = create_app()
    with app.app_context():
        for slate in Slate.query.filter_by(status="live").all():
            games = [Game.query.get(sg.game_id) for sg in SlateGame.query.filter_by(slate_id=slate.id).all()]
            if games and all(g and g.status == "final" for g in games):
                slate.status = "finalizing"
                db.session.commit()
                finalize_slate_task.delay(slate.id)


# Alias for backward compatibility
finalize_bts_day = finalize_bts_day_task
