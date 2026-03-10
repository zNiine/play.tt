from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from sqlalchemy import desc
from ..models import Week, WeeklyScore

weeks_bp = Blueprint("weeks", __name__)


@weeks_bp.route("/current", methods=["GET"])
def current_week():
    today = datetime.now(timezone.utc).date()
    week = Week.query.filter(Week.start_date <= today, Week.end_date >= today).first()
    if not week:
        return jsonify({"error": "No current week"}), 404
    return jsonify(week.to_dict())


@weeks_bp.route("/<int:week_id>", methods=["GET"])
def get_week(week_id):
    week = Week.query.get_or_404(week_id)
    return jsonify(week.to_dict())


@weeks_bp.route("/<int:week_id>/leaderboard", methods=["GET"])
def leaderboard(week_id):
    Week.query.get_or_404(week_id)
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 25, type=int), 100)
    scores = (
        WeeklyScore.query.filter_by(week_id=week_id)
        .order_by(desc(WeeklyScore.total_points))
        .paginate(page=page, per_page=per_page, error_out=False)
    )
    return jsonify({
        "week_id": week_id,
        "scores": [s.to_dict() for s in scores.items],
        "total": scores.total,
        "pages": scores.pages,
        "page": page,
    })
