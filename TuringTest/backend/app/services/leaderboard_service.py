import json
import math
from ..extensions import db, redis_client
from ..models import Entry, WeeklyScore
from sqlalchemy import desc


def get_slate_leaderboard(slate_id: int, page: int = 1, per_page: int = 25) -> dict:
    cache_key = f"live_leaderboard_{slate_id}"

    try:
        cached = redis_client.get(cache_key)
        if cached:
            data = json.loads(cached)
            start = (page - 1) * per_page
            return {
                "slate_id": slate_id,
                "scores": data["scores"][start: start + per_page],
                "total": data["total"],
                "pages": math.ceil(data["total"] / per_page),
                "page": page,
            }
    except Exception:
        pass

    entries = (
        Entry.query.filter_by(slate_id=slate_id)
        .filter(Entry.status.in_(["submitted", "scored", "final"]))
        .order_by(desc(Entry.total_points))
        .all()
    )

    scores = [
        {
            "rank": i + 1,
            "user_id": e.user_id,
            "display_name": e.user.display_name if e.user else None,
            "entry_id": e.id,
            "total_points": e.total_points,
            "total_salary": e.total_salary,
        }
        for i, e in enumerate(entries)
    ]

    try:
        redis_client.setex(cache_key, 30, json.dumps({"scores": scores, "total": len(scores)}))
    except Exception:
        pass

    start = (page - 1) * per_page
    return {
        "slate_id": slate_id,
        "scores": scores[start: start + per_page],
        "total": len(scores),
        "pages": math.ceil(len(scores) / per_page) if scores else 1,
        "page": page,
    }


def invalidate_leaderboard_cache(slate_id: int):
    try:
        redis_client.delete(f"live_leaderboard_{slate_id}")
    except Exception:
        pass


def update_weekly_score(user_id: str, week_id: int, points: float):
    score = WeeklyScore.query.filter_by(week_id=week_id, user_id=user_id).first()
    if not score:
        score = WeeklyScore(week_id=week_id, user_id=user_id)
        db.session.add(score)
    score.total_points += points
    score.entries_count += 1
    db.session.commit()
