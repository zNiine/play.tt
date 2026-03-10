def compute_batter_points(stats: dict) -> float:
    return (
        stats.get("1B", 0) * 3
        + stats.get("2B", 0) * 5
        + stats.get("3B", 0) * 8
        + stats.get("HR", 0) * 10
        + stats.get("BB", 0) * 2
        + stats.get("R", 0) * 2
        + stats.get("RBI", 0) * 2
        + stats.get("SB", 0) * 5
        + stats.get("CS", 0) * -2
    )


def compute_pitcher_points(stats: dict) -> float:
    return (
        stats.get("IP", 0) * 3
        + stats.get("K", 0) * 2
        + stats.get("ER", 0) * -2
        + stats.get("W", 0) * 5
    )


def compute_fantasy_points(stats: dict, position: str) -> float:
    if position == "P":
        return compute_pitcher_points(stats)
    return compute_batter_points(stats)


def recompute_entry_score(entry) -> float:
    from ..models import PlayerGameStats

    total = 0.0
    for pick in entry.picks:
        stats_records = PlayerGameStats.query.filter_by(player_id=pick.player_id).all()
        total += sum(s.fantasy_points for s in stats_records)

    entry.total_points = total
    return total
