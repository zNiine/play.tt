from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timezone
from sqlalchemy import desc
from ..extensions import db
from ..models import BTSDay, BTSEntry, BTSPick, BTSUserState, Player

bts_bp = Blueprint("bts", __name__)


@bts_bp.route("/today", methods=["GET"])
def get_today():
    today = datetime.now(timezone.utc).date()
    day = BTSDay.query.filter_by(date=today).first()
    if not day:
        return jsonify({"error": "No BTS day for today"}), 404
    return jsonify(day.to_dict())


@bts_bp.route("/entry", methods=["POST"])
@jwt_required()
def submit_entry():
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    player_ids = data.get("player_ids", [])

    if not 1 <= len(player_ids) <= 5:
        return jsonify({"error": "Select 1 to 5 players"}), 400

    today = datetime.now(timezone.utc).date()
    day = BTSDay.query.filter_by(date=today).first()
    if not day:
        return jsonify({"error": "No BTS day available"}), 404
    if day.status != "open":
        return jsonify({"error": "BTS is locked for today"}), 400
    if day.lock_time and datetime.now(timezone.utc) >= day.lock_time:
        return jsonify({"error": "BTS lock time has passed"}), 400

    if BTSEntry.query.filter_by(bts_day_id=day.id, user_id=user_id).first():
        return jsonify({"error": "Already submitted for today"}), 409

    entry = BTSEntry(bts_day_id=day.id, user_id=user_id)
    db.session.add(entry)
    db.session.flush()

    for pid in player_ids:
        if not Player.query.get(pid):
            db.session.rollback()
            return jsonify({"error": f"Player {pid} not found"}), 400
        db.session.add(BTSPick(bts_entry_id=entry.id, player_id=pid))

    db.session.commit()
    return jsonify(entry.to_dict()), 201


@bts_bp.route("/me", methods=["GET"])
@jwt_required()
def get_my_bts():
    user_id = get_jwt_identity()
    today = datetime.now(timezone.utc).date()
    state = BTSUserState.query.get(user_id)
    day = BTSDay.query.filter_by(date=today).first()
    today_entry = BTSEntry.query.filter_by(bts_day_id=day.id, user_id=user_id).first() if day else None
    recent = (
        BTSEntry.query.filter_by(user_id=user_id)
        .order_by(desc(BTSEntry.submitted_at))
        .limit(10)
        .all()
    )
    return jsonify({
        "state": state.to_dict() if state else None,
        "today_entry": today_entry.to_dict() if today_entry else None,
        "recent_entries": [e.to_dict() for e in recent],
    })


@bts_bp.route("/leaderboard", methods=["GET"])
def get_leaderboard():
    year = datetime.now(timezone.utc).year
    states = (
        BTSUserState.query.filter_by(season_year=year)
        .order_by(desc(BTSUserState.current_streak))
        .limit(50)
        .all()
    )
    return jsonify([{
        "user_id": s.user_id,
        "display_name": s.user.display_name if s.user else None,
        "current_streak": s.current_streak,
        "longest_streak": s.longest_streak,
        "last_played": s.last_played.isoformat() if s.last_played else None,
    } for s in states])
