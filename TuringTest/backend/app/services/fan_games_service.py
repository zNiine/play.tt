"""
Fan Games service — challenge generation & validation logic.

All data comes from the existing DB (players, teams, player_game_stats).
"""
import re
import random
from datetime import date, datetime
from collections import defaultdict
from sqlalchemy import func

from ..extensions import db
from ..models import Player, Team, PlayerGameStats, Game


# ── Category helpers ──────────────────────────────────────────────────────────

POSITION_GROUPS = {
    "P": "pitcher",
    "C": "catcher",
    "1B": "infield", "2B": "infield", "3B": "infield", "SS": "infield",
    "LF": "outfield", "CF": "outfield", "RF": "outfield",
    "DH": "infield",
}

POSITION_LABELS = {
    "P": "Pitcher", "C": "Catcher",
    "1B": "First Base", "2B": "Second Base", "3B": "Third Base",
    "SS": "Shortstop", "LF": "Left Field", "CF": "Center Field",
    "RF": "Right Field", "DH": "Designated Hitter",
}

STAT_THRESHOLDS = {
    "hr_5":   ("HR ≥ 5 (career)",   lambda s: s.get("HR", 0), 5),
    "hr_10":  ("HR ≥ 10 (career)",  lambda s: s.get("HR", 0), 10),
    "sb_5":   ("SB ≥ 5 (career)",   lambda s: s.get("SB", 0), 5),
    "sb_10":  ("SB ≥ 10 (career)",  lambda s: s.get("SB", 0), 10),
    "h_50":   ("H ≥ 50 (career)",   lambda s: s.get("H", 0), 50),
    "h_100":  ("H ≥ 100 (career)",  lambda s: s.get("H", 0), 100),
    "h_200":  ("H ≥ 200 (career)",  lambda s: s.get("H", 0), 200),
    "rbi_25": ("RBI ≥ 25 (career)", lambda s: s.get("RBI", 0), 25),
    "rbi_50": ("RBI ≥ 50 (career)", lambda s: s.get("RBI", 0), 50),
    "r_50":   ("R ≥ 50 (career)",   lambda s: s.get("R", 0), 50),
    "bb_30":  ("BB ≥ 30 (career)",  lambda s: s.get("BB", 0), 30),
    "k_30":   ("K ≥ 30 (pitcher, career)", lambda s: s.get("K", 0), 30),
}


def _load_data_db_career_stats_by_name():
    """Load data.db career stats keyed by lower-cased 'First Last' player name. Returns {} if unavailable."""
    try:
        from .data_db import get_career_stats_by_roster_name
        return get_career_stats_by_roster_name()
    except Exception:
        return {}


def _get_player_data_stats(player, data_by_name):
    """Return data.db career stats for a postgres Player, matched by name. Falls back to {}."""
    name_lower = (player.full_name or "").strip().lower()
    return data_by_name.get(name_lower, {})


def _get_multi_team_sets():
    """
    From data.db, find pairs of ALPB teams such that at least 2 players played for both.
    Returns list of (team_a_name, team_b_name, set_of_player_names).
    """
    try:
        from .data_db import _conn
        c = _conn()
        if not c:
            return []
        # Get player_id -> set of teams
        rows = c.execute(
            "SELECT DISTINCT player_id, team FROM batters WHERE player_id IS NOT NULL AND team IS NOT NULL"
        ).fetchall()
        c.close()
        player_teams: dict = {}
        for player_id, team in rows:
            pid = str(player_id)
            if pid not in player_teams:
                player_teams[pid] = set()
            player_teams[pid].add(team)

        # team pair -> set of player_ids
        pair_players: dict = defaultdict(set)
        for pid, teams in player_teams.items():
            teams_list = sorted(teams)
            for i in range(len(teams_list)):
                for j in range(i + 1, len(teams_list)):
                    pair = (teams_list[i], teams_list[j])
                    pair_players[pair].add(pid)

        # Keep pairs with at least 2 shared players
        return [(a, b, pids) for (a, b), pids in pair_players.items() if len(pids) >= 2]
    except Exception:
        return []


def _aggregate_player_stats():
    """Return dict player_id -> aggregated stats dict across all games (Python-side, DB-agnostic)."""
    records = PlayerGameStats.query.all()
    agg = {}
    for r in records:
        s = r.stats_json or {}
        pid = r.player_id
        if pid not in agg:
            agg[pid] = {"HR": 0, "SB": 0, "H": 0, "RBI": 0, "K": 0, "IP": 0.0,
                        "R": 0, "BB": 0, "1B": 0, "2B": 0, "3B": 0}
        for key in ("HR", "SB", "H", "RBI", "K", "R", "BB"):
            agg[pid][key] += int(s.get(key) or 0)
        agg[pid]["IP"] += float(s.get("IP") or 0)
        agg[pid]["1B"] += int(s.get("1B") or 0)
        agg[pid]["2B"] += int(s.get("2B") or 0)
        agg[pid]["3B"] += int(s.get("3B") or 0)
    return agg


def _check_category(player, agg_stats, category):
    """Return True if player satisfies the given category key."""
    if category.startswith("team:"):
        return player.team and player.team.team_code == category[5:]
    if category.startswith("pos:"):
        return player.primary_position == category[4:]
    if category.startswith("pos_group:"):
        return POSITION_GROUPS.get(player.primary_position) == category[10:]
    if category in STAT_THRESHOLDS:
        _, stat_fn, threshold = STAT_THRESHOLDS[category]
        stats = agg_stats.get(player.id, {})
        return stat_fn(stats) >= threshold
    return False


def _category_label(category):
    if category.startswith("team:"):
        t = Team.query.filter_by(team_code=category[5:]).first()
        return t.team_name if t else category[5:]
    if category.startswith("pos:"):
        return POSITION_LABELS.get(category[4:], category[4:])
    if category.startswith("pos_group:"):
        g = category[10:]
        labels = {"pitcher": "Pitchers", "catcher": "Catchers", "infield": "Infielders", "outfield": "Outfielders"}
        return labels.get(g, g.capitalize() + "s")
    if category in STAT_THRESHOLDS:
        return STAT_THRESHOLDS[category][0]
    return category


# ── Immaculate Grid ───────────────────────────────────────────────────────────

def _players_matching_category(category, players, data_by_name, agg_pg):
    """Return list of player IDs matching a given category string."""
    result = []
    for p in players:
        if category.startswith("team:"):
            if p.team and p.team.team_code == category[5:]:
                result.append(p.id)
        elif category.startswith("pos:"):
            if p.primary_position == category[4:]:
                result.append(p.id)
        elif category.startswith("pos_group:"):
            if POSITION_GROUPS.get(p.primary_position) == category[10:]:
                result.append(p.id)
        elif category in STAT_THRESHOLDS:
            _, stat_fn, threshold = STAT_THRESHOLDS[category]
            # Prefer data.db stats; fall back to postgres aggregated stats
            stats = _get_player_data_stats(p, data_by_name) or agg_pg.get(p.id, {})
            if stat_fn(stats) >= threshold:
                result.append(p.id)
    return result


def generate_grid_challenge(challenge_date: date) -> dict:
    """
    Generate a 3x3 Immaculate Grid challenge.
    Rows = 3 teams. Cols = mix of stat threshold, position, or position-group categories.
    Uses data.db career stats for stat threshold validation.
    Ensures every cell has ≥1 valid answer.
    """
    players = Player.query.filter_by(active=True).all()
    teams = Team.query.all()
    if not players or not teams:
        raise ValueError("No players or teams available for grid")

    team_codes = [t.team_code for t in teams if any(p.team and p.team.team_code == t.team_code for p in players)]
    if len(team_codes) < 3:
        raise ValueError("Need at least 3 teams with players for grid")

    # Load data.db career stats for stat thresholds
    data_by_name = _load_data_db_career_stats_by_name()
    agg_pg = _aggregate_player_stats()

    # Build candidate column categories: stat thresholds + positions + position groups
    positions_in_use = list({p.primary_position for p in players if p.primary_position})
    pos_groups_in_use = list({POSITION_GROUPS[p] for p in positions_in_use if p in POSITION_GROUPS})

    stat_col_candidates = []
    # Add usable stat threshold categories (those with ≥3 qualifying players)
    for key in STAT_THRESHOLDS:
        qids = _players_matching_category(key, players, data_by_name, agg_pg)
        if len(qids) >= 3:
            stat_col_candidates.append(f"stat:{key}")

    pos_col_candidates = []
    # Use position groups (not individual positions to avoid overlap)
    for grp in pos_groups_in_use:
        pos_col_candidates.append(f"pos_group:{grp}")
    # Add specific positions only if position group doesn't exist
    for pos in positions_in_use:
        grp = POSITION_GROUPS.get(pos)
        if not grp or f"pos_group:{grp}" not in pos_col_candidates:
            pos_col_candidates.append(f"pos:{pos}")

    col_candidates = stat_col_candidates + pos_col_candidates
    random.shuffle(stat_col_candidates)
    random.shuffle(pos_col_candidates)

    # Pre-compute player IDs per category for fast lookup
    cat_players: dict = {}
    row_cats = [f"team:{tc}" for tc in team_codes]
    all_cats = row_cats + col_candidates
    for cat in all_cats:
        real_cat = cat[5:] if cat.startswith("stat:") else cat
        cat_players[cat] = _players_matching_category(real_cat, players, data_by_name, agg_pg)

    # Find 3 rows (teams) and 3 cols where all 9 cells have ≥1 valid answer
    # Try to guarantee at least 1 stat threshold column when available
    chosen_rows = None
    chosen_cols = None
    random.shuffle(team_codes)

    for _ in range(300):
        r3 = random.sample(row_cats, min(3, len(row_cats)))
        if len(col_candidates) < 3:
            break
        # Build c3: prefer 1-2 stat cols + rest position cols
        if stat_col_candidates and pos_col_candidates:
            n_stat = random.randint(1, min(2, len(stat_col_candidates)))
            n_pos = 3 - n_stat
            c3 = random.sample(stat_col_candidates, min(n_stat, len(stat_col_candidates))) + \
                 random.sample(pos_col_candidates, min(n_pos, len(pos_col_candidates)))
            random.shuffle(c3)
        else:
            c3 = random.sample(col_candidates, min(3, len(col_candidates)))
        ok = True
        for r in r3:
            r_ids = set(cat_players.get(r, []))
            for c in c3:
                c_ids = set(cat_players.get(c, []))
                if not (r_ids & c_ids):
                    ok = False
                    break
            if not ok:
                break
        if ok:
            chosen_rows = r3
            chosen_cols = c3
            break

    # Fallback: pure team × position grid
    if not chosen_rows:
        positions_shuffled = list(positions_in_use)
        random.shuffle(positions_shuffled)
        chosen_rows = [f"team:{tc}" for tc in team_codes[:3]]
        chosen_cols = [f"pos:{pos}" for pos in positions_shuffled[:3]]

    # Build valid_answers map (intersection of row and col player sets)
    valid_answers = {}
    for ri, r in enumerate(chosen_rows):
        r_ids = set(cat_players.get(r, []))
        for ci, c in enumerate(chosen_cols):
            c_ids = set(cat_players.get(c, []))
            valid_answers[f"{ri},{ci}"] = list(r_ids & c_ids)

    # Strip "stat:" prefix from stored cols for label resolution
    stored_cols = [c[5:] if c.startswith("stat:") else c for c in chosen_cols]

    return {
        "rows": chosen_rows,
        "cols": stored_cols,
        "row_labels": {r: _category_label(r) for r in chosen_rows},
        "col_labels": {c: _category_label(c) for c in stored_cols},
        "valid_answers": valid_answers,
        "max_misses": 9,
    }


def validate_grid_answer(challenge_data: dict, row: int, col: int, player_id: int) -> bool:
    """Return True if player_id is a valid answer for grid cell (row, col)."""
    key = f"{row},{col}"
    return player_id in challenge_data.get("valid_answers", {}).get(key, [])


def get_grid_cell_answer_count(challenge_data: dict, row: int, col: int, player_id: int, results) -> int:
    """Return how many users picked this player_id for this cell (for rarity score)."""
    count = 0
    key = f"{row},{col}"
    for r in results:
        cell_picks = r.result_data.get("picks", {})
        if cell_picks.get(key, {}).get("player_id") == player_id:
            count += 1
    return count


def get_grid_pick_pct(challenge_id: int, result) -> dict:
    """
    For a completed result, return pick_pct per cell: what % of completers chose the same player.
    cell_key -> float (0-100). Refreshed each time so returning users see updated %.
    """
    if not result or not result.completed:
        return {}
    from ..models.fan_games import FanGameResult
    completed = FanGameResult.query.filter_by(challenge_id=challenge_id, completed=True).all()
    total = len(completed)
    if total == 0:
        return {}
    picks = result.result_data.get("picks", {})
    out = {}
    for cell_key, pick in picks.items():
        if not pick.get("correct"):
            continue
        pid = pick.get("player_id")
        if pid is None:
            continue
        count = sum(
            1 for r in completed
            if r.result_data.get("picks", {}).get(cell_key, {}).get("player_id") == pid
        )
        out[cell_key] = round(100.0 * count / total, 1)
    return out


# ── Guess the Player ──────────────────────────────────────────────────────────

def _player_bats_throws(player):
    """Resolve bats/throws from roster_bats_throws (e.g. 'L/R') or separate columns."""
    rbt = getattr(player, "roster_bats_throws", None) or ""
    if rbt and "/" in rbt:
        parts = rbt.strip().split("/", 1)
        return (parts[0].strip() or None, parts[1].strip() if len(parts) > 1 else None)
    return (player.bats, player.throws)


def generate_guess_challenge(challenge_date: date) -> dict:
    """
    Pick a random active player as the mystery player.
    Stores full clue (team, division, position, bats, throws, jersey, height, weight)
    for feedback comparison. Nothing is revealed upfront — all attributes shown via per-guess comparison.
    """
    players = Player.query.filter_by(active=True).all()
    if not players:
        raise ValueError("No players available")

    target = random.choice(players)
    bats, throws = _player_bats_throws(target)
    team = target.team
    roster = None

    try:
        from .data_db import get_roster_for_player_by_name, get_latest_season
        data_season = get_latest_season()
        roster = get_roster_for_player_by_name(target.full_name, season=data_season) if data_season else None
        if roster:
            rbt = (roster.get("roster_bats_throws") or "").strip()
            if rbt and "/" in rbt:
                parts = rbt.split("/", 1)
                bats = parts[0].strip() or bats
                throws = parts[1].strip() if len(parts) > 1 else throws
    except Exception:
        pass

    clue = {
        "team_code": team.team_code if team else None,
        "team_name": team.team_name if team else None,
        "position": target.primary_position,
        "bats": bats,
        "throws": throws,
        "division": (roster.get("division") if roster else None) or getattr(team, "division", None),
        "jersey": roster.get("roster_jersey") if roster else None,
        "height": roster.get("roster_height") if roster else None,
        "weight": roster.get("roster_weight") if roster else None,
    }

    return {
        "player_id": target.id,
        "player_name": target.full_name,  # hidden from public response
        "clue": clue,
        "max_guesses": 8,
    }


def _height_to_inches(h):
    """Parse '5-11' or '6-2' height string to total inches. Returns None if unparseable."""
    if not h:
        return None
    m = re.match(r"(\d+)-(\d+)", str(h).strip())
    return int(m.group(1)) * 12 + int(m.group(2)) if m else None


def _weight_to_lbs(w):
    """Parse '185 lbs' or '185' to integer pounds. Returns None if unparseable."""
    if not w:
        return None
    m = re.match(r"(\d+)", str(w).strip())
    return int(m.group(1)) if m else None


def _jersey_to_int(j):
    """Parse '#24' or '24' to integer. Returns None if unparseable."""
    if not j:
        return None
    m = re.match(r"#?(\d+)", str(j).strip())
    return int(m.group(1)) if m else None


def _numeric_match(guessed_val, target_val):
    """Return 'exact', 'high' (guessed too high), 'low' (guessed too low), or 'unknown'."""
    if guessed_val is None or target_val is None:
        return "unknown"
    if guessed_val == target_val:
        return "exact"
    return "high" if guessed_val > target_val else "low"


def get_guess_feedback(challenge_data: dict, guessed_player_id: int) -> dict:
    """
    Return full attribute comparison for a guess vs the mystery player.
    All attributes (team, division, position, bats, throws, jersey, height, weight) are compared.
    Height/weight use directional matching (high/low) in addition to exact.
    """
    target_id = challenge_data["player_id"]
    clue = challenge_data["clue"]

    guessed = Player.query.get(guessed_player_id)
    if not guessed:
        return None

    guessed_bats, guessed_throws = _player_bats_throws(guessed)
    guessed_division = None
    guessed_jersey = None
    guessed_height = None
    guessed_weight = None

    try:
        from .data_db import get_roster_for_player_by_name, get_latest_season
        data_season = get_latest_season()
        roster = get_roster_for_player_by_name(guessed.full_name, season=data_season) if data_season else None
        if roster:
            rbt = (roster.get("roster_bats_throws") or "").strip()
            if rbt and "/" in rbt:
                parts = rbt.split("/", 1)
                guessed_bats = parts[0].strip() or guessed_bats
                guessed_throws = parts[1].strip() if len(parts) > 1 else guessed_throws
            guessed_division = roster.get("division")
            guessed_jersey = roster.get("roster_jersey")
            guessed_height = roster.get("roster_height")
            guessed_weight = roster.get("roster_weight")
    except Exception:
        pass

    correct = guessed.id == target_id

    return {
        "guessed_player": {
            "id": guessed.id,
            "full_name": guessed.full_name,
            "team_code": guessed.team.team_code if guessed.team else None,
            "team_name": guessed.team.team_name if guessed.team else None,
            "position": guessed.primary_position,
            "division": guessed_division,
            "bats": guessed_bats,
            "throws": guessed_throws,
            "jersey": guessed_jersey,
            "height": guessed_height,
            "weight": guessed_weight,
        },
        "feedback": {
            "team": "exact" if (guessed.team and guessed.team.team_code == clue.get("team_code")) else "wrong",
            "position": "exact" if guessed.primary_position == clue.get("position") else (
                "close" if POSITION_GROUPS.get(guessed.primary_position) == POSITION_GROUPS.get(clue.get("position")) else "wrong"
            ),
            "division": "exact" if guessed_division and guessed_division == clue.get("division") else "wrong",
            "bats": "exact" if guessed_bats == clue.get("bats") else "wrong",
            "throws": "exact" if guessed_throws == clue.get("throws") else "wrong",
            "jersey": _numeric_match(_jersey_to_int(guessed_jersey), _jersey_to_int(clue.get("jersey"))),
            "height": _numeric_match(_height_to_inches(guessed_height), _height_to_inches(clue.get("height"))),
            "weight": _numeric_match(_weight_to_lbs(guessed_weight), _weight_to_lbs(clue.get("weight"))),
        },
        "correct": correct,
    }


# ── Target Line Challenge ─────────────────────────────────────────────────────

MAX_TARGET_PLAYERS = 15


def generate_target_challenge(challenge_date: date) -> dict:
    """Generate daily target: randomly select 8 player-seasons from data.db (AB>=100), sum them."""
    season = None
    try:
        from .data_db import get_latest_season
        season = get_latest_season()  # e.g. "ALPB- 2025" — None if data.db unavailable
    except Exception:
        pass

    target = None
    label = "Target line"
    if season:
        try:
            from .data_db import get_random_target_from_season
            seed = challenge_date.toordinal()
            target, label = get_random_target_from_season(season, n_players=8, seed=seed)
        except Exception:
            pass

    if not target:
        target = {"HR": 20, "H": 220, "RBI": 60, "SB": 12}
        label = "Target line"

    return {
        "target": target,
        "label": label,
        "season": season,  # None when data.db unavailable — frontend handles gracefully
        "max_players": MAX_TARGET_PLAYERS,
        "time_limit_seconds": 90,
    }


def score_target_submission(target: dict, selected_players: list) -> dict:
    """
    Score a user's selected player list against the target.
    Returns totals and a closeness score (100 = perfect, 0 = worst).
    Handles any stat keys in target (HR, H, RBI, SB, R, BB, etc.).
    """
    totals = {stat: 0 for stat in target}
    for p in selected_players:
        s = p.get("stats", {})
        for stat in target:
            totals[stat] = totals.get(stat, 0) + (s.get(stat, 0) or 0)

    n_stats = len([v for v in target.values() if v > 0])
    points_per_stat = 100.0 / n_stats if n_stats > 0 else 0
    score = 100.0
    for stat, tgt_val in target.items():
        if tgt_val == 0:
            continue
        actual = totals.get(stat, 0)
        diff_pct = abs(actual - tgt_val) / tgt_val
        deduction = min(points_per_stat, diff_pct * points_per_stat)
        score -= deduction

    score = max(0.0, round(score, 2))
    return {"totals": totals, "score": score}


def get_player_career_stats(player_id: int) -> dict:
    """Aggregate all game stats for a player across all games (postgres)."""
    agg = _aggregate_player_stats()
    return agg.get(player_id, {
        "HR": 0, "SB": 0, "H": 0, "RBI": 0,
        "K": 0, "IP": 0.0, "R": 0, "BB": 0,
        "1B": 0, "2B": 0, "3B": 0,
    })


def get_player_season_stats_from_data_db(player_id: int, season: str) -> dict | None:
    """Get season stats from data.db: use external_player_id, or resolve player_id from players table (player_url)."""
    p = Player.query.get(player_id)
    if not p:
        return None
    try:
        from .data_db import get_batter_season_stats, get_player_id_from_players_table
        data_id = str(p.external_player_id) if p.external_player_id else get_player_id_from_players_table(p.full_name, season)
        if not data_id:
            return None
        key = (data_id, season)
        stats_map = get_batter_season_stats()
        return stats_map.get(key)
    except Exception:
        return None


# ── Higher or Lower ───────────────────────────────────────────────────────────

HIGHER_LOWER_STATS = {
    "batters": ["HR", "H", "RBI", "SB", "R", "BB"],
    "pitchers": ["K", "IP", "ER"],
}

STAT_DISPLAY = {
    "HR": "Home Runs", "H": "Hits", "RBI": "RBI",
    "SB": "Stolen Bases", "R": "Runs", "BB": "Walks",
    "K": "Strikeouts", "IP": "Innings Pitched", "ER": "Earned Runs",
}


def _higher_lower_agg():
    """Stats for higher/lower: uses data.db career stats matched by name (single bulk query)."""
    agg_pg = _aggregate_player_stats()
    active_players = Player.query.filter_by(active=True).all()
    players = active_players if len(active_players) >= 2 else Player.query.all()
    # Single bulk lookup — no per-player queries
    data_by_name = _load_data_db_career_stats_by_name()
    out = {}
    for p in players:
        s = data_by_name.get((p.full_name or "").strip().lower()) or agg_pg.get(p.id, {})
        out[p.id] = {
            "HR": s.get("HR", 0), "H": s.get("H", 0), "RBI": s.get("RBI", 0), "SB": s.get("SB", 0),
            "R": s.get("R", 0), "BB": s.get("BB", 0), "K": 0, "IP": 0.0, "ER": 0,
        }
    return out


def get_available_regular_seasons():
    """Return list of {season, year} dicts for all available regular ALPB seasons."""
    try:
        from .data_db import get_available_seasons, _year_from_season
        all_seasons = get_available_seasons()
        regular = [s for s in all_seasons
                   if s.strip().upper().startswith("ALPB")
                   and "TRAINING" not in s.upper()
                   and "PLAYOFF" not in s.upper()]
        return [{"season": s, "year": _year_from_season(s)} for s in regular]
    except Exception:
        return []


def get_higher_lower_pair(allowed_seasons=None) -> dict:
    """
    Pick two players and a stat to compare, each from independently chosen seasons.
    allowed_seasons: list of season strings to filter by; None/empty = all regular seasons.
    Each player can be from a different season.
    """
    active_players = Player.query.filter_by(active=True).all()
    all_players = active_players if len(active_players) >= 2 else Player.query.all()
    if len(all_players) < 2:
        return None

    name_to_player = {(p.full_name or "").strip().lower(): p for p in all_players}

    # Determine which regular seasons to use
    regular = []
    try:
        from .data_db import get_available_seasons, _year_from_season
        all_seasons = get_available_seasons()
        regular = [s for s in all_seasons
                   if s.strip().upper().startswith("ALPB")
                   and "TRAINING" not in s.upper()
                   and "PLAYOFF" not in s.upper()]
        if allowed_seasons:
            filtered = [s for s in regular if s in allowed_seasons]
            if filtered:
                regular = filtered
    except Exception:
        pass

    # Build pool: one entry per (player, season) combination
    # pool entry: (Player, stats_dict, season_str, season_year)
    pool = []
    if regular:
        try:
            from .data_db import get_season_stats_by_roster_name, _year_from_season
            for season_str in regular:
                season_year = _year_from_season(season_str)
                data_by_name = get_season_stats_by_roster_name(season_str)
                for name_lower, stats in data_by_name.items():
                    p = name_to_player.get(name_lower)
                    if p and any(stats.get(k, 0) > 0 for k in ("H", "HR", "RBI", "SB", "R", "BB")):
                        pool.append((p, stats, season_str, season_year))
        except Exception:
            pass

    # Fall back to career stats if pool too small
    if len(pool) < 2:
        agg = _higher_lower_agg()
        pool = [(p, agg.get(p.id, {}), None, None) for p in all_players]

    if len(pool) < 2:
        return None

    # Sample two entries; retry to avoid same player twice
    entry1, entry2 = pool[0], pool[1]
    for _ in range(50):
        entry1, entry2 = random.sample(pool, 2)
        if entry1[0].id != entry2[0].id:
            break

    p1, s1, season1, year1 = entry1
    p2, s2, season2, year2 = entry2

    # Choose a relevant stat based on positions
    if p1.primary_position == "P" and p2.primary_position == "P":
        stat_key = random.choice(HIGHER_LOWER_STATS["pitchers"])
    elif p1.primary_position != "P" and p2.primary_position != "P":
        stat_key = random.choice(HIGHER_LOWER_STATS["batters"])
    else:
        stat_key = random.choice(["H", "R"])

    val1 = s1.get(stat_key, 0)
    val2 = s2.get(stat_key, 0)
    correct = "higher" if val2 >= val1 else "lower"

    return {
        "stat_key": stat_key,
        "stat_label": STAT_DISPLAY.get(stat_key, stat_key),
        "player_a": {
            "id": p1.id,
            "full_name": p1.full_name,
            "team": p1.team.team_code if p1.team else None,
            "team_name": p1.team.team_name if p1.team else None,
            "position": p1.primary_position,
            "value": val1,
            "season": season1,
            "season_year": year1,
        },
        "player_b": {
            "id": p2.id,
            "full_name": p2.full_name,
            "team": p2.team.team_code if p2.team else None,
            "team_name": p2.team.team_name if p2.team else None,
            "position": p2.primary_position,
            "season": season2,
            "season_year": year2,
            # value hidden until user answers
        },
        "_correct": correct,
        "_value_b": val2,
    }

# ── Connections: ALPB Edition ─────────────────────────────────────────────────

DIFFICULTY_COLORS = {1: "yellow", 2: "green", 3: "blue", 4: "purple"}


def generate_connections_challenge(challenge_date):
    """
    16-item board split into 4 groups of 4.
    Groups: 2 team-based + 2 position-based.
    """
    random.seed(challenge_date.toordinal())
    players = Player.query.filter_by(active=True).all()
    random.shuffle(players)
    random.seed()

    used_ids = set()
    groups = []

    team_players = defaultdict(list)
    for p in players:
        if p.team_id:
            team_players[p.team_id].append(p)

    pos_players = defaultdict(list)
    for p in players:
        pos_players[p.primary_position].append(p)

    team_list = list(team_players.items())
    random.shuffle(team_list)

    for difficulty, (tid, tplayers) in enumerate(team_list[:2], start=1):
        eligible = [p for p in tplayers if p.id not in used_ids]
        if len(eligible) < 4:
            continue
        selected = random.sample(eligible, 4)
        for p in selected:
            used_ids.add(p.id)
        team = Team.query.get(tid)
        groups.append({
            "id": f"team_{tid}",
            "category": team.team_name if team else f"Team {tid}",
            "category_hint": "Same Team",
            "difficulty": difficulty,
            "color": DIFFICULTY_COLORS[difficulty],
            "items": [p.full_name for p in selected],
            "item_ids": [p.id for p in selected],
        })

    pos_list = list(pos_players.items())
    random.shuffle(pos_list)

    added_pos = 0
    for pos, plist in pos_list:
        if added_pos >= 2:
            break
        eligible = [p for p in plist if p.id not in used_ids]
        if len(eligible) < 4:
            continue
        selected = random.sample(eligible, 4)
        for p in selected:
            used_ids.add(p.id)
        difficulty = 3 + added_pos
        groups.append({
            "id": f"pos_{pos}",
            "category": f"{POSITION_LABELS.get(pos, pos)} Players",
            "category_hint": "Same Position",
            "difficulty": difficulty,
            "color": DIFFICULTY_COLORS[difficulty],
            "items": [p.full_name for p in selected],
            "item_ids": [p.id for p in selected],
        })
        added_pos += 1

    if len(groups) < 4:
        raise ValueError("Not enough data to generate connections challenge")

    all_items = []
    for g in groups:
        for name in g["items"]:
            all_items.append({"name": name, "group_id": g["id"]})
    random.shuffle(all_items)

    return {
        "items": all_items,
        "groups": [
            {
                "id": g["id"],
                "category": g["category"],
                "category_hint": g["category_hint"],
                "difficulty": g["difficulty"],
                "color": g["color"],
            }
            for g in groups
        ],
        "answers": {
            g["id"]: {"names": g["items"], "ids": g["item_ids"]}
            for g in groups
        },
        "max_mistakes": 4,
    }


def validate_connections_group(challenge_data, group_id, submitted_names):
    """True if submitted_names exactly matches the group answer set."""
    answers = challenge_data.get("answers", {})
    group_answer = answers.get(group_id)
    if not group_answer:
        return False
    return set(group_answer["names"]) == set(submitted_names)


# ── Name the Roster ───────────────────────────────────────────────────────────

def generate_roster_challenge(challenge_date):
    """Pick today's featured team for the Name the Roster challenge.
    Picks a random ALPB regular season (not always the latest) seeded by date."""
    teams = Team.query.all()
    if not teams:
        raise ValueError("No teams available")
    season = None
    try:
        from .data_db import get_available_seasons
        all_seasons = get_available_seasons()
        # Only regular ALPB seasons (not spring training or playoffs)
        regular = [s for s in all_seasons
                   if s.strip().upper().startswith("ALPB")
                   and "TRAINING" not in s.upper()
                   and "PLAYOFF" not in s.upper()]
        if regular:
            random.seed(challenge_date.toordinal())
            season = random.choice(regular)
            random.seed()
    except Exception:
        pass
    random.seed(challenge_date.toordinal() + 1)  # +1 so team pick differs from season pick
    team = random.choice(teams)
    random.seed()
    players = Player.query.filter_by(team_id=team.id, active=True).all()
    return {
        "team_code": team.team_code,
        "team_name": team.team_name,
        "season": season,
        "roster": [p.full_name for p in players],   # hidden from public
        "roster_ids": [p.id for p in players],
        "player_count": len(players),
        "time_limit_seconds": 120,
    }


def check_roster_guess(challenge_data, name_guess):
    """
    Check if name_guess matches any player on the hidden roster.
    Accepts last-name-only, first-name-only, or partial matches (4+ chars).
    """
    roster = challenge_data.get("roster", [])
    guess = name_guess.strip().lower()
    if not guess:
        return {"found": False, "player_name": None}
    for player_name in roster:
        pn_lower = player_name.lower()
        parts = pn_lower.split()
        if guess == pn_lower:
            return {"found": True, "player_name": player_name}
        if parts and guess == parts[-1]:
            return {"found": True, "player_name": player_name}
        if parts and guess == parts[0]:
            return {"found": True, "player_name": player_name}
        if len(guess) >= 4 and guess in pn_lower:
            return {"found": True, "player_name": player_name}
    return {"found": False, "player_name": None}


# ── Franchise Journey ─────────────────────────────────────────────────────────

TEAM_GEO = {
    "HAG": "Maryland", "LAN": "Pennsylvania", "LID": "New York",
    "SIF": "New York", "YRK": "Pennsylvania", "CHS": "West Virginia",
    "GAS": "North Carolina", "HPT": "North Carolina",
    "LEX": "Kentucky", "SOM": "Maryland",
}

TEAM_REGION = {
    "HAG": "Mid-Atlantic", "LAN": "Mid-Atlantic", "LID": "Northeast",
    "SIF": "Northeast", "YRK": "Mid-Atlantic", "CHS": "Southeast",
    "GAS": "Southeast", "HPT": "Southeast", "LEX": "Southeast",
    "SOM": "Mid-Atlantic",
}


def generate_journey_challenge(challenge_date):
    """
    Mystery player with a 6-clue progressive reveal.
    Clues go from vague (region) to specific (name hint).
    """
    players = Player.query.filter_by(active=True).all()
    if not players:
        raise ValueError("No players available")
    random.seed(challenge_date.toordinal())
    target = random.choice(players)
    random.seed()

    pos_group = POSITION_GROUPS.get(target.primary_position, "player")
    team_code = target.team.team_code if target.team else ""
    team_name = target.team.team_name if target.team else "an ALPB team"
    geo = TEAM_GEO.get(team_code, "the Eastern United States")
    region = TEAM_REGION.get(team_code, "the Atlantic League")
    name_parts = target.full_name.split()
    last_name = name_parts[-1] if name_parts else target.full_name
    first_name = name_parts[0] if name_parts else ""
    bats_info = (f", bats {target.bats}" if target.bats else "")
    pos_label = POSITION_LABELS.get(target.primary_position, target.primary_position)

    clues = [
        {"number": 1, "text": f"This player is on an active ALPB roster in the {region} region."},
        {"number": 2, "text": f"This player lines up as a {pos_group}."},
        {"number": 3, "text": f"Their franchise is based in {geo}."},
        {"number": 4, "text": f"Primary position: {pos_label}{bats_info}."},
        {"number": 5, "text": f"They wear the uniform of the {team_name}."},
        {
            "number": 6,
            "text": (
                f"Last name: {len(last_name)} letters, starts with '{last_name[0].upper()}'. "
                f"First name starts with '{first_name[0].upper() if first_name else '?'}'."
            ),
        },
    ]

    return {
        "player_id": target.id,
        "player_name": target.full_name,   # hidden from public
        "clues": clues,
        "max_clues": len(clues),
        "max_guesses": 6,
    }


def get_journey_feedback(challenge_data, guessed_player_id):
    """Validate a guess; return feedback dict."""
    target_id = challenge_data["player_id"]
    guessed = Player.query.get(guessed_player_id)
    if not guessed:
        return None
    return {
        "guessed_player": {
            "id": guessed.id,
            "full_name": guessed.full_name,
            "team": guessed.team.team_code if guessed.team else None,
            "team_name": guessed.team.team_name if guessed.team else None,
            "position": guessed.primary_position,
        },
        "correct": guessed.id == target_id,
    }
