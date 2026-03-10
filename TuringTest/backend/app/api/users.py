from flask import Blueprint, jsonify
from sqlalchemy import desc
from ..models import User, Entry, BTSUserState, Winner

users_bp = Blueprint("users", __name__)


@users_bp.route("/<user_id>/profile", methods=["GET"])
def get_profile(user_id):
    user = User.query.get_or_404(user_id)
    state = BTSUserState.query.get(user_id)
    wins = Winner.query.filter_by(user_id=user_id).order_by(desc(Winner.id)).limit(10).all()
    return jsonify({
        "user": user.to_dict(),
        "bts_state": state.to_dict() if state else None,
        "recent_wins": [w.to_dict() for w in wins],
    })


@users_bp.route("/<user_id>/history", methods=["GET"])
def get_history(user_id):
    User.query.get_or_404(user_id)
    entries = (
        Entry.query.filter_by(user_id=user_id)
        .filter(Entry.status.in_(["submitted", "scored", "final"]))
        .order_by(desc(Entry.submitted_at))
        .limit(20)
        .all()
    )
    return jsonify([e.to_dict() for e in entries])


@users_bp.route("/<user_id>/wins", methods=["GET"])
def get_wins(user_id):
    User.query.get_or_404(user_id)
    wins = Winner.query.filter_by(user_id=user_id).order_by(desc(Winner.id)).all()
    return jsonify([w.to_dict() for w in wins])
