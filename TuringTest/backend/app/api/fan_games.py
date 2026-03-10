"""
Fan Games API blueprint.

Routes:
  GET  /api/fan-games/grid/today
  POST /api/fan-games/grid/guess
  GET  /api/fan-games/grid/result
  GET  /api/fan-games/grid/leaderboard
  GET  /api/fan-games/grid/answers

  GET  /api/fan-games/guess/today
  POST /api/fan-games/guess/submit
  GET  /api/fan-games/guess/result
  GET  /api/fan-games/guess/leaderboard

  GET  /api/fan-games/target/today
  GET  /api/fan-games/target/players
  POST /api/fan-games/target/submit
  GET  /api/fan-games/target/result
  GET  /api/fan-games/target/leaderboard

  GET  /api/fan-games/higher-lower/pair
  POST /api/fan-games/higher-lower/answer
  POST /api/fan-games/higher-lower/score
  GET  /api/fan-games/higher-lower/leaderboard

  GET  /api/fan-games/players/search
"""
import json
from datetime import datetime, timezone, date
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from sqlalchemy import desc

from ..extensions import db
from ..models import Player, Team
from ..models.fan_games import DailyChallenge, FanGameResult, HigherLowerScore
from ..services.fan_games_service import (
    generate_grid_challenge, validate_grid_answer,
    generate_guess_challenge, get_guess_feedback,
    generate_target_challenge, score_target_submission, get_player_career_stats,
    get_higher_lower_pair, get_available_regular_seasons,
    generate_connections_challenge,
    generate_roster_challenge,
    generate_journey_challenge,
)

fan_games_bp = Blueprint("fan_games", __name__)


def _today():
    """Return current 'baseball day' date (rolls over at 4 AM UTC)."""
    now = datetime.now(timezone.utc)
    # If before 4 AM, treat as previous day's challenge
    if now.hour < 4:
        from datetime import timedelta
        return (now - timedelta(days=1)).date()
    return now.date()


def _get_or_create_challenge(game_type: str, gen_fn):
    """Get today's challenge for game_type, generating if missing. Returns (challenge, error)."""
    today = _today()
    challenge = DailyChallenge.query.filter_by(date=today, game_type=game_type).first()
    if not challenge:
        try:
            data = gen_fn(today)
            challenge = DailyChallenge(date=today, game_type=game_type, challenge_data=data)
            db.session.add(challenge)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            return None, str(e)
    return challenge, None


def _optional_user():
    """Return user_id if JWT present, else None."""
    try:
        verify_jwt_in_request(optional=True)
        return get_jwt_identity()
    except Exception:
        return None


def _get_result(user_id, challenge_id):
    if not user_id:
        return None
    return FanGameResult.query.filter_by(user_id=user_id, challenge_id=challenge_id).first()


# ─────────────────────────────────────────────────────────────────────────────
# Shared: Player search
# ─────────────────────────────────────────────────────────────────────────────

@fan_games_bp.route("/players/search", methods=["GET"])
def player_search():
    q = request.args.get("q", "").strip()
    if len(q) < 2:
        return jsonify([])
    players = (
        Player.query
        .filter(Player.full_name.ilike(f"%{q}%"))
        .filter_by(active=True)
        .limit(20)
        .all()
    )
    return jsonify([
        {
            "id": p.id,
            "full_name": p.full_name,
            "position": p.primary_position,
            "team": p.team.team_code if p.team else None,
            "team_name": p.team.team_name if p.team else None,
        }
        for p in players
    ])


# ─────────────────────────────────────────────────────────────────────────────
# Immaculate Grid
# ─────────────────────────────────────────────────────────────────────────────

@fan_games_bp.route("/grid/today", methods=["GET"])
def grid_today():
    from ..services.fan_games_service import get_grid_pick_pct
    challenge, err = _get_or_create_challenge("grid", generate_grid_challenge)
    if err:
        return jsonify({"error": "Could not generate today's grid", "detail": err}), 503
    user_id = _optional_user()
    result = _get_result(user_id, challenge.id)
    payload = {
        "challenge": challenge.to_dict(include_answers=False),
        "result": result.to_dict() if result else None,
        "today": _today().isoformat(),
    }
    if result and result.completed:
        payload["pick_pct"] = get_grid_pick_pct(challenge.id, result)
    return jsonify(payload)


@fan_games_bp.route("/grid/guess", methods=["POST"])
@jwt_required()
def grid_guess():
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    row = data.get("row")
    col = data.get("col")
    player_id = data.get("player_id")

    if row is None or col is None or player_id is None:
        return jsonify({"error": "row, col, and player_id required"}), 400

    challenge, err = _get_or_create_challenge("grid", generate_grid_challenge)
    if err:
        return jsonify({"error": "Could not load grid challenge", "detail": err}), 503
    cdata = challenge.challenge_data

    # Load or create result
    result = _get_result(user_id, challenge.id)
    if not result:
        result = FanGameResult(
            user_id=user_id,
            challenge_id=challenge.id,
            result_data={"picks": {}, "misses": 0, "correct": 0},
            score=0.0,
            completed=False,
        )
        db.session.add(result)

    rdata = result.result_data
    if result.completed:
        return jsonify({"error": "Game already complete"}), 400

    cell_key = f"{row},{col}"
    max_misses = cdata.get("max_misses", 9)

    # Check if cell already filled
    if cell_key in rdata.get("picks", {}) and rdata["picks"][cell_key].get("correct"):
        return jsonify({"error": "Cell already filled"}), 400

    valid = validate_grid_answer(cdata, int(row), int(col), int(player_id))

    # Fetch player info for response
    player = Player.query.get(player_id)
    player_info = {
        "id": player.id,
        "full_name": player.full_name,
        "position": player.primary_position,
        "team": player.team.team_code if player.team else None,
    } if player else {"id": player_id}

    picks = rdata.get("picks", {})
    misses = rdata.get("misses", 0)
    correct_count = rdata.get("correct", 0)

    if valid:
        picks[cell_key] = {"player_id": player_id, "player": player_info, "correct": True}
        correct_count += 1
    else:
        picks[cell_key] = picks.get(cell_key, {})  # keep previous if exists
        misses += 1

    total_cells = len(cdata.get("rows", [])) * len(cdata.get("cols", []))
    completed = correct_count == total_cells or misses >= max_misses

    result.result_data = {
        "picks": picks,
        "misses": misses,
        "correct": correct_count,
    }
    result.score = float(correct_count) * 10 - float(misses)
    result.completed = completed

    db.session.commit()

    return jsonify({
        "valid": valid,
        "player": player_info,
        "misses": misses,
        "correct": correct_count,
        "completed": completed,
        "result_data": result.result_data,
    })


@fan_games_bp.route("/grid/result", methods=["GET"])
@jwt_required()
def grid_result():
    user_id = get_jwt_identity()
    challenge, err = _get_or_create_challenge("grid", generate_grid_challenge)
    if err:
        return jsonify({"error": "Could not load grid challenge", "detail": err}), 503
    result = _get_result(user_id, challenge.id)
    return jsonify({
        "result": result.to_dict() if result else None,
        "challenge": challenge.to_dict(include_answers=False),
    })


@fan_games_bp.route("/grid/answers", methods=["GET"])
def grid_answers():
    """Reveal valid answers for completed games (or after game ends). Include pick_pct."""
    from ..services.fan_games_service import get_grid_pick_pct
    challenge, err = _get_or_create_challenge("grid", generate_grid_challenge)
    if err:
        return jsonify({"error": "Could not load grid challenge", "detail": err}), 503
    user_id = _optional_user()
    result = _get_result(user_id, challenge.id)

    # Only reveal if user completed their game
    if not result or not result.completed:
        return jsonify({"error": "Complete the game first"}), 403

    # Build answer display (player names for each cell)
    cdata = challenge.challenge_data
    valid_answers = cdata.get("valid_answers", {})
    answer_display = {}
    for cell_key, player_ids in valid_answers.items():
        names = []
        for pid in player_ids[:5]:  # show up to 5 examples
            p = Player.query.get(pid)
            if p:
                names.append(p.full_name)
        answer_display[cell_key] = names

    payload = {
        "rows": cdata.get("rows", []),
        "cols": cdata.get("cols", []),
        "row_labels": cdata.get("row_labels", {}),
        "col_labels": cdata.get("col_labels", {}),
        "answers": answer_display,
        "pick_pct": get_grid_pick_pct(challenge.id, result),
    }
    return jsonify(payload)


@fan_games_bp.route("/grid/leaderboard", methods=["GET"])
def grid_leaderboard():
    challenge, err = _get_or_create_challenge("grid", generate_grid_challenge)
    if err:
        return jsonify({"error": "Could not load grid challenge", "detail": err}), 503
    results = (
        FanGameResult.query
        .filter_by(challenge_id=challenge.id, completed=True)
        .order_by(desc(FanGameResult.score), FanGameResult.updated_at)
        .limit(50)
        .all()
    )
    board = []
    for rank, r in enumerate(results, 1):
        user = r.user
        rdata = r.result_data
        board.append({
            "rank": rank,
            "user_id": r.user_id,
            "display_name": user.display_name if user else "Unknown",
            "correct": rdata.get("correct", 0),
            "misses": rdata.get("misses", 0),
            "score": r.score,
        })
    return jsonify(board)


# ─────────────────────────────────────────────────────────────────────────────
# Guess the Player
# ─────────────────────────────────────────────────────────────────────────────

@fan_games_bp.route("/guess/today", methods=["GET"])
def guess_today():
    challenge, err = _get_or_create_challenge("guess", generate_guess_challenge)
    if err:
        return jsonify({"error": "Could not generate today's puzzle", "detail": err}), 503
    user_id = _optional_user()
    result = _get_result(user_id, challenge.id)

    cdata = challenge.challenge_data

    return jsonify({
        "challenge": {
            "id": challenge.id,
            "date": challenge.date.isoformat(),
            "max_guesses": cdata.get("max_guesses", 8),
        },
        "result": result.to_dict() if result else None,
        "today": _today().isoformat(),
    })


@fan_games_bp.route("/guess/submit", methods=["POST"])
@jwt_required()
def guess_submit():
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    player_id = data.get("player_id")

    if player_id is None or player_id == "":
        return jsonify({"error": "player_id required"}), 400
    try:
        pid = int(player_id)
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid player_id"}), 400

    challenge, err = _get_or_create_challenge("guess", generate_guess_challenge)
    if err:
        return jsonify({"error": "Could not load puzzle", "detail": err}), 503
    cdata = challenge.challenge_data
    max_guesses = cdata.get("max_guesses", 8)

    result = _get_result(user_id, challenge.id)
    if not result:
        result = FanGameResult(
            user_id=user_id,
            challenge_id=challenge.id,
            result_data={"guesses": [], "solved": False},
            score=0.0,
            completed=False,
        )
        db.session.add(result)

    rdata = result.result_data
    if result.completed:
        return jsonify({"error": "Game already complete"}), 400

    guesses = rdata.get("guesses", [])
    if len(guesses) >= max_guesses:
        result.completed = True
        db.session.commit()
        return jsonify({"error": "No guesses remaining"}), 400

    try:
        feedback = get_guess_feedback(cdata, pid)
    except Exception as e:
        return jsonify({"error": "Error processing guess", "detail": str(e)}), 500
    if feedback is None:
        return jsonify({"error": "Player not found"}), 404

    guesses.append(feedback)
    solved = feedback["correct"]
    guesses_used = len(guesses)
    completed = solved or guesses_used >= max_guesses

    # Score: more points for solving in fewer guesses
    score = 0.0
    if solved:
        score = max(10.0, 100.0 - (guesses_used - 1) * 12.0)

    result.result_data = {"guesses": guesses, "solved": solved}
    result.score = score
    result.completed = completed

    db.session.commit()

    response = {
        "feedback": feedback,
        "guesses_used": guesses_used,
        "guesses_remaining": max_guesses - guesses_used,
        "solved": solved,
        "completed": completed,
    }

    if completed:
        response["answer"] = {
            "player_id": cdata["player_id"],
            "player_name": cdata["player_name"],
            "clue": cdata["clue"],
        }

    return jsonify(response)


@fan_games_bp.route("/guess/result", methods=["GET"])
@jwt_required()
def guess_result():
    user_id = get_jwt_identity()
    challenge, err = _get_or_create_challenge("guess", generate_guess_challenge)
    if err:
        return jsonify({"error": "Could not load puzzle", "detail": err}), 503
    result = _get_result(user_id, challenge.id)
    cdata = challenge.challenge_data

    resp = {"result": result.to_dict() if result else None}
    if result and result.completed:
        resp["answer"] = {
            "player_id": cdata["player_id"],
            "player_name": cdata["player_name"],
        }
    return jsonify(resp)


@fan_games_bp.route("/guess/leaderboard", methods=["GET"])
def guess_leaderboard():
    challenge, err = _get_or_create_challenge("guess", generate_guess_challenge)
    if err:
        return jsonify({"error": "Could not load puzzle", "detail": err}), 503
    results = (
        FanGameResult.query
        .filter_by(challenge_id=challenge.id, completed=True)
        .order_by(desc(FanGameResult.score), FanGameResult.updated_at)
        .limit(50)
        .all()
    )
    board = []
    for rank, r in enumerate(results, 1):
        user = r.user
        rdata = r.result_data
        board.append({
            "rank": rank,
            "user_id": r.user_id,
            "display_name": user.display_name if user else "Unknown",
            "solved": rdata.get("solved", False),
            "guesses_used": len(rdata.get("guesses", [])),
            "score": r.score,
        })
    return jsonify(board)


# ─────────────────────────────────────────────────────────────────────────────
# Target Line Challenge
# ─────────────────────────────────────────────────────────────────────────────

@fan_games_bp.route("/target/today", methods=["GET"])
def target_today():
    challenge, err = _get_or_create_challenge("target", generate_target_challenge)
    if err:
        return jsonify({"error": "Could not generate today's challenge", "detail": err}), 503
    user_id = _optional_user()
    result = _get_result(user_id, challenge.id)
    return jsonify({
        "challenge": challenge.to_dict(include_answers=False),
        "result": result.to_dict() if result else None,
        "today": _today().isoformat(),
    })


@fan_games_bp.route("/target/players", methods=["GET"])
def target_players():
    """Search players for Target Line. Returns one option per (player, season) from data.db (AB>=100). User picks which season per player."""
    q = request.args.get("q", "").strip()
    if q and len(q) >= 2:
        try:
            from ..services.data_db import search_batter_seasons_by_name
            data_results = search_batter_seasons_by_name(q, min_ab=100)
            if data_results:
                result = []
                for row in data_results:
                    result.append({
                        "id": row["player_id"],
                        "full_name": row["player_name"],
                        "position": "",
                        "team": None,
                        "team_name": "",
                        "season": row["season"],
                        "stats": row.get("stats") or {},
                    })
                return jsonify(result)
        except Exception:
            pass
    # Fallback: app Player search with latest season
    from ..services.fan_games_service import get_player_season_stats_from_data_db
    today = _today()
    challenge = DailyChallenge.query.filter_by(date=today, game_type="target").first()
    season = None
    if challenge and challenge.challenge_data:
        season = challenge.challenge_data.get("season")
    if not season:
        try:
            from ..services.data_db import get_latest_season
            season = get_latest_season()
        except Exception:
            pass
    players = Player.query.filter_by(active=True)
    if q and len(q) >= 2:
        players = players.filter(Player.full_name.ilike(f"%{q}%"))
    players = players.limit(30).all()
    result = []
    for p in players:
        stats = None
        if season:
            stats = get_player_season_stats_from_data_db(p.id, season)
        if not stats:
            stats = get_player_career_stats(p.id)
        else:
            stats = {k: (int(v) if isinstance(v, (int, float)) else v) for k, v in stats.items() if k in ("HR", "H", "RBI", "SB", "R", "BB", "AB", "AVG", "OBP")}
        result.append({
            "id": p.id,
            "full_name": p.full_name,
            "position": p.primary_position,
            "team": p.team.team_code if p.team else None,
            "team_name": p.team.team_name if p.team else None,
            "season": season,  # None when data.db unavailable; frontend omits "(season)" label
            "stats": stats if isinstance(stats, dict) else {},
        })
    return jsonify(result)


@fan_games_bp.route("/debug/reset-today", methods=["POST"])
def debug_reset_today():
    """Delete today's challenges so they regenerate on next request. Dev/debug use only."""
    today = _today()
    challenges = DailyChallenge.query.filter_by(date=today).all()
    challenge_ids = [c.id for c in challenges]
    # Delete results first to satisfy FK constraint
    results_deleted = 0
    if challenge_ids:
        results_deleted = FanGameResult.query.filter(FanGameResult.challenge_id.in_(challenge_ids)).delete(synchronize_session=False)
    deleted = DailyChallenge.query.filter_by(date=today).delete(synchronize_session=False)
    db.session.commit()
    return jsonify({"deleted": deleted, "results_deleted": results_deleted, "date": today.isoformat()})


@fan_games_bp.route("/debug/status", methods=["GET"])
def debug_status():
    """Quick health check: player counts, data.db availability, today's challenges."""
    from ..services.data_db import get_latest_season, get_available_seasons
    try:
        latest_season = get_latest_season()
        seasons = get_available_seasons()
    except Exception as e:
        latest_season = None
        seasons = []
    active_players = Player.query.filter_by(active=True).count()
    all_players = Player.query.count()
    from ..models import Team
    teams = Team.query.count()
    today = _today()
    challenges = {
        c.game_type: {"id": c.id, "created_at": c.created_at.isoformat() if c.created_at else None}
        for c in DailyChallenge.query.filter_by(date=today).all()
    }
    return jsonify({
        "date": today.isoformat(),
        "active_players": active_players,
        "all_players": all_players,
        "teams": teams,
        "data_db": {"latest_season": latest_season, "available_seasons": seasons[:5]},
        "todays_challenges": challenges,
    })


@fan_games_bp.route("/target/submit", methods=["POST"])
@jwt_required()
def target_submit():
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    player_ids = data.get("player_ids", [])
    player_selections = data.get("player_selections", [])  # [{ player_id, season }] from data.db

    challenge, err = _get_or_create_challenge("target", generate_target_challenge)
    if err:
        return jsonify({"error": "Could not load challenge", "detail": err}), 503
    cdata = challenge.challenge_data
    target = cdata.get("target", {})
    max_players = cdata.get("max_players", 15)

    # Prefer player_selections (data.db player+season) when provided
    if player_selections:
        if len(player_selections) > max_players:
            return jsonify({"error": f"Select 1 to {max_players} players"}), 400
        from ..services.data_db import get_batter_season_stats
        stats_map = get_batter_season_stats()
        selected = []
        for sel in player_selections:
            pid, season = sel.get("player_id"), sel.get("season")
            if not pid or not season:
                continue
            key = (str(pid), str(season))
            s = stats_map.get(key)
            if not s:
                continue
            selected.append({
                "id": pid,
                "full_name": s.get("player_name") or str(pid),
                "position": "",
                "team": None,
                "stats": {k: s.get(k, 0) for k in ("HR", "H", "RBI", "SB", "R", "BB")},
            })
        if not selected:
            return jsonify({"error": "No valid player-seasons found"}), 400
    else:
        if not player_ids or len(player_ids) > max_players:
            return jsonify({"error": f"Select 1 to {max_players} players"}), 400
        from ..services.fan_games_service import get_player_season_stats_from_data_db
        challenge_season = cdata.get("season")
        selected = []
        for pid in player_ids:
            p = Player.query.get(pid)
            if not p:
                return jsonify({"error": f"Player {pid} not found"}), 404
            stats = None
            if challenge_season:
                stats = get_player_season_stats_from_data_db(pid, challenge_season)
            if not stats:
                stats = get_player_career_stats(pid)
            else:
                stats = {k: (int(v) if isinstance(v, (int, float)) else v) for k, v in stats.items() if k in ("HR", "H", "RBI", "SB", "R", "BB")}
            selected.append({
                "id": p.id,
                "full_name": p.full_name,
                "position": p.primary_position,
                "team": p.team.team_code if p.team else None,
                "stats": stats if isinstance(stats, dict) else {},
            })

    result = _get_result(user_id, challenge.id)
    if result and result.completed:
        return jsonify({"error": "Already submitted"}), 400

    score_result = score_target_submission(target, selected)

    if not result:
        result = FanGameResult(
            user_id=user_id,
            challenge_id=challenge.id,
            result_data={},
            score=0.0,
            completed=False,
        )
        db.session.add(result)

    result.result_data = {
        "selected_players": selected,
        "totals": score_result["totals"],
        "target": target,
    }
    result.score = score_result["score"]
    result.completed = True
    db.session.commit()

    return jsonify({
        "score": score_result["score"],
        "totals": score_result["totals"],
        "target": target,
        "selected_players": selected,
    })


@fan_games_bp.route("/target/result", methods=["GET"])
@jwt_required()
def target_result():
    user_id = get_jwt_identity()
    challenge, err = _get_or_create_challenge("target", generate_target_challenge)
    if err:
        return jsonify({"error": "Could not load challenge", "detail": err}), 503
    result = _get_result(user_id, challenge.id)
    return jsonify({"result": result.to_dict() if result else None})


@fan_games_bp.route("/target/leaderboard", methods=["GET"])
def target_leaderboard():
    challenge, err = _get_or_create_challenge("target", generate_target_challenge)
    if err:
        return jsonify({"error": "Could not load challenge", "detail": err}), 503
    results = (
        FanGameResult.query
        .filter_by(challenge_id=challenge.id, completed=True)
        .order_by(desc(FanGameResult.score), FanGameResult.updated_at)
        .limit(50)
        .all()
    )
    board = []
    for rank, r in enumerate(results, 1):
        user = r.user
        rdata = r.result_data
        board.append({
            "rank": rank,
            "user_id": r.user_id,
            "display_name": user.display_name if user else "Unknown",
            "score": r.score,
            "totals": rdata.get("totals", {}),
        })
    return jsonify(board)


# ─────────────────────────────────────────────────────────────────────────────
# Higher or Lower
# ─────────────────────────────────────────────────────────────────────────────

@fan_games_bp.route("/higher-lower/seasons", methods=["GET"])
def higher_lower_seasons():
    """Return available regular ALPB seasons for the season filter."""
    return jsonify(get_available_regular_seasons())


@fan_games_bp.route("/higher-lower/pair", methods=["GET"])
def higher_lower_pair():
    allowed_seasons = request.args.getlist("seasons") or None
    try:
        pair = get_higher_lower_pair(allowed_seasons=allowed_seasons)
    except Exception as e:
        return jsonify({"error": "Could not load pair", "detail": str(e)}), 503
    if not pair:
        return jsonify({"error": "Not enough player data"}), 503
    public_pair = {k: v for k, v in pair.items() if not k.startswith("_")}
    return jsonify(public_pair)


@fan_games_bp.route("/higher-lower/answer", methods=["POST"])
def higher_lower_answer():
    """
    Validate an answer for a higher-lower pair.
    Client sends: player_a_id, player_b_id, stat_key, answer ('higher'|'lower')
    Server re-computes the correct answer from DB.
    """
    data = request.get_json() or {}
    player_a_id = data.get("player_a_id")
    player_b_id = data.get("player_b_id")
    stat_key = data.get("stat_key")
    answer = data.get("answer")  # 'higher' or 'lower'
    season_a = data.get("season_a")
    season_b = data.get("season_b")

    if not all([player_a_id, player_b_id, stat_key, answer]):
        return jsonify({"error": "player_a_id, player_b_id, stat_key, answer required"}), 400

    # Validate using season-specific stats when available, fall back to career
    val_a = val_b = None
    try:
        from ..services.data_db import get_season_stats_by_roster_name
        p_a = Player.query.get(player_a_id)
        p_b_obj = Player.query.get(player_b_id)
        if season_a and p_a:
            s = get_season_stats_by_roster_name(season_a)
            val_a = s.get((p_a.full_name or "").strip().lower(), {}).get(stat_key)
        if season_b and p_b_obj:
            s = get_season_stats_by_roster_name(season_b)
            val_b = s.get((p_b_obj.full_name or "").strip().lower(), {}).get(stat_key)
    except Exception:
        pass

    if val_a is None or val_b is None:
        from ..services.fan_games_service import _higher_lower_agg
        agg = _higher_lower_agg()
        if val_a is None:
            val_a = agg.get(int(player_a_id), {}).get(stat_key, 0)
        if val_b is None:
            val_b = agg.get(int(player_b_id), {}).get(stat_key, 0)

    correct_answer = "higher" if val_b >= val_a else "lower"

    correct = answer.lower() == correct_answer

    p_b = Player.query.get(player_b_id)
    return jsonify({
        "correct": correct,
        "correct_answer": correct_answer,
        "value_b": val_b,
        "player_b": {
            "id": p_b.id,
            "full_name": p_b.full_name,
            "team": p_b.team.team_code if p_b and p_b.team else None,
        } if p_b else None,
    })


@fan_games_bp.route("/higher-lower/score", methods=["POST"])
@jwt_required()
def higher_lower_score():
    """Submit a final streak score."""
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    streak = int(data.get("streak", 0))

    if streak < 0:
        return jsonify({"error": "Invalid streak"}), 400

    score = HigherLowerScore(user_id=user_id, streak=streak)
    db.session.add(score)
    db.session.commit()

    # Return user's best streak
    best = (
        HigherLowerScore.query
        .filter_by(user_id=user_id)
        .order_by(desc(HigherLowerScore.streak))
        .first()
    )
    rank_query = db.session.query(
        db.func.count(db.func.distinct(HigherLowerScore.user_id))
    ).filter(
        HigherLowerScore.streak > (best.streak if best else 0)
    ).scalar()

    return jsonify({
        "streak": streak,
        "best_streak": best.streak if best else streak,
        "rank": (rank_query or 0) + 1,
    })


@fan_games_bp.route("/higher-lower/leaderboard", methods=["GET"])
def higher_lower_leaderboard():
    """All-time best streak per user."""
    subq = (
        db.session.query(
            HigherLowerScore.user_id,
            db.func.max(HigherLowerScore.streak).label("best_streak"),
        )
        .group_by(HigherLowerScore.user_id)
        .subquery()
    )
    rows = (
        db.session.query(subq, HigherLowerScore.user_id)
        .join(HigherLowerScore, HigherLowerScore.user_id == subq.c.user_id)
        .order_by(desc(subq.c.best_streak))
        .limit(50)
        .all()
    )

    # Deduplicate by user
    seen = set()
    board = []
    rank = 1
    for row in rows:
        uid = row.user_id
        if uid in seen:
            continue
        seen.add(uid)
        score_obj = HigherLowerScore.query.filter_by(user_id=uid).order_by(desc(HigherLowerScore.streak)).first()
        user = score_obj.user if score_obj else None
        board.append({
            "rank": rank,
            "user_id": uid,
            "display_name": user.display_name if user else "Unknown",
            "best_streak": row.best_streak,
        })
        rank += 1

    return jsonify(board)

# ─────────────────────────────────────────────────────────────────────────────
# Connections: ALPB Edition
# ─────────────────────────────────────────────────────────────────────────────

@fan_games_bp.route("/connections/today", methods=["GET"])
def connections_today():
    challenge, err = _get_or_create_challenge("connections", generate_connections_challenge)
    if err:
        return jsonify({"error": "Could not generate today's puzzle", "detail": err}), 503
    user_id = _optional_user()
    result = _get_result(user_id, challenge.id)
    return jsonify({
        "challenge": challenge.to_dict(include_answers=False),
        "result": result.to_dict() if result else None,
        "today": _today().isoformat(),
    })


@fan_games_bp.route("/connections/guess", methods=["POST"])
@jwt_required()
def connections_guess():
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    group_id = data.get("group_id")
    submitted_names = data.get("names", [])

    if not group_id or not isinstance(submitted_names, list) or len(submitted_names) != 4:
        return jsonify({"error": "group_id and exactly 4 names required"}), 400

    challenge, err = _get_or_create_challenge("connections", generate_connections_challenge)
    if err:
        return jsonify({"error": "Could not load puzzle", "detail": err}), 503
    cdata = challenge.challenge_data

    result = _get_result(user_id, challenge.id)
    if not result:
        result = FanGameResult(
            user_id=user_id,
            challenge_id=challenge.id,
            result_data={"solved_groups": [], "mistakes": 0},
            score=0.0,
            completed=False,
        )
        db.session.add(result)

    rdata = result.result_data
    if result.completed:
        return jsonify({"error": "Game already complete"}), 400

    mistakes = rdata.get("mistakes", 0)
    solved_groups = rdata.get("solved_groups", [])
    max_mistakes = cdata.get("max_mistakes", 4)
    total_groups = len(cdata.get("groups", []))

    if group_id in solved_groups:
        return jsonify({"error": "Group already solved"}), 400

    from ..services.fan_games_service import validate_connections_group
    correct = validate_connections_group(cdata, group_id, submitted_names)

    if correct:
        solved_groups.append(group_id)
        # Find group meta for response
        group_meta = next((g for g in cdata["groups"] if g["id"] == group_id), {})
        score = len(solved_groups) * 25.0 - mistakes * 5.0
    else:
        mistakes += 1
        group_meta = {}
        score = result.score

    completed = len(solved_groups) == total_groups or mistakes >= max_mistakes

    result.result_data = {"solved_groups": solved_groups, "mistakes": mistakes}
    result.score = max(0.0, score)
    result.completed = completed
    db.session.commit()

    # Build answer reveal for solved group
    reveal = None
    if correct:
        answers = cdata.get("answers", {})
        reveal = answers.get(group_id, {}).get("names", [])

    return jsonify({
        "correct": correct,
        "mistakes": mistakes,
        "solved_groups": solved_groups,
        "completed": completed,
        "group_meta": group_meta,
        "reveal": reveal,
    })


@fan_games_bp.route("/connections/leaderboard", methods=["GET"])
def connections_leaderboard():
    challenge, err = _get_or_create_challenge("connections", generate_connections_challenge)
    if err:
        return jsonify({"error": "Could not load puzzle", "detail": err}), 503
    results = (
        FanGameResult.query
        .filter_by(challenge_id=challenge.id, completed=True)
        .order_by(desc(FanGameResult.score), FanGameResult.updated_at)
        .limit(50).all()
    )
    board = []
    for rank, r in enumerate(results, 1):
        rdata = r.result_data
        board.append({
            "rank": rank,
            "user_id": r.user_id,
            "display_name": r.user.display_name if r.user else "Unknown",
            "solved": len(rdata.get("solved_groups", [])),
            "mistakes": rdata.get("mistakes", 0),
            "score": r.score,
        })
    return jsonify(board)


@fan_games_bp.route("/connections/answers", methods=["GET"])
def connections_answers():
    challenge, err = _get_or_create_challenge("connections", generate_connections_challenge)
    if err:
        return jsonify({"error": "Could not load puzzle", "detail": err}), 503
    user_id = _optional_user()
    result = _get_result(user_id, challenge.id)
    if not result or not result.completed:
        return jsonify({"error": "Complete the game first"}), 403

    cdata = challenge.challenge_data
    full_answers = []
    for g in cdata.get("groups", []):
        ans = cdata.get("answers", {}).get(g["id"], {})
        full_answers.append({
            "id": g["id"],
            "category": g["category"],
            "color": g["color"],
            "difficulty": g["difficulty"],
            "names": ans.get("names", []),
        })
    return jsonify({"groups": full_answers})


@fan_games_bp.route("/connections/giveup", methods=["POST"])
def connections_giveup():
    """Give up on today's connections puzzle. Marks as completed (loss) and reveals all answers."""
    user_id = _optional_user()
    challenge, err = _get_or_create_challenge("connections", generate_connections_challenge)
    if err:
        return jsonify({"error": "Could not load puzzle", "detail": err}), 503

    if user_id:
        result = _get_result(user_id, challenge.id)
        if not result:
            result = FanGameResult(
                user_id=user_id,
                challenge_id=challenge.id,
                result_data={"solved_groups": [], "mistakes": 0},
                score=0.0,
                completed=True,
            )
            db.session.add(result)
        elif not result.completed:
            result.completed = True
            result.score = 0.0
        db.session.commit()

    cdata = challenge.challenge_data
    full_answers = []
    for g in cdata.get("groups", []):
        ans = cdata.get("answers", {}).get(g["id"], {})
        full_answers.append({
            "id": g["id"],
            "category": g["category"],
            "color": g["color"],
            "difficulty": g["difficulty"],
            "names": ans.get("names", []),
        })
    return jsonify({"groups": full_answers, "gave_up": True})


# ─────────────────────────────────────────────────────────────────────────────
# Name the Roster
# ─────────────────────────────────────────────────────────────────────────────

@fan_games_bp.route("/roster/today", methods=["GET"])
def roster_today():
    challenge, err = _get_or_create_challenge("roster", generate_roster_challenge)
    if err:
        return jsonify({"error": "Could not generate today's roster", "detail": err}), 503
    user_id = _optional_user()
    result = _get_result(user_id, challenge.id)
    cdata = challenge.challenge_data
    # Public view hides the roster list; include team + season for "Name the Roster"
    public_cdata = {
        "team_code": cdata["team_code"],
        "team_name": cdata["team_name"],
        "season": cdata.get("season"),
        "player_count": cdata["player_count"],
        "time_limit_seconds": cdata["time_limit_seconds"],
    }
    return jsonify({
        "challenge": {
            "id": challenge.id,
            "date": challenge.date.isoformat(),
            "game_type": challenge.game_type,
            "challenge_data": public_cdata,
        },
        "result": result.to_dict() if result else None,
        "today": _today().isoformat(),
    })


@fan_games_bp.route("/roster/guess", methods=["POST"])
@jwt_required()
def roster_guess():
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    name_guess = data.get("name", "").strip()

    if not name_guess:
        return jsonify({"error": "name required"}), 400

    challenge, err = _get_or_create_challenge("roster", generate_roster_challenge)
    if err:
        return jsonify({"error": "Could not load roster", "detail": err}), 503
    cdata = challenge.challenge_data

    result = _get_result(user_id, challenge.id)
    if not result:
        result = FanGameResult(
            user_id=user_id,
            challenge_id=challenge.id,
            result_data={"found_names": [], "guesses": 0},
            score=0.0,
            completed=False,
        )
        db.session.add(result)

    rdata = result.result_data
    found_names = rdata.get("found_names", [])

    from ..services.fan_games_service import check_roster_guess
    check = check_roster_guess(cdata, name_guess)

    new_find = False
    if check["found"] and check["player_name"] not in found_names:
        found_names.append(check["player_name"])
        new_find = True

    guesses = rdata.get("guesses", 0) + 1
    score = len(found_names) * 10.0

    result.result_data = {"found_names": found_names, "guesses": guesses}
    result.score = score
    db.session.commit()

    return jsonify({
        "found": check["found"] and new_find,
        "already_found": check["found"] and not new_find,
        "player_name": check["player_name"],
        "found_count": len(found_names),
        "found_names": found_names,
    })


@fan_games_bp.route("/roster/complete", methods=["POST"])
@jwt_required()
def roster_complete():
    """Mark the roster game as done, reveal full roster."""
    user_id = get_jwt_identity()
    challenge, err = _get_or_create_challenge("roster", generate_roster_challenge)
    if err:
        return jsonify({"error": "Could not load roster", "detail": err}), 503
    cdata = challenge.challenge_data

    result = _get_result(user_id, challenge.id)
    if result and not result.completed:
        result.completed = True
        db.session.commit()

    return jsonify({
        "full_roster": cdata.get("roster", []),
        "result": result.to_dict() if result else None,
    })


@fan_games_bp.route("/roster/leaderboard", methods=["GET"])
def roster_leaderboard():
    challenge, err = _get_or_create_challenge("roster", generate_roster_challenge)
    if err:
        return jsonify({"error": "Could not load roster", "detail": err}), 503
    results = (
        FanGameResult.query
        .filter_by(challenge_id=challenge.id, completed=True)
        .order_by(desc(FanGameResult.score), FanGameResult.updated_at)
        .limit(50).all()
    )
    board = []
    for rank, r in enumerate(results, 1):
        rdata = r.result_data
        total = challenge.challenge_data.get("player_count", 1)
        board.append({
            "rank": rank,
            "user_id": r.user_id,
            "display_name": r.user.display_name if r.user else "Unknown",
            "found": len(rdata.get("found_names", [])),
            "total": total,
            "score": r.score,
        })
    return jsonify(board)


# ─────────────────────────────────────────────────────────────────────────────
# Franchise Journey
# ─────────────────────────────────────────────────────────────────────────────

@fan_games_bp.route("/journey/today", methods=["GET"])
def journey_today():
    challenge = _get_or_create_challenge("journey", generate_journey_challenge)
    user_id = _optional_user()
    result = _get_result(user_id, challenge.id)
    cdata = challenge.challenge_data

    # Return only clues seen so far (based on user progress), or clue 1 if new
    clues_seen = 1
    if result:
        clues_seen = result.result_data.get("clues_seen", 1)

    public_clues = [c for c in cdata["clues"] if c["number"] <= clues_seen]

    return jsonify({
        "challenge": {
            "id": challenge.id,
            "date": challenge.date.isoformat(),
            "max_clues": cdata["max_clues"],
            "max_guesses": cdata["max_guesses"],
            "clues": public_clues,
        },
        "result": result.to_dict() if result else None,
        "today": _today().isoformat(),
    })


@fan_games_bp.route("/journey/clue", methods=["POST"])
@jwt_required()
def journey_next_clue():
    """Reveal the next clue (costs 1 potential score point)."""
    user_id = get_jwt_identity()
    challenge = _get_or_create_challenge("journey", generate_journey_challenge)
    cdata = challenge.challenge_data

    result = _get_result(user_id, challenge.id)
    if not result:
        result = FanGameResult(
            user_id=user_id,
            challenge_id=challenge.id,
            result_data={"clues_seen": 1, "guesses": [], "solved": False},
            score=0.0,
            completed=False,
        )
        db.session.add(result)

    if result.completed:
        return jsonify({"error": "Game already complete"}), 400

    rdata = result.result_data
    clues_seen = rdata.get("clues_seen", 1)
    max_clues = cdata["max_clues"]

    if clues_seen >= max_clues:
        return jsonify({"error": "All clues already revealed"}), 400

    clues_seen += 1
    result.result_data = {**rdata, "clues_seen": clues_seen}
    db.session.commit()

    new_clue = next((c for c in cdata["clues"] if c["number"] == clues_seen), None)
    return jsonify({"clue": new_clue, "clues_seen": clues_seen})


@fan_games_bp.route("/journey/guess", methods=["POST"])
@jwt_required()
def journey_guess():
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    player_id = data.get("player_id")

    if not player_id:
        return jsonify({"error": "player_id required"}), 400

    challenge = _get_or_create_challenge("journey", generate_journey_challenge)
    cdata = challenge.challenge_data
    max_guesses = cdata.get("max_guesses", 6)

    result = _get_result(user_id, challenge.id)
    if not result:
        result = FanGameResult(
            user_id=user_id,
            challenge_id=challenge.id,
            result_data={"clues_seen": 1, "guesses": [], "solved": False},
            score=0.0,
            completed=False,
        )
        db.session.add(result)

    rdata = result.result_data
    if result.completed:
        return jsonify({"error": "Game already complete"}), 400

    guesses = rdata.get("guesses", [])
    clues_seen = rdata.get("clues_seen", 1)

    if len(guesses) >= max_guesses:
        result.completed = True
        db.session.commit()
        return jsonify({"error": "No guesses remaining"}), 400

    from ..services.fan_games_service import get_journey_feedback
    feedback = get_journey_feedback(cdata, int(player_id))
    if not feedback:
        return jsonify({"error": "Player not found"}), 404

    guesses.append({
        "player": feedback["guessed_player"],
        "correct": feedback["correct"],
    })

    solved = feedback["correct"]
    guesses_used = len(guesses)
    completed = solved or guesses_used >= max_guesses

    # Score: more clues seen = lower score; solved = bonus
    score = 0.0
    if solved:
        score = max(10.0, 100.0 - (clues_seen - 1) * 15.0 - (guesses_used - 1) * 5.0)

    result.result_data = {**rdata, "guesses": guesses, "solved": solved}
    result.score = score
    result.completed = completed
    db.session.commit()

    resp = {
        "feedback": feedback,
        "guesses_used": guesses_used,
        "guesses_remaining": max_guesses - guesses_used,
        "solved": solved,
        "completed": completed,
    }
    if completed:
        resp["answer"] = {
            "player_id": cdata["player_id"],
            "player_name": cdata["player_name"],
        }
    return jsonify(resp)


@fan_games_bp.route("/journey/result", methods=["GET"])
@jwt_required()
def journey_result():
    user_id = get_jwt_identity()
    challenge = _get_or_create_challenge("journey", generate_journey_challenge)
    result = _get_result(user_id, challenge.id)
    cdata = challenge.challenge_data
    resp = {"result": result.to_dict() if result else None}
    if result and result.completed:
        resp["answer"] = {
            "player_id": cdata["player_id"],
            "player_name": cdata["player_name"],
        }
    return jsonify(resp)


@fan_games_bp.route("/journey/leaderboard", methods=["GET"])
def journey_leaderboard():
    challenge = _get_or_create_challenge("journey", generate_journey_challenge)
    results = (
        FanGameResult.query
        .filter_by(challenge_id=challenge.id, completed=True)
        .order_by(desc(FanGameResult.score), FanGameResult.updated_at)
        .limit(50).all()
    )
    board = []
    for rank, r in enumerate(results, 1):
        rdata = r.result_data
        board.append({
            "rank": rank,
            "user_id": r.user_id,
            "display_name": r.user.display_name if r.user else "Unknown",
            "solved": rdata.get("solved", False),
            "clues_used": rdata.get("clues_seen", 1),
            "guesses_used": len(rdata.get("guesses", [])),
            "score": r.score,
        })
    return jsonify(board)
