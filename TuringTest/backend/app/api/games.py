from flask import Blueprint, jsonify
from ..models import Game, GameLineup

games_bp = Blueprint("games", __name__)


@games_bp.route("/<int:game_id>", methods=["GET"])
def get_game(game_id):
    game = Game.query.get_or_404(game_id)
    return jsonify(game.to_dict())


@games_bp.route("/<int:game_id>/lineups", methods=["GET"])
def get_lineups(game_id):
    game = Game.query.get_or_404(game_id)
    lineups = GameLineup.query.filter_by(game_id=game_id).all()
    confirmed = [l for l in lineups if l.confirmed]
    return jsonify({
        "game": game.to_dict(),
        "lineups": [l.to_dict() for l in lineups],
        "confirmed_count": len(confirmed),
        "total_teams": 2,
    })


@games_bp.route("/<int:game_id>/lineups/status", methods=["GET"])
def lineup_status(game_id):
    game = Game.query.get_or_404(game_id)
    lineups = GameLineup.query.filter_by(game_id=game_id).all()
    confirmed = [l for l in lineups if l.confirmed]
    return jsonify({
        "game_id": game_id,
        "game_status": game.status,
        "lineups_confirmed": len(confirmed),
        "lineups_total": len(lineups),
        "fully_confirmed": len(confirmed) == 2,
    })
