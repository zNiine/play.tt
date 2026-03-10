from datetime import datetime, timezone
from ..extensions import celery, db
from ..stats.mock_provider import MockStatsProvider
from ..models import Game, PlayerGameStats, Player, Slate, SlateGame, Entry
from ..services.scoring import compute_fantasy_points, recompute_entry_score
from ..services.leaderboard_service import invalidate_leaderboard_cache

provider = MockStatsProvider()


@celery.task(name="tasks.update_live_scores")
def update_live_scores():
    from app import create_app
    app = create_app()
    with app.app_context():
        live_games = Game.query.filter_by(status="live").all()
        if not live_games:
            return

        for game in live_games:
            if not game.external_game_id:
                continue
            for sd in provider.get_player_game_stats(game.external_game_id):
                p = Player.query.filter_by(external_player_id=sd["player_id"]).first()
                if not p:
                    continue
                pgs = PlayerGameStats.query.filter_by(game_id=game.id, player_id=p.id).first()
                if not pgs:
                    pgs = PlayerGameStats(game_id=game.id, player_id=p.id)
                    db.session.add(pgs)
                pgs.stats_json = sd
                pgs.fantasy_points = compute_fantasy_points(sd, sd.get("position", p.primary_position))
                pgs.last_updated = datetime.now(timezone.utc)
            db.session.commit()

        live_game_ids = {g.id for g in live_games}
        live_slate_ids = {
            sg.slate_id
            for sg in SlateGame.query.filter(SlateGame.game_id.in_(live_game_ids)).all()
        }

        for slate_id in live_slate_ids:
            entries = Entry.query.filter_by(slate_id=slate_id).filter(
                Entry.status.in_(["submitted", "scored"])
            ).all()
            for entry in entries:
                recompute_entry_score(entry)
                entry.status = "scored"
            db.session.commit()
            invalidate_leaderboard_cache(slate_id)
