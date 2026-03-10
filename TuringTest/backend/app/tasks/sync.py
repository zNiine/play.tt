from datetime import datetime, timezone, date
from ..extensions import celery, db
from ..stats.mock_provider import MockStatsProvider
from ..models import Game, Team, Player, GameLineup, LineupPlayer

provider = MockStatsProvider()


@celery.task(name="tasks.sync_games_for_date")
def sync_games_for_date(game_date_str: str = None):
    from app import create_app
    app = create_app()
    with app.app_context():
        game_date = date.fromisoformat(game_date_str) if game_date_str else datetime.now(timezone.utc).date()
        for gd in provider.get_games(game_date):
            if Game.query.filter_by(external_game_id=gd["external_id"]).first():
                continue
            home = Team.query.filter_by(team_code=gd["home_team"]).first()
            away = Team.query.filter_by(team_code=gd["away_team"]).first()
            if home and away:
                game = Game(
                    external_game_id=gd["external_id"],
                    home_team_id=home.id,
                    away_team_id=away.id,
                    start_time=datetime.fromisoformat(gd["start_time"]),
                    status=gd.get("status", "scheduled"),
                )
                db.session.add(game)
        db.session.commit()


@celery.task(name="tasks.update_confirmed_lineups")
def update_confirmed_lineups():
    from app import create_app
    app = create_app()
    with app.app_context():
        games = Game.query.filter(Game.status.in_(["scheduled", "lineups_partial"])).all()
        for game in games:
            if not game.external_game_id:
                continue
            data = provider.get_confirmed_lineups(game.external_game_id)
            if not data:
                continue
            confirmed_count = 0
            for side, team in [("home", game.home_team), ("away", game.away_team)]:
                if not team:
                    continue
                gl = GameLineup.query.filter_by(game_id=game.id, team_id=team.id).first()
                if not gl:
                    gl = GameLineup(game_id=game.id, team_id=team.id)
                    db.session.add(gl)
                    db.session.flush()
                if data.get(side):
                    gl.confirmed = True
                    gl.confirmed_at = datetime.now(timezone.utc)
                    LineupPlayer.query.filter_by(game_lineup_id=gl.id).delete()
                    for lp in data[side]:
                        p = Player.query.filter_by(external_player_id=lp["player_id"]).first()
                        if p:
                            db.session.add(LineupPlayer(
                                game_lineup_id=gl.id,
                                player_id=p.id,
                                batting_order=lp.get("batting_order"),
                                position=lp.get("position"),
                            ))
                    confirmed_count += 1
            if confirmed_count == 0:
                game.status = "scheduled"
            elif confirmed_count == 1:
                game.status = "lineups_partial"
            else:
                game.status = "lineups_confirmed"
        db.session.commit()
