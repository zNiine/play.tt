"""
Read-only service for data.db (SQLite): batters season/career stats, players roster info.
Path: backend/data.db (or DATA_DB_PATH env).
"""
import os
import re
import sqlite3
import random
from datetime import datetime
_DATA_DB_PATH = None


def extract_player_id_from_player_url(player_url):
    """Extract player id from player_url e.g. '...playerid=1747602&...' -> '1747602'."""
    if not player_url:
        return None
    m = re.search(r"playerid=(\d+)", player_url, re.IGNORECASE)
    return m.group(1) if m else None


def _get_path():
    global _DATA_DB_PATH
    if _DATA_DB_PATH is None:
        _DATA_DB_PATH = os.environ.get(
            "DATA_DB_PATH",
            os.path.join(os.path.dirname(__file__), "..", "..", "data.db"),
        )
    return _DATA_DB_PATH


def _conn():
    path = _get_path()
    if not os.path.exists(path):
        return None
    return sqlite3.connect(path, detect_types=sqlite3.PARSE_DECLTYPES)


def _year_from_season(season_str):
    """Extract 4-digit calendar year from season string (e.g. 'ALPB- 2025' -> 2025, '2025' -> 2025)."""
    if not season_str:
        return None
    s = str(season_str).strip()
    # Find last 4-digit sequence (must be exactly 4 digits)
    for i in range(len(s) - 3, -1, -1):
        chunk = s[i:i + 4]
        if len(chunk) == 4 and chunk.isdigit():
            return int(chunk)
    return None


def get_available_seasons():
    """Return list of distinct seasons from batters table (that have data), newest first.
    Prefers regular ALPB seasons (ALPB- prefix) over playoffs/spring training.
    Excludes future years."""
    c = _conn()
    if not c:
        return []
    try:
        rows = c.execute(
            "SELECT DISTINCT season FROM batters WHERE season IS NOT NULL AND trim(season) != '' LIMIT 100"
        ).fetchall()
        this_year = datetime.now().year
        valid = []
        for (s,) in rows:
            y = _year_from_season(s)
            if y is not None and y <= this_year:
                valid.append((y, s))
        # Sort: regular seasons (ALPB prefix) first, then by year descending
        def sort_key(item):
            y, s = item
            is_regular = 1 if (s.strip().upper().startswith("ALPB") and "TRAINING" not in s.upper()
                               and "PLAYOFF" not in s.upper() and "WORLD" not in s.upper()
                               and "PRE" not in s.upper()) else 0
            return (-y, -is_regular)
        valid.sort(key=sort_key)
        return [s for _, s in valid]
    finally:
        c.close()


def get_latest_season():
    """Return the most recent season string from data (e.g. 'ALPB- 2025')."""
    seasons = get_available_seasons()
    return seasons[0] if seasons else None


def _safe_float(v, default=0):
    if v is None or v == "":
        return default
    try:
        return float(v)
    except (ValueError, TypeError):
        return default


def _safe_int(v, default=0):
    if v is None or v == "":
        return default
    try:
        return int(float(v))
    except (ValueError, TypeError):
        return default


def get_batter_season_stats():
    """
    Aggregate batters table by player_id + season. Returns dict:
    (player_id, season) -> { AB, H, HR, RBI, SB, BB, R, AVG, OBP, ... }
    """
    c = _conn()
    if not c:
        return {}
    try:
        rows = c.execute("""
            SELECT player_id, player, season,
                   SUM(CAST(NULLIF(trim(ab), '') AS REAL)),
                   SUM(CAST(NULLIF(trim(h), '') AS REAL)),
                   SUM(CAST(NULLIF(trim(hr), '') AS REAL)),
                   SUM(CAST(NULLIF(trim(rbi), '') AS REAL)),
                   SUM(CAST(NULLIF(trim(sb), '') AS REAL)),
                   SUM(CAST(NULLIF(trim(bb), '') AS REAL)),
                   SUM(CAST(NULLIF(trim(r), '') AS REAL)),
                   SUM(CAST(NULLIF(trim(so), '') AS REAL))
            FROM batters WHERE log_type = 'batting' AND player_id IS NOT NULL AND trim(player_id) != ''
            GROUP BY player_id, season
        """).fetchall()
        out = {}
        for r in rows:
            player_id, player_name, season = str(r[0]), r[1], r[2]
            ab = _safe_float(r[3])
            h = _safe_float(r[4])
            hr = _safe_int(r[5])
            rbi = _safe_int(r[6])
            sb = _safe_int(r[7])
            bb = _safe_int(r[8])
            runs = _safe_int(r[9])
            so = _safe_int(r[10])
            avg = round(h / ab, 3) if ab and ab > 0 else 0.0
            # OBP approx: (H+BB)/(AB+BB) for simplicity (ignoring HP, SF)
            pa = ab + bb
            obp = round((h + bb) / pa, 3) if pa and pa > 0 else 0.0
            key = (player_id, season)
            out[key] = {
                "player_id": player_id,
                "player_name": player_name,
                "season": season,
                "AB": int(ab), "H": int(h), "HR": hr, "RBI": rbi, "SB": sb, "BB": bb, "R": runs, "SO": so,
                "AVG": avg, "OBP": obp,
            }
        return out
    finally:
        c.close()


def get_career_stats_by_roster_name():
    """
    Career stats keyed by roster_player_name (full 'First Last' format from players table).
    Joins players table (for name + player_url) to batters (for stats via player_id).
    Returns dict: roster_player_name.lower() -> stats dict.
    """
    c = _conn()
    if not c:
        return {}
    try:
        # Get player_id mapping from players table (player_url -> playerid)
        # players.player_url: "...playerid=1750058&..." -> player_id="1750058"
        rows = c.execute("""
            SELECT DISTINCT roster_player_name, player_url
            FROM players
            WHERE roster_player_name IS NOT NULL AND trim(roster_player_name) != ''
              AND player_url IS NOT NULL AND player_url LIKE '%playerid=%'
        """).fetchall()
        # Extract player_id from URL
        import re as _re
        name_to_pid = {}
        for roster_name, player_url in rows:
            m = _re.search(r"playerid=(\d+)", player_url, _re.IGNORECASE)
            if m:
                pid = m.group(1)
                name_lower = roster_name.strip().lower()
                name_to_pid[name_lower] = pid

        if not name_to_pid:
            return {}

        # Aggregate batters stats by player_id
        batter_rows = c.execute("""
            SELECT player_id,
                   SUM(CAST(NULLIF(trim(ab), '') AS REAL)),
                   SUM(CAST(NULLIF(trim(h), '') AS REAL)),
                   SUM(CAST(NULLIF(trim(hr), '') AS REAL)),
                   SUM(CAST(NULLIF(trim(rbi), '') AS REAL)),
                   SUM(CAST(NULLIF(trim(sb), '') AS REAL)),
                   SUM(CAST(NULLIF(trim(bb), '') AS REAL)),
                   SUM(CAST(NULLIF(trim(r), '') AS REAL)),
                   SUM(CAST(NULLIF(trim(so), '') AS REAL))
            FROM batters WHERE log_type = 'batting' AND player_id IS NOT NULL AND trim(player_id) != ''
            GROUP BY player_id
        """).fetchall()
        pid_to_stats = {}
        for row in batter_rows:
            pid = str(row[0])
            ab = _safe_float(row[1])
            h = _safe_float(row[2])
            pid_to_stats[pid] = {
                "AB": int(ab), "H": int(h),
                "HR": _safe_int(row[3]), "RBI": _safe_int(row[4]), "SB": _safe_int(row[5]),
                "BB": _safe_int(row[6]), "R": _safe_int(row[7]), "SO": _safe_int(row[8]),
            }

        out = {}
        for name_lower, pid in name_to_pid.items():
            if pid in pid_to_stats:
                out[name_lower] = pid_to_stats[pid]
        return out
    finally:
        c.close()


def get_batter_career_stats():
    """Aggregate batters by player_id (all seasons). player_id -> stats dict."""
    c = _conn()
    if not c:
        return {}
    try:
        rows = c.execute("""
            SELECT player_id, player,
                   SUM(CAST(NULLIF(trim(ab), '') AS REAL)),
                   SUM(CAST(NULLIF(trim(h), '') AS REAL)),
                   SUM(CAST(NULLIF(trim(hr), '') AS REAL)),
                   SUM(CAST(NULLIF(trim(rbi), '') AS REAL)),
                   SUM(CAST(NULLIF(trim(sb), '') AS REAL)),
                   SUM(CAST(NULLIF(trim(bb), '') AS REAL)),
                   SUM(CAST(NULLIF(trim(r), '') AS REAL)),
                   SUM(CAST(NULLIF(trim(so), '') AS REAL))
            FROM batters WHERE log_type = 'batting' AND player_id IS NOT NULL AND trim(player_id) != ''
            GROUP BY player_id
        """).fetchall()
        out = {}
        for r in rows:
            player_id = str(r[0])
            ab = _safe_float(r[2])
            h = _safe_float(r[3])
            out[player_id] = {
                "player_id": player_id,
                "player_name": r[1],
                "AB": int(ab), "H": int(h),
                "HR": _safe_int(r[4]), "RBI": _safe_int(r[5]), "SB": _safe_int(r[6]),
                "BB": _safe_int(r[7]), "R": _safe_int(r[8]), "SO": _safe_int(r[9]),
                "AVG": round(h / ab, 3) if ab and ab > 0 else 0.0,
            }
        return out
    finally:
        c.close()


def get_players_roster_by_season(season=None):
    """
    From data.db 'players' table: roster_bats_throws, roster_height, roster_weight, roster_jersey, division, team.
    Returns list of dicts with player_id (from profile or roster), roster_* fields.
    If season is None, use latest.
    """
    c = _conn()
    if not c:
        return []
    season = season or get_latest_season()
    if not season:
        return []
    try:
        rows = c.execute("""
            SELECT roster_player_name, roster_bats_throws, roster_height, roster_weight, roster_jersey, division, team, team_id
            FROM players WHERE season = ?
        """, (season,)).fetchall()
        return [
            {"roster_player_name": r[0], "roster_bats_throws": r[1] or None, "roster_height": r[2] or None,
             "roster_weight": r[3] or None, "roster_jersey": r[4] or None, "division": r[5] or None,
             "team": r[6] or None, "team_id": r[7] or None, "season": season}
            for r in rows
        ]
    finally:
        c.close()


def get_player_id_from_players_table(roster_player_name, season=None):
    """Resolve data.db player_id from players table: extract from player_url (playerid=1747602)."""
    c = _conn()
    if not c:
        return None
    season = season or get_latest_season()
    if not season:
        return None
    try:
        name_clean = (roster_player_name or "").strip()
        rows = c.execute("SELECT player_url FROM players WHERE season = ? AND (roster_player_name = ? OR roster_player_name LIKE ?) LIMIT 1",
                         (season, name_clean, f"%{name_clean}%")).fetchall()
        if not rows:
            parts = name_clean.split()
            if len(parts) >= 2:
                rev = f"{parts[-1]}, {' '.join(parts[:-1])}"
                rows = c.execute("SELECT player_url FROM players WHERE season = ? AND roster_player_name = ? LIMIT 1", (season, rev)).fetchall()
        if rows and rows[0][0]:
            return extract_player_id_from_player_url(rows[0][0])
        return None
    finally:
        c.close()


def get_roster_for_player_by_name(player_name, season=None):
    """Get roster_bats_throws, height, weight, jersey, division, and player_id (from player_url) for a player by name."""
    c = _conn()
    if not c:
        return None
    season = season or get_latest_season()
    if not season:
        return None
    try:
        name_clean = (player_name or "").strip()
        rows = c.execute("""
            SELECT roster_bats_throws, roster_height, roster_weight, roster_jersey, division, team, player_url
            FROM players WHERE season = ? AND (
                roster_player_name = ? OR
                roster_player_name LIKE ? OR
                replace(replace(roster_player_name, ', ', ' '), ' ', '') = replace(replace(?, ' ', ''), ',', '')
            ) LIMIT 1
        """, (season, name_clean, f"%{name_clean}%", name_clean.replace(",", " "))).fetchall()
        if not rows:
            parts = name_clean.split()
            if len(parts) >= 2:
                rev = f"{parts[-1]}, {' '.join(parts[:-1])}"
                rows = c.execute("SELECT roster_bats_throws, roster_height, roster_weight, roster_jersey, division, team, player_url FROM players WHERE season = ? AND roster_player_name = ? LIMIT 1", (season, rev)).fetchall()
        if rows:
            r = rows[0]
            player_id = extract_player_id_from_player_url(r[6]) if len(r) > 6 and r[6] else None
            return {
                "roster_bats_throws": r[0] or None,
                "roster_height": r[1] or None,
                "roster_weight": r[2] or None,
                "roster_jersey": r[3] or None,
                "division": r[4] or None,
                "team": r[5] or None,
                "season": season,
                "player_id": player_id,
            }
        return None
    finally:
        c.close()


def get_player_id_from_name_and_season(player_name, season):
    """Resolve data.db player_id: try players table (player_url) first, then batters table."""
    pid = get_player_id_from_players_table(player_name, season)
    if pid:
        return pid
    c = _conn()
    if not c:
        return None
    try:
        rows = c.execute("SELECT DISTINCT player_id FROM batters WHERE season = ? AND trim(player) = ? LIMIT 1", (season, (player_name or "").strip())).fetchall()
        if rows:
            return str(rows[0][0])
        parts = (player_name or "").strip().split()
        if len(parts) >= 2:
            rev = f"{parts[-1]}, {' '.join(parts[:-1])}"
            rows = c.execute("SELECT DISTINCT player_id FROM batters WHERE season = ? AND trim(player) = ? LIMIT 1", (season, rev)).fetchall()
            if rows:
                return str(rows[0][0])
        return None
    finally:
        c.close()


_ALL_TARGET_STATS = ["HR", "H", "RBI", "SB", "R", "BB"]


def get_random_target_from_season(season, n_players=8, seed=None):
    """
    Randomly select n_players from the season's batter stats (each with AB >= 100), sum their stats, return target line.
    Randomly picks 3-4 stat categories each day so the target varies (not always HR+H+RBI+SB).
    Returns (target_dict, label) e.g. ({"HR": 45, "RBI": 180, "SB": 42}, "8 random players").
    """
    stats_map = get_batter_season_stats()
    # Only player-seasons with at least 100 AB
    candidates = [
        (k, v) for k, v in stats_map.items()
        if k[1] == season and (v.get("AB") or 0) >= 100
    ]
    if len(candidates) < n_players:
        n_players = max(1, len(candidates))
    if not candidates:
        return None, None
    if seed is not None:
        random.seed(seed)
    chosen = random.sample(candidates, min(n_players, len(candidates)))
    # Randomly pick 3-4 stats (seeded so same each day)
    n_stats = random.randint(3, 4)
    chosen_stats = random.sample(_ALL_TARGET_STATS, n_stats)
    if seed is not None:
        random.seed()
    target = {stat: 0 for stat in chosen_stats}
    for (_, _), s in chosen:
        for stat in chosen_stats:
            target[stat] += s.get(stat, 0) or 0
    return target, "Today's Combined Line"


def get_season_stats_by_roster_name(season):
    """
    Season-specific stats keyed by roster_player_name (First Last format from players table).
    Returns dict: name.lower() -> { H, HR, RBI, SB, BB, R } for the given season.
    """
    c = _conn()
    if not c:
        return {}
    try:
        rows = c.execute("""
            SELECT DISTINCT roster_player_name, player_url
            FROM players
            WHERE season = ? AND roster_player_name IS NOT NULL AND trim(roster_player_name) != ''
              AND player_url IS NOT NULL AND player_url LIKE '%playerid=%'
        """, (season,)).fetchall()
        import re as _re
        name_to_pid = {}
        for roster_name, player_url in rows:
            m = _re.search(r"playerid=(\d+)", player_url, _re.IGNORECASE)
            if m:
                name_to_pid[roster_name.strip().lower()] = m.group(1)
        if not name_to_pid:
            return {}
        batter_rows = c.execute("""
            SELECT player_id,
                   SUM(CAST(NULLIF(trim(h), '') AS REAL)),
                   SUM(CAST(NULLIF(trim(hr), '') AS REAL)),
                   SUM(CAST(NULLIF(trim(rbi), '') AS REAL)),
                   SUM(CAST(NULLIF(trim(sb), '') AS REAL)),
                   SUM(CAST(NULLIF(trim(bb), '') AS REAL)),
                   SUM(CAST(NULLIF(trim(r), '') AS REAL))
            FROM batters WHERE log_type = 'batting' AND season = ? AND player_id IS NOT NULL AND trim(player_id) != ''
            GROUP BY player_id
        """, (season,)).fetchall()
        pid_to_stats = {}
        for row in batter_rows:
            pid = str(row[0])
            pid_to_stats[pid] = {
                "H": _safe_int(row[1]), "HR": _safe_int(row[2]), "RBI": _safe_int(row[3]),
                "SB": _safe_int(row[4]), "BB": _safe_int(row[5]), "R": _safe_int(row[6]),
            }
        return {name: pid_to_stats[pid] for name, pid in name_to_pid.items() if pid in pid_to_stats}
    finally:
        c.close()


def get_all_historical_player_teams(regular_only=True):
    """
    Returns dict: {player_id (str) -> set of team names} from batters table.
    Covers all ALPB regular seasons when regular_only=True.
    """
    c = _conn()
    if not c:
        return {}
    try:
        if regular_only:
            rows = c.execute("""
                SELECT DISTINCT player_id, team, season FROM batters
                WHERE player_id IS NOT NULL AND trim(player_id) != ''
                  AND team IS NOT NULL AND trim(team) != ''
                  AND season IS NOT NULL
            """).fetchall()
        else:
            rows = c.execute("""
                SELECT DISTINCT player_id, team, season FROM batters
                WHERE player_id IS NOT NULL AND trim(player_id) != ''
                  AND team IS NOT NULL AND trim(team) != ''
            """).fetchall()
        this_year = datetime.now().year
        out = {}
        for player_id, team, season in rows:
            if regular_only:
                s = (season or "").strip().upper()
                y = _year_from_season(season)
                if not (s.startswith("ALPB") and "TRAINING" not in s
                        and "PLAYOFF" not in s and y and y <= this_year):
                    continue
            pid = str(player_id)
            if pid not in out:
                out[pid] = set()
            out[pid].add(team)
        return out
    finally:
        c.close()


def get_player_name_by_id(player_id):
    """Return the most common/recent player name for a data.db player_id."""
    c = _conn()
    if not c:
        return None
    try:
        pid = str(player_id)
        # Try players table first (has clean roster names)
        rows = c.execute("""
            SELECT roster_player_name FROM players
            WHERE player_url LIKE ? AND roster_player_name IS NOT NULL
            ORDER BY season DESC LIMIT 1
        """, (f"%playerid={pid}%",)).fetchall()
        if rows and rows[0][0]:
            return rows[0][0].strip()
        # Fallback to batters table
        rows = c.execute("""
            SELECT player FROM batters WHERE player_id = ? AND player IS NOT NULL LIMIT 1
        """, (pid,)).fetchall()
        return rows[0][0].strip() if rows else None
    finally:
        c.close()


def get_historical_player_positions():
    """
    Returns {player_id (str): position (str)} from data.db players table.
    Uses roster_position or profile_position, prefers latest season.
    """
    c = _conn()
    if not c:
        return {}
    try:
        rows = c.execute("""
            SELECT p.player_url, p.roster_position, p.profile_position, p.season
            FROM players p
            WHERE p.player_url IS NOT NULL AND p.player_url LIKE '%playerid=%'
            ORDER BY p.season DESC
        """).fetchall()
        import re as _re
        out = {}
        for player_url, roster_pos, profile_pos, season in rows:
            m = _re.search(r"playerid=(\d+)", player_url, _re.IGNORECASE)
            if not m:
                continue
            pid = m.group(1)
            if pid in out:
                continue  # already set from a later season
            pos = (roster_pos or profile_pos or "").strip()
            if pos:
                # Normalize common position strings
                pos = pos.upper().split("/")[0].strip()
                out[pid] = pos
        return out
    finally:
        c.close()


def get_all_batter_player_ids_by_season():
    """
    Returns dict: {(player_id, season) -> player_name} for all ALPB regular-season batters.
    """
    c = _conn()
    if not c:
        return {}
    try:
        rows = c.execute("""
            SELECT DISTINCT player_id, season, player FROM batters
            WHERE player_id IS NOT NULL AND trim(player_id) != ''
              AND season IS NOT NULL AND log_type = 'batting'
        """).fetchall()
        this_year = datetime.now().year
        out = {}
        for player_id, season, player_name in rows:
            s = (season or "").strip().upper()
            y = _year_from_season(season)
            if not (s.startswith("ALPB") and "TRAINING" not in s
                    and "PLAYOFF" not in s and y and y <= this_year):
                continue
            key = (str(player_id), season)
            if key not in out and player_name:
                out[key] = player_name.strip()
        return out
    finally:
        c.close()


def search_batter_seasons_by_name(q, min_ab=100):
    """
    Search batter season stats by player name (case-insensitive). Only returns (player_id, season) with AB >= min_ab.
    Returns list of dicts: { player_id, player_name, season, stats } where stats has HR, H, RBI, SB, etc.
    """
    if not q or len(q.strip()) < 2:
        return []
    stats_map = get_batter_season_stats()
    q_lower = q.strip().lower()
    out = []
    for (player_id, season), v in stats_map.items():
        if (v.get("AB") or 0) < min_ab:
            continue
        name = (v.get("player_name") or "").strip()
        if q_lower not in name.lower():
            continue
        out.append({
            "player_id": player_id,
            "player_name": name,
            "season": season,
            "stats": {
                "HR": v.get("HR", 0),
                "H": v.get("H", 0),
                "RBI": v.get("RBI", 0),
                "SB": v.get("SB", 0),
                "R": v.get("R", 0),
                "BB": v.get("BB", 0),
                "AB": v.get("AB", 0),
            },
        })
    # Sort by season desc, then name
    out.sort(key=lambda x: (x["season"] or "", x["player_name"] or ""), reverse=True)
    return out[:50]
