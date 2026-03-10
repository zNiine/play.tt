from statistics import median
from datetime import datetime, timedelta, timezone


def compute_player_projection(player_id: int, num_games: int = 15) -> float:
    from ..models import PlayerGameStats

    records = (
        PlayerGameStats.query.filter_by(player_id=player_id)
        .order_by(PlayerGameStats.last_updated.desc())
        .limit(num_games)
        .all()
    )
    if not records:
        return 5.0

    weights = [1 / (i + 1) for i in range(len(records))]
    total_weight = sum(weights)
    weighted_sum = sum(s.fantasy_points * w for s, w in zip(records, weights))
    return weighted_sum / total_weight


def compute_salary(proj_fp: float, median_proj: float, prev_salary: int = None) -> int:
    med = max(median_proj, 0.1)
    model_salary = round(((proj_fp / med) ** 1.25) * 5500)
    model_salary = max(3000, min(11000, model_salary))

    if prev_salary is not None:
        salary = round(0.7 * prev_salary + 0.3 * model_salary)
    else:
        salary = model_salary

    return max(3000, min(11000, salary))


def update_slate_salaries(slate_id: int):
    from ..models import SlatePlayer
    from ..extensions import db

    slate_players = SlatePlayer.query.filter_by(slate_id=slate_id, active=True).all()
    projections = {sp.player_id: compute_player_projection(sp.player_id) for sp in slate_players}

    proj_values = list(projections.values())
    med = median(proj_values) if proj_values else 5.0

    for sp in slate_players:
        sp.salary = compute_salary(projections.get(sp.player_id, 5.0), med, sp.salary)

    db.session.commit()
