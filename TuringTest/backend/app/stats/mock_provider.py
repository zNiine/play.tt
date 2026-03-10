import random
from datetime import date
from typing import List, Dict, Optional
from .provider import StatsProvider

MOCK_TEAMS = [
    {"id": "HBG", "name": "Harrisburg Senators"},
    {"id": "ALT", "name": "Altoona Curve"},
    {"id": "ERE", "name": "Erie SeaWolves"},
    {"id": "BGM", "name": "Binghamton Rumble Ponies"},
    {"id": "BOW", "name": "Bowie Baysox"},
    {"id": "HFD", "name": "Hartford Yard Goats"},
]

MOCK_PLAYERS = [
    {"id": "P001", "name": "Marcus Johnson", "position": "CF", "team": "HBG"},
    {"id": "P002", "name": "Tyler Rodriguez", "position": "1B", "team": "HBG"},
    {"id": "P003", "name": "Derek Williams", "position": "P", "team": "HBG"},
    {"id": "P004", "name": "Sam Chen", "position": "SS", "team": "ALT"},
    {"id": "P005", "name": "Jake Thompson", "position": "2B", "team": "ALT"},
    {"id": "P006", "name": "Alex Rivera", "position": "P", "team": "ALT"},
    {"id": "P007", "name": "Chris Martinez", "position": "RF", "team": "ERE"},
    {"id": "P008", "name": "Kevin Lee", "position": "3B", "team": "ERE"},
    {"id": "P009", "name": "Ryan Park", "position": "P", "team": "ERE"},
    {"id": "P010", "name": "Josh Davis", "position": "C", "team": "BGM"},
    {"id": "P011", "name": "Dante Brooks", "position": "LF", "team": "BGM"},
    {"id": "P012", "name": "Mike Torres", "position": "P", "team": "BGM"},
]


class MockStatsProvider(StatsProvider):
    def get_games(self, game_date: date) -> List[Dict]:
        return [
            {
                "external_id": f"GAME_{game_date}_001",
                "home_team": "HBG",
                "away_team": "ALT",
                "start_time": f"{game_date}T19:05:00",
                "status": "scheduled",
            },
            {
                "external_id": f"GAME_{game_date}_002",
                "home_team": "ERE",
                "away_team": "BGM",
                "start_time": f"{game_date}T19:05:00",
                "status": "scheduled",
            },
        ]

    def get_game_status(self, game_id: str) -> str:
        return random.choice(["scheduled", "live", "final"])

    def get_player_game_stats(self, game_id: str) -> List[Dict]:
        stats = []
        for p in MOCK_PLAYERS:
            if p["position"] == "P":
                stats.append({
                    "player_id": p["id"],
                    "position": "P",
                    "IP": round(random.uniform(4, 7), 1),
                    "K": random.randint(2, 10),
                    "ER": random.randint(0, 4),
                    "W": random.randint(0, 1),
                })
            else:
                ab = random.randint(2, 5)
                hits = random.randint(0, ab)
                singles = random.randint(0, hits)
                doubles = random.randint(0, max(0, hits - singles))
                hr = random.randint(0, max(0, hits - singles - doubles))
                stats.append({
                    "player_id": p["id"],
                    "position": p["position"],
                    "AB": ab, "H": hits, "1B": singles, "2B": doubles, "HR": hr,
                    "BB": random.randint(0, 2),
                    "R": random.randint(0, 2),
                    "RBI": random.randint(0, 3),
                    "SB": random.randint(0, 1),
                    "CS": 0,
                })
        return stats

    def get_rosters(self, game_date: date) -> List[Dict]:
        return MOCK_PLAYERS

    def get_confirmed_lineups(self, game_id: str) -> Optional[Dict]:
        if random.random() > 0.4:
            return {
                "home": [
                    {"player_id": "P001", "batting_order": 1, "position": "CF"},
                    {"player_id": "P002", "batting_order": 2, "position": "1B"},
                    {"player_id": "P003", "batting_order": None, "position": "SP"},
                ],
                "away": [
                    {"player_id": "P004", "batting_order": 1, "position": "SS"},
                    {"player_id": "P005", "batting_order": 2, "position": "2B"},
                    {"player_id": "P006", "batting_order": None, "position": "SP"},
                ],
            }
        return None
