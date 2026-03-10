from functools import wraps
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from ..extensions import db
from ..models import User, Slate, Week, BTSDay, SlateGame, SlatePlayer, Game, Team, Player

admin_bp = Blueprint("admin", __name__)


def admin_required(f):
    @wraps(f)
    @jwt_required()
    def decorated(*args, **kwargs):
        user = User.query.get(get_jwt_identity())
        if not user or user.role != "admin":
            return jsonify({"error": "Admin access required"}), 403
        return f(*args, **kwargs)
    return decorated


@admin_bp.route("/slates", methods=["POST"])
@admin_required
def create_slate():
    data = request.get_json() or {}
    slate_date = datetime.strptime(data["slate_date"], "%Y-%m-%d").date()
    if Slate.query.filter_by(slate_date=slate_date).first():
        return jsonify({"error": "Slate already exists for this date"}), 409

    slate = Slate(
        slate_date=slate_date,
        lock_time=datetime.fromisoformat(data["lock_time"]) if data.get("lock_time") else None,
    )
    db.session.add(slate)
    db.session.flush()

    for game_id in data.get("game_ids", []):
        db.session.add(SlateGame(slate_id=slate.id, game_id=game_id))

    db.session.commit()
    return jsonify(slate.to_dict()), 201


@admin_bp.route("/slates/<int:slate_id>/lock", methods=["POST"])
@admin_required
def lock_slate(slate_id):
    slate = Slate.query.get_or_404(slate_id)
    slate.status = "locked"
    db.session.commit()
    return jsonify(slate.to_dict())


@admin_bp.route("/slates/<int:slate_id>/finalize", methods=["POST"])
@admin_required
def finalize_slate(slate_id):
    Slate.query.get_or_404(slate_id)
    from ..tasks.finalization import finalize_slate_task
    finalize_slate_task.delay(slate_id)
    return jsonify({"message": "Slate finalization queued"})


@admin_bp.route("/weeks", methods=["POST"])
@admin_required
def create_week():
    data = request.get_json() or {}
    week = Week(
        season_year=data["season_year"],
        week_index=data["week_index"],
        start_date=datetime.strptime(data["start_date"], "%Y-%m-%d").date(),
        end_date=datetime.strptime(data["end_date"], "%Y-%m-%d").date(),
    )
    db.session.add(week)
    db.session.commit()
    return jsonify(week.to_dict()), 201


@admin_bp.route("/weeks/<int:week_id>/finalize", methods=["POST"])
@admin_required
def finalize_week(week_id):
    Week.query.get_or_404(week_id)
    from ..tasks.finalization import finalize_week_task
    finalize_week_task.delay(week_id)
    return jsonify({"message": "Week finalization queued"})


@admin_bp.route("/bts-days", methods=["POST"])
@admin_required
def create_bts_day():
    data = request.get_json() or {}
    bts_day = BTSDay(
        date=datetime.strptime(data["date"], "%Y-%m-%d").date(),
        lock_time=datetime.fromisoformat(data["lock_time"]) if data.get("lock_time") else None,
    )
    db.session.add(bts_day)
    db.session.commit()
    return jsonify(bts_day.to_dict()), 201


@admin_bp.route("/teams", methods=["POST"])
@admin_required
def create_team():
    data = request.get_json() or {}
    team = Team(team_code=data["team_code"], team_name=data["team_name"])
    db.session.add(team)
    db.session.commit()
    return jsonify(team.to_dict()), 201


@admin_bp.route("/players", methods=["POST"])
@admin_required
def create_player():
    data = request.get_json() or {}
    player = Player(
        full_name=data["full_name"],
        primary_position=data["primary_position"],
        team_id=data.get("team_id"),
        bats=data.get("bats"),
        throws=data.get("throws"),
        external_player_id=data.get("external_player_id"),
    )
    db.session.add(player)
    db.session.commit()
    return jsonify(player.to_dict()), 201


@admin_bp.route("/games", methods=["POST"])
@admin_required
def create_game():
    data = request.get_json() or {}
    game = Game(
        home_team_id=data["home_team_id"],
        away_team_id=data["away_team_id"],
        start_time=datetime.fromisoformat(data["start_time"]),
        status=data.get("status", "scheduled"),
        external_game_id=data.get("external_game_id"),
    )
    db.session.add(game)
    db.session.commit()
    return jsonify(game.to_dict()), 201


@admin_bp.route("/slate-players", methods=["POST"])
@admin_required
def add_slate_player():
    data = request.get_json() or {}
    sp = SlatePlayer(
        slate_id=data["slate_id"],
        player_id=data["player_id"],
        salary=data.get("salary", 5000),
        eligible_positions=data.get("eligible_positions", []),
    )
    db.session.add(sp)
    db.session.commit()
    return jsonify(sp.to_dict()), 201
