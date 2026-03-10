from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timezone
from ..extensions import db
from ..models import Slate, SlatePlayer, Entry, EntryPick

slates_bp = Blueprint("slates", __name__)

SALARY_CAP = 50_000
BATTER_SLOTS = 5
PITCHER_SLOT = 1


@slates_bp.route("/", methods=["GET"])
def get_slates():
    slates = Slate.query.order_by(Slate.slate_date.desc()).limit(14).all()
    return jsonify([s.to_dict() for s in slates])


@slates_bp.route("/today", methods=["GET"])
def get_today_slate():
    today = datetime.now(timezone.utc).date()
    slate = Slate.query.filter_by(slate_date=today).first()
    if not slate:
        return jsonify({"error": "No slate for today"}), 404
    return jsonify(slate.to_dict())


@slates_bp.route("/<int:slate_id>", methods=["GET"])
def get_slate(slate_id):
    slate = Slate.query.get_or_404(slate_id)
    data = slate.to_dict()
    data["games"] = [sg.game.to_dict() for sg in slate.slate_games]
    return jsonify(data)


@slates_bp.route("/<int:slate_id>/players", methods=["GET"])
def get_slate_players(slate_id):
    Slate.query.get_or_404(slate_id)
    position = request.args.get("position")
    players = SlatePlayer.query.filter_by(slate_id=slate_id, active=True).all()
    result = [sp.to_dict() for sp in players]
    if position:
        result = [p for p in result if position in (p.get("eligible_positions") or [])]
    return jsonify(result)


@slates_bp.route("/<int:slate_id>/entry", methods=["GET", "POST"])
@jwt_required()
def entry(slate_id):
    user_id = get_jwt_identity()
    slate = Slate.query.get_or_404(slate_id)

    if request.method == "GET":
        e = Entry.query.filter_by(user_id=user_id, slate_id=slate_id).first()
        return jsonify(e.to_dict() if e else None)

    # POST – save draft
    if slate.status not in ("open",):
        return jsonify({"error": "Slate not accepting entries"}), 400

    data = request.get_json() or {}
    picks_data = data.get("picks", [])
    if len(picks_data) != 6:
        return jsonify({"error": "Must provide exactly 6 picks (5 batters + 1 pitcher)"}), 400

    e = Entry.query.filter_by(user_id=user_id, slate_id=slate_id, status="draft").first()
    if not e:
        e = Entry(user_id=user_id, slate_id=slate_id)
        db.session.add(e)
        db.session.flush()
    else:
        EntryPick.query.filter_by(entry_id=e.id).delete()

    total_salary = 0
    for pd in picks_data:
        sp = SlatePlayer.query.filter_by(slate_id=slate_id, player_id=pd["player_id"]).first()
        if not sp or not sp.active:
            db.session.rollback()
            return jsonify({"error": f"Player {pd['player_id']} not available in this slate"}), 400
        total_salary += sp.salary
        db.session.add(EntryPick(
            entry_id=e.id,
            player_id=pd["player_id"],
            slot=pd["slot"],
            position=pd["position"],
        ))

    if total_salary > SALARY_CAP:
        db.session.rollback()
        return jsonify({"error": f"Salary cap exceeded ({total_salary}/{SALARY_CAP})"}), 400

    e.total_salary = total_salary
    db.session.commit()
    return jsonify(e.to_dict())


@slates_bp.route("/<int:slate_id>/entry/submit", methods=["POST"])
@jwt_required()
def submit_entry(slate_id):
    user_id = get_jwt_identity()
    slate = Slate.query.get_or_404(slate_id)

    if slate.status not in ("open",):
        return jsonify({"error": "Slate is locked"}), 400
    if slate.lock_time and datetime.now(timezone.utc) >= slate.lock_time:
        return jsonify({"error": "Slate lock time has passed"}), 400

    e = Entry.query.filter_by(user_id=user_id, slate_id=slate_id, status="draft").first()
    if not e:
        return jsonify({"error": "No draft entry found"}), 404
    if len(e.picks) != 6:
        return jsonify({"error": "Entry must have 6 picks"}), 400

    e.status = "submitted"
    e.submitted_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(e.to_dict())


@slates_bp.route("/<int:slate_id>/leaderboard", methods=["GET"])
def get_leaderboard(slate_id):
    Slate.query.get_or_404(slate_id)
    from ..services.leaderboard_service import get_slate_leaderboard
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 25, type=int)
    return jsonify(get_slate_leaderboard(slate_id, page=page, per_page=per_page))
